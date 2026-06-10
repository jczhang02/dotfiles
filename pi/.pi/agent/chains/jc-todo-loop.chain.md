---
name: jc-todo-loop
description: JC HazAT-style single-todo loop: scout, plan one execution-contract todo, implement with commit, then review.
---

## jc-scout
phase: Context
label: Scout context
as: scout
output: scout.md
outputMode: file-only

Scout relevant code/context for this task. Do not edit files.

Task: {task}

Return key files, conventions, risks, and recommended verification.

## jc-planner
phase: Planning
label: Plan todo
as: plan
output: plan.md
outputMode: file-only

Create a plan and exactly one execution-contract implementation todo for this task, using scout output below.

Scout: {outputs.scout}

Task: {task}

The todo must fit one focused worker session and one commit.

## jc-worker
phase: Implementation
label: Implement todo
as: result
output: result.md
outputMode: file-only
progress: true

Implement exactly the execution-contract todo from this plan. Verify it. If files changed, commit one focused conventional commit for this todo before claiming done. Never push.

Plan: {outputs.plan}

## jc-reviewer
phase: Review
label: Review result
output: review.md
outputMode: file-only

Review the current diff and worker result against the original task and plan. Do not edit files.

Task: {task}
Plan: {outputs.plan}
Worker result: {outputs.result}
