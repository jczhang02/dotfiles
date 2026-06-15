# Changelog

## [0.6.1-jc.8] - 2026-06-14

### Changed
- Refactored JC fork into a lightweight UI plugin: fixed statusline, editor decorators, model-generated action vibe, original welcome UI, and inline slash.
- Removed preset/custom-layout engine. Statusline now has one fixed JC layout.
- Moved the fixed JC statusline into Pi's real footer instead of editor-adjacent widgets.
- Added a selected extension-status footer segment for goal, MCP, and loadout status.
- Replaced themed/file-mode vibes with sanitized current-action generation.
- Simplified `/powerline` to status/toggle/decorator reload.
- Composed Powerline editor features around later editor factories while active.

### Fixed
- Startup editor composition now wraps an editor factory installed before Powerline starts.
- Inline slash autocomplete now triggers for async suggestion providers and ignores stale async snapshots.
- Immediate/earlier footer renders now preempt delayed render schedules.
- Editor decorators skip configured regex rules on very long visible lines and reject obvious high-risk nested regex patterns.
- Action vibes work on runtimes without `AbortSignal.timeout()` / `AbortSignal.any()`.
- Debug logging redacts local cwd/home paths.
- `/vibe on` now migrates stale `workingVibeEnabled` and `workingVibeMode` keys.
- Shutdown and disable paths abort pending vibe generation and clear stale working-message state.
- Timed-out vibe generations no longer update UI after timeout.
- Context usage with unknown core tokens no longer falls back to stale assistant usage.
- Non-reasoning models no longer show `think:off`.
- Action vibe text is English-only and no longer appends the `✦` marker.
- `/vibe refresh` and `/vibe max-length` notifications report clamped saved values.
- Original rich welcome overlay/header has been restored after the lean refactor removed it.
- Welcome UI now stays visible instead of disappearing on input, prompt submit, agent activity, or control keys.
- Action vibe working line is now action-first, removes the extra `Pondering...` prefix, hides zero-token noise, and marks estimated tokens with `≈`.
- Latest submitted prompt now renders as a dedicated second footer row instead of a competing statusline segment.

### Removed
- Fixed-editor compositor, mouse/chat viewport ownership, bash mode, shell ghost/history ranking, stash/prompt history, settings TUI, custom extension-status segment, unused icon/separator tables, dead theme keys, and stale package test script.

### Tests
- `bun run verify`: source and tests pass.
- `PI_OFFLINE=1 pi list --no-approve`: plugin recognized.

## Upstream provenance

Forked from `pi-powerline-footer` `0.6.1` by Nico Bailon. Upstream history intentionally omitted from this local fork changelog to keep package docs small.
