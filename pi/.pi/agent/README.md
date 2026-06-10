# JC Pi Agent Config

Personal Pi agent configuration for JC Zhang. Project-level instructions override these global defaults.

## Core defaults
- Work surgically: read first, edit second, verify when feasible.
- Use repo-declared tooling; prefer `bun` only when no package-manager signal exists.
- Commit only when explicitly asked, except file-changing implementation todos.
- Each completed file-changing implementation todo gets one focused conventional commit. Never push unless explicitly asked.
- New pi-codex-goal goals default to unbounded budget by omitting `token_budget`.

## Default workflow for nontrivial work
1. Investigate facts and project conventions.
2. Confirm intent only when ambiguity blocks progress.
3. Compare one or two implementation paths.
4. Premortem likely failures.
5. Convert approved plan into execution-contract todos.
6. Implement one narrow todo at a time.
7. Verify with the closest executable check.
8. Commit that todo's file changes with one focused conventional commit.
9. Report changed files, commands, results, commit SHA, and residual risks.

## Execution-contract todos
- Use `jc-todo-contract` when creating or executing implementation todos.
- Every implementation todo body should include context/refs, constraints, target files, examples or exact file references, acceptance criteria, verification commands, and commit expectations.
- Do not complete a file-changing todo before verification and commit. If verification cannot run or unrelated dirty files block a clean commit, stop and report the blocker.

## Delegation model
- Main session stays orchestrator.
- Read-only scouts/researchers/reviewers may run in parallel when they save context.
- Write work stays in main session unless explicitly delegated.
- Delegated workers should handle one todo at a time and block if context or acceptance criteria are missing.

## Local workflow artifacts
- Skill: `jc-todo-contract` — self-contained todos plus per-todo commit discipline.
- Agents: `jc-scout`, `jc-planner`, `jc-worker`, `jc-reviewer` — HazAT-style roles adapted to pi-subagents.
- Chain: `jc-todo-loop` — scout → plan → one worker → one reviewer for a single focused implementation todo.
- Prompt: `/jc-workflow` — reusable entry prompt for the whole pattern.

## Review standard
- P0: data loss, security issue, build break, or unrecoverable failure.
- P1: incorrect behavior or missed requirement.
- P2: maintainability, performance, or reliability risk.
- P3: polish, style, or minor clarity issue.
- No manufactured findings; state what was checked when no issue exists.

## Maintenance notes
- Update this README when global config changes affect defaults, workflows, agents, skills, packages, MCP servers, or setup steps.
- Keep changes reproducible: note why, what to verify, and whether Pi restart/update is needed.
