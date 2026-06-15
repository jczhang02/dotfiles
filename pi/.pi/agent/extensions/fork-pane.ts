import {
	DynamicBorder,
	SessionManager,
	UserMessageSelectorComponent,
	type ExtensionAPI,
	type ExtensionCommandContext,
	type ExtensionContext,
	type SessionEntry,
} from "@earendil-works/pi-coding-agent";
import { Container, SelectList, Text, type SelectItem } from "@earendil-works/pi-tui";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const PREFILL_ENV = "PI_FORK_PANE_PREFILL_FILE";
const COMMAND_ENV = "PI_FORK_PANE_COMMAND";
const SIZE_ENV = "PI_FORK_PANE_SIZE";
const CLOSE_ON_EXIT_ENV = "PI_FORK_PANE_CLOSE_ON_EXIT";
const VERBOSE_ENV = "PI_FORK_PANE_VERBOSE";
const PREFILL_MAX_AGE_MS = 10 * 60 * 1000;

type Direction = "right" | "left" | "up" | "down";

type ForkableMessage = {
	id: string;
	text: string;
	timestamp?: string;
};

type PrefillPayload = {
	sessionFile: string;
	text: string;
	createdAt: number;
};

type ParsedArgs = {
	direction?: Direction;
	size?: number;
	error?: string;
};

export default function forkPaneExtension(pi: ExtensionAPI): void {
	pi.on("session_start", async (_event, ctx) => {
		await maybeApplyPrefill(ctx);
	});

	const handler = async (args: string, ctx: ExtensionCommandContext) => {
		await handleForkPane(pi, args, ctx);
	};

	pi.registerCommand("fork-pane", {
		description: "Fork from a user message into a tmux pane. Usage: /fork-pane [right|left|up|down] [size%]",
		handler,
	});

	pi.registerCommand("fp", {
		description: "Alias for /fork-pane. Usage: /fp [r|l|u|d] [size%]",
		handler,
	});
}

async function handleForkPane(pi: ExtensionAPI, args: string, ctx: ExtensionCommandContext): Promise<void> {
	if (ctx.mode !== "tui") {
		ctx.ui.notify("/fork-pane requires Pi TUI mode", "warning");
		return;
	}

	if (!process.env.TMUX) {
		ctx.ui.notify("/fork-pane requires tmux. Run pi inside tmux, or use /fork.", "warning");
		return;
	}

	const parsed = parseArgs(args);
	if (parsed.error) {
		ctx.ui.notify(parsed.error, "error");
		return;
	}

	const sessionFile = ctx.sessionManager.getSessionFile();
	if (!sessionFile) {
		ctx.ui.notify("/fork-pane requires a saved session. Start pi without --no-session, or use /fork.", "warning");
		return;
	}

	const messages = getForkableMessages(ctx);
	if (messages.length === 0) {
		ctx.ui.notify("No messages to fork from", "info");
		return;
	}

	const entryId = await selectUserMessage(ctx, messages);
	if (!entryId) return;

	const direction = parsed.direction ?? (await selectDirection(ctx));
	if (!direction) return;

	let forked: { sessionFile: string; selectedText: string };
	try {
		forked = await createForkedSession(ctx, entryId, sessionFile);
	} catch (error) {
		ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
		return;
	}

	const prefillFile = await writePrefillFile(forked.sessionFile, forked.selectedText);
	const tmuxArgs = buildTmuxArgs({
		direction,
		size: parsed.size ?? getEnvSize(),
		cwd: ctx.cwd,
		prefillFile,
		sessionFile: forked.sessionFile,
	});

	const result = await pi.exec("tmux", tmuxArgs, { cwd: ctx.cwd, timeout: 10_000 });
	if (result.code !== 0) {
		await safeUnlink(prefillFile);
		const reason = (result.stderr || result.stdout || "tmux split-window failed").trim();
		ctx.ui.notify(reason, "error");
		return;
	}

	const paneId = result.stdout.trim();
	if (isTruthyEnv(process.env[VERBOSE_ENV])) {
		ctx.ui.notify(`Forked to pane ${paneId || "?"}: ${forked.sessionFile}`, "info");
	} else {
		ctx.ui.notify("Forked to new tmux pane", "info");
	}
}

