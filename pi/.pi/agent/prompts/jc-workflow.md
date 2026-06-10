---
description: Run JC HazAT-style workflow with execution-contract todos and per-todo commits
argument-hint: "<task>"
---
Run JC workflow for: $ARGUMENTS

Use the existing JC Pi ecosystem, not HazAT Solo directly:
- Load/use `jc-todo-contract` for todo shape and commit discipline.
- Scout/read before planning when context is nontrivial.
- Create execution-contract todos: context, constraints, target files, references, acceptance, verification, commit expectation.
- Execute one implementation todo at a time.
- Every file-changing completed implementation todo must have one focused conventional commit before completion.
- Run review with P0/P1/P2/P3 severity for nontrivial changes.
- Final report: changed files, commands, verification, commit SHAs, risks.

If user intent is ambiguous, ask only blocking questions before implementation.
