# Session titles

A user-level `UserPromptSubmit` hook that names each new Claude Code session
from its first prompt, following [rules.txt](rules.txt), for example
`fix: resolve hook timeout on first prompt`.

The hook is registered with `"async": true`, so Claude Code never waits for it.
On the first typed prompt of a session it creates a once-only marker, forks a
detached worker (`setsid`) and exits. The worker asks Haiku for a title through
an isolated `claude -p --safe-mode --no-session-persistence` call with no tools,
no MCP servers, thinking disabled and a `--json-schema` that pins the format,
then appends the same record `/rename` writes:

```json
{"type":"custom-title","customTitle":"...","sessionId":"..."}
```

A `sessionTitle` hook output is not used: Claude Code keeps it only in memory,
the background AI titler replaces it, and it is honored only from a synchronous
hook ([anthropics/claude-code#82724](https://github.com/anthropics/claude-code/issues/82724)).

Skipped: resumed sessions, subagents, sessions already named with `--name` or
`/rename` (checked again just before writing), and prompts that start with `/`.
Only the first 600 characters of the prompt are sent. Generation failures are
not retried.

Per-session outcomes (`pending`, `named`, `skip_renamed`, `failed_*`) are kept in
`$CLAUDE_CONFIG_DIR/session-title-state/<session id>.json`; prompts and titles
are not stored there.

Edit [settings.json](settings.json) for the model, CLI, rules file, maximum
length, or generation timeout. To disable the feature, remove the
`UserPromptSubmit` entry in `~/.claude/settings.json` whose command is
`/usr/bin/python3 ~/.claude/hooks/session-title/main.py`.
