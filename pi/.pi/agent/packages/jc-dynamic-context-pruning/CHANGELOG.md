# Changelog

## [1.0.7] - 2026-04-14

### Fixed

- **Infinity anchorTimestamp ghost block spiral** — When a `compress` range extended to the end of the conversation, `resolveAnchorTimestamp` returned `Infinity`. `JSON.stringify(Infinity)` serialises to `null`, so on session restore the corrupted block's timestamps coerced to `0` in JS overlap checks, making every new range appear to overlap the ghost block and trapping the model in a compression spiral (101 failures over 2 hours). `resolveAnchorTimestamp` now returns `endTimestamp + 1` instead of `Infinity`.
- **Corrupted block propagation on session restore** — `index.ts` now filters out any persisted compression block whose `startTimestamp`, `endTimestamp`, or `anchorTimestamp` is non-finite before restoring state, preventing ghost blocks from surviving across sessions.
- **Non-finite timestamp guard** — All code paths that create or apply compression blocks now validate timestamps are finite before proceeding, failing fast rather than silently corrupting state.
- **Overlap error diagnostics** — Overlap error messages now include the existing block's timestamp range to aid debugging.
- **Prompt tag name mismatch** — The prompt tag was named `<dcp-message-id>` but the code injected `<dcp-id>`; tag name corrected to `<dcp-id>` throughout `prompts.ts`.
- **Duplicate test** — Removed a duplicate test case from `pruner.test.ts`.

### Added

- **Regression tests** — New test cases for the `Infinity` anchor scenario, `null`-timestamp corrupted blocks, and corrupted-block resilience on session restore.

Thanks to [@wassname](https://github.com/wassname) for diagnosing and fixing the compression spiral root cause in [#3](https://github.com/complexthings/pi-dynamic-context-pruning/pull/3).

## [1.0.6] - 2026-04-09

### Fixed

- **Orphaned tool_use/tool_result after compression** — Compression ranges that touched part of an assistant→toolResult group could leave orphaned `tool_use` or `tool_result` blocks, causing Anthropic API 400 errors (`unexpected tool_use_id found in tool_result blocks`). The backward and forward expansion logic now correctly skips PI-internal passthrough roles (`compaction`, `branch_summary`, `custom_message`) when scanning for paired messages, ensuring atomic removal of complete tool groups.
- **Content mutation across context events** — `applyPruning` now deep-clones message content instead of shallow-copying, preventing injected `dcp-id` blocks from accumulating on shared message objects across successive context events.

### Added

- **Post-compression repair function** — `repairOrphanedToolPairs` runs after all compression blocks are applied as a safety net. It removes orphaned `toolResult`/`bashExecution` messages whose `toolCallId` has no matching `toolCall` in any assistant message, and strips orphaned `toolCall` blocks from assistant messages whose results no longer exist.
- **New test cases** — Tests 5–9 covering passthrough role handling (backward and forward expansion), content mutation isolation, multi-block orphan repair, and direct orphan cleanup.

## [1.0.5] - 2026-04-06

### Fixed

- Prevent orphaned tool_use blocks from compression and harden autocomplete.

## [1.0.4] - 2026-04-05

### Fixed

- Tool crash on compression.

## [1.0.3] - 2026-04-04

### Fixed

- Various errors and issues.

## [1.0.2] - 2026-04-03

### Changed

- Added pi package details to package.json.

## [1.0.1] - 2026-04-02

### Added

- Initial release.
