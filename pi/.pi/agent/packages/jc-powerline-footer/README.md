# jc-powerline-footer

JC-local lightweight Pi UI plugin.

Kept scope:

- one fixed JC statusline layout
- editor keyword highlighting
- model-generated action vibe line
- original welcome UI: startup overlay, or rich quiet-startup header when `quietStartup: true`
- inline slash autocomplete

Removed scope: presets, custom layouts, fixed-editor compositor, mouse/chat viewport ownership, bash mode, shell ghost history, stash/prompt history, themed/file vibes, settings TUI.

## Statusline

Fixed layout in Pi's real footer/statusline:

```text
model | thinking | path | git | context | cache_read | cost | extension_statuses
```

The latest submitted prompt is not a statusline segment; it renders as the dedicated second footer row and uses the available footer width. Overflowed status segments stay in the footer after the prompt row. `extension_statuses` currently includes selected Pi status-bus entries: goal (`codex-goal`), MCP (`mcp`), and loadout (`loadout`). Notification-style extension statuses starting with `[` still render above the editor. Unknown context usage is hidden instead of showing stale usage.

Command:

```text
/powerline [status|on|off|toggle|editor-decorators reload]
```

Old keys like `powerline.preset`, `fixedEditor`, `mouseScroll`, and `customItems` are ignored by this fork.

## Keyword highlighting

Editor decorators run in the editor render path.

Default highlights:

- `/command`
- `/skill:<name>`
- `workflow`, `workflows`, `workflow:<name>`, `workflows:<name>`

Config: `editor-decorators.jsonc`

Command: `/editor-decorators`

## Action vibe line

Action vibe replaces Pi's working line with a compact action-first message. During streaming, token count falls back to elapsed/text estimation and uses `≈` until Pi reports real usage:

```text
calling subagent... · 12s · ≈1.5k tok
```

Model generation uses sanitized hints such as `calling subagent`, `running workflow`, `reading file`, or `running command`. Raw prompts, file paths, commands, and secrets are not sent.

Command:

```text
/vibe status
/vibe on
/vibe off
/vibe model <provider/model>
/vibe refresh <seconds>
/vibe max-length <n>
```

Legacy `/vibe <theme>`, `/vibe mode file`, and `/vibe generate <theme>` are removed.

## Welcome header

Startup welcome UI keeps the original rich layout. With `quietStartup: true`, it renders as a persistent header; otherwise it renders as a persistent startup overlay.

## Inline slash

Inline slash autocomplete remains enabled inside normal editor text:

- inline `/command` suggestions
- inline `/skill:<name>` suggestions
- leading slash command token still delegates to Pi core
- real absolute paths like `/tmp` or `/home/...` submit as user text, not slash commands

If another extension replaces the editor while Powerline is active, Powerline wraps that editor factory so decorators and inline slash stay composed.

## Verification

From source checkout:

```bash
bun run verify
PI_OFFLINE=1 pi list --no-approve
```

Individual checks:

```bash
bun run typecheck
bun run test
```
