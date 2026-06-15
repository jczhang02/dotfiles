import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const AGENT_REACH_PLATFORMS = [
	"twitter",
	"bilibili",
	"github_repos",
	"github_code",
	"youtube",
	"web",
	"v2ex",
	"reddit",
	"xiaohongshu",
] as const;

export type AgentReachPlatform = typeof AGENT_REACH_PLATFORMS[number];

type PlatformStatus = "ok" | "error" | "unavailable";

interface DoctorEntry {
	status?: string;
	name?: string;
	message?: string;
	active_backend?: string | null;
	backends?: string[];
}

type DoctorReport = Record<string, DoctorEntry>;

export interface NormalizedAgentReachParams {
	query: string;
	platforms: AgentReachPlatform[];
	limit: number;
}

export interface AgentReachPlatformResult {
	platform: AgentReachPlatform;
	status: PlatformStatus;
	backend: string | null;
	command?: string[];
	text?: string;
	error?: string;
	fix?: string;
}

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 20;
const COMMAND_TIMEOUT_MS = 90_000;
const MAX_STDOUT_CHARS = 120_000;
const MAX_PLATFORM_CHARS = 6_000;
const MAX_TOTAL_CHARS = 18_000;
const MAX_ERROR_CHARS = 2_000;
const AGENT_REACH_CWD = process.env.PI_AGENT_HOME ?? join(homedir(), ".pi", "agent");

export function normalizeAgentReachParams(input: Record<string, unknown>): NormalizedAgentReachParams {
	const query = typeof input.query === "string" ? input.query.trim() : "";
	const limitInput = typeof input.limit === "number" && Number.isFinite(input.limit)
		? Math.floor(input.limit)
		: DEFAULT_LIMIT;
	const limit = Math.max(1, Math.min(MAX_LIMIT, limitInput));
	const requested = Array.isArray(input.platforms) ? input.platforms : [];
	const seen = new Set<AgentReachPlatform>();
	const platforms: AgentReachPlatform[] = [];
	for (const value of requested) {
		if (typeof value !== "string") continue;
		if (!isAgentReachPlatform(value)) continue;
		if (seen.has(value)) continue;
		seen.add(value);
		platforms.push(value);
	}
	return {
		query,
		platforms,
		limit,
	};
}

function isAgentReachPlatform(value: string): value is AgentReachPlatform {
	return (AGENT_REACH_PLATFORMS as readonly string[]).includes(value);
}

export function buildCommandForPlatform(
	platform: AgentReachPlatform,
	query: string,
	limit: number,
	doctor: DoctorReport,
): { command: string; args: string[]; backend: string | null } | { unavailable: true; backend: string | null; fix: string } {
	const backend = activeBackendFor(platform, doctor);
	const backendLower = backend?.toLowerCase() ?? "";

	switch (platform) {
		case "twitter":
			if (backendLower.includes("twitter-cli")) {
				return { command: "twitter", args: ["search", query, "-n", String(limit), "--json"], backend };
			}
			return unavailable(platform, backend, "twitter-cli unavailable. Configure Agent-Reach Twitter without OpenCLI.");

		case "bilibili":
			if (backendLower.includes("bili-cli")) {
				return { command: "bili", args: ["search", query, "--type", "video", "-n", String(limit), "--json"], backend };
			}
			if (backendLower.includes("b站搜索 api")) {
				return { command: "python3", args: ["-c", bilibiliApiScript(), query, String(limit)], backend };
			}
			return unavailable(platform, backend, "bili-cli unavailable. Install via uv tool or pipx if needed.");

		case "github_repos": {
			const githubBackend = activeBackendFor("github", doctor);
			if (githubBackend?.toLowerCase().includes("gh")) {
				return { command: "gh", args: ["search", "repos", query, "--sort", "stars", "--limit", String(limit), "--json", "fullName,description,url,stargazersCount,language"], backend: githubBackend };
			}
			return unavailable(platform, githubBackend, "gh CLI unavailable.");
		}

		case "github_code": {
			const githubBackend = activeBackendFor("github", doctor);
			if (githubBackend?.toLowerCase().includes("gh")) {
				return { command: "gh", args: ["search", "code", query, "--limit", String(limit), "--json", "repository,path,url"], backend: githubBackend };
			}
			return unavailable(platform, githubBackend, "gh CLI unavailable.");
		}

		case "youtube":
			if (backendLower.includes("yt-dlp")) {
				return { command: "yt-dlp", args: ["--dump-json", "--skip-download", "--flat-playlist", `ytsearch${limit}:${query}`], backend };
			}
			return unavailable(platform, backend, "yt-dlp unavailable.");

		case "web":
			if (isDoctorOk("exa_search", doctor)) {
				return { command: "mcporter", args: ["call", `exa.web_search_exa(query: ${JSON.stringify(query)}, numResults: ${limit})`], backend: activeBackendFor("exa_search", doctor) };
			}
			return unavailable(platform, activeBackendFor("exa_search", doctor), doctor.exa_search?.message ?? "Exa via mcporter unavailable.");

		case "v2ex":
			if (isDoctorOk("exa_search", doctor)) {
				return { command: "mcporter", args: ["call", `exa.web_search_exa(query: ${JSON.stringify(`site:v2ex.com/t ${query}`)}, numResults: ${limit})`], backend: "Exa site:v2ex.com/t" };
			}
			return unavailable(platform, activeBackendFor("v2ex", doctor), "V2EX has no public full-text search; Exa site search unavailable.");

		case "reddit":
			if (backendLower.includes("rdt-cli")) {
				return { command: "rdt", args: ["search", query, "--limit", String(limit), "--json"], backend };
			}
			return unavailable(platform, backend, "Reddit non-OpenCLI backend unavailable. rdt-cli login required.");

		case "xiaohongshu":
			if (backendLower.includes("xiaohongshu-mcp")) {
				return { command: "mcporter", args: ["call", `xiaohongshu.search_feeds(keyword: ${JSON.stringify(query)})`, "--timeout", "120000"], backend };
			}
			if (backendLower.includes("xhs-cli") || backendLower.includes("xiaohongshu-cli")) {
				return { command: "xhs", args: ["search", query], backend };
			}
			return unavailable(platform, backend, "Xiaohongshu non-OpenCLI backend unavailable. Use xiaohongshu-mcp or existing xhs-cli.");
	}
}

