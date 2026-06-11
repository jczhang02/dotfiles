import type { ExtensionAPI, ExtensionCommandContext, ExtensionUIContext, Theme } from "@earendil-works/pi-coding-agent";
import { matchesKey, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

const RECENT_LIMIT = 50;
const STATE_KEY = "__jcPiWarningRouterState";
const UI_ORIGINAL_NOTIFY_KEY = "__jcWarningRouterOriginalNotify";
const CONSOLE_WRAPPED_KEY = "__jcWarningRouterWrapped";

type WarningChannel = "notify" | "console.warn";

interface MutedWarning {
	at: Date;
	channel: WarningChannel;
	source: string;
	message: string;
}

interface WarningRouterState {
	recent: MutedWarning[];
	originalConsoleWarn?: (...data: unknown[]) => void;
}

type GlobalWithWarningRouter = typeof globalThis & {
	[STATE_KEY]?: WarningRouterState;
};

type PatchedUi = ExtensionUIContext & {
	[UI_ORIGINAL_NOTIFY_KEY]?: ExtensionUIContext["notify"];
};

type WrappedConsoleWarn = typeof console.warn & {
	[CONSOLE_WRAPPED_KEY]?: true;
};

function getState(): WarningRouterState {
	const globalState = globalThis as GlobalWithWarningRouter;
	globalState[STATE_KEY] ??= { recent: [] };
	return globalState[STATE_KEY];
}

function sourceFor(message: string): string {
	if (/observer returned no observations/i.test(message)) return "pi-observational-memory";
	if (/pruner:\s*skipped pruning|skipped pruning/i.test(message)) return "pi-context-prune";
	return "unknown";
}

function stringifyWarnArgs(args: readonly unknown[]): string {
	return args
		.map((arg) => {
			if (arg instanceof Error) return arg.stack || arg.message;
			if (typeof arg === "string") return arg;
			try {
				return JSON.stringify(arg);
			} catch {
				return String(arg);
			}
		})
		.join(" ")
		.trim();
}

function recordMutedWarning(channel: WarningChannel, rawMessage: string): void {
	const message = rawMessage.trim() || "(empty warning)";
	const state = getState();
	state.recent.push({
		at: new Date(),
		channel,
		source: sourceFor(message),
		message,
	});
	if (state.recent.length > RECENT_LIMIT) {
		state.recent.splice(0, state.recent.length - RECENT_LIMIT);
	}
}

function patchConsoleWarn(): void {
	const currentWarn = console.warn as WrappedConsoleWarn;
	if (currentWarn[CONSOLE_WRAPPED_KEY]) return;

	const state = getState();
	state.originalConsoleWarn ??= console.warn.bind(console) as (...data: unknown[]) => void;

	const wrappedWarn = ((...args: unknown[]) => {
		recordMutedWarning("console.warn", stringifyWarnArgs(args));
	}) as WrappedConsoleWarn;
	wrappedWarn[CONSOLE_WRAPPED_KEY] = true;
	console.warn = wrappedWarn;
}

function patchNotify(ui: ExtensionUIContext): void {
	const patchedUi = ui as PatchedUi;
	const originalNotify = patchedUi[UI_ORIGINAL_NOTIFY_KEY] ?? ui.notify.bind(ui);
	patchedUi[UI_ORIGINAL_NOTIFY_KEY] = originalNotify;

	patchedUi.notify = (message: string, type?: "info" | "warning" | "error") => {
		if (type === "warning") {
			recordMutedWarning("notify", message);
			return;
		}

		originalNotify(message, type);
	};
}

function formatTime(date: Date): string {
	return date.toTimeString().slice(0, 8);
}

function padToVisibleWidth(text: string, width: number): string {
	return text + " ".repeat(Math.max(0, width - visibleWidth(text)));
}

function row(theme: Theme, content: string, width: number): string {
	const innerWidth = Math.max(0, width - 2);
	return theme.fg("border", "│") + padToVisibleWidth(truncateToWidth(content, innerWidth, "…", true), innerWidth) + theme.fg("border", "│");
}

function renderWarnings(theme: Theme, warnings: readonly MutedWarning[], width: number): string[] {
	const safeWidth = Math.max(46, Math.min(width, 100));
	const innerWidth = safeWidth - 2;
	const lines: string[] = [];

	lines.push(theme.fg("border", `╭${"─".repeat(innerWidth)}╮`));
	lines.push(row(theme, ` ${theme.fg("accent", theme.bold("Muted warnings"))}`, safeWidth));
	lines.push(row(theme, "", safeWidth));

	if (warnings.length === 0) {
		lines.push(row(theme, ` ${theme.fg("dim", "No muted warnings in this session.")}`, safeWidth));
	} else {
		const sourceWidth = Math.min(24, Math.max(10, Math.floor(innerWidth * 0.28)));
		const channelWidth = 12;
		const messageWidth = Math.max(10, innerWidth - 1 - 8 - 2 - sourceWidth - 2 - channelWidth - 1);
		const header = ` ${padToVisibleWidth("time", 8)}  ${padToVisibleWidth("source", sourceWidth)}  ${padToVisibleWidth("channel", channelWidth)} message`;

		lines.push(row(theme, theme.fg("dim", header), safeWidth));
		lines.push(row(theme, theme.fg("borderMuted", ` ${"─".repeat(Math.max(0, innerWidth - 1))}`), safeWidth));

		for (const warning of warnings) {
			const time = theme.fg("muted", padToVisibleWidth(formatTime(warning.at), 8));
			const source = theme.fg("accent", padToVisibleWidth(truncateToWidth(warning.source, sourceWidth, "…", true), sourceWidth));
			const channel = theme.fg("muted", padToVisibleWidth(warning.channel, channelWidth));
			const message = truncateToWidth(warning.message.replace(/\s+/g, " "), messageWidth, "…", true);
			lines.push(row(theme, ` ${time}  ${source}  ${channel} ${message}`, safeWidth));
		}
	}

	lines.push(row(theme, "", safeWidth));
	lines.push(row(theme, ` ${theme.fg("dim", "Enter/Esc close")}`, safeWidth));
	lines.push(theme.fg("border", `╰${"─".repeat(innerWidth)}╯`));

	return lines;
}

async function showMutedWarnings(ctx: ExtensionCommandContext): Promise<void> {
	if (ctx.mode !== "tui") {
		if (ctx.hasUI) ctx.ui.notify("/muted-warnings requires TUI mode", "info");
		return;
	}

	const snapshot = [...getState().recent];
	await ctx.ui.custom<void>(
		(_tui, theme, _keybindings, done) => ({
			render: (width: number) => renderWarnings(theme, snapshot, width),
			invalidate: () => {},
			handleInput: (data: string) => {
				if (matchesKey(data, "enter") || matchesKey(data, "return") || matchesKey(data, "escape")) {
					done(undefined);
				}
			},
		}),
		{
			overlay: true,
			overlayOptions: {
				width: "82%",
				minWidth: 48,
				maxHeight: "80%",
				anchor: "center",
				margin: 2,
			},
		},
	);
}

export default function (pi: ExtensionAPI) {
	patchConsoleWarn();

	pi.on("session_start", (_event, ctx) => {
		if (!ctx.hasUI) return;
		patchNotify(ctx.ui);
	});

	pi.registerCommand("muted-warnings", {
		description: "Show warnings muted by the global warning router",
		handler: async (_args, ctx) => {
			await showMutedWarnings(ctx);
		},
	});
}