function parseArgs(rawArgs: string): ParsedArgs {
	const tokens = rawArgs.trim().split(/\s+/).filter(Boolean);
	let direction: Direction | undefined;
	let size: number | undefined;

	for (const token of tokens) {
		const parsedDirection = parseDirection(token);
		if (parsedDirection) {
			if (direction) return { error: `Duplicate direction: ${token}` };
			direction = parsedDirection;
			continue;
		}

		const parsedSize = parseSize(token);
		if (parsedSize !== undefined) {
			if (size !== undefined) return { error: `Duplicate size: ${token}` };
			size = parsedSize;
			continue;
		}

		return { error: `Usage: /fork-pane [right|left|up|down] [size%]` };
	}

	return { direction, size };
}

function parseDirection(value: string): Direction | undefined {
	switch (value.toLowerCase()) {
		case "r":
		case "right":
			return "right";
		case "l":
		case "left":
			return "left";
		case "u":
		case "up":
			return "up";
		case "d":
		case "down":
			return "down";
		default:
			return undefined;
	}
}

function parseSize(value: string): number | undefined {
	const match = value.match(/^(\d{1,2})%?$/);
	if (!match) return undefined;
	const size = Number(match[1]);
	return size > 0 && size < 100 ? size : undefined;
}

function getEnvSize(): number | undefined {
	const raw = process.env[SIZE_ENV];
	return raw ? parseSize(raw) : undefined;
}

function getForkableMessages(ctx: ExtensionCommandContext): ForkableMessage[] {
	return ctx.sessionManager
		.getEntries()
		.filter(isUserMessageEntry)
		.map((entry) => ({ id: entry.id, text: extractUserMessageText(entry.message.content), timestamp: entry.timestamp }))
		.filter((message) => message.text.length > 0);
}

function isUserMessageEntry(entry: SessionEntry): entry is Extract<SessionEntry, { type: "message" }> {
	return entry.type === "message" && entry.message.role === "user";
}

function extractUserMessageText(content: Extract<SessionEntry, { type: "message" }>["message"]["content"]): string {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	return content
		.filter((part) => part.type === "text" && typeof part.text === "string")
		.map((part) => part.text)
		.join("");
}

async function selectUserMessage(ctx: ExtensionCommandContext, messages: ForkableMessage[]): Promise<string | null> {
	const initialSelectedId = messages[messages.length - 1]?.id;
	return await ctx.ui.custom<string | null>((tui, _theme, _keybindings, done) => {
		const selector = new UserMessageSelectorComponent(
			messages,
			(entryId) => done(entryId),
			() => done(null),
			initialSelectedId,
		);

		return {
			render: (width: number) => selector.render(width),
			invalidate: () => selector.invalidate(),
			handleInput: (data: string) => {
				selector.getMessageList().handleInput(data);
				tui.requestRender();
			},
		};
	});
}

async function selectDirection(ctx: ExtensionCommandContext): Promise<Direction | null> {
	const items: SelectItem[] = [
		{ value: "right", label: "right" },
		{ value: "left", label: "left" },
		{ value: "up", label: "up" },
		{ value: "down", label: "down" },
	];

	return await ctx.ui.custom<Direction | null>((tui, theme, _keybindings, done) => {
		const container = new Container();
		container.addChild(new DynamicBorder((text: string) => theme.fg("accent", text)));
		container.addChild(new Text(theme.fg("accent", theme.bold("Select pane direction"))));

		const list = new SelectList(items, items.length, {
			selectedPrefix: (text: string) => theme.fg("accent", text),
			selectedText: (text: string) => theme.fg("accent", text),
			description: (text: string) => theme.fg("muted", text),
			scrollInfo: (text: string) => theme.fg("dim", text),
			noMatch: (text: string) => theme.fg("warning", text),
		});
		list.onSelect = (item) => done(item.value as Direction);
		list.onCancel = () => done(null);

		container.addChild(list);
		container.addChild(new Text(theme.fg("dim", "↑↓ navigate • enter select • esc cancel")));
		container.addChild(new DynamicBorder((text: string) => theme.fg("accent", text)));

		return {
			render: (width: number) => container.render(width),
			invalidate: () => container.invalidate(),
			handleInput: (data: string) => {
				list.handleInput(data);
				tui.requestRender();
			},
		};
	});
}

