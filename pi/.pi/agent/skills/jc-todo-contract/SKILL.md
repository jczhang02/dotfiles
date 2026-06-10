---
name: jc-todo-contract
description: Create and execute implementation todos as self-contained contracts with one focused commit per file-changing todo. Use when planning multi-step coding work, breaking plans into todos, delegating workers, or completing todo items that modify files.
---

# JC Todo Contract

Use this skill when implementation work becomes todo-based. It adapts HazAT's Solo todo discipline to JC's existing Pi ecosystem: `todo`, `pi-subagents`, existing skills, and normal git.

## Core rule

Every completed implementation todo that changes files must produce one focused conventional commit before the todo is marked complete.

Exceptions:
- User explicitly says not to commit.
- Verification fails or cannot be meaningfully waived.
- Repo has unrelated dirty state and staging only this todo is unsafe.
- Work is read-only, planning-only, or verification-only.
- Directory is not a git repo.

If an exception applies, do not pretend the todo is complete. Keep it in progress or blocked, and report why.

## Todo body template

````markdown
## What
[What this todo produces and why]

## Context
- Plan: [path/id/summary]
- Scout/research: [path/id/summary]
- User constraints: [exact constraints]

## Constraints
- [Architecture/tooling constraints]
- [Anti-patterns to avoid]
- No opportunistic refactors outside this todo.

## Files
- `path/to/file` — [expected change]

## References
- `path/to/example.ts:10-45` — [pattern to follow]

## Expected shape
```ts
// Optional small sketch when exact reference is insufficient.
```

## Acceptance criteria
- [ ] [Observable behavior or code-state criterion]
- [ ] [Verification command passes]

## Verification
```bash
[focused command]
```

## Commit
- Commit required if files change.
- One conventional commit for this todo only.
- Do not stage unrelated files.
````

## Planner rules

- Split work so each implementation todo fits one focused session and one commit.
- Copy relevant plan decisions into each todo; do not rely on hidden context.
- Include exact files or areas to inspect.
- Include at least one existing reference or short code sketch when implementation shape matters.
- Make acceptance binary and verifiable.
- Name anti-patterns that a worker might otherwise choose.
- Add dependencies with `blockedBy` when order matters.

## Worker rules

1. Mark todo in progress before editing.
2. Read the todo body and referenced files first.
3. Stop if context, constraints, files, acceptance, or verification are missing.
4. Keep scope to this todo. No opportunistic cleanup.
5. Run the closest useful verification.
6. Inspect `git status --short` before staging.
7. Stage only files changed for this todo.
8. Commit one conventional commit for this todo.
9. Record commit SHA, command output, changed files, and residual risks.
10. Only then mark todo complete.

## Commit command pattern

```bash
git status --short
git add <files-for-this-todo-only>
git commit -m "feat: concise imperative subject"
git rev-parse --short HEAD
```

Use `fix:`, `feat:`, `refactor:`, `docs:`, `test:`, or `chore:` as appropriate. Subject ≤ 50 chars.

Never push unless explicitly asked.

## Completion report

```markdown
Done: Todo <id/title>

Changed files:
- `path` — why

Verification:
- `<command>` — pass/fail/not run, key output

Commit:
- `<sha>` — `<subject>`

Residual risks:
- [risk or "none known"]
```