function unavailable(platform: AgentReachPlatform, backend: string | null, fix: string) {
	return { unavailable: true as const, backend, fix };
}

function activeBackendFor(platform: string, doctor: DoctorReport): string | null {
	return doctor[platform]?.active_backend ?? null;
}

function isDoctorOk(platform: string, doctor: DoctorReport): boolean {
	return doctor[platform]?.status === "ok";
}

export async function executeAgentReachSearch(
	params: Record<string, unknown>,
	signal?: AbortSignal,
): Promise<{ content: Array<{ type: "text"; text: string }>; details: Record<string, unknown> }> {
	const normalized = normalizeAgentReachParams(params);
	if (!normalized.query) {
		return errorReturn("No query provided.", { error: "No query provided" });
	}
	if (normalized.platforms.length === 0) {
		return errorReturn("No platforms provided.", {
			error: "No platforms provided",
			fix: "Pass explicit platforms to avoid sending a query to unintended backends.",
			availablePlatforms: AGENT_REACH_PLATFORMS,
		});
	}
	if (normalized.query.startsWith("-")) {
		return errorReturn("Query cannot start with '-'.", {
			error: "Query cannot start with '-'",
			fix: "Prefix the query with words or quotes in natural language so platform CLIs cannot parse it as an option.",
		});
	}

	const doctorResult = await runCommand("agent-reach", ["doctor", "--json"], signal, 30_000);
	if (doctorResult.error) {
		return errorReturn(`Agent-Reach doctor failed: ${doctorResult.error}`, {
			error: doctorResult.error,
			fix: "Install/configure agent-reach, then run agent-reach doctor --json.",
		});
	}

	let doctor: DoctorReport;
	try {
		doctor = JSON.parse(doctorResult.stdout) as DoctorReport;
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return errorReturn(`Agent-Reach doctor returned invalid JSON: ${message}`, {
			error: message,
			stdout: truncate(doctorResult.stdout, 2_000),
			stderr: truncate(doctorResult.stderr, 2_000),
		});
	}

	const results = await Promise.all(normalized.platforms.map(async (platform) => {
		const route = buildCommandForPlatform(platform, normalized.query, normalized.limit, doctor);
		if ("unavailable" in route) {
			return {
				platform,
				status: "unavailable" as const,
				backend: route.backend,
				fix: route.fix,
			};
		}

		const commandResult = await runCommand(route.command, route.args, signal, COMMAND_TIMEOUT_MS);
		if (commandResult.error) {
			return {
				platform,
				status: "error" as const,
				backend: route.backend,
				command: [route.command, ...route.args],
				error: truncate(commandResult.error, MAX_ERROR_CHARS),
				text: formatCommandOutput(commandResult.stdout, normalized.limit),
			};
		}

		return {
			platform,
			status: "ok" as const,
			backend: route.backend,
			command: [route.command, ...route.args],
			text: formatCommandOutput(commandResult.stdout, normalized.limit),
		};
	}));

	const text = formatAgentReachResults(normalized.query, normalized.limit, results);
	const ok = results.filter(r => r.status === "ok").length;
	return {
		content: [{ type: "text", text }],
		details: {
			query: normalized.query,
			platforms: normalized.platforms,
			limit: normalized.limit,
			ok,
			total: results.length,
			results: results.map(r => ({
				platform: r.platform,
				status: r.status,
				backend: r.backend,
				command: r.command,
				error: r.error,
				fix: r.fix,
			})),
		},
	};
}