async function createForkedSession(
	ctx: ExtensionCommandContext,
	entryId: string,
	currentSessionFile: string,
): Promise<{ sessionFile: string; selectedText: string }> {
	const selectedEntry = ctx.sessionManager.getEntry(entryId);
	if (!selectedEntry || !isUserMessageEntry(selectedEntry)) {
		throw new Error("Invalid entry ID for forking");
	}

	const selectedText = extractUserMessageText(selectedEntry.message.content);
	const sessionDir = ctx.sessionManager.getSessionDir();
	await mkdir(sessionDir, { recursive: true });

	if (!selectedEntry.parentId) {
		const emptySession = SessionManager.create(ctx.cwd, sessionDir);
		const newSessionFile = emptySession.newSession({ parentSession: currentSessionFile });
		if (!newSessionFile) throw new Error("Failed to create forked session");
		forceWriteSession(emptySession);
		return { sessionFile: newSessionFile, selectedText };
	}

	const sessionManager = SessionManager.open(currentSessionFile, sessionDir);
	const forkedSessionFile = sessionManager.createBranchedSession(selectedEntry.parentId);
	if (!forkedSessionFile) throw new Error("Failed to create forked session");
	forceWriteSession(sessionManager);
	return { sessionFile: forkedSessionFile, selectedText };
}

function forceWriteSession(sessionManager: SessionManager): void {
	// Pi may defer writing forked sessions that do not contain assistant messages.
	// The child process needs the session file immediately, so force the same internal writer Pi uses.
	const maybeWriter = (sessionManager as unknown as { _rewriteFile?: () => void })._rewriteFile;
	if (typeof maybeWriter === "function") maybeWriter.call(sessionManager);
}

async function writePrefillFile(sessionFile: string, text: string): Promise<string> {
	const file = path.join(tmpdir(), `pi-fork-pane-${randomUUID()}.json`);
	const payload: PrefillPayload = { sessionFile, text, createdAt: Date.now() };
	await writeFile(file, JSON.stringify(payload), { encoding: "utf8", mode: 0o600 });
	return file;
}

function buildTmuxArgs(options: {
	direction: Direction;
	size?: number;
	cwd: string;
	prefillFile: string;
	sessionFile: string;
}): string[] {
	const args = ["split-window"];
	if (options.direction === "left" || options.direction === "right") {
		args.push("-h");
	} else {
		args.push("-v");
	}
	if (options.direction === "left" || options.direction === "up") args.push("-b");
	if (options.size !== undefined) args.push("-p", String(options.size));
	args.push("-c", options.cwd, "-P", "-F", "#{pane_id}");
	args.push(buildPaneCommand(options.prefillFile, options.sessionFile));
	return args;
}

function buildPaneCommand(prefillFile: string, sessionFile: string): string {
	const piCommand = process.env[COMMAND_ENV]?.trim() || "pi";
	const parts = [
		"env",
		`${PREFILL_ENV}=${shellQuote(prefillFile)}`,
		piCommand,
		"--session",
		shellQuote(sessionFile),
	];
	const command = parts.join(" ");
	return isTruthyEnv(process.env[CLOSE_ON_EXIT_ENV]) ? command : `${command}; exec "\${SHELL:-/bin/sh}"`;
}

function shellQuote(value: string): string {
	return `'${value.replace(/'/g, `'\\''`)}'`;
}

async function maybeApplyPrefill(ctx: ExtensionContext): Promise<void> {
	const prefillFile = process.env[PREFILL_ENV];
	if (!prefillFile || !ctx.hasUI) return;

	let payload: PrefillPayload | undefined;
	try {
		payload = JSON.parse(await readFile(prefillFile, "utf8")) as PrefillPayload;
	} catch {
		await safeUnlink(prefillFile);
		return;
	}

	await safeUnlink(prefillFile);
	delete process.env[PREFILL_ENV];

	if (!payload || typeof payload.text !== "string" || typeof payload.sessionFile !== "string") return;
	if (Date.now() - Number(payload.createdAt || 0) > PREFILL_MAX_AGE_MS) return;

	const currentSessionFile = ctx.sessionManager.getSessionFile();
	if (!currentSessionFile || path.resolve(currentSessionFile) !== path.resolve(payload.sessionFile)) return;
	if (ctx.ui.getEditorText()) return;

	ctx.ui.setEditorText(payload.text);
}

async function safeUnlink(file: string): Promise<void> {
	try {
		await unlink(file);
	} catch {
		// Best effort cleanup.
	}
}

function isTruthyEnv(value: string | undefined): boolean {
	return value === "1" || value === "true" || value === "yes" || value === "on";
}
