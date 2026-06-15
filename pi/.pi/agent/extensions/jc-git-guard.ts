import { isToolCallEventType, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

const GIT_ENV_PREFIX = "export GIT_EDITOR=true GIT_SEQUENCE_EDITOR=true GIT_MERGE_AUTOEDIT=no\n";

const GIT_GLOBAL_ARGS_PATTERN = String.raw`(?:\s+(?:-C\s+\S+|-c\s+\S+|--(?:git-dir|work-tree|namespace)(?:=\S+|\s+\S+)|--(?:literal|glob|noglob|icase)-pathspecs|--no-optional-locks))*`;

function gitCommandPattern(subcommand: string, suffix = String.raw`[^;\n]*`): RegExp {
	return new RegExp(String.raw`\bgit${GIT_GLOBAL_ARGS_PATTERN}\s+${subcommand}\b${suffix}`, "i");
}

function anyGitWithSuffixPattern(suffix: string): RegExp {
	return new RegExp(String.raw`\bgit${GIT_GLOBAL_ARGS_PATTERN}\s+[^;\n]*${suffix}`, "i");
}

const BLOCKED_GIT_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
	{ pattern: anyGitWithSuffixPattern(String.raw`--no-verify\b`), reason: "git --no-verify bypasses repository hooks." },
	{ pattern: gitCommandPattern("reset", String.raw`[^;\n]*\s--hard\b`), reason: "git reset --hard is destructive and not meaningfully reversible." },
	{ pattern: gitCommandPattern("clean", String.raw`(?![^;\n]*(?:\s--dry-run\b|\s-[A-Za-z]*n[A-Za-z]*\b))`), reason: "git clean deletes untracked files and is not meaningfully reversible." },
	{ pattern: gitCommandPattern("push", String.raw`[^;\n]*(?:--force|-f)\b`), reason: "git force push rewrites remote history." },
	{ pattern: gitCommandPattern("branch", String.raw`[^;\n]*\s-D\b`), reason: "git branch -D deletes a branch forcefully." },
	{ pattern: gitCommandPattern("rebase"), reason: "git rebase rewrites history; ask JC before running it." },
	{ pattern: gitCommandPattern("filter-branch"), reason: "git filter-branch rewrites history." },
];

function hasGitCommand(command: string): boolean {
	return /\bgit\s+/.test(command);
}

function alreadyHasGitEnv(command: string): boolean {
	return command.includes("GIT_EDITOR=true") && command.includes("GIT_SEQUENCE_EDITOR=true");
}

export default function jcGitGuard(pi: ExtensionAPI): void {
	pi.on("tool_call", (event) => {
		if (!isToolCallEventType("bash", event)) return undefined;

		const command = event.input.command;
		if (!hasGitCommand(command)) return undefined;

		for (const guard of BLOCKED_GIT_PATTERNS) {
			if (guard.pattern.test(command)) {
				return {
					block: true,
					reason: `jc-git-guard blocked this command: ${guard.reason} Ask JC explicitly before using this operation.`,
				};
			}
		}

		if (!alreadyHasGitEnv(command)) {
			event.input.command = `${GIT_ENV_PREFIX}${command}`;
		}

		return undefined;
	});
}