export function formatAgentReachResults(query: string, limit: number, results: AgentReachPlatformResult[]): string {
	const ok = results.filter(r => r.status === "ok").length;
	const lines: string[] = [
		`# Agent-Reach search: ${query}`,
		``,
		`${ok}/${results.length} sources OK · limit ${limit} · OpenCLI not used`,
	];

	for (const result of results) {
		lines.push("", `## ${result.platform} — ${result.status}`);
		if (result.backend) lines.push(`Backend: ${result.backend}`);
		if (result.command) lines.push(`Command: ${result.command.map(shellish).join(" ")}`);
		if (result.fix) lines.push(`Fix: ${result.fix}`);
		if (result.error) lines.push(`Error: ${result.error}`);
		if (result.text) lines.push("", truncate(result.text, MAX_PLATFORM_CHARS));
	}

	return truncate(lines.join("\n"), MAX_TOTAL_CHARS);
}

function shellish(value: string): string {
	return /^[A-Za-z0-9_./:=@+-]+$/.test(value) ? value : JSON.stringify(value);
}

export function formatCommandOutput(stdout: string, limit: number): string {
	const trimmed = stdout.trim();
	if (!trimmed) return "(no output)";

	const parsed = parseJsonOrNdjson(trimmed);
	if (!parsed) return truncate(trimmed, MAX_PLATFORM_CHARS);

	const items = extractItems(parsed).slice(0, limit);
	if (items.length === 0) return truncate(JSON.stringify(parsed, null, 2), MAX_PLATFORM_CHARS);

	return items.map((item, index) => formatItem(item, index + 1)).join("\n\n");
}

function parseJsonOrNdjson(text: string): unknown | null {
	try { return JSON.parse(text); } catch {}
	const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
	const values: unknown[] = [];
	for (const line of lines) {
		try { values.push(JSON.parse(line)); } catch { return null; }
	}
	return values.length > 0 ? values : null;
}

function extractItems(value: unknown): unknown[] {
	if (Array.isArray(value)) return value;
	if (!value || typeof value !== "object") return [];
	const obj = value as Record<string, unknown>;
	for (const key of ["results", "items", "data", "tweets", "posts", "feeds", "videos"]) {
		if (Array.isArray(obj[key])) return obj[key] as unknown[];
	}
	return [value];
}

function formatItem(value: unknown, index: number): string {
	if (!value || typeof value !== "object") return `${index}. ${String(value)}`;
	const obj = value as Record<string, unknown>;
	const path = firstString(obj, ["path"]);
	const repository = firstString(obj, ["repository"]);
	const title = repository && path
		? `${repository}:${path}`
		: firstString(obj, ["title", "fullName", "name", "text", "content", "description", "path", "repository"]);
	const url = firstString(obj, ["url", "link", "html_url", "webpage_url"]);
	const meta = compact([
		repository && path ? null : repository,
		firstString(obj, ["author", "user", "screen_name", "subreddit", "owner"]),
		numberLabel(obj, "stargazersCount", "stars"),
		numberLabel(obj, "likes", "likes"),
		numberLabel(obj, "score", "score"),
		numberLabel(obj, "comments", "comments"),
		firstString(obj, ["published_at", "created_at", "upload_date", "language"]),
	]).join(" · ");
	const fallback = truncate(JSON.stringify(obj), 500);
	return [
		`${index}. ${truncate(title || fallback, 500)}`,
		meta ? `   ${meta}` : "",
		url ? `   ${url}` : "",
	].filter(Boolean).join("\n");
}

