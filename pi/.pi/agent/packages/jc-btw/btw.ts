/**
 * @juicesharp/rpiv-btw — /btw side-question slash command.
 *
 * Asks the same primary model a one-off side question using the cloned primary
 * conversation as context. Answer is rendered ephemerally in a bottom-slot
 * overlay (never enters main agent's messages). History persists per-session-file
 * via globalThis-keyed storage; process-scoped only (no disk persistence).
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
	type AssistantMessage,
	completeSimple,
	type Message,
	type StopReason,
	type UserMessage,
} from "@earendil-works/pi-ai";
import {
	buildSessionContext,
	convertToLlm,
	estimateTokens,
	type ExtensionAPI,
	type ExtensionCommandContext,
	type ExtensionContext,
	type SessionContext,
	type SessionEntry,
} from "@earendil-works/pi-coding-agent";
import { showBtwOverlay } from "./btw-ui.js";
import { sanitizeToolPairs } from "./tool-pairs.js";

// ---------------------------------------------------------------------------
// Constants — flat named consts, grouped by concern (advisor pattern, b9428e9)
// ---------------------------------------------------------------------------

// Identity
export const BTW_COMMAND_NAME = "btw";

// Storage — globalThis-keyed survives module re-import on /new, /fork, /resume.
// Lost on Pi process exit (intentional — no disk persistence).
export const BTW_STATE_KEY = Symbol.for("jc-btw");

// Cross-session pattern hint: how many recent question-strings to inject
export const CROSS_SESSION_HINT_LIMIT = 10;

// Main-context clone budget. Keep /btw lightweight even when main session is near full.
const BTW_MAIN_CONTEXT_WINDOW_FRACTION = 0.65;
const BTW_MAIN_CONTEXT_RESERVE_TOKENS = 16_384;
const BTW_MAIN_CONTEXT_MIN_TOKENS = 8_000;
const BTW_MAIN_CONTEXT_MAX_TOKENS = 120_000;
const BTW_HISTORY_WINDOW_FRACTION = 0.15;
const BTW_HISTORY_MIN_TOKENS = 4_000;
const BTW_HISTORY_MAX_TOKENS = 24_000;
const BTW_HISTORY_TURN_LIMIT = 12;
const BTW_LIVE_ASSISTANT_TEXT_LIMIT = 8_000;
const BTW_LIVE_TOOL_TEXT_LIMIT = 4_000;

// Messages (static)
const MSG_REQUIRES_INTERACTIVE = "/btw requires interactive mode";
const MSG_USAGE = "Usage: /btw <question>";
const MSG_NO_MODEL = "/btw requires an active model";

// Errors (static)
const ERR_EMPTY_RESPONSE = "/btw returned no text content.";

// Errors (parameterized)
const errMisconfigured = (label: string, err: string) => `/btw model (${label}) is misconfigured: ${err}`;
const errNoApiKey = (label: string) => `/btw model (${label}) has no API key available.`;
const errCallFailed = (err: string | undefined) => `/btw call failed: ${err ?? "unknown error"}`;
const errCallThrew = (msg: string) => `/btw call threw: ${msg}`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// Real messages — no fabrication. userMessage is built at call time; assistantMessage
// is the unmodified completeSimple response. Stable object references across calls →
// byte-identical prompt prefix on subsequent /btw invocations (cache parity).
export interface BtwTurn {
	userMessage: UserMessage;
	assistantMessage: AssistantMessage;
}

interface BtwLiveToolUpdate {
	toolName: string;
	text: string;
	isError: boolean;
}

interface BtwLiveContext {
	assistantText: string;
	toolUpdates: Map<string, BtwLiveToolUpdate>;
}

interface BtwState {
	histories: Map<string, BtwTurn[]>;
	snapshots: Map<string, { messages: Message[] }>;
	liveContexts: Map<string, BtwLiveContext>;
}

function branchToAgentMessages(branch: SessionEntry[]): SessionContext["messages"] {
	return branch.filter((e): e is SessionEntry & { type: "message" } => e.type === "message").map((e) => e.message);
}

function getBtwInputTokenBudget(model: ExtensionContext["model"]): number {
	const contextWindow = model?.contextWindow ?? 128_000;
	const reserveTokens = Math.min(BTW_MAIN_CONTEXT_RESERVE_TOKENS, Math.max(1_024, Math.floor(contextWindow * 0.25)));
	return Math.max(1_024, Math.floor(contextWindow * 0.9) - reserveTokens);
}

function boundTokenBudget(target: number, min: number, max: number, ceiling: number): number {
	const safeCeiling = Math.max(0, ceiling);
	const boundedTarget = Math.min(target, max, safeCeiling);
	const minWhenPossible = Math.min(min, safeCeiling);
	return Math.max(minWhenPossible, boundedTarget);
}

function getMainContextTokenBudget(model: ExtensionContext["model"]): number {
	const inputBudget = getBtwInputTokenBudget(model);
	const historyCeiling = Math.floor(inputBudget * BTW_HISTORY_WINDOW_FRACTION);
	const mainCeiling = inputBudget - historyCeiling;
	const target = Math.floor(inputBudget * BTW_MAIN_CONTEXT_WINDOW_FRACTION);
	return boundTokenBudget(target, BTW_MAIN_CONTEXT_MIN_TOKENS, BTW_MAIN_CONTEXT_MAX_TOKENS, mainCeiling);
}

function getHistoryTokenBudget(model: ExtensionContext["model"]): number {
	const inputBudget = getBtwInputTokenBudget(model);
	const ceiling = Math.floor(inputBudget * BTW_HISTORY_WINDOW_FRACTION);
	const target = ceiling;
	return boundTokenBudget(target, BTW_HISTORY_MIN_TOKENS, BTW_HISTORY_MAX_TOKENS, ceiling);
}

function isSummaryMessage(message: SessionContext["messages"][number]): boolean {
	return message.role === "compactionSummary" || message.role === "branchSummary";
}

function limitContextMessages(messages: SessionContext["messages"], tokenBudget: number): SessionContext["messages"] {
	if (messages.length === 0 || tokenBudget <= 0) return [];

	const summaryIndex = messages.findIndex(isSummaryMessage);
	const summary = summaryIndex >= 0 ? messages[summaryIndex] : undefined;
	const summaryTokens = summary ? estimateTokens(summary) : 0;
	const includeSummary = !!summary && summaryTokens < Math.floor(tokenBudget / 3);
	const tailBudget = includeSummary ? tokenBudget - summaryTokens : tokenBudget;

	let usedTokens = 0;
	let startIndex = messages.length;
	while (startIndex > 0) {
		const candidate = messages[startIndex - 1];
		const candidateTokens = estimateTokens(candidate);
		if (usedTokens > 0 && usedTokens + candidateTokens > tailBudget) break;
		if (usedTokens === 0 && candidateTokens > tailBudget) break;
		usedTokens += candidateTokens;
		startIndex -= 1;
	}

	while (startIndex < messages.length && messages[startIndex]?.role === "toolResult") {
		startIndex += 1;
	}

	const kept = new Set<number>();
	if (includeSummary) kept.add(summaryIndex);
	for (let i = startIndex; i < messages.length; i += 1) kept.add(i);

	return [...kept]
		.sort((a, b) => a - b)
		.map((index) => messages[index]);
}

function appendExtraMessage(
	messages: SessionContext["messages"],
	extraMessage?: SessionContext["messages"][number],
): SessionContext["messages"] {
	if (!extraMessage) return messages;
	if (messages[messages.length - 1] === extraMessage) return messages;
	return [...messages, extraMessage];
}

function convertBoundedContext(messages: SessionContext["messages"], tokenBudget: number): Message[] {
	return sanitizeToolPairs(convertToLlm(limitContextMessages(messages, tokenBudget)));
}

function buildMainContextMessages(ctx: ExtensionContext, extraMessage?: SessionContext["messages"][number]): Message[] {
	const tokenBudget = getMainContextTokenBudget(ctx.model);
	try {
		const sessionContext = buildSessionContext(ctx.sessionManager.getEntries(), ctx.sessionManager.getLeafId());
		return convertBoundedContext(appendExtraMessage(sessionContext.messages, extraMessage), tokenBudget);
	} catch {
		const branch = ctx.sessionManager.getBranch() as SessionEntry[];
		return convertBoundedContext(appendExtraMessage(branchToAgentMessages(branch), extraMessage), tokenBudget);
	}
}

function limitBtwHistoryTurns(history: BtwTurn[], model: ExtensionContext["model"]): BtwTurn[] {
	const recent = history.slice(-BTW_HISTORY_TURN_LIMIT);
	const tokenBudget = getHistoryTokenBudget(model);
	let usedTokens = 0;
	let startIndex = recent.length;

	while (startIndex > 0) {
		const turn = recent[startIndex - 1];
		const turnTokens = estimateTokens(turn.userMessage) + estimateTokens(turn.assistantMessage);
		if (usedTokens > 0 && usedTokens + turnTokens > tokenBudget) break;
		if (usedTokens === 0 && turnTokens > tokenBudget) break;
		usedTokens += turnTokens;
		startIndex -= 1;
	}

	return recent.slice(startIndex);
}

// ---------------------------------------------------------------------------
// System prompt — loaded once at module init from prompts/btw-system.txt
// ---------------------------------------------------------------------------

export const BTW_SYSTEM_PROMPT = readFileSync(
	fileURLToPath(new URL("./prompts/btw-system.txt", import.meta.url)),
	"utf-8",
).trimEnd();

// ---------------------------------------------------------------------------
// Storage — globalThis-keyed, survives module re-import on /new, /fork, /resume.
// Standard Node.js `globalThis + Symbol.for()` idiom for cross-import-graph
// singleton state (used by OpenTelemetry, etc.); lost on process exit.
// ---------------------------------------------------------------------------

function getState(): BtwState {
	const g = globalThis as unknown as { [k: symbol]: BtwState | undefined };
	let state = g[BTW_STATE_KEY];
	if (!state) {
		state = {
			histories: new Map(),
			snapshots: new Map(),
			liveContexts: new Map(),
		};
		g[BTW_STATE_KEY] = state;
	} else if (!state.liveContexts) {
		state.liveContexts = new Map();
	}
	return state;
}

function getSessionFile(ctx: ExtensionContext): string {
	return ctx.sessionManager.getSessionFile() ?? `memory:${ctx.sessionManager.getSessionId()}`;
}

function getSessionHistory(ctx: ExtensionContext): BtwTurn[] {
	const key = getSessionFile(ctx);
	const state = getState();
	let turns = state.histories.get(key);
	if (!turns) {
		turns = [];
		state.histories.set(key, turns);
	}
	return turns;
}

function pushSessionTurn(ctx: ExtensionContext, turn: BtwTurn): void {
	getSessionHistory(ctx).push(turn);
}

export function clearSessionHistory(ctx: ExtensionContext): void {
	getState().histories.set(getSessionFile(ctx), []);
}

function getSnapshot(ctx: ExtensionContext): { messages: Message[] } | undefined {
	return getState().snapshots.get(getSessionFile(ctx));
}

function setSnapshot(ctx: ExtensionContext, snapshot: { messages: Message[] }): void {
	getState().snapshots.set(getSessionFile(ctx), snapshot);
}

export function invalidateSnapshot(ctx: ExtensionContext): void {
	getState().snapshots.delete(getSessionFile(ctx));
}

function getLiveContext(ctx: ExtensionContext): BtwLiveContext {
	const key = getSessionFile(ctx);
	const state = getState();
	let live = state.liveContexts.get(key);
	if (!live) {
		live = { assistantText: "", toolUpdates: new Map() };
		state.liveContexts.set(key, live);
	}
	return live;
}

function readLiveContext(ctx: ExtensionContext): BtwLiveContext | undefined {
	return getState().liveContexts.get(getSessionFile(ctx));
}

function clearLiveContext(ctx: ExtensionContext): void {
	getState().liveContexts.delete(getSessionFile(ctx));
}

function truncateText(text: string, maxChars: number): string {
	if (text.length <= maxChars) return text;
	return `${text.slice(0, maxChars)}\n… [truncated ${text.length - maxChars} chars]`;
}

function setLiveAssistantText(ctx: ExtensionContext, text: string): void {
	getLiveContext(ctx).assistantText = truncateText(text.trim(), BTW_LIVE_ASSISTANT_TEXT_LIMIT);
}

function setLiveToolUpdate(
	ctx: ExtensionContext,
	toolCallId: string,
	toolName: string,
	text: string,
	isError: boolean,
): void {
	getLiveContext(ctx).toolUpdates.set(toolCallId, {
		toolName,
		text: truncateText(text.trim(), BTW_LIVE_TOOL_TEXT_LIMIT),
		isError,
	});
}

function deleteLiveToolUpdate(ctx: ExtensionContext, toolCallId: string): void {
	const live = readLiveContext(ctx);
	if (!live) return;
	live.toolUpdates.delete(toolCallId);
	if (!live.assistantText && live.toolUpdates.size === 0) clearLiveContext(ctx);
}

function isTextContent(value: unknown): value is { type: "text"; text: string } {
	if (typeof value !== "object" || value === null) return false;
	const content = value as { type?: unknown; text?: unknown };
	return content.type === "text" && typeof content.text === "string";
}

function contentText(value: unknown): string | undefined {
	if (typeof value === "string") return value;
	if (!Array.isArray(value)) return undefined;
	const text = value.filter(isTextContent).map((part) => part.text).join("\n");
	return text || undefined;
}

function unknownToText(value: unknown): string {
	const direct = contentText(value);
	if (direct) return direct;
	if (typeof value === "object" && value !== null) {
		const nested = contentText((value as { content?: unknown }).content);
		if (nested) return nested;
	}
	try {
		return JSON.stringify(value) ?? String(value);
	} catch {
		return String(value);
	}
}

function buildLiveContextMessage(ctx: ExtensionContext): UserMessage | undefined {
	if (ctx.isIdle()) return undefined;
	const live = readLiveContext(ctx);
	if (!live) return undefined;

	const sections: string[] = [];
	if (live.assistantText) {
		sections.push(`Current main assistant response (partial, not finalized):\n${live.assistantText}`);
	}

	const toolLines = [...live.toolUpdates.entries()]
		.map(([toolCallId, update]) => {
			if (!update.text) return undefined;
			const status = update.isError ? "error" : "running/partial";
			return `- ${update.toolName} (${status}, ${toolCallId}): ${update.text}`;
		})
		.filter((line): line is string => line !== undefined);
	if (toolLines.length > 0) {
		sections.push(`Current main tool activity (partial, not finalized):\n${toolLines.join("\n")}`);
	}

	if (sections.length === 0) return undefined;
	return {
		role: "user",
		content: [
			{
				type: "text",
				text: `<live-main-session-context>\nThese notes come from Pi extension events while the main agent is still running. They are not finalized transcript turns.\n\n${sections.join("\n\n")}\n</live-main-session-context>`,
			},
		],
		timestamp: Date.now(),
	};
}

// Extract text from a UserMessage's content.
export function userMessageText(msg: UserMessage): string {
	if (typeof msg.content === "string") return msg.content;
	return msg.content
		.filter((c): c is { type: "text"; text: string } => c.type === "text")
		.map((c) => c.text)
		.join("\n");
}

// Extract text from an AssistantMessage's content (text parts only).
export function assistantMessageText(msg: AssistantMessage): string {
	return msg.content
		.filter((c): c is { type: "text"; text: string } => c.type === "text")
		.map((c) => c.text)
		.join("\n");
}

// Cross-session pattern hint — last N question-strings across ALL sessions.
function getCrossSessionHint(): string {
	const allTurns: { q: string; ts: number }[] = [];
	for (const turns of getState().histories.values()) {
		for (const t of turns) {
			allTurns.push({ q: userMessageText(t.userMessage), ts: t.userMessage.timestamp });
		}
	}
	if (allTurns.length === 0) return "";
	const recent = allTurns.sort((a, b) => a.ts - b.ts).slice(-CROSS_SESSION_HINT_LIMIT);
	const lines = recent.map((t, i) => `${i + 1}. ${t.q.replace(/\s+/g, " ").slice(0, 200)}`);
	return `\n\n## Recent /btw questions across sessions (oldest first)\n\n${lines.join("\n")}`;
}

// ---------------------------------------------------------------------------
// Executor — auth, message threading, completeSimple, four StopReason branches
// Modeled after rpiv-advisor/advisor.ts:225-336
// ---------------------------------------------------------------------------

export type BtwExecResult =
	| { ok: true; answer: string; userMessage: UserMessage; assistantMessage: AssistantMessage; stopReason: StopReason }
	| { ok: false; error: string; stopReason?: StopReason }
	| { ok: false; aborted: true; stopReason: StopReason };

function readMainContextMessages(ctx: ExtensionContext): Message[] {
	const liveMessage = buildLiveContextMessage(ctx);
	if (!ctx.isIdle()) return buildMainContextMessages(ctx, liveMessage);

	const cached = getSnapshot(ctx);
	if (cached) return cached.messages;
	// Cold start or invalidated snapshot — fall back to live session read.
	return buildMainContextMessages(ctx, liveMessage);
}

function buildBtwMessages(ctx: ExtensionContext, userMessage: UserMessage): Message[] {
	const mainContextMessages = readMainContextMessages(ctx);
	const history = limitBtwHistoryTurns(getSessionHistory(ctx), ctx.model);
	// Reusing stored real UserMessage/AssistantMessage object references across calls
	// preserves byte-identical prompt prefix (cache parity).
	const historyMessages: Message[] = history.flatMap((h) => [h.userMessage, h.assistantMessage]);
	return [...mainContextMessages, ...historyMessages, userMessage];
}

function buildSystemPrompt(): string {
	return BTW_SYSTEM_PROMPT + getCrossSessionHint();
}

export async function executeBtw(
	question: string,
	ctx: ExtensionContext,
	controller: AbortController,
): Promise<BtwExecResult> {
	const model = ctx.model;
	if (!model) {
		return { ok: false, error: MSG_NO_MODEL };
	}
	const modelLabel = `${model.provider}:${model.id}`;

	const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
	if (!auth.ok) {
		return { ok: false, error: errMisconfigured(modelLabel, auth.error) };
	}
	if (!auth.apiKey) {
		return { ok: false, error: errNoApiKey(modelLabel) };
	}

	const userMessage: UserMessage = {
		role: "user",
		content: [{ type: "text", text: question }],
		timestamp: Date.now(),
	};
	const messages = buildBtwMessages(ctx, userMessage);
	const systemPrompt = buildSystemPrompt();

	try {
		const response = await completeSimple(
			model,
			{ systemPrompt, messages, tools: [] },
			{
				apiKey: auth.apiKey,
				headers: auth.headers,
				signal: controller.signal, // own AbortController, NOT ctx.signal (Decision 8)
			},
		);

		if (response.stopReason === "aborted") {
			return { ok: false, aborted: true, stopReason: response.stopReason };
		}
		if (response.stopReason === "error") {
			return {
				ok: false,
				error: errCallFailed(response.errorMessage),
				stopReason: response.stopReason,
			};
		}

		const answerText = assistantMessageText(response).trim();
		if (!answerText) {
			return { ok: false, error: ERR_EMPTY_RESPONSE, stopReason: response.stopReason };
		}

		return {
			ok: true,
			answer: answerText,
			userMessage,
			assistantMessage: response,
			stopReason: response.stopReason,
		};
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		if (controller.signal.aborted) {
			return { ok: false, aborted: true, stopReason: "aborted" as const };
		}
		return { ok: false, error: errCallThrew(message) };
	}
}

// ---------------------------------------------------------------------------
// Registrars — command + snapshot/live-context lifecycle hooks
// ---------------------------------------------------------------------------

export function registerMessageEndSnapshot(pi: ExtensionAPI): void {
	pi.on("message_end", async (event, ctx) => {
		const msg = event.message;
		if (msg.role === "assistant") {
			const assistant = msg as AssistantMessage;
			if (assistant.stopReason === "toolUse") {
				setLiveAssistantText(ctx, assistantMessageText(assistant));
				invalidateSnapshot(ctx);
				return;
			}
			setSnapshot(ctx, { messages: buildMainContextMessages(ctx, assistant) });
			clearLiveContext(ctx);
			return;
		}

		if (msg.role === "toolResult") deleteLiveToolUpdate(ctx, msg.toolCallId);
		invalidateSnapshot(ctx);
	});
}

export function registerInvalidationHooks(pi: ExtensionAPI): void {
	pi.on("agent_start", async (_e, ctx) => {
		invalidateSnapshot(ctx);
		clearLiveContext(ctx);
	});
	pi.on("agent_end", async (_e, ctx) => {
		clearLiveContext(ctx);
	});
	pi.on("message_update", async (event, ctx) => {
		if (event.message.role !== "assistant") return;
		setLiveAssistantText(ctx, assistantMessageText(event.message as AssistantMessage));
		invalidateSnapshot(ctx);
	});
	pi.on("tool_execution_start", async (event, ctx) => {
		setLiveToolUpdate(ctx, event.toolCallId, event.toolName, `started with args: ${unknownToText(event.args)}`, false);
		invalidateSnapshot(ctx);
	});
	pi.on("tool_execution_update", async (event, ctx) => {
		setLiveToolUpdate(ctx, event.toolCallId, event.toolName, unknownToText(event.partialResult), false);
		invalidateSnapshot(ctx);
	});
	pi.on("tool_execution_end", async (event, ctx) => {
		setLiveToolUpdate(ctx, event.toolCallId, event.toolName, unknownToText(event.result), event.isError);
		invalidateSnapshot(ctx);
	});
	pi.on("session_compact", async (_e, ctx) => {
		invalidateSnapshot(ctx);
		clearLiveContext(ctx);
	});
	pi.on("session_tree", async (_e, ctx) => {
		invalidateSnapshot(ctx);
		clearLiveContext(ctx);
	});
	pi.on("model_select", async (_e, ctx) => {
		invalidateSnapshot(ctx);
		clearLiveContext(ctx);
	});
}

export function registerBtwCommand(pi: ExtensionAPI): void {
	pi.registerCommand(BTW_COMMAND_NAME, {
		description: "Ask a side question without polluting the main conversation",
		handler: (args: string, ctx: ExtensionCommandContext) => handleBtwCommand(pi, args, ctx),
	});
}

async function handleBtwCommand(_pi: ExtensionAPI, args: string, ctx: ExtensionCommandContext): Promise<void> {
	if (ctx.mode !== "tui") {
		ctx.ui.notify(MSG_REQUIRES_INTERACTIVE, "error");
		return;
	}
	const question = args.trim();
	if (!question) {
		ctx.ui.notify(MSG_USAGE, "warning");
		return;
	}
	if (!ctx.model) {
		ctx.ui.notify(MSG_NO_MODEL, "error");
		return;
	}

	const controller = new AbortController();
	const historySnapshot = [...getSessionHistory(ctx)];

	try {
		const { overlayPromise, controllerReady } = showBtwOverlay({
			ctx,
			question,
			history: historySnapshot,
			controller,
			onClearHistory: () => clearSessionHistory(ctx),
			setFooterStatus: (value) =>
				ctx.ui.setStatus("jc-btw", value ? ctx.ui.theme.fg("dim", value) : undefined),
		});

		const overlayCtl = await controllerReady;
		const result = await executeBtw(question, ctx, controller);

		if (result.ok) {
			overlayCtl.setAnswer(result.answer);
			pushSessionTurn(ctx, {
				userMessage: result.userMessage,
				assistantMessage: result.assistantMessage,
			});
			// No disk persistence — process-scoped only (Decision 4)
		} else if ("aborted" in result) {
			// User Esc'd — overlay already dismissed via done(); no further action
		} else {
			overlayCtl.setError(result.error);
		}

		await overlayPromise;
	} finally {
		ctx.ui.setStatus("jc-btw", undefined);
	}
}
