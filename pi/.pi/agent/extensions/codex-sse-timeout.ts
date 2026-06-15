import { getAgentDir, SettingsManager, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { basename, dirname, join } from "node:path";

const CODEX_SSE_HEADER_TIMEOUT_MS_VALUES = [10_000, 20_000] as const;
const CODEX_SSE_HEADER_TIMEOUT_MS_SET = new Set<number>(CODEX_SSE_HEADER_TIMEOUT_MS_VALUES);
const CODEX_SSE_HEADER_TIMEOUT_DEFINITION_SNIPPETS = [
	"const DEFAULT_SSE_HEADER_TIMEOUT_MS = 10_000;",
	"const DEFAULT_SSE_HEADER_TIMEOUT_MS = 20_000;",
	"DEFAULT_SSE_HEADER_TIMEOUT_MS = 1e4",
	"DEFAULT_SSE_HEADER_TIMEOUT_MS = 2e4",
	"DEFAULT_SSE_HEADER_TIMEOUT_MS = 10000",
	"DEFAULT_SSE_HEADER_TIMEOUT_MS = 20000",
];
const PATCH_KEY = Symbol.for("pi.extension.codexSseHeaderTimeoutPatch");

function getCodexSseTimeoutErrorMessage(timeoutMs: number): string {
	return `Codex SSE response headers timed out after ${timeoutMs}ms`;
}

type PatchState = {
	originalSetTimeout: typeof globalThis.setTimeout;
	originalAbort: typeof AbortController.prototype.abort;
	timeoutMs: number;
	providerKind: "package" | "bundled";
};

export default function codexSseTimeoutExtension(pi: ExtensionAPI) {
	const providerValidation = validateInstalledCodexProvider();
	if (providerValidation.error) {
		const message = `Codex SSE timeout extension disabled: ${providerValidation.error}`;
		console.warn(`[codex-sse-timeout] ${message}`);
		pi.on("session_start", (_event, ctx) => {
			if (ctx.hasUI) ctx.ui.setStatus("codex-sse-timeout", `[codex-sse-timeout] ${message}`);
		});
		return;
	}

	installPatch(providerValidation.kind!);
}

function installPatch(providerKind: "package" | "bundled"): void {
	const global = globalThis as unknown as Record<symbol, PatchState | undefined>;
	const state: PatchState = global[PATCH_KEY] ?? {
		originalSetTimeout: globalThis.setTimeout,
		originalAbort: AbortController.prototype.abort,
		timeoutMs: getHttpIdleTimeoutMs(),
		providerKind,
	};
	state.timeoutMs = getHttpIdleTimeoutMs();
	state.providerKind = providerKind;

	globalThis.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
		if (
			typeof timeout === "number" &&
			CODEX_SSE_HEADER_TIMEOUT_MS_SET.has(timeout) &&
			isCodexSseHeaderTimer(state.providerKind)
		) {
			return state.originalSetTimeout(handler, state.timeoutMs, ...args);
		}

		return state.originalSetTimeout(handler, timeout, ...args);
	}) as typeof globalThis.setTimeout;

	AbortController.prototype.abort = function patchedAbort(this: AbortController, reason?: unknown): void {
		if (isCodexSseTimeoutError(reason, state.providerKind)) {
			reason = new Error(`Codex SSE response headers timed out after ${state.timeoutMs}ms`);
		}
		return state.originalAbort.call(this, reason);
	};

	global[PATCH_KEY] = state;
}

function getHttpIdleTimeoutMs(): number {
	return SettingsManager.create(process.cwd(), getAgentDir()).getHttpIdleTimeoutMs();
}

function isCodexSseHeaderTimer(providerKind: "package" | "bundled"): boolean {
	const stack = new Error().stack ?? "";
	if (!stack.includes("createSSEHeaderTimeout")) return false;
	return providerKind === "bundled" || stack.includes("openai-codex-responses");
}

