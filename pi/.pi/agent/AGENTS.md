# Global Agent Instructions (pi)

Global working preferences for JC Zhang. System/developer/user instructions and project-level `AGENTS.md` override these defaults.

## Code
- Type-safety first. Prefer explicit types; avoid `any` and untyped escapes.
- Python: use PEP 604 runtime syntax (`X | None`, `list[str]`). NEVER write `from __future__ import annotations`.
- JS/TS: use the repo-declared package manager. Prefer `bun` only when no project signal exists.
- Match the surrounding code's style. Keep diffs minimal and surgical.

## Shell
- Prefer `rg` over `grep`, `fd` over `find`, `eza` over `ls` when available.

## Git
- Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`, …). Imperative subject ≤ 50 chars.
- Commit only when asked, except implementation todos: every completed implementation todo that changes files must end with one focused conventional commit unless the user explicitly disables commits, verification fails, or the repo is not safe to commit.
- Never push unless asked.

## Goals
- When creating pi-codex-goal goals, omit `token_budget` unless the user explicitly requests a budget.
- Default goal budget should be unbounded. Do not infer a token budget from task size, duration, or wording.
- Ask before changing an existing goal; if the user approves clearing a budget, recreate it without `token_budget`.

## Skill routing
- For nontrivial tasks, prefer relevant skills when available; skip if missing or overhead exceeds value.
- Implementation plans/todos: prefer `jc-todo-contract` so todos are self-contained and each file-changing todo commits before completion.
- Hard bug, flaky test, crash, or performance regression: prefer `diagnose` before fixing.
- Test-first feature or subtle bug boundary: prefer `tdd`.
- Unclear feature, architecture choice, or plan validation: prefer `think` or `grill-with-docs`.
- Issue/PRD workflow: prefer `to-prd`, `to-issues`, or `triage`.
- Codebase architecture/code rot: prefer `improve-codebase-architecture`.
- Need system-level explanation before edits: prefer `zoom-out`.
- After implementation/release-ready change: prefer `check` when asked or when risk is non-trivial.

## Planning workflow
- For nontrivial, ambiguous, or high-risk work, run a lightweight planner before editing: investigate facts, confirm intent when needed, ask only blocking questions, size effort/scope/risk, compare one or two implementation paths, choose one, and premortem likely failures.
- For simple, obvious, single-file work, skip formal planning and act directly.
- Plans should name assumptions, files/commands checked, chosen path, acceptance criteria, and verification commands.
- Convert approved plans into executable todos when the work is handoffable or spans multiple steps.

## Long-task protocol
- For nontrivial 3+ step work, keep a task list and update it as work changes.
- Treat each implementation todo as an execution contract: objective, context/refs, constraints, target files/areas, acceptance criteria, and verification commands.
- Do not mark a file-changing implementation todo complete until its verification has run or been explicitly waived, its scoped changes are committed, and commit SHA is recorded in the final note.
- If unrelated dirty worktree state prevents a clean todo commit, stop and ask; do not stage unrelated files.
- Build a fast feedback loop before debugging or broad refactors.
- Explore first, edit second. Prefer one narrow implementation path over speculative rewrites.
- Parent/orchestrator sessions may spawn read-only subagents in parallel for scouting, research, review, or visual checks when it saves context.
- Keep write work in the main thread unless explicitly delegated. If delegated, keep worker scope narrow: one todo at a time, sequential when file conflicts are possible, no opportunistic refactors, and block rather than guess when context or acceptance criteria are missing.
- Do not delegate quick, simple, single-file, or hands-on tasks where tool overhead exceeds value.
- Verify changed behavior with the closest executable check when feasible: test, typecheck, CLI, HTTP, browser, or minimal driver. If not run, say so.
- If three materially different attempts fail, stop editing, summarize attempts, and ask for a sharper constraint or external review. Stop earlier for unsafe, destructive, or unclear work.

## Review and completion evidence
- Before claiming done on nontrivial work, report changed files, commands run, verification result, and residual risks or checks not run.
- For completed file-changing todos, also report commit SHA and subject.
- Use reviewer severity levels: P0 data loss/security/build break, P1 incorrect behavior, P2 maintainability/performance risk, P3 polish/style.
- Do not manufacture review findings. If no concrete issue exists, say so and state what was checked.

## Pi config hygiene
- When changing global Pi config, document user-visible defaults, agents, skills, packages, MCP servers, workflows, or setup steps in `README.md` or a nearby runbook.
- Keep config changes reproducible: note what changed, why, how to verify, and any manual restart/update step.
- Prefer small role prompts or skills with clear scope, inputs, outputs, stop conditions, and handoff artifacts over broad catch-all instructions.

## Output
- Be concise. Lead with the answer; no filler preamble unless the user asks for detail.

## Memory routing
- Use Nowledge Mem as the canonical long-term memory layer when available; if `nmem` is missing or failing, skip it or fall back to agentmemory.
- Search memory only when the user references prior work, decisions, preferences, or context; when the task likely depends on previous sessions; or when durable project/user knowledge would materially improve the answer.
- Save durable user preferences, project decisions, procedures, architecture facts, important plans, and reusable learnings. Ask before saving sensitive or private information.
- Before saving, search first to avoid duplicates. Prefer updating existing memory over creating duplicates.
- Do not duplicate the same memory into agentmemory unless explicitly needed; use agentmemory mainly for file history, current-project/session observations, and fallback.
