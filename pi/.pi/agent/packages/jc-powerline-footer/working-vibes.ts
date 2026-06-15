// working-vibes.ts
// Model-generated action descriptions for Pi's working line.

import { complete, type Context } from "@earendil-works/pi-ai";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { sanitizeErrorForLog, sanitizePathForLog } from "./log-sanitizer.ts";

const DEFAULT_MODEL = "openai-codex/gpt-5.4-mini";
const DEFAULT_BASE = "Pondering";
const DEFAULT_ACTION = "thinking...";
const READING_PROMPT_ACTION = "reading prompt...";
type TokenSource = "usage" | "estimate";

const DEFAULT_PROMPT = `Generate one short English action phrase describing what the assistant is doing right now.

Safe action hint: {task}
{exclude}

Rules:
- Write English only.
- Keep it concrete and current-progress, like "calling subagent..." or "checking config...".
- 2-5 words.
- End with "...".
- Do not include file paths, commands, secrets, user names, quotes, bullets, or explanations.
Output only the phrase.`;

const ACTION_SYSTEM_PROMPT = "You write one concise current-action status phrase and nothing else.";

interface VibeConfig {
  enabled: boolean;
  modelSpec: string;
  fallback: string;
  timeout: number;
  refreshInterval: number;
  promptTemplate: string;
  maxLength: number;
}

interface ActionGenContext {
  taskHint: string;
}

let config: VibeConfig = loadConfig();
let extensionCtx: ExtensionContext | null = null;
let currentGeneration: AbortController | null = null;
let isStreaming = false;
let lastVibeTime = 0;
let lastGeneratedHint = "";
let vibeSessionId = 0;
let activeAction = DEFAULT_ACTION;
let activeStartedAt = 0;
let activeTokens = 0;
let activeTokenSource: TokenSource = "estimate";
let activeSetWorkingMessage: ((msg?: string) => void) | null = null;
let activeTicker: ReturnType<typeof setInterval> | null = null;

const MAX_RECENT_ACTIONS = 5;
let recentActions: string[] = [];

