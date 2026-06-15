/**
 * Pi Notify
 *
 * Global Pi extension for native/terminal notifications.
 * Auto-discovered from ~/.pi/agent/extensions/pi-notify/index.ts.
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { appendFile } from "node:fs/promises";
import { homedir, platform } from "node:os";
import { dirname, join } from "node:path";
import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";

const execFile = promisify(execFileCb);

export type NotifyBackend =
	| "auto"
	| "osc777"
	| "osc99"
	| "osascript"
	| "notify-send"
	| "powershell"
	| "ui"
	| "off";

export type NotifyConfig = {
	enabled: boolean;
	backend: NotifyBackend;
	historyEnabled: boolean;
	historyPath: string;
	historyMaxEntries: number;
	notifyOnAgentEnd: boolean;
	notifyOnDangerousTool: boolean;
	notifyOnToolError: boolean;
	notifyOnCompaction: boolean;
	quietSeconds: number;
	sound: boolean;
	timeoutMs: number;
	maxPreviewChars: number;
	appName: string;
};

type NotifyKind = "done" | "danger" | "error" | "compact" | "test" | "status";
type NotifyEventName = "agent_end" | "dangerous_tool" | "tool_error" | "compaction";

type NotifyPayload = {
	kind: NotifyKind;
	title: string;
	body: string;
	urgency?: "low" | "normal" | "critical";
	force?: boolean;
};

type RuntimeOptions = {
	configPath?: string;
	now?: () => number;
	writeStdout?: (text: string) => void;
	execFile?: (file: string, args: string[], options?: { timeout?: number }) => Promise<unknown>;
	env?: NodeJS.ProcessEnv;
	platform?: NodeJS.Platform;
};

const DEFAULT_CONFIG: NotifyConfig = {
	enabled: true,
	backend: "auto",
	historyEnabled: false,
	historyPath: defaultHistoryPath(),
	historyMaxEntries: 200,
	notifyOnAgentEnd: true,
	notifyOnDangerousTool: true,
	notifyOnToolError: false,
	notifyOnCompaction: true,
	quietSeconds: 10,
	sound: true,
	timeoutMs: 10_000,
	maxPreviewChars: 120,
	appName: "Pi",
};

const CONFIG_KEYS = Object.keys(DEFAULT_CONFIG) as Array<keyof NotifyConfig>;

export function defaultConfigPath(): string {
	return join(homedir(), ".config", "pi-notify", "config.json");
}

export function defaultHistoryPath(): string {
	return join(homedir(), ".cache", "pi-notify", "history.jsonl");
}

function isBackend(value: unknown): value is NotifyBackend {
	return ["auto", "osc777", "osc99", "osascript", "notify-send", "powershell", "ui", "off"].includes(
		String(value),
	);
}

function toBool(value: unknown, fallback: boolean): boolean {
	return typeof value === "boolean" ? value : fallback;
}

function toNumber(value: unknown, fallback: number, min: number, max: number): number {
	if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
	return Math.min(max, Math.max(min, value));
}

function normalizePath(value: unknown, fallback: string): string {
	if (typeof value !== "string" || !value.trim()) return fallback;
	const trimmed = value.trim();
	return trimmed === "~" ? homedir() : trimmed.startsWith("~/") ? join(homedir(), trimmed.slice(2)) : trimmed;
}

export function normalizeConfig(raw: unknown): NotifyConfig {
	const input = raw && typeof raw === "object" ? (raw as Partial<NotifyConfig>) : {};
	return {
		enabled: toBool(input.enabled, DEFAULT_CONFIG.enabled),
		backend: isBackend(input.backend) ? input.backend : DEFAULT_CONFIG.backend,
		historyEnabled: toBool(input.historyEnabled, DEFAULT_CONFIG.historyEnabled),
		historyPath: normalizePath(input.historyPath, DEFAULT_CONFIG.historyPath),
		historyMaxEntries: toNumber(input.historyMaxEntries, DEFAULT_CONFIG.historyMaxEntries, 1, 10_000),
		notifyOnAgentEnd: toBool(input.notifyOnAgentEnd, DEFAULT_CONFIG.notifyOnAgentEnd),
		notifyOnDangerousTool: toBool(input.notifyOnDangerousTool, DEFAULT_CONFIG.notifyOnDangerousTool),
		notifyOnToolError: toBool(input.notifyOnToolError, DEFAULT_CONFIG.notifyOnToolError),
		notifyOnCompaction: toBool(input.notifyOnCompaction, DEFAULT_CONFIG.notifyOnCompaction),
		quietSeconds: toNumber(input.quietSeconds, DEFAULT_CONFIG.quietSeconds, 0, 3600),
		sound: toBool(input.sound, DEFAULT_CONFIG.sound),
		timeoutMs: toNumber(input.timeoutMs, DEFAULT_CONFIG.timeoutMs, 500, 120_000),
		maxPreviewChars: toNumber(input.maxPreviewChars, DEFAULT_CONFIG.maxPreviewChars, 20, 1000),
		appName: typeof input.appName === "string" && input.appName.trim() ? input.appName.trim() : DEFAULT_CONFIG.appName,
	};
}

export function loadConfig(path = defaultConfigPath()): NotifyConfig {
	if (!existsSync(path)) return { ...DEFAULT_CONFIG };
	try {
		return normalizeConfig(JSON.parse(readFileSync(path, "utf8")));
	} catch {
		return { ...DEFAULT_CONFIG };
	}
}

export function saveConfig(config: NotifyConfig, path = defaultConfigPath()): void {
	mkdirSync(dirname(path), { recursive: true });
	const clean: Record<string, unknown> = {};
	for (const key of CONFIG_KEYS) clean[key] = config[key];
	writeFileSync(path, `${JSON.stringify(clean, null, 2)}\n`, "utf8");
}

export function projectLabel(cwd: string): { name: string; path: string } {
	const normalized = cwd.replace(/\/$/, "") || cwd;
	const name = normalized.split(/[\\/]/).filter(Boolean).pop() || normalized || "unknown";
	return { name, path: cwd };
}

export function truncate(input: string, maxChars: number): string {
	const oneLine = input.replace(/\s+/g, " ").trim();
	return oneLine.length > maxChars ? `${oneLine.slice(0, Math.max(0, maxChars - 1))}…` : oneLine;
}

export function sanitizeTerminalText(value: string): string {
	const safe = value
		.replace(/[\r\n\t]+/g, " ")
		.replace(/;/g, "：")
		.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/g, "")
		.replace(/\s+/g, " ")
		.trim();
	return safe || " ";
}

function titleFor(kind: NotifyKind, project: string): string {
	switch (kind) {
		case "done":
			return `Pi done - ${project}`;
		case "danger":
			return `⚠️ Pi tool request - ${project}`;
		case "error":
			return `Pi tool failed - ${project}`;
		case "compact":
			return `Pi compacted - ${project}`;
		case "test":
			return `Pi notify test - ${project}`;
		case "status":
			return `Pi notify - ${project}`;
	}
}

export function buildPayload(kind: NotifyKind, cwd: string, message: string): NotifyPayload {
	const project = projectLabel(cwd);
	const urgency = kind === "danger" || kind === "error" ? "critical" : "normal";
	return {
		kind,
		title: titleFor(kind, project.name),
		body: `${message}\nProject: ${project.name} (${project.path})`,
		urgency,
	};
}

export function detectDangerousTool(toolName: string, input: unknown, maxPreviewChars = 120): string | null {
	const name = toolName.toLowerCase();
	if (name === "bash") {
		const fields = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
		const command = typeof fields.command === "string" ? fields.command : "";
		const dangerous = [
			/\brm\s+(-[\w-]*[rf][\w-]*|-[\w-]*[fr][\w-]*)\b/,
			/\bsudo\b/,
			/\bchmod\s+-R\s+(777|666)\b/,
			/\bchown\s+-R\b/,
			/\bmkfs\b/,
			/\bdd\s+.*\bof=/,
			/\bshutdown\b|\breboot\b|\bpoweroff\b/,
		];
		if (dangerous.some((pattern) => pattern.test(command))) return `Bash: ${truncate(command, maxPreviewChars)}`;
		return null;
	}

	const fields = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
	if (name === "multi_tool_use.parallel") {
		const toolUses = Array.isArray(fields.tool_uses) ? fields.tool_uses : [];
		for (const toolUse of toolUses) {
			const tool = toolUse && typeof toolUse === "object" ? (toolUse as Record<string, unknown>) : {};
			const nestedName = typeof tool.recipient_name === "string" ? tool.recipient_name.split(".").pop() : undefined;
			if (!nestedName) continue;
			const nested = detectDangerousTool(nestedName, tool.parameters, maxPreviewChars);
			if (nested) return `parallel: ${nested}`;
		}
		return null;
	}

	if (["write", "edit", "apply_patch"].includes(name)) {
		const path = typeof fields.path === "string" ? fields.path : typeof fields.file_path === "string" ? fields.file_path : "file mutation";
		return `${toolName}: ${truncate(path, maxPreviewChars)}`;
	}

	return null;
}

function appleString(value: string): string {
	return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function psString(value: string): string {
	return `'${value.replace(/'/g, "''")}'`;
}

function powershellToastScript(title: string, body: string, appName: string): string {
	const type = "Windows.UI.Notifications";
	return [
		`[${type}.ToastNotificationManager, ${type}, ContentType = WindowsRuntime] > $null`,
		`[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom, ContentType = WindowsRuntime] > $null`,
		`$xml = [${type}.ToastNotificationManager]::GetTemplateContent([${type}.ToastTemplateType]::ToastText02)`,
		`$xml.GetElementsByTagName('text')[0].AppendChild($xml.CreateTextNode(${psString(title)})) > $null`,
		`$xml.GetElementsByTagName('text')[1].AppendChild($xml.CreateTextNode(${psString(body)})) > $null`,
		`$toast = [${type}.ToastNotification]::new($xml)`,
		`[${type}.ToastNotificationManager]::CreateToastNotifier(${psString(appName)}).Show($toast)`,
	].join("; ");
}

export function resolveBackend(configured: NotifyBackend, env = process.env, os = platform()): NotifyBackend {
	if (configured !== "auto") return configured;
	if (env.KITTY_WINDOW_ID) return "osc99";
	if (env.TERM_PROGRAM === "iTerm.app" || env.TERM_PROGRAM === "WezTerm" || env.WEZTERM_EXECUTABLE || env.GHOSTTY_RESOURCES_DIR) {
		return "osc777";
	}
	if (os === "darwin") return "osascript";
	if (os === "win32" || env.WT_SESSION) return "powershell";
	if (os === "linux") return "notify-send";
	return "osc777";
}

export function isInsideTmux(env = process.env): boolean {
	return Boolean(env.TMUX) || env.TERM_PROGRAM === "tmux" || String(env.TERM ?? "").startsWith("tmux");
}

export function wrapForTmuxPassthrough(sequence: string): string {
	return `\x1bPtmux;${sequence.replace(/\x1b/g, "\x1b\x1b")}\x1b\\`;
}

function terminalSequence(sequence: string, env = process.env): string {
	return isInsideTmux(env) ? wrapForTmuxPassthrough(sequence) : sequence;
}

async function playCanberraSound(
	config: NotifyConfig,
	options: Required<Pick<RuntimeOptions, "execFile" | "platform">>,
): Promise<void> {
	if (!config.sound || options.platform !== "linux") return;
	try {
		await options.execFile("canberra-gtk-play", ["--id=message-new-instant", `--description=${config.appName} notification`], {
			timeout: Math.min(config.timeoutMs, 2000),
		});
	} catch {
		// Sound is best-effort; missing canberra must not break notifications.
	}
}

async function sendViaBackend(
	payload: NotifyPayload,
	config: NotifyConfig,
	backend: NotifyBackend,
	options: Required<Pick<RuntimeOptions, "writeStdout" | "execFile" | "platform" | "env">>,
): Promise<void> {
	if (backend === "off") return;
	if (backend === "osc777") {
		const title = sanitizeTerminalText(payload.title);
		const body = sanitizeTerminalText(payload.body);
		options.writeStdout(terminalSequence(`\x1b]777;notify;${title};${body}\x07`, options.env));
		return;
	}
	if (backend === "osc99") {
		const title = sanitizeTerminalText(payload.title);
		const body = sanitizeTerminalText(payload.body);
		options.writeStdout(terminalSequence(`\x1b]99;i=pi-notify:d=0;${title}\x1b\\`, options.env));
		options.writeStdout(terminalSequence(`\x1b]99;i=pi-notify:p=body;${body}\x1b\\`, options.env));
		return;
	}
	if (backend === "osascript") {
		const sound = config.sound ? " sound name \"default\"" : "";
		await options.execFile(
			"osascript",
			["-e", `display notification ${appleString(payload.body)} with title ${appleString(payload.title)}${sound}`],
			{ timeout: config.timeoutMs },
		);
		return;
	}
	if (backend === "notify-send") {
		await options.execFile(
			"notify-send",
			[
				`--app-name=${config.appName}`,
				`--urgency=${payload.urgency ?? "normal"}`,
				`--expire-time=${config.timeoutMs}`,
				payload.title,
				payload.body,
			],
			{ timeout: config.timeoutMs },
		);
		return;
	}
	if (backend === "powershell") {
		const exe = options.platform === "win32" ? "powershell" : "powershell.exe";
		await options.execFile(exe, ["-NoProfile", "-Command", powershellToastScript(payload.title, payload.body, config.appName)], {
			timeout: config.timeoutMs,
		});
	}
}

async function appendHistory(payload: NotifyPayload, backend: NotifyBackend, config: NotifyConfig, timestampMs: number): Promise<void> {
	if (!config.historyEnabled) return;
	mkdirSync(dirname(config.historyPath), { recursive: true });
	const record = {
		timestamp: new Date(timestampMs).toISOString(),
		backend,
		kind: payload.kind,
		title: payload.title,
		body: payload.body,
		urgency: payload.urgency ?? "normal",
	};
	await appendFile(config.historyPath, `${JSON.stringify(record)}\n`, "utf8");

	const lines = readFileSync(config.historyPath, "utf8")
		.split("\n")
		.filter((line) => line.trim());
	if (lines.length > config.historyMaxEntries) {
		writeFileSync(config.historyPath, `${lines.slice(-config.historyMaxEntries).join("\n")}\n`, "utf8");
	}
}

const EVENT_CONFIG_KEYS: Record<NotifyEventName, keyof Pick<NotifyConfig, "notifyOnAgentEnd" | "notifyOnDangerousTool" | "notifyOnToolError" | "notifyOnCompaction">> = {
	agent_end: "notifyOnAgentEnd",
	dangerous_tool: "notifyOnDangerousTool",
	tool_error: "notifyOnToolError",
	compaction: "notifyOnCompaction",
};

function renderEvents(config: NotifyConfig): string {
	return `agent_end=${config.notifyOnAgentEnd}\ndangerous_tool=${config.notifyOnDangerousTool}\ntool_error=${config.notifyOnToolError}\ncompaction=${config.notifyOnCompaction}`;
}

function parseEventName(value: string | undefined): NotifyEventName | undefined {
	return value && value in EVENT_CONFIG_KEYS ? (value as NotifyEventName) : undefined;
}

function parseSwitch(value: string | undefined): boolean | undefined {
	const normalized = value?.toLowerCase() ?? "";
	if (["on", "enable", "enabled", "true", "1"].includes(normalized)) return true;
	if (["off", "disable", "disabled", "false", "0"].includes(normalized)) return false;
	return undefined;
}

function renderStatus(config: NotifyConfig, configPath: string, backend: NotifyBackend): string {
	return [
		`enabled: ${config.enabled}`,
		`backend: ${config.backend} -> ${backend}`,
		`config: ${configPath}`,
		`history: ${config.historyEnabled} (${config.historyPath}, max ${config.historyMaxEntries})`,
		`events: ${renderEvents(config).replace(/\n/g, ", ")}`,
		`sound: ${config.sound}`,
		`quietSeconds: ${config.quietSeconds}`,
	].join("\n");
}

function renderHistory(config: NotifyConfig): string {
	return [`enabled: ${config.historyEnabled}`, `path: ${config.historyPath}`, `maxEntries: ${config.historyMaxEntries}`].join("\n");
}

function commandHelp(): string {
	return [
		"Usage: /notify <test|status|enable|disable|backend|events|sound>",
		"/notify test      Send test notification",
		"/notify status    Show config and resolved backend",
		"/notify enable    Enable notifications",
		"/notify disable   Disable notifications",
		"/notify backend <auto|osc777|osc99|osascript|notify-send|powershell|ui|off>",
		"/notify history   Show local history settings",
		"/notify history <on|off|clear|path|max> [value]",
		"/notify events    Show enabled event triggers",
		"/notify events <agent_end|dangerous_tool|tool_error|compaction> <on|off>",
		"/notify sound <on|off>    Enable or disable notification sound",
	].join("\n");
}

export default function piNotify(pi: ExtensionAPI, runtime: RuntimeOptions = {}) {
	const configPath = runtime.configPath ?? process.env.PI_NOTIFY_CONFIG ?? defaultConfigPath();
	const now = runtime.now ?? (() => Date.now());
	const writeStdout = runtime.writeStdout ?? ((text: string) => process.stdout.write(text));
	const runExecFile = runtime.execFile ?? ((file, args, options) => execFile(file, args, options));
	const env = runtime.env ?? process.env;
	const os = runtime.platform ?? platform();
	const lastSent = new Map<string, number>();

	let config = loadConfig(configPath);

	function loadCurrentConfig(): NotifyConfig {
		config = loadConfig(configPath);
		return config;
	}

	async function notify(
		payload: NotifyPayload,
		ctx?: Pick<ExtensionContext, "hasUI" | "ui">,
		currentConfig = loadCurrentConfig(),
	): Promise<boolean> {
		if (!currentConfig.enabled || currentConfig.backend === "off") return false;

		const key = `${payload.kind}:${payload.title}`;
		const current = now();
		const last = lastSent.get(key) ?? 0;
		if (!payload.force && currentConfig.quietSeconds > 0 && current - last < currentConfig.quietSeconds * 1000) return false;

		const backend = resolveBackend(currentConfig.backend, env, os);

		try {
			if (backend === "ui") {
				if (!ctx?.hasUI) return false;
				ctx.ui.notify(`${payload.title}\n${payload.body}`, payload.urgency === "critical" ? "warning" : "info");
			} else {
				await sendViaBackend(payload, currentConfig, backend, { writeStdout, execFile: runExecFile, platform: os, env });
			}
			await playCanberraSound(currentConfig, { execFile: runExecFile, platform: os });
			try {
				await appendHistory(payload, backend, currentConfig, current);
			} catch {
				// History is best-effort; storage failure must not break notifications.
			}
			lastSent.set(key, current);
			if (env.PI_NOTIFY_E2E_LOG) {
				await appendFile(env.PI_NOTIFY_E2E_LOG, `${JSON.stringify({ backend, payload })}\n`, "utf8");
			}
			return true;
		} catch (error) {
			if (ctx?.hasUI) {
				ctx.ui.notify(`Pi notify failed via ${backend}: ${error instanceof Error ? error.message : String(error)}`, "warning");
			}
			return false;
		}
	}

	function show(ctx: Pick<ExtensionContext, "hasUI" | "ui">, message: string, type: "info" | "warning" | "error" = "info") {
		if (ctx.hasUI) ctx.ui.notify(message, type);
		else writeStdout(`${message}\n`);
	}

	pi.on("session_start", async (_event, ctx) => {
		config = loadCurrentConfig();
		if (ctx.hasUI) ctx.ui.setStatus("pi-notify", config.enabled ? "notify:on" : "notify:off");
	});

	pi.on("agent_end", async (_event, ctx) => {
		const currentConfig = loadCurrentConfig();
		if (!currentConfig.notifyOnAgentEnd) return;
		await notify(buildPayload("done", ctx.cwd, "Ready for input"), ctx, currentConfig);
	});

	pi.on("tool_call", async (event, ctx) => {
		const currentConfig = loadCurrentConfig();
		if (!currentConfig.notifyOnDangerousTool) return;
		const preview = detectDangerousTool(event.toolName, event.input, currentConfig.maxPreviewChars);
		if (!preview) return;
		await notify(buildPayload("danger", ctx.cwd, preview), ctx, currentConfig);
	});

	pi.on("tool_result", async (event, ctx) => {
		const currentConfig = loadCurrentConfig();
		if (!currentConfig.notifyOnToolError || !event.isError) return;
		await notify(buildPayload("error", ctx.cwd, `${event.toolName} failed`), ctx, currentConfig);
	});

	pi.on("session_compact", async (_event, ctx) => {
		const currentConfig = loadCurrentConfig();
		if (!currentConfig.notifyOnCompaction) return;
		await notify(buildPayload("compact", ctx.cwd, "Context compacted"), ctx, currentConfig);
	});

	pi.registerCommand("notify", {
		description: "Manage Pi native notifications",
		handler: async (args: string, ctx) => {
			const [command = "status", ...values] = args.trim().split(/\s+/).filter(Boolean);
			const value = values[0];
			config = loadCurrentConfig();

			if (command === "test") {
				const sent = await notify({ ...buildPayload("test", ctx.cwd, "Test notification"), force: true }, ctx);
				show(ctx, sent ? "Pi notify test sent" : "Pi notify test not sent", sent ? "info" : "warning");
				return;
			}

			if (command === "status") {
				const backend = resolveBackend(config.backend, env, os);
				show(ctx, renderStatus(config, configPath, backend));
				return;
			}

			if (command === "events") {
				if (!value) {
					show(ctx, renderEvents(config));
					return;
				}

				const eventName = parseEventName(value);
				const enabled = parseSwitch(values[1]);
				if (!eventName || enabled === undefined) {
					show(ctx, `Invalid events command: ${values.join(" ")}\n${commandHelp()}`, "error");
					return;
				}

				config[EVENT_CONFIG_KEYS[eventName]] = enabled;
				saveConfig(config, configPath);
				show(ctx, `Pi notify event ${eventName} = ${enabled}`);
				return;
			}

			if (command === "history") {
				if (!value || value === "status") {
					show(ctx, renderHistory(config));
					return;
				}

				const enabled = parseSwitch(value);
				if (enabled !== undefined) {
					config.historyEnabled = enabled;
					saveConfig(config, configPath);
					show(ctx, `Pi notify history = ${enabled}`);
					return;
				}

				if (value === "clear") {
					mkdirSync(dirname(config.historyPath), { recursive: true });
					writeFileSync(config.historyPath, "", "utf8");
					show(ctx, `Pi notify history cleared: ${config.historyPath}`);
					return;
				}

				if (value === "path") {
					const nextPath = values[1];
					if (!nextPath) {
						show(ctx, config.historyPath);
						return;
					}
					config.historyPath = normalizePath(nextPath, config.historyPath);
					saveConfig(config, configPath);
					show(ctx, `Pi notify history path = ${config.historyPath}`);
					return;
				}

				if (value === "max") {
					const maxEntries = Number(values[1]);
					if (!Number.isInteger(maxEntries) || maxEntries < 1 || maxEntries > 10_000) {
						show(ctx, `Invalid history max: ${values[1] ?? ""}\n${commandHelp()}`, "error");
						return;
					}
					config.historyMaxEntries = maxEntries;
					saveConfig(config, configPath);
					show(ctx, `Pi notify history max = ${maxEntries}`);
					return;
				}

				show(ctx, `Invalid history command: ${values.join(" ")}\n${commandHelp()}`, "error");
				return;
			}

			if (command === "sound") {
				const enabled = parseSwitch(value);
				if (enabled === undefined) {
					show(ctx, `Invalid sound command: ${value ?? ""}\n${commandHelp()}`, "error");
					return;
				}
				config.sound = enabled;
				saveConfig(config, configPath);
				show(ctx, `Pi notify sound = ${enabled}`);
				return;
			}

			if (command === "enable" || command === "disable") {
				config.enabled = command === "enable";
				saveConfig(config, configPath);
				if (ctx.hasUI) {
					ctx.ui.setStatus("pi-notify", config.enabled ? "notify:on" : "notify:off");
				}
				show(ctx, `Pi notify ${config.enabled ? "enabled" : "disabled"}`);
				return;
			}

			if (command === "backend") {
				if (!isBackend(value)) {
					show(ctx, `Invalid backend: ${value ?? ""}\n${commandHelp()}`, "error");
					return;
				}
				config.backend = value;
				saveConfig(config, configPath);
				show(ctx, `Pi notify backend = ${value}`);
				return;
			}

			show(ctx, commandHelp());
		},
	});
}
