# Session titles

A user-level `UserPromptSubmit` hook that names each new Claude Code session
from its first prompt, following [rules.txt](rules.txt), for example
`fix: resolve hook timeout on first prompt`.

Claude Code never waits for the naming model. On the first typed prompt the
hook creates a once-only marker, forks a detached worker (`setsid`) and returns
in a few tens of milliseconds. The worker asks Haiku for a title through an
isolated `claude -p --safe-mode --no-session-persistence` call with no tools,
no MCP servers, thinking disabled and a `--json-schema` that pins the format,
then appends the same record `/rename` writes:

```json
{"type":"custom-title","customTitle":"...","sessionId":"..."}
```

That record makes the title persist, but a running session reads it only when
it loads a transcript. So on the next prompt the hook also returns the title as
`hookSpecificOutput.sessionTitle`, which updates the running session's header
and terminal title. This is why the hook is registered synchronously: Claude
Code ignores `sessionTitle` from async hooks. The first turn still shows Claude
Code's own AI title.

Skipped: resumed sessions, subagents, sessions already named with `--name` or
`/rename` (checked again before writing and before applying), and slash
commands. Only the first 600 characters of the prompt are sent. The worker also
sets `CLAUDE_CODE_DISABLE_ADVISOR_TOOL=1`: `--tools ""` does not remove the
advisor, and Haiku occasionally calling it billed a Fable request at about 30
times the cost of the title.

A session stays unnamed, without retry, when the first prompt is a slash
command, or when naming fails or the worker is killed. Pasted text and images
in the first prompt are fine: the hook's `prompt` matches the transcript's text
block (`<pasted_content>` inline, `[Image #1]` with the image in its own block).

To rename a session that has moved on to another task, start a prompt with
`#retitle`, e.g. `#retitle add dark mode to the settings page`. The hook names
the session from the text after the marker the same way, whatever the current
title is, and tells Claude to ignore the marker and act on the rest. A bare
`#retitle` does nothing. As with the first title, the new one shows in the
header from the next prompt on.

Per-session state lives in `$CLAUDE_CONFIG_DIR/session-title-state/<session
id>.json`: the outcome (`pending`, `named`, `applied`, `skip_renamed`,
`failed_*`), the generated title, and the naming call's cost and models. Once
the outcome is final, later prompts read only this file, never the transcript.
Prompts are not stored.

Edit [settings.json](settings.json) for the model, CLI, rules file, maximum
length, or generation timeout. To disable the feature, remove the
`UserPromptSubmit` entry in `~/.claude/settings.json` whose command is
`/usr/bin/python3 ~/.claude/hooks/session-title/main.py`.
