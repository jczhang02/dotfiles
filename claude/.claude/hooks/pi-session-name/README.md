# Pi-style lowercase session names

This user-level hook handles `SessionStart` and `UserPromptSubmit` in Claude Code.
The first prompt of an eligible new session makes one naming request. Resumed
sessions, missing startup provenance, forks, subagents, existing custom names,
and previously attempted sessions are skipped. The hook returns the official
`hookSpecificOutput.sessionTitle`; it never writes session transcripts.

Everything the hook needs lives in this directory. The naming rules are in
[rules.txt](rules.txt); relative paths in [settings.json](settings.json) resolve
against this directory, and `claude_binary` is looked up on `PATH`, which always
contains the Claude Code that runs the hook. The hook also enforces lowercase on
the generated string and requires one of the six pi-stuff prefixes.

Edit [settings.json](settings.json) to change the naming model, timeout, rules
file, or CLI. Defaults are `haiku`, 20 seconds, and an 80-code-point title. Keep
`installed_at` intact.

The naming call uses an isolated `claude -p --safe-mode --no-session-persistence`
process with no tools, no MCP servers, and thinking disabled
(`MAX_THINKING_TOKENS=0`). It uses existing Claude authentication. Only the
first 600 characters of the prompt are sent. A child environment guard prevents
recursion even if hooks are unexpectedly loaded. The process group is
terminated on timeout or interruption.

State is stored under `$CLAUDE_CONFIG_DIR/pi-session-name-state`, defaulting to
`~/.claude/pi-session-name-state`. It contains eligibility, timestamps and
outcome only; it does not store prompts, titles or credentials. A malformed
title is retried once; any other failure does not block the task or retry on
the next turn.

The first prompt waits for naming, which takes about 1.5 seconds. With thinking
enabled, Haiku spent 800-2300 tokens per title and long prompts regularly
exceeded the timeout. Later prompts skip generation. Existing manual names are
checked before and after generation; the final read and Claude applying the
returned title are not atomic, so an extremely narrow concurrent-rename window
is not ruled out.

Use `/hooks` to inspect the two handlers. To disable only this feature, remove
the two entries in `~/.claude/settings.json` whose command is:

```text
/usr/bin/python3 /home/jc/.claude/hooks/pi-session-name/main.py
```

Do not set `disableAllHooks` just to disable naming, since that affects
unrelated hooks.
