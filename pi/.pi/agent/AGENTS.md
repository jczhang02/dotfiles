# Global Agent Instructions (pi)

Universal working preferences for JC Zhang. A project-level `AGENTS.md` overrides anything here.

## Code
- Type-safety first. Prefer explicit types; avoid `any` and untyped escapes.
- Python: use PEP 604 runtime syntax (`X | None`, `list[str]`). NEVER write `from __future__ import annotations`.
- JS/TS: use `bun` (package manager + runtime), not npm/pnpm/yarn.
- Match the surrounding code's style. Keep diffs minimal and surgical.

## Shell
- Prefer `rg` over `grep`, `fd` over `find`, `eza` over `ls` when available.

## Git
- Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`, …). Imperative subject ≤ 50 chars.
- Commit or push only when asked.

## Output
- Be concise. Lead with the answer; no filler preamble.
