# Pi Global Extensions

## `00-warning-router.ts`
- Purpose: reduce warning notification noise globally without patching upstream Pi packages.
- Behavior: suppresses all `ctx.ui.notify(..., "warning")` and `console.warn(...)` output, while keeping `info` and `error` output unchanged.
- Inspection: stores only the latest 50 muted warnings in memory and exposes `/muted-warnings` as a theme-native overlay.
- Persistence/UI: no file log, no footer badge, no cross-session retention.
- Deployment: loaded through `~/.pi/agent/extensions/00-warning-router.ts`, a symlink to this dotfiles copy.
- Verify: run `pi --no-extensions --extension ~/.pi/agent/extensions/00-warning-router.ts --offline --list-models openai`; then reload or restart Pi for normal sessions.
