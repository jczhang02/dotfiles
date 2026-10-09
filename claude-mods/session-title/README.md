# Session titles

A Claude Code mod (a plugin of function hooks) that names each session after
what it works on, following [rules.txt](rules.txt), for example
`fix: resolve hook timeout on first prompt`, and names it again when its main
task changes. It replaces the earlier `UserPromptSubmit` command hook,
`hooks/session-title/main.py`.

The title is the session's name: Claude Code shows it at the right of the
prompt box's top border, in the terminal title and in `/resume`. The mod
draws nothing of its own.

Naming happens three times over a session's life, each a single call to
Haiku through `$.model.complete`, on the session's own client: no `claude -p`
child, no tools, no MCP servers, no advisor.

1. The first typed prompt: a quick title from the prompt's first 600
   characters, so the session has a name at once. The prompt waits up to
   `waitMs` (1.5 s by default) for it; a slower title goes out with the next
   prompt.
2. The first answered turn: a title from the first prompt, Claude's reply
   and the working directory's name. By then the session knows which
   file or program it is about, so this title replaces the first one. A
   failed attempt tries again on the next answered turn, three times at most.
3. Every `checkTurns` (8) answered turns after that: a check of the title
   against the latest prompts and reply. The title stays unless the main task
   has clearly moved to another object or goal; a new phase of the same task,
   a follow-up or a side question keeps it.

Interrupted turns, turns that end on an error and subagents' turns count for
nothing. Each call runs from a `$.clock.after` timer, so it outlives the hook
that started it and Esc does not cut it; a call cut by a reload of the mod,
or pending past 90 s, is dropped.

A new title goes out as `sessionTitle` on the next typed prompt, the only way
a hook sets the running session's title; Claude Code saves it as the same
`custom-title` record `/rename` writes. A title from a turn's end therefore
shows from the next prompt, with no `/rename` line in the transcript.

Your own name wins: once the session title is not the one the mod gave it
(`/rename`, `--name`), the mod names nothing more until `/clear`. A title
that comes back with a suffix, because another session holds that name, still
counts as the mod's. After `/clear` the fresh conversation keeps the old
title, and its first typed prompt names it again, unless `/rename` changed
the title in between.

Skipped: forked sessions, subagents, prompts not typed by the person (`-p`,
loop and schedule wakeups, task notifications), sessions already named, and
slash commands; the first typed prompt after a slash command still names the
session. A resumed session is watched (step 3) when its title is still the
one the mod gave it; the mod keeps those titles in `$.store`, the 1000 latest
sessions. Other resumed sessions are left alone.

A reply that leads in before its title line ("Here is a title:") keeps the
title line; a reply with no line in the format fails.

Per-session state lives in `$.state` under `session-title` (`naming`: the
phase, the title the mod gave and one waiting for a prompt, the call under
way, turns since the last check, whether naming is off and why; `cleared`:
the title `/clear` carried over). Only the clipped first prompt is held, in
memory, until the first answered turn names the session from it.

Options (`userConfig`, in `/config` or under `pluginConfigs.session-title` in
`~/.claude/settings.json`): `model` (default `haiku`), `maxLength` (80),
`waitMs` (1500, at most 8000, 0 never waits) and `checkTurns` (8).

Claude Code also asks Haiku for a title of its own (`ai-title`) when a turn
starts on a session with no name. A first title on time leaves it nothing to
do; otherwise the mod's title takes over from it as soon as it goes out.

Loaded straight from this repository through `CLAUDE_CODE_PLUGIN_DIRS` in the
`env` block of `~/.claude/settings.json`, which names
`~/dev/dotfiles/claude-mods/session-title`; it is not stowed, because the
plugin loader does not follow symlinks. Check and test it with:

```sh
claude plugin validate ~/dev/dotfiles/claude-mods/session-title
claude plugin test ~/dev/dotfiles/claude-mods/session-title
```

To disable it, remove that path from `CLAUDE_CODE_PLUGIN_DIRS`.
