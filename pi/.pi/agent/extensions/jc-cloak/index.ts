import { getAgentDir, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { existsSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

type PatternConfig = {
	pattern: string;
	flags?: string;
	replace?: string;
};

type RuleConfig = {
	filePattern: string | string[];
	patterns: PatternConfig[];
};

type CloakConfig = {
	enabled?: boolean;
	mask?: string;
	rules?: RuleConfig[];
};

type CompiledRule = {
	fileMatchers: RegExp[];
	patterns: Array<{ regex: RegExp; replace?: string }>;
};

const DEFAULT_CONFIG_PATH = join(getAgentDir(), "cloak.json");
const DEFAULT_MASK = "****";

function asArray<T>(value: T | T[]): T[] {
	return Array.isArray(value) ? value : [value];
}

function escapeRegExp(value: string): string {
	return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

function normalizePath(value: string): string {
	return value.replaceAll("\\", "/");
}

function globToRegExp(glob: string): RegExp {
	const normalized = normalizePath(glob.trim());
	let pattern = "^";
	for (let index = 0; index < normalized.length; index++) {
		const char = normalized[index]!;
		const next = normalized[index + 1];
		const afterNext = normalized[index + 2];

		if (char === "*" && next === "*") {
			if (afterNext === "/") {
				pattern += "(?:.*/)?";
				index += 2;
			} else {
				pattern += ".*";
				index += 1;
			}
			continue;
		}

		if (char === "*") {
			pattern += "[^/]*";
			continue;
		}

		pattern += escapeRegExp(char);
	}
	return new RegExp(`${pattern}$`);
}

function ensureGlobal(flags?: string): string {
	const chars = new Set((flags ?? "").split("").filter(Boolean));
	chars.add("g");
	return [...chars].join("");
}

function loadConfig(): { enabled: boolean; mask: string; rules: CompiledRule[]; error?: string } {
	if (!existsSync(DEFAULT_CONFIG_PATH)) {
		return { enabled: true, mask: DEFAULT_MASK, rules: [] };
	}

	try {
		const raw = readFileSync(DEFAULT_CONFIG_PATH, "utf8");
		const config = JSON.parse(raw) as CloakConfig;
		return {
			enabled: config.enabled !== false,
			mask: config.mask ?? DEFAULT_MASK,
			rules: (config.rules ?? []).map((rule) => ({
				fileMatchers: asArray(rule.filePattern).map(globToRegExp),
				patterns: rule.patterns.map((pattern) => ({
					regex: new RegExp(pattern.pattern, ensureGlobal(pattern.flags)),
					replace: pattern.replace,
				})),
			})),
		};
	} catch (error) {
		return {
			enabled: true,
			mask: DEFAULT_MASK,
			rules: [],
			error: `jc-cloak failed to load ${DEFAULT_CONFIG_PATH}: ${error instanceof Error ? error.message : String(error)}`,
		};
	}
}

function pathCandidates(rawPath: string, cwd: string): string[] {
	const stripped = rawPath.startsWith("@") ? rawPath.slice(1) : rawPath;
	const normalized = normalizePath(stripped);
	const absolute = normalizePath(resolve(cwd, stripped.replace(/^~(?=\/|$)/, process.env.HOME ?? "~")));
	return [...new Set([normalized, absolute, basename(normalized), basename(absolute)])];
}

function ruleMatches(rule: CompiledRule, rawPath: string, cwd: string): boolean {
	const candidates = pathCandidates(rawPath, cwd);
	return candidates.some((candidate) => rule.fileMatchers.some((matcher) => matcher.test(candidate)));
}

function applyTemplate(template: string, mask: string, replaceArgs: unknown[]): string {
	const maybeGroups = replaceArgs[replaceArgs.length - 1];
	const hasNamedGroups = maybeGroups !== null && typeof maybeGroups === "object";
	const capturesEnd = hasNamedGroups ? replaceArgs.length - 3 : replaceArgs.length - 2;
	const captures = replaceArgs.slice(1, capturesEnd);
	const match = String(replaceArgs[0] ?? "");

	return template.replace(/\$(MASK|&|\d{1,2})/g, (_token, key: string) => {
		if (key === "MASK") return mask;
		if (key === "&") return match;

		const captureIndex = Number(key) - 1;
		const capture = captures[captureIndex];
		return capture == null ? "" : String(capture);
	});
}

function applyCloakPatterns(text: string, rules: CompiledRule[], mask: string): string {
  let result = text;
  for (const rule of rules) {
    for (const pattern of rule.patterns) {
      result = result.replace(pattern.regex, (...args: unknown[]) => {
        const match = String(args[0] ?? "");
        if (pattern.replace) return applyTemplate(pattern.replace, mask, args);
        return `${match.slice(0, 1)}${mask}`;
      });
    }
  }
  return result;
}

function cloakText(text: string, rawPath: string, cwd: string, config: ReturnType<typeof loadConfig>, options: { allRules?: boolean } = {}): string {
	if (!config.enabled || config.rules.length === 0) return text;

	const rules = options.allRules ? config.rules : config.rules.filter((rule) => ruleMatches(rule, rawPath, cwd));
	return applyCloakPatterns(text, rules, config.mask);
}

const OUTPUT_WIDE_CLOAK_TOOLS = new Set([
  "bash",
  "exec_command",
  "grep",
  "ffgrep",
  "fff-multi-grep",
  "code_search",
  "web_search",
  "fetch_content",
  "get_search_content",
  "mcp",
  "subagent",
  "workflow",
]);

export default function jcCloak(pi: ExtensionAPI): void {
	let config = loadConfig();

	pi.on("session_start", (_event, ctx) => {
		config = loadConfig();
		if (ctx.hasUI) ctx.ui.setStatus("cloak-status", config.error);
	});

	pi.registerCommand("cloak-status", {
		description: "Show jc-cloak masking status",
		handler: async (_args, ctx) => {
			config = loadConfig();
			const message = config.error ?? `jc-cloak enabled=${config.enabled} rules=${config.rules.length}`;
			if (ctx.hasUI) ctx.ui.setStatus("cloak-status", message);
			else console.log(message);
		},
	});

	pi.on("tool_result", (event, ctx) => {
		const rawPath = event.toolName === "read" && typeof event.input.path === "string" ? event.input.path : "";
		const allRules = !rawPath && OUTPUT_WIDE_CLOAK_TOOLS.has(event.toolName);
		if (!rawPath && !allRules) return undefined;

		let changed = false;
		const content = event.content.map((part) => {
			if (part.type !== "text") return part;
			const cloaked = cloakText(part.text, rawPath, ctx.cwd, config, { allRules });
			if (cloaked === part.text) return part;
			changed = true;
			return { ...part, text: cloaked };
		});

		return changed ? { content } : undefined;
	});
}
