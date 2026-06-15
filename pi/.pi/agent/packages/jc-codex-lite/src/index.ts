import { getAgentDir, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const CONFIG_PATH = join(getAgentDir(), "jc-codex-lite.json");
const STATUS_KEY = "jc-codex-lite";
const COMMAND_USAGE = "Usage: /codex fast [on|off], /codex usage";
const DEFAULT_CODEX_BASE_URL = "https://chatgpt.com/backend-api";
const JWT_CLAIM_PATH = "https://api.openai.com/auth";

const REQUIRED_TOOLS = ["apply_patch", "view_image", "imagegen"];
const BLOCKED_CODEX_TOOLS = new Set(["exec_command", "write_stdin", "web_run"]);
const EXTENSION_DIR = dirname(fileURLToPath(import.meta.url));

type ToolContent =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string; detail: "high" | "original" };

interface CodexLiteConfig {
  fast: boolean;
}

interface RunToolOptions {
  binary: string;
  args: string[];
  stdin?: string;
  cwd: string;
  env?: NodeJS.ProcessEnv;
  signal?: AbortSignal;
  maxBuffer?: number;
  label?: string;
}

interface RunToolResult {
  stdout: string;
  stderr: string;
  status: number | null;
}

interface ExecutePatchResult {
  changedFiles: string[];
  createdFiles: string[];
  deletedFiles: string[];
  movedFiles: string[];
  fuzz: number;
}

interface ApplyPatchJson {
  status: "success" | "failure";
  error?: string | null;
  result?: ExecutePatchResult;
}

interface ImagegenOutput {
  path: string;
  latest_path?: string;
  images?: Array<{
    path?: string;
    absolute_path?: string;
    latest_path?: string;
    latest_absolute_path?: string;
  }>;
  background?: string;
  quality?: string;
  size?: string;
}

interface CodexUsageWindow {
  usedPercent?: number;
  windowMinutes?: number;
  resetsAt?: number;
}

interface CodexUsageLimit {
  limitId: string;
  limitName?: string;
  primary?: CodexUsageWindow;
  secondary?: CodexUsageWindow;
}

interface CodexUsageSnapshot {
  planType?: string;
  limits: CodexUsageLimit[];
  raw: unknown;
}

function readConfig(): CodexLiteConfig {
  if (!existsSync(CONFIG_PATH)) return { fast: false };
  try {
    const parsed = JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as Partial<CodexLiteConfig>;
    return { fast: parsed.fast === true };
  } catch {
    return { fast: false };
  }
}

