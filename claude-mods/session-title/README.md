# Session titles

A Claude Code mod (a plugin of function hooks) that names each new session
from its first prompt, following [rules.txt](rules.txt), for example
`fix: resolve hook timeout on first prompt`. It replaces the earlier
`UserPromptSubmit` command hook, `hooks/session-title/main.py`.

On the first typed prompt the mod asks Haiku for a title through
`$.model.complete`, on the session's own client: no `claude -p` child, no
tools, no MCP servers, no advisor. The call runs from a `$.clock.after`
timer, so it outlives the prompt that started it and Esc on the turn does not
cut it. The prompt waits up to `waitMs` (1.5 s by default) for the title and
returns it as `sessionTitle`, so the title usually shows on the first prompt.
A slower title goes out with the next prompt instead: `sessionTitle` on
`UserPromptSubmit` (or `SessionStart`) is the only way to set the running
session's title. Claude Code then saves it to the transcript as the same
`custom-title` record `/rename` writes, so it survives `--resume`.

Skipped: resumed and forked sessions, subagents, prompts not typed by the
person (`-p`, loop and schedule wakeups, task notifications), sessions already
named with `--name` or `/rename`, and slash commands; the first typed prompt
after a slash command still names the session. After `/clear` the fresh
conversation keeps the old title, and its first typed prompt names it again,
unless `/rename` changed the title in between. A title that arrives after a
`/rename` is dropped. A reply outside the format is dropped, with no retry.
Only the first 600 characters of the prompt are sent.

`/retitle <task>` names a session that has moved on to another task. It does
not start a turn; the new title shows from the next prompt.

The band above the prompt shows what naming is doing, drawn like the built-in
"You should know" lines: `✦ Naming this session…` while the model call runs,
then `✦ Session title · <title>` with a green star (and "shows from your next
prompt" when the title came late), or the failure with a red star and a hint
to use `/retitle`. It stays up until the next prompt, or until `0` (Dismiss or
OK) takes it down. The band holds one plugin's drawing at a time, so this and
a "You should know" line never show together; one waits for the other.

Per-session state lives in `$.state` under `session-title` (`naming`: the
outcome `pending`, `named`, `applied`, `skipped`, `skip_renamed` or `failed`,
and the title; `seen`: the session title Claude Code last reported;
`cleared`: the title `/clear` carried over; `notice`: what the band
shows). Prompts are not stored.

Options (`userConfig`, in `/config` or under `pluginConfigs.session-title` in
`~/.claude/settings.json`): `model` (default `haiku`), `maxLength` (80) and
`waitMs` (1500, at most 8000, 0 never waits).

Loaded straight from this repository through `CLAUDE_CODE_PLUGIN_DIRS` in the
`env` block of `~/.claude/settings.json`, which names
`~/dev/dotfiles/claude-mods/session-title`; it is not stowed, because the
plugin loader does not follow symlinks. Check and test it with:

```sh
claude plugin validate ~/dev/dotfiles/claude-mods/session-title
claude plugin test ~/dev/dotfiles/claude-mods/session-title
```

To disable it, remove that path from `CLAUDE_CODE_PLUGIN_DIRS`.