function firstString(obj: Record<string, unknown>, keys: string[]): string | null {
	for (const key of keys) {
		const value = obj[key];
		if (typeof value === "string" && value.trim()) return value.trim();
		if (value && typeof value === "object" && key === "repository") {
			const repo = value as Record<string, unknown>;
			if (typeof repo.fullName === "string") return repo.fullName;
			if (typeof repo.nameWithOwner === "string") return repo.nameWithOwner;
			if (typeof repo.name === "string") return repo.name;
		}
	}
	return null;
}

function numberLabel(obj: Record<string, unknown>, key: string, label: string): string | null {
	const value = obj[key];
	return typeof value === "number" ? `${value} ${label}` : null;
}

function compact<T>(values: Array<T | null | undefined | "">): T[] {
	return values.filter(Boolean) as T[];
}

function truncate(text: string, max: number): string {
	if (text.length <= max) return text;
	return text.slice(0, max - 25) + "\n...[truncated]";
}

async function runCommand(command: string, args: string[], signal: AbortSignal | undefined, timeoutMs: number): Promise<{ stdout: string; stderr: string; code: number | null; error?: string }> {
	return new Promise((resolve) => {
		let stdout = "";
		let stderr = "";
		let settled = false;
		let terminatingError: string | undefined;
		let killTimer: NodeJS.Timeout | undefined;
		const cwd = existsSync(AGENT_REACH_CWD) ? AGENT_REACH_CWD : null;
		if (!cwd) {
			resolve({ stdout, stderr, code: null, error: `Agent-Reach cwd not found: ${AGENT_REACH_CWD}` });
			return;
		}
		if (signal?.aborted) {
			resolve({ stdout, stderr, code: null, error: "Aborted" });
			return;
		}
		const child = spawn(command, args, {
			stdio: ["ignore", "pipe", "pipe"],
			cwd,
		});
		const finish = (result: { stdout: string; stderr: string; code: number | null; error?: string }) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			if (killTimer) clearTimeout(killTimer);
			signal?.removeEventListener("abort", onAbort);
			resolve(result.error ? { ...result, error: truncate(result.error, MAX_ERROR_CHARS) } : result);
		};
		const terminate = (error: string) => {
			if (terminatingError) return;
			terminatingError = error;
			child.kill("SIGTERM");
			killTimer = setTimeout(() => child.kill("SIGKILL"), 2_000);
		};
		const onAbort = () => {
			terminate("Aborted");
		};
		const timer = setTimeout(() => {
			terminate(`Timed out after ${timeoutMs}ms`);
		}, timeoutMs);
		signal?.addEventListener("abort", onAbort, { once: true });
		child.stdout.on("data", (chunk: Buffer) => {
			stdout = capBuffer(stdout + chunk.toString("utf8"));
		});
		child.stderr.on("data", (chunk: Buffer) => {
			stderr = capBuffer(stderr + chunk.toString("utf8"));
		});
		child.on("error", (err) => {
			finish({ stdout, stderr, code: null, error: err.message });
		});
		child.on("close", (code) => {
			if (terminatingError) {
				finish({ stdout, stderr, code, error: terminatingError });
			} else if (code === 0) {
				finish({ stdout, stderr, code });
			} else {
				finish({ stdout, stderr, code, error: truncate((stderr || stdout || `Command exited ${code}`).trim(), MAX_ERROR_CHARS) });
			}
		});
	});
}

function capBuffer(text: string): string {
	if (text.length <= MAX_STDOUT_CHARS) return text;
	return text.slice(text.length - MAX_STDOUT_CHARS);
}

function errorReturn(message: string, details: Record<string, unknown>) {
	return {
		content: [{ type: "text" as const, text: `Error: ${message}` }],
		details,
	};
}

function bilibiliApiScript(): string {
	return `
import json, sys, urllib.parse, urllib.request
q = sys.argv[1]
limit = int(sys.argv[2])
url = "https://api.bilibili.com/x/web-interface/search/type?search_type=video&keyword=" + urllib.parse.quote(q)
req = urllib.request.Request(url, headers={"User-Agent":"Mozilla/5.0"})
with urllib.request.urlopen(req, timeout=20) as r:
    data = json.load(r)
items = (data.get("data") or {}).get("result") or []
out = []
for item in items[:limit]:
    out.append({
        "title": item.get("title"),
        "url": "https://www.bilibili.com/video/" + str(item.get("bvid")),
        "author": item.get("author"),
        "description": item.get("description"),
        "play": item.get("play"),
        "favorites": item.get("favorites"),
    })
print(json.dumps(out, ensure_ascii=False))
`;
}