function writeConfig(config: CodexLiteConfig): void {
  mkdirSync(dirname(CONFIG_PATH), { recursive: true });
  writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`);
}

function notify(ctx: ExtensionContext, message: string, type: "info" | "warning" | "error" = "info"): void {
  if (ctx.hasUI) ctx.ui.notify(message, type);
  else console.log(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function isOpenAICodexContext(ctx: ExtensionContext): boolean {
  return (ctx.model?.provider ?? "").toLowerCase() === "openai-codex";
}

function withFastServiceTier(payload: unknown, ctx: ExtensionContext, config: CodexLiteConfig): unknown | undefined {
  if (!config.fast || !isOpenAICodexContext(ctx) || !isRecord(payload)) return undefined;
  return { ...payload, service_tier: "priority" };
}

function sameTools(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((tool, index) => tool === b[index]);
}

function syncTools(pi: ExtensionAPI, ctx?: ExtensionContext, config: CodexLiteConfig = readConfig()): void {
  const activeTools = pi.getActiveTools();
  const nextTools = activeTools.filter((tool) => !BLOCKED_CODEX_TOOLS.has(tool));

  for (const tool of REQUIRED_TOOLS) {
    if (!nextTools.includes(tool)) nextTools.push(tool);
  }

  if (!sameTools(activeTools, nextTools)) pi.setActiveTools(nextTools);
  if (ctx?.hasUI) ctx.ui.setStatus(STATUS_KEY, `Codex lite: patch/image${config.fast ? " • fast" : ""}`);
}

function syncNowAndAfterOtherHandlers(pi: ExtensionAPI, ctx: ExtensionContext, config: CodexLiteConfig): void {
  syncTools(pi, ctx, config);
  queueMicrotask(() => syncTools(pi, ctx, config));
  setTimeout(() => syncTools(pi, ctx, config), 0);
}

function parseFastArg(arg: string, current: boolean): boolean | undefined {
  const parts = arg.split(/\s+/).filter(Boolean);
  if (parts[0] !== "fast") return undefined;
  const mode = parts[1];
  if (!mode || mode === "toggle") return !current;
  if (mode === "on" || mode === "true" || mode === "1") return true;
  if (mode === "off" || mode === "false" || mode === "0") return false;
  return undefined;
}

function toolDir(name: "apply_patch" | "view_image" | "imagegen"): string {
  if (name === "apply_patch") return "apply-patch";
  if (name === "view_image") return "view-image";
  return "imagegen";
}

function toolBinary(name: "apply_patch" | "view_image" | "imagegen"): string {
  const exe = process.platform === "win32" ? `${name}.exe` : name;
  const binary = join(EXTENSION_DIR, "tools", toolDir(name), "bin", `${process.platform}-${process.arch}`, exe);
  if (!existsSync(binary)) throw new Error(`${name} binary is not bundled for ${process.platform}-${process.arch}`);
  return binary;
}

function runTool({ binary, args, stdin, cwd, env, signal, maxBuffer = 64 * 1024 * 1024, label = "tool" }: RunToolOptions): Promise<RunToolResult> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error(`${label} aborted`));
      return;
    }

    let stdout = "";
    let stderr = "";
    let outputBytes = 0;
    let settled = false;
    const child = spawn(binary, args, {
      cwd,
      env: env ?? process.env,
      stdio: [stdin === undefined ? "ignore" : "pipe", "pipe", "pipe"],
    });

    const cleanup = () => signal?.removeEventListener("abort", onAbort);
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn();
    };
    const append = (target: "stdout" | "stderr", chunk: Buffer | string) => {
      const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
      outputBytes += Buffer.byteLength(text, "utf8");
      if (outputBytes > maxBuffer) {
        child.kill();
        finish(() => reject(new Error(`${label} output exceeded ${maxBuffer} bytes`)));
        return;
      }
      if (target === "stdout") stdout += text;
      else stderr += text;
    };
    const onAbort = () => {
      child.kill();
      finish(() => reject(new Error(`${label} aborted`)));
    };

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk) => append("stdout", chunk));
    child.stderr?.on("data", (chunk) => append("stderr", chunk));
    child.on("error", (error) => finish(() => reject(error)));
    child.on("close", (status) => finish(() => resolve({ stdout, stderr, status })));
    signal?.addEventListener("abort", onAbort, { once: true });
    if (stdin !== undefined) child.stdin?.end(stdin);
  });
}

function parseJsonLine<T>(stdout: string, label: string): T {
  const lines = stdout.trimEnd().split("\n");
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index]?.trimStart();
    if (line?.startsWith("{")) return JSON.parse(line) as T;
  }
  throw new Error(`${label} did not return structured JSON output`);
}

function parseApplyPatchParams(params: unknown): { input: string } {
  if (!isRecord(params) || typeof params.input !== "string") throw new Error("apply_patch requires a string 'input' parameter");
  return { input: params.input };
}

function prepareApplyPatchArguments(args: unknown): unknown {
  if (isRecord(args)) {
    if (typeof args.input === "string") return { input: args.input };
    if (typeof args.patchText === "string") return { input: args.patchText };
    if (typeof args.patch === "string") return { input: args.patch };
  }
  return args;
}

function summarizePatch(result: ExecutePatchResult): string {
  return [
    "Applied patch successfully.",
    `Changed files: ${result.changedFiles.length}`,
    `Created files: ${result.createdFiles.length}`,
    `Deleted files: ${result.deletedFiles.length}`,
    `Moved files: ${result.movedFiles.length}`,
    `Fuzz: ${result.fuzz}`,
  ].join("\n");
}

function registerApplyPatchTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "apply_patch",
    label: "apply_patch",
    description: "Patch files.",
    parameters: Type.Object({
      input: Type.String({ description: "Full patch text. Use *** Begin Patch / *** End Patch with Add/Update/Delete File sections." }),
    }),
    prepareArguments: prepareApplyPatchArguments,
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const { input } = parseApplyPatchParams(params);
      const child = await runTool({
        binary: toolBinary("apply_patch"),
        args: [],
        stdin: input,
        cwd: ctx.cwd,
        env: { ...process.env, PI_APPLY_PATCH_JSON: "1" },
        signal,
        label: "apply_patch",
      });
      const parsed = parseJsonLine<ApplyPatchJson>(child.stdout, "apply_patch");
      if (parsed.status === "success" && child.status === 0 && parsed.result) {
        return { content: [{ type: "text", text: summarizePatch(parsed.result) }], details: { status: "success", result: parsed.result } };
      }
      const error = parsed.error ?? (child.stderr.trim() || "apply_patch failed");
      throw new Error(error);
    },
  });
}

function supportsViewImage(model: ExtensionContext["model"]): boolean {
  return Array.isArray(model?.input) && model.input.includes("image");
}

function parseViewImageParams(params: unknown): { path: string } {
  if (!isRecord(params) || typeof params.path !== "string") throw new Error("view_image requires a string 'path' parameter");
  const detail = params.detail;
  if (detail !== undefined && detail !== null && detail !== "original") throw new Error("view_image.detail only supports `original`");
  return { path: params.path };
}

function prepareViewImageArguments(args: unknown): unknown {
  if (!isRecord(args) || typeof args.path === "string") return args;
  if (typeof args.file_path === "string") return { ...args, path: args.file_path };
  if (typeof args.image_path === "string") return { ...args, path: args.image_path };
  return args;
}

function imageContentFromJson(json: string): ToolContent | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return undefined;
  }
  if (!isRecord(parsed)) return undefined;
  const imageUrl = parsed.image_url;
  const detail = parsed.detail;
  if (typeof imageUrl !== "string" || (detail !== "high" && detail !== "original")) return undefined;
  const match = imageUrl.match(/^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return undefined;
  return { type: "image", mimeType: match[1]!, data: match[2]!, detail };
}

function imageContentsFromOutput(output: string): ToolContent[] {
  const trimmed = output.trim();
  if (!trimmed) return [];
  const whole = imageContentFromJson(trimmed);
  if (whole) return [whole];
  return trimmed.split(/\r?\n/).flatMap((line) => {
    const image = imageContentFromJson(line.trim());
    return image ? [image] : [];
  });
}

function registerViewImageTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "view_image",
    label: "view_image",
    description: "View image.",
    parameters: Type.Object({ path: Type.String() }),
    prepareArguments: prepareViewImageArguments,
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      if (!supportsViewImage(ctx.model)) throw new Error("view_image is not allowed because you do not support image inputs");
      const typedParams = parseViewImageParams(params);
      const child = await runTool({
        binary: toolBinary("view_image"),
        args: [JSON.stringify(typedParams)],
        cwd: ctx.cwd,
        signal,
        label: "view_image",
      });
      if (child.status !== 0) throw new Error((child.stderr || child.stdout || "view_image failed").trim());
      const content = imageContentsFromOutput(child.stdout);
      if (!content.length) throw new Error("view_image expected an image file.");
      return { content, details: { pathTool: { viewImage: true } } };
    },
  });
}

function supportsImageInputs(model: ExtensionContext["model"]): boolean {
  return !Array.isArray(model?.input) || model.input.includes("image");
}

function supportsImagegen(model: ExtensionContext["model"]): boolean {
  return (model?.provider ?? "").toLowerCase() === "openai-codex" && Boolean(model?.api?.includes("responses")) && supportsImageInputs(model);
}

function headerValue(headers: Record<string, string> | undefined, name: string): string | undefined {
  if (!headers) return undefined;
  const lowerName = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lowerName) return value;
  }
  return undefined;
}

function extractBearerToken(headers: Headers): string | undefined {
  return headers.get("authorization")?.trim().match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
}

function extractAccountId(token: string | undefined): string | undefined {
  if (!token) return undefined;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return undefined;
    const payload = JSON.parse(Buffer.from(parts[1] ?? "", "base64").toString("utf8")) as unknown;
    const authClaims = isRecord(payload) ? payload[JWT_CLAIM_PATH] : undefined;
    const accountId = isRecord(authClaims) ? authClaims.chatgpt_account_id : undefined;
    return stringValue(accountId);
  } catch {
    return undefined;
  }
}

function resolveCodexApiProviderBaseUrl(modelBaseUrl: string | undefined): string {
  const base = modelBaseUrl?.trim() || DEFAULT_CODEX_BASE_URL;
  const normalized = base.replace(/\/+$/, "");
  try {
    const url = new URL(normalized);
    if (url.pathname === "" || url.pathname === "/") return `${normalized}/api/codex`;
  } catch {}
  if (normalized.endsWith("/codex/responses")) return normalized.slice(0, -"/responses".length);
  if (normalized.endsWith("/codex")) return normalized;
  if (normalized.endsWith("/backend-api") || normalized.endsWith("/api")) return `${normalized}/codex`;
  return normalized;
}

async function codexAuthHeaders(ctx: ExtensionContext): Promise<Headers> {
  if (!ctx.model) throw new Error("No active model selected.");
  const auth = await ctx.modelRegistry.getApiKeyAndHeaders(ctx.model);
  if (!auth.ok) throw new Error(auth.error);
  const headers = new Headers(ctx.model.headers);
  for (const [key, value] of Object.entries(auth.headers ?? {})) headers.set(key, value);
  if (auth.apiKey) headers.set("authorization", `Bearer ${auth.apiKey}`);
  const token = auth.apiKey ?? extractBearerToken(headers);
  const accountId = extractAccountId(token) ?? headerValue(auth.headers, "chatgpt-account-id");
  if (accountId) headers.set("chatgpt-account-id", accountId);
  headers.set("accept", "application/json");
  headers.set("originator", "pi");
  return headers;
}

async function imagegenEnv(ctx: ExtensionContext): Promise<NodeJS.ProcessEnv> {
  const headers = await codexAuthHeaders(ctx);
  const token = extractBearerToken(headers);
  if (!token) throw new Error("imagegen requires an image-capable OpenAI Codex-compatible Responses provider");
  return {
    ...process.env,
    PI_CODEX_ACCESS_TOKEN: token,
    PI_CODEX_ACCOUNT_ID: headers.get("chatgpt-account-id") ?? extractAccountId(token) ?? "",
    PI_CODEX_BASE_URL: resolveCodexApiProviderBaseUrl(ctx.model?.baseUrl),
  };
}

function parseImagegenOutput(output: string): ImagegenOutput {
  const parsed = JSON.parse(output.trim()) as unknown;
  if (!isRecord(parsed) || typeof parsed.path !== "string" || !parsed.path) {
    throw new Error("imagegen returned output, but Pi could not parse it");
  }
  return parsed as ImagegenOutput;
}

function formatImagegenOutput(output: ImagegenOutput): string {
  const lines = [`Generated image: ${output.path}`];
  if (output.latest_path) lines.push(`Latest: ${output.latest_path}`);
  return lines.join("\n");
}

function imageContentsFromImagegen(output: ImagegenOutput): ToolContent[] {
  const images = Array.isArray(output.images) ? output.images : [];
  return images.flatMap((image) => {
    if (typeof image.absolute_path !== "string" || !image.absolute_path) return [];
    try {
      return [{ type: "image" as const, mimeType: "image/png", data: readFileSync(image.absolute_path).toString("base64"), detail: "high" as const }];
    } catch {
      return [];
    }
  });
}

function registerImagegenTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "imagegen",
    label: "imagegen",
    description: "Generate/edit images.",
    parameters: Type.Object({
      prompt: Type.String(),
      action: Type.Optional(Type.Union([Type.Literal("generate"), Type.Literal("edit")], { description: "Default generate." })),
      images: Type.Optional(Type.Array(Type.String(), { description: "Edit inputs." })),
    }),
    prepareArguments: (args) => args,
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      if (!supportsImagegen(ctx.model)) throw new Error("imagegen requires an image-capable OpenAI Codex-compatible Responses provider");
      const child = await runTool({
        binary: toolBinary("imagegen"),
        args: [JSON.stringify({ ...(params as Record<string, unknown>), model: ctx.model?.id, cwd: ctx.cwd })],
        cwd: ctx.cwd,
        env: await imagegenEnv(ctx),
        signal,
        label: "imagegen",
      });
      if (child.status !== 0) throw new Error((child.stderr || child.stdout || "imagegen failed").trim());
      const details = parseImagegenOutput(child.stdout);
      return { content: [{ type: "text", text: formatImagegenOutput(details) }, ...imageContentsFromImagegen(details)], details };
    },
  });
}

function parseWindow(value: unknown): CodexUsageWindow | undefined {
  if (!isRecord(value)) return undefined;
  const usedPercent = numberValue(value.used_percent);
  const limitWindowSeconds = numberValue(value.limit_window_seconds);
  const windowMinutes = numberValue(value.window_minutes) ?? (limitWindowSeconds === undefined ? undefined : Math.ceil(limitWindowSeconds / 60));
  const resetsAt = numberValue(value.resets_at) ?? numberValue(value.reset_at);
  return usedPercent === undefined && windowMinutes === undefined && resetsAt === undefined ? undefined : { usedPercent, windowMinutes, resetsAt };
}

function parseRateLimit(value: unknown): { primary?: CodexUsageWindow; secondary?: CodexUsageWindow } {
  if (!isRecord(value)) return {};
  return {
    primary: parseWindow(value.primary_window) ?? parseWindow(value.primary),
    secondary: parseWindow(value.secondary_window) ?? parseWindow(value.secondary),
  };
}

function parseCodexUsagePayload(payload: unknown): CodexUsageSnapshot {
  const root = isRecord(payload) ? payload : {};
  const limits: CodexUsageLimit[] = [];
  const addLimit = (limitId: string, limitName: string | undefined, source: unknown) => {
    const rateLimit = isRecord(source) && "rate_limit" in source ? source.rate_limit : source;
    const parsed = parseRateLimit(rateLimit);
    limits.push({
      limitId,
      ...(limitName ? { limitName } : {}),
      ...(parsed.primary ? { primary: parsed.primary } : {}),
      ...(parsed.secondary ? { secondary: parsed.secondary } : {}),
    });
  };
  addLimit("codex", undefined, root.rate_limit);
  if (Array.isArray(root.additional_rate_limits)) {
    for (const item of root.additional_rate_limits) {
      if (!isRecord(item)) continue;
      addLimit(stringValue(item.metered_feature) ?? "additional", stringValue(item.limit_name), item);
    }
  }
  return { planType: stringValue(root.plan_type), limits, raw: payload };
}

async function fetchCodexUsage(ctx: ExtensionContext): Promise<CodexUsageSnapshot> {
  if (!ctx.model) throw new Error("No active model selected.");
  if (ctx.model.provider !== "openai-codex") throw new Error("Codex usage is only available for OpenAI Codex subscription models.");
  const response = await fetch(`${DEFAULT_CODEX_BASE_URL}/wham/usage`, {
    method: "GET",
    headers: await codexAuthHeaders(ctx),
    ...(ctx.signal ? { signal: ctx.signal } : {}),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Usage request failed (${response.status}): ${text || response.statusText}`);
  return parseCodexUsagePayload(JSON.parse(text));
}

