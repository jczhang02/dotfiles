# Pi-style lowercase session names

This user-level hook handles `SessionStart` and `UserPromptSubmit` in Claude Code.
The first prompt of an eligible new session makes one naming request. Resumed
sessions, missing startup provenance, forks, subagents, existing custom names,
and previously attempted sessions are skipped. The hook returns the official
`hookSpecificOutput.sessionTitle`; it never writes session transcripts.

The shared naming rules are read from
[/home/jc/.codex/hooks/pi-session-name/rules.txt](/home/jc/.codex/hooks/pi-session-name/rules.txt).
Both Codex and Claude Code use that file. Claude's hook also enforces lowercase
on the generated string and requires one of the six pi-stuff prefixes.

Edit [settings.json](/home/jc/.claude/hooks/pi-session-name/settings.json) to change
the naming model, timeout, rules path, or CLI path. Defaults are `haiku`,
15 seconds, and an 80-code-point title. Keep `installed_at` intact. The binary
path follows mise's `latest` symlink so normal upgrades do not break its path.

The naming call uses an isolated `claude -p --safe-mode --no-session-persistence`
process with no tools or MCP servers. It uses existing Claude authentication.
A child environment guard prevents recursion even if hooks are unexpectedly
loaded. The process group is terminated on timeout or interruption.

State is stored under `$CLAUDE_CONFIG_DIR/pi-session-name-state`, defaulting to
`/home/jc/.claude/pi-session-name-state`. It contains eligibility, timestamps
and outcome only; it does not store prompts, titles or credentials. A failed
attempt does not block the task or retry on the next turn.

The first prompt waits for naming. Two real-account samples took about 8 and
13 seconds for the naming step, including child CLI startup. Later prompts
skip generation. Existing manual names are checked before and after generation;
the final read and Claude applying the returned title are not atomic, so an
extremely narrow concurrent-rename window is not ruled out by these tests.

Use `/hooks` to inspect the two handlers. To disable only this feature, remove
the two entries whose command is:

```text
/usr/bin/python3 /home/jc/.claude/hooks/pi-session-name/main.py
```

from [settings.json](/home/jc/.claude/settings.json), retaining the other entries.
Do not set `disableAllHooks` just to disable naming, since that affects unrelated hooks.

Verified with Claude Code 2.1.281. Installation and E2E artifacts:
[/home/jc/Documents/claude-naming-hook-install-20260924](/home/jc/Documents/claude-naming-hook-install-20260924).
