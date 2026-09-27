# Durable Context Rule

Use durable context only when it can improve current task quality without replacing live source verification.

## Read order

1. Current repo/runtime files and command output.
2. Project instructions and ledgers such as `AGENTS.md`, `CLAUDE.md`, `README.md`, `docs/adr/*`, and local config ledgers.
3. User-level rules and skills.
4. Long-term memory only for reusable preferences, decisions, procedures, and gotchas.

Stop once enough evidence exists. Do not read memory or history preemptively for small edits.

## Memory type mapping

- `preference`: stable user preference or workflow preference.
- `decision`: durable architecture/config/product decision with rationale.
- `principle`: reusable rule that should guide future work.
- `procedure`: repeatable workflow or command sequence.
- `pattern` / `learning`: repeated failure mode or gotcha.
- `fact`: stable external or local fact; re-verify before code, security, finance, or external side effects.
- `event`: one-off incident; avoid using as policy unless it recurs.

## Write policy

Follow local agent policy first. For this Pi setup, memory-write skills are manual or ask-first unless the user explicitly requests saving. Automatic transcript sync can run, but distilled durable memories need clear durable value and no secrets.

Never store secrets, tokens, credentials, private customer data, or large raw source excerpts.