function formatReset(timestampSeconds: number | undefined): string {
  if (!timestampSeconds) return "reset unknown";
  const ms = timestampSeconds * 1000;
  const minutes = Math.max(0, Math.round((ms - Date.now()) / 60000));
  return minutes < 90 ? `resets in ~${minutes}m` : `resets ${new Date(ms).toLocaleString()}`;
}

function formatWindow(label: string, window: CodexUsageWindow | undefined): string | undefined {
  if (!window) return undefined;
  const remainingPercent = window.usedPercent === undefined ? undefined : 100 - Math.max(0, Math.min(100, window.usedPercent));
  const percent = remainingPercent === undefined ? "?" : `${Math.round(remainingPercent)}%`;
  const span = window.windowMinutes ? `${Math.round(window.windowMinutes)}m` : "window";
  return `${label}: ${percent} left (${span}, ${formatReset(window.resetsAt)})`;
}

function formatCodexUsage(snapshot: CodexUsageSnapshot): string {
  const lines = [`Codex usage${snapshot.planType ? ` (${snapshot.planType})` : ""}:`];
  for (const limit of snapshot.limits) {
    const title = limit.limitName ?? limit.limitId;
    const parts = [formatWindow("5h", limit.primary), formatWindow("weekly", limit.secondary)].filter(Boolean);
    lines.push(`- ${title}: ${parts.length ? parts.join("; ") : "no usage data"}`);
  }
  return lines.join("\n");
}