function isCodexSseTimeoutError(reason: unknown, providerKind: "package" | "bundled"): reason is Error {
	if (!(reason instanceof Error)) return false;
	const isKnownTimeoutMessage = CODEX_SSE_HEADER_TIMEOUT_MS_VALUES.some(
		(timeoutMs) => reason.message === getCodexSseTimeoutErrorMessage(timeoutMs),
	);
	if (!isKnownTimeoutMessage) return false;
	if (providerKind === "bundled") return true;
	return (reason.stack ?? "").includes("openai-codex-responses");
}

type ProviderValidation =
	| { kind: "package" | "bundled"; error?: undefined }
	| { kind?: undefined; error: string };

function validateInstalledCodexProvider(): ProviderValidation {
	const packageProviderPath = resolveCodexProviderPackagePath();
	if (packageProviderPath) {
		const source = readFileSync(packageProviderPath, "utf8");
		const requiredSnippetGroups = [
			CODEX_SSE_HEADER_TIMEOUT_DEFINITION_SNIPPETS,
			["function createSSEHeaderTimeout()"],
			["Codex SSE response headers timed out after ${DEFAULT_SSE_HEADER_TIMEOUT_MS}ms"],
			["const headerTimeout = createSSEHeaderTimeout();"],
		];

		const missing = requiredSnippetGroups.filter((snippets) => !snippets.some((snippet) => source.includes(snippet)));
		return missing.length === 0
			? { kind: "package" }
			: {
					error: `provider code did not match expected implementation; missing ${missing.length} validation snippet(s)`,
				};
	}

	const bundledProviderPath = resolveBundledPiPath();
	if (!bundledProviderPath) return { error: "could not locate installed Codex provider file or bundled pi executable" };

	const source = readFileSync(bundledProviderPath);
	const requiredSnippetGroups = [
		CODEX_SSE_HEADER_TIMEOUT_DEFINITION_SNIPPETS,
		["function createSSEHeaderTimeout()"],
		["Codex SSE response headers timed out after ${DEFAULT_SSE_HEADER_TIMEOUT_MS}ms"],
		["const headerTimeout = createSSEHeaderTimeout();"],
	];

	const missing = requiredSnippetGroups.filter((snippets) => !snippets.some((snippet) => bufferIncludes(source, snippet)));
	return missing.length === 0
		? { kind: "bundled" }
		: {
				error: `bundled provider code did not match expected implementation; missing ${missing.length} validation snippet(s)`,
			};
}

function bufferIncludes(source: Buffer, snippet: string): boolean {
	return source.includes(Buffer.from(snippet, "utf8"));
}

function resolveCodexProviderPackagePath(): string | undefined {
	const cliPath = resolveCliPath();
	if (!cliPath) return undefined;

	const packageRoot = dirname(dirname(cliPath));
	const providerPath = join(
		packageRoot,
		"node_modules",
		"@earendil-works",
		"pi-ai",
		"dist",
		"providers",
		"openai-codex-responses.js",
	);

	return existsSync(providerPath) ? providerPath : undefined;
}

function resolveBundledPiPath(): string | undefined {
	const cliPath = resolveCliPath();
	return cliPath && basename(cliPath) === "pi" && existsSync(cliPath) ? cliPath : undefined;
}

function resolveCliPath(): string | undefined {
	const argvPath = process.argv[1];
	// Bundled bun single-file executables expose argv[1] as a virtual path
	// (e.g. "/$bunfs/root/pi") absent from disk; lstat/realpathSync throws
	// ENOENT for it. Fall back to the real binary via process.execPath.
	if (argvPath && !argvPath.startsWith("/$bunfs")) {
		try {
			return realpathSync(argvPath);
		} catch {
			// fall through to execPath
		}
	}
	try {
		return process.execPath ? realpathSync(process.execPath) : undefined;
	} catch {
		return process.execPath || undefined;
	}
}