function getSettingsPath(): string {
  const homeDir = process.env.HOME || process.env.USERPROFILE || homedir();
  return join(homeDir, ".pi", "agent", "settings.json");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readSettingsForLoad(): Record<string, unknown> {
  const settingsPath = getSettingsPath();
  try {
    if (!existsSync(settingsPath)) return {};
    const parsed = JSON.parse(readFileSync(settingsPath, "utf-8"));
    return isRecord(parsed) ? parsed : {};
  } catch (error) {
    console.debug(`[working-vibes] Failed to load settings from ${sanitizePathForLog(settingsPath)}: ${sanitizeErrorForLog(error)}`);
    return {};
  }
}

function finiteNumberSetting(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readSettingsForWrite(scope: string): Record<string, unknown> | null {
  const settingsPath = getSettingsPath();
  if (!existsSync(settingsPath)) return {};
  try {
    const parsed = JSON.parse(readFileSync(settingsPath, "utf-8"));
    if (!isRecord(parsed)) {
      console.debug(`[working-vibes] Refusing to write ${scope}: settings is not an object`);
      return null;
    }
    return parsed;
  } catch (error) {
    console.debug(`[working-vibes] Failed to parse settings while writing ${scope}: ${sanitizeErrorForLog(error)}`);
    return null;
  }
}

function persistSettings(settings: Record<string, unknown>, scope: string): boolean {
  const settingsPath = getSettingsPath();
  try {
    mkdirSync(dirname(settingsPath), { recursive: true });
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
    return true;
  } catch (error) {
    console.debug(`[working-vibes] Failed to persist ${scope} to ${sanitizePathForLog(settingsPath)}: ${sanitizeErrorForLog(error)}`);
    return false;
  }
}

function loadConfig(): VibeConfig {
  const settings = readSettingsForLoad();
  const rawVibe = typeof settings.workingVibe === "string" ? settings.workingVibe.trim().toLowerCase() : null;
  const explicitEnabled = typeof settings.workingVibeEnabled === "boolean" ? settings.workingVibeEnabled : undefined;
  const enabled = rawVibe ? rawVibe !== "off" : explicitEnabled ?? true;

  const refreshSeconds = Math.max(0, finiteNumberSetting(settings.workingVibeRefreshInterval, 30));
  const maxLength = Math.max(8, Math.floor(finiteNumberSetting(settings.workingVibeMaxLength, 48)));

  return {
    enabled,
    modelSpec: typeof settings.workingVibeModel === "string" ? settings.workingVibeModel : DEFAULT_MODEL,
    fallback: typeof settings.workingVibeFallback === "string" && settings.workingVibeFallback.trim()
      ? settings.workingVibeFallback.trim().replace(/\.+$/, "")
      : DEFAULT_BASE,
    timeout: 3000,
    refreshInterval: refreshSeconds * 1000,
    promptTemplate: typeof settings.workingVibePrompt === "string" ? settings.workingVibePrompt : DEFAULT_PROMPT,
    maxLength,
  };
}

function saveEnabledConfig(): boolean {
  const settings = readSettingsForWrite("workingVibe");
  if (!settings) return false;
  settings.workingVibe = config.enabled ? "action" : "off";
  delete settings.workingVibeEnabled;
  delete settings.workingVibeMode;
  return persistSettings(settings, "workingVibe");
}

function saveModelConfig(): boolean {
  const settings = readSettingsForWrite("workingVibeModel");
  if (!settings) return false;
  if (config.modelSpec === DEFAULT_MODEL) delete settings.workingVibeModel;
  else settings.workingVibeModel = config.modelSpec;
  return persistSettings(settings, "workingVibeModel");
}

function saveConfigValue(key: string, value: string | number, defaultValue: string | number): boolean {
  const settings = readSettingsForWrite(key);
  if (!settings) return false;
  if (value === defaultValue) delete settings[key];
  else settings[key] = value;
  return persistSettings(settings, key);
}

function sanitizeTaskHint(value: string): string {
  return value
    .replace(/\b[A-Za-z_][A-Za-z0-9_]*(?:TOKEN|SECRET|KEY|PASSWORD)[A-Za-z0-9_]*\b/gi, "[redacted]")
    .replace(/(?:\/|~\/|\.\.?\/)[^\s]+/g, "[path]")
    .replace(/[`$][^\n]*/g, "[command]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function fallbackActionForHint(taskHint: string): string {
  const normalized = taskHint.toLowerCase();
  if (normalized.includes("understanding") || normalized.includes("request") || normalized.includes("prompt")) return READING_PROMPT_ACTION;
  if (normalized.includes("subagent")) return "calling subagent...";
  if (normalized.includes("workflow")) return "running workflow...";
  if (normalized.includes("search")) return "searching references...";
  if (normalized.includes("read")) return "reading files...";
  if (normalized.includes("write")) return "writing files...";
  if (normalized.includes("edit")) return "editing code...";
  if (normalized.includes("command") || normalized.includes("bash")) return "running command...";
  if (normalized.includes("test")) return "running tests...";
  return DEFAULT_ACTION;
}

export function getSafeVibeToolHint(toolName: string): string {
  const normalized = toolName.toLowerCase();
  if (normalized === "agent" || normalized === "subagent") return "calling subagent";
  if (normalized === "workflow") return "running workflow";
  if (normalized === "read") return "reading file";
  if (normalized === "write") return "writing file";
  if (normalized === "edit" || normalized === "apply_patch") return "editing code";
  if (normalized === "bash") return "running command";
  if (normalized.includes("grep") || normalized.includes("find")) return "searching code";
  if (normalized.includes("search") || normalized.includes("fetch")) return "searching references";
  if (normalized.includes("test")) return "running tests";
  return `using ${normalized} tool`;
}

function buildActionPrompt(ctx: ActionGenContext): string {
  const task = sanitizeTaskHint(ctx.taskHint) || "working";
  const exclude = recentActions.length > 0 ? `Avoid repeating: ${recentActions.join(", ")}` : "";
  return config.promptTemplate
    .replace(/\{task\}/g, task)
    .replace(/\{exclude\}/g, exclude);
}

export function buildVibePromptForTest(taskHint: string): string {
  return buildActionPrompt({ taskHint });
}

function parseActionResponse(response: string, fallbackAction: string): string {
  let action = response.trim().split("\n")[0]?.trim() ?? "";
  action = action
    .replace(/^[-*\d.)\s]+/, "")
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
    .replace(/(?:\/|~\/|\.\.?\/)[^\s]+/g, "[path]")
    .replace(/\s+/g, " ")
    .trim();

  if (!action || /[\u4e00-\u9fff]/.test(action)) action = fallbackAction;
  if (!action.endsWith("...")) {
    action = action.replace(/[。.!！]+$/g, "");
    action += "...";
  }

  if (action.length > config.maxLength) {
    action = action.slice(0, Math.max(1, config.maxLength - 3)).trimEnd() + "...";
  }

  return action && action !== "..." ? action : fallbackAction;
}

function buildAiContext(prompt: string): Context {
  return {
    systemPrompt: ACTION_SYSTEM_PROMPT,
    messages: [{
      role: "user",
      content: [{ type: "text", text: prompt }],
      timestamp: Date.now(),
    }],
  };
}

async function generateActionDescription(
  ctx: ActionGenContext,
  signal: AbortSignal,
): Promise<string> {
  const fallbackAction = fallbackActionForHint(ctx.taskHint);
  if (!extensionCtx) return fallbackAction;

  const slashIndex = config.modelSpec.indexOf("/");
  if (slashIndex === -1) return fallbackAction;
  const provider = config.modelSpec.slice(0, slashIndex);
  const modelId = config.modelSpec.slice(slashIndex + 1);
  if (!provider || !modelId) return fallbackAction;

  const model = extensionCtx.modelRegistry.find(provider, modelId);
  if (!model) {
    console.debug(`[working-vibes] Model not found: ${config.modelSpec}`);
    return fallbackAction;
  }

  const auth = await extensionCtx.modelRegistry.getApiKeyAndHeaders(model);
  if (!auth.ok) {
    console.debug(`[working-vibes] Auth failed for ${provider}: ${auth.error}`);
    return fallbackAction;
  }
  if (signal.aborted) return fallbackAction;

  const response = await complete(model, buildAiContext(buildActionPrompt(ctx)), {
    apiKey: auth.apiKey,
    headers: auth.headers,
    signal,
  });

  const textContent = response.content.find((entry) => entry.type === "text");
  if (!textContent?.text && response.stopReason === "error" && response.errorMessage) {
    console.debug(`[working-vibes] Action vibe generation failed for ${config.modelSpec}: ${response.errorMessage}`);
  }
  return parseActionResponse(textContent?.text || "", fallbackAction);
}

function trackRecentAction(action: string): void {
  if (action === DEFAULT_ACTION) return;
  recentActions = [action, ...recentActions.filter((entry) => entry !== action)].slice(0, MAX_RECENT_ACTIONS);
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m${seconds.toString().padStart(2, "0")}s` : `${seconds}s`;
}

function formatTokenCount(tokens: number): string {
  if (tokens < 1000) return tokens.toString();
  if (tokens < 10000) return `${(tokens / 1000).toFixed(1)}k`;
  if (tokens < 1000000) return `${Math.round(tokens / 1000)}k`;
  return `${(tokens / 1000000).toFixed(1)}M`;
}

function formatWorkingMessage(
  action: string,
  elapsedMs = activeStartedAt ? Date.now() - activeStartedAt : 0,
  tokens = activeTokens,
  tokenSource: TokenSource = activeTokenSource,
): string {
  const parts = [action, formatDuration(elapsedMs)];
  if (tokens > 0) parts.push(`${tokenSource === "estimate" ? "≈" : ""}${formatTokenCount(tokens)} tok`);
  return parts.join(" · ");
}

function publishWorkingMessage(): void {
  if (isStreaming && activeStartedAt) {
    const elapsedMs = Date.now() - activeStartedAt;
    if (activeAction === READING_PROMPT_ACTION && elapsedMs >= 2000) activeAction = DEFAULT_ACTION;
    const elapsedTokenFloor = Math.max(1, Math.floor(elapsedMs / 1000) * 3);
    if (activeTokenSource === "estimate") activeTokens = Math.max(activeTokens, elapsedTokenFloor);
  }
  activeSetWorkingMessage?.(formatWorkingMessage(activeAction));
}

function startWorkingMessage(setWorkingMessage: (msg?: string) => void, action: string): void {
  activeSetWorkingMessage = setWorkingMessage;
  activeAction = action;
  activeStartedAt = Date.now();
  activeTokens = 0;
  activeTokenSource = "estimate";
  publishWorkingMessage();
  if (activeTicker) clearInterval(activeTicker);
  activeTicker = setInterval(publishWorkingMessage, 1000);
}

function updateWorkingAction(setWorkingMessage: (msg?: string) => void, action: string): void {
  activeSetWorkingMessage = setWorkingMessage;
  activeAction = action;
  if (!activeStartedAt) activeStartedAt = Date.now();
  publishWorkingMessage();
}

function stopWorkingMessage(setWorkingMessage?: (msg?: string) => void): void {
  if (activeTicker) clearInterval(activeTicker);
  activeTicker = null;
  activeSetWorkingMessage = null;
  activeAction = DEFAULT_ACTION;
  activeStartedAt = 0;
  activeTokens = 0;
  activeTokenSource = "estimate";
  setWorkingMessage?.(undefined);
}

export function formatWorkingMessageForTest(action: string, elapsedMs: number, tokens: number, tokenSource: TokenSource = "usage"): string {
  return formatWorkingMessage(action, elapsedMs, tokens, tokenSource);
}

export interface TimeoutSignalHandle {
  signal: AbortSignal;
  dispose(): void;
}

export function createTimeoutSignal(timeoutMs: number): TimeoutSignalHandle {
  if (typeof AbortSignal.timeout === "function") {
    return { signal: AbortSignal.timeout(timeoutMs), dispose() {} };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    dispose() { clearTimeout(timer); },
  };
}

export function combineAbortSignals(signals: AbortSignal[]): AbortSignal {
  if (typeof AbortSignal.any === "function") return AbortSignal.any(signals);

  const controller = new AbortController();
  const abort = () => controller.abort();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort();
      break;
    }
    signal.addEventListener("abort", abort, { once: true });
  }
  return controller.signal;
}

async function generateAndUpdate(
  taskHint: string,
  setWorkingMessage: (msg?: string) => void,
): Promise<void> {
  if (!config.enabled) return;
  lastGeneratedHint = taskHint;
  const sessionId = vibeSessionId;

  const controller = new AbortController();
  currentGeneration?.abort();
  currentGeneration = controller;
  const timeoutSignal = createTimeoutSignal(config.timeout);
  const combinedSignal = combineAbortSignals([controller.signal, timeoutSignal.signal]);

  try {
    const action = await generateActionDescription({ taskHint }, combinedSignal);
    if (sessionId === vibeSessionId && isStreaming && currentGeneration === controller && config.enabled && !controller.signal.aborted && !combinedSignal.aborted) {
      trackRecentAction(action);
      updateWorkingAction(setWorkingMessage, action);
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.debug("[working-vibes] Action generation aborted");
    } else {
      console.debug(`[working-vibes] Action generation failed: ${sanitizeErrorForLog(error)}`);
    }
  } finally {
    timeoutSignal.dispose();
    if (currentGeneration === controller) currentGeneration = null;
  }
}

export function initVibeManager(ctx: ExtensionContext): void {
  resetVibeState(false);
  extensionCtx = ctx;
  config = loadConfig();
  lastGeneratedHint = "";
}

export function getActionVibeEnabled(): boolean {
  return config.enabled;
}

function resetVibeState(clearContext: boolean): void {
  vibeSessionId += 1;
  isStreaming = false;
  currentGeneration?.abort();
  currentGeneration = null;
  recentActions = [];
  lastGeneratedHint = "";
  lastVibeTime = 0;
  if (clearContext) extensionCtx = null;
}

export function shutdownVibeManager(setWorkingMessage?: (msg?: string) => void): void {
  resetVibeState(true);
  stopWorkingMessage(setWorkingMessage);
}

export function setActionVibeEnabled(enabled: boolean): boolean {
  if (enabled !== config.enabled) {
    resetVibeState(false);
    if (!enabled) stopWorkingMessage(activeSetWorkingMessage ?? undefined);
  }
  config = { ...config, enabled };
  return saveEnabledConfig();
}

export function getVibeModel(): string {
  return config.modelSpec;
}

export function setVibeModel(modelSpec: string): boolean {
  config = { ...config, modelSpec };
  return saveModelConfig();
}

export function getVibeRefreshIntervalSeconds(): number {
  return Math.round(config.refreshInterval / 1000);
}

export function setVibeRefreshIntervalSeconds(seconds: number): boolean {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 30;
  config = { ...config, refreshInterval: safeSeconds * 1000 };
  return saveConfigValue("workingVibeRefreshInterval", safeSeconds, 30);
}

export function getVibeMaxLength(): number {
  return config.maxLength;
}

export function setVibeMaxLength(maxLength: number): boolean {
  const safeMaxLength = Number.isFinite(maxLength) ? Math.max(8, Math.floor(maxLength)) : 48;
  config = { ...config, maxLength: safeMaxLength };
  return saveConfigValue("workingVibeMaxLength", safeMaxLength, 48);
}

export function getVibeFallback(): string {
  return config.fallback;
}

export function setVibeFallback(fallback: string): boolean {
  const normalized = fallback.trim().replace(/\.+$/, "") || DEFAULT_BASE;
  config = { ...config, fallback: normalized };
  return saveConfigValue("workingVibeFallback", normalized, DEFAULT_BASE);
}

export function onVibeBeforeAgentStart(
  _prompt: string,
  setWorkingMessage: (msg?: string) => void,
): void {
  if (!config.enabled || !extensionCtx) return;
  isStreaming = true;
  const hint = "understanding user request";
  startWorkingMessage(setWorkingMessage, fallbackActionForHint(hint));
  lastVibeTime = Date.now();
  void generateAndUpdate(hint, setWorkingMessage);
}

export function onVibeAgentStart(): void {
  isStreaming = true;
}

export function onVibeToolCall(
  toolName: string,
  _toolInput: Record<string, unknown>,
  setWorkingMessage: (msg?: string) => void,
): void {
  if (!config.enabled || !extensionCtx || !isStreaming) return;

  const hint = getSafeVibeToolHint(toolName);
  updateWorkingAction(setWorkingMessage, fallbackActionForHint(hint));

  const now = Date.now();
  if (hint === lastGeneratedHint && now - lastVibeTime < config.refreshInterval) return;
  lastVibeTime = now;
  void generateAndUpdate(hint, setWorkingMessage);
}

export function onVibeAgentEnd(setWorkingMessage: (msg?: string) => void): void {
  resetVibeState(false);
  stopWorkingMessage(setWorkingMessage);
}

export function onVibeUsageUpdate(tokens: number, tokenSource: TokenSource = "usage"): void {
  if (!isStreaming) return;
  if (activeTokenSource === "usage" && tokenSource === "estimate") return;
  if (activeAction === READING_PROMPT_ACTION) activeAction = "writing response...";
  activeTokens = Math.max(0, Math.floor(tokens));
  activeTokenSource = tokenSource;
  publishWorkingMessage();
}

export function onVibeTextDelta(charCount: number): void {
  if (!isStreaming || activeTokenSource === "usage") return;
  if (charCount <= 0) return;
  activeAction = "writing response...";
  activeTokens += Math.max(1, Math.ceil(charCount / 4));
  activeTokenSource = "estimate";
  publishWorkingMessage();
}

export function normalizeVibeActionForTest(response: string, fallbackAction = DEFAULT_ACTION): string {
  return parseActionResponse(response, fallbackAction);
}
