# jc-codex-lite

Local Pi package that keeps only the desired Codex-derived surface:

- `apply_patch`
- `view_image`
- `imagegen`
- `/codex fast`
- `/codex usage`

It intentionally does not include or load `exec_command`, `write_stdin`, `web_run`, PATH mode, background shells, prompt adapter behavior, Responses compaction, or full settings UI.

## Layout

This package mirrors the upstream path-tool layout:

- `src/index.ts` — Pi extension entrypoint
- `src/tools/Cargo.toml` — Rust workspace
- `src/tools/apply-patch/rust` — `apply_patch` source
- `src/tools/view-image/rust` — `view_image` source
- `src/tools/imagegen/rust` — `imagegen` source
- `src/tools/*/bin/<platform>-<arch>/` — built helper binaries
- `bin/` — optional command wrappers matching package bin names
- `scripts/` — local build/verify helpers

## Build

```bash
npm run build:binaries
npm run verify:binaries
```