export default function jcCodexLite(pi: ExtensionAPI): void {
  let cwd = process.cwd();
  let config = readConfig();

  registerApplyPatchTool(pi);
  registerViewImageTool(pi);
  registerImagegenTool(pi);

  pi.registerCommand("codex", {
    description: "Codex lite: fast mode and usage",
    getArgumentCompletions: (prefix) =>
      ["fast", "fast on", "fast off", "usage"]
        .filter((value) => value.startsWith(prefix.trim().toLowerCase()))
        .map((value) => ({ label: value, value })),
    handler: async (args, ctx) => {
      config = readConfig();
      const arg = args.trim().toLowerCase();

      if (arg === "usage") {
        try {
          notify(ctx, formatCodexUsage(await fetchCodexUsage(ctx)), "info");
        } catch (error) {
          notify(ctx, error instanceof Error ? error.message : String(error), "error");
        }
        return;
      }

      const nextFast = parseFastArg(arg, config.fast);
      if (nextFast !== undefined) {
        config = { fast: nextFast };
        writeConfig(config);
        syncTools(pi, ctx, config);
        notify(ctx, `Codex fast mode ${config.fast ? "on" : "off"}.`, "info");
        return;
      }

      notify(ctx, COMMAND_USAGE, arg ? "warning" : "info");
    },
  });

  pi.on("tool_call", (event) => {
    if (!BLOCKED_CODEX_TOOLS.has(event.toolName)) return undefined;
    return {
      block: true,
      reason: `jc-codex-lite blocks ${event.toolName}; only apply_patch, view_image, imagegen, /codex fast, and /codex usage are allowed.`,
    };
  });

  pi.on("session_start", (_event, ctx) => {
    cwd = ctx.cwd;
    config = readConfig();
    syncNowAndAfterOtherHandlers(pi, ctx, config);
    return undefined;
  });

  pi.on("model_select", (_event, ctx) => {
    cwd = ctx.cwd;
    config = readConfig();
    syncNowAndAfterOtherHandlers(pi, ctx, config);
    return undefined;
  });

  pi.on("before_provider_request", (event, ctx) => {
    cwd = ctx.cwd;
    return withFastServiceTier(event.payload, ctx, config);
  });
}
