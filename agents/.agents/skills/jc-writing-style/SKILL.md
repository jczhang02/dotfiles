---
name: jc-writing-style
description: Use when writing, rewriting, polishing, or drafting in JC Zhang / Chengrui Zhang's personal style. Covers Chinese academic writing, English academic manuscript style, and Chinese defense/oral-report style; trigger on "按我的风格", "像我写的", "张成瑞风格", "JC style", "答辩稿", "讲稿", "中文写作风格", "英文写作风格".
version: 0.1.0
---

# JC writing style — router

This skill is split like `nature-writing`: a small router plus mode fragments.

Do not write from memory. Load the manifest and the relevant fragment every time.

## Routing protocol

### 1. Load manifest and core

Read [manifest.yaml](manifest.yaml).

Then read every file listed under `always_load`. These define intake, drafting loop, output, and anti-AI cleanup.

### 2. Detect writing mode

Choose one value for `mode`:

- `chinese-writing` — Chinese research prose, reports, manuscript sections, project summaries, technical explanations.
- `english-writing` — English academic manuscript prose in the SFS-SLL style.
- `defense` — Chinese oral scripts, defense speeches, competition reports, slide narration.

If a task asks for Chinese manuscript/report prose, use `chinese-writing`, not `defense`.
If a task asks for spoken delivery, slide narration, or 答辩/汇报, use `defense`.
If mode affects the result and remains ambiguous after reading the prompt, ask one short question.

State detected mode in one short line before drafting unless the user explicitly asks for final text only.

### 3. Load matching fragment

Read the file mapped by `axes.mode.values.<mode>` in `manifest.yaml`.

Load `references/examples.md` only when:

- the user asks for examples;
- the requested output feels off and needs calibration;
- you need a short source-shaped pattern to repair rhythm.

Load `references/source-files.md` only when:

- the user asks where this style came from;
- you are updating the skill;
- you need to audit source coverage.

### 4. Draft or rewrite

Follow `static/core/workflow.md`.

Priority order:

1. User facts, constraints, target audience, and requested format.
2. Mode fragment.
3. Anti-AI cleanup.
4. General writing taste.

Never invent results, references, metrics, experiments, dates, institutions, claims, or personal history.
If evidence is missing, use placeholders or ask before drafting.

### 5. Final check

Before returning, check:

- selected mode matches requested medium;
- no private source sentence was copied unless user supplied it in this turn;
- no generic AI phrasing remains;
- claims stay within user-provided evidence;
- output format matches request.
