# Workflow

Run this loop for every task.

## 1. Detect mode

Pick `chinese-writing`, `english-writing`, or `defense` from the prompt and requested medium.

Completion criterion: selected mode can be justified in one phrase, e.g. `defense: slide narration`.

## 2. Collect minimum inputs

Identify:

- output type: paragraph, abstract, introduction, report section, speech script, reply, summary;
- language;
- audience;
- target length;
- facts/evidence supplied by user;
- claims that must stay bounded;
- formatting constraints.

If one missing input blocks correctness, ask. If not, draft with placeholders.

## 3. Build skeleton before prose

For written prose, map paragraphs to jobs: background, problem, gap, method, result, discussion, limitation, future work.

For defense prose, map speech beats: greeting, topic, roadmap, motivation, method, experiment/result, contribution, closing.

Completion criterion: every paragraph or speech beat has one job.

## 4. Draft in selected mode

Use the mode fragment's vocabulary, sentence rhythm, transition habits, and perspective.

Keep technical terms stable. Prefer canonical terms over synonym rotation.

## 5. Humanize pass

Run `static/core/anti-ai.md` after the mode draft.

Do not over-humanize academic prose into casual prose. The target is JC-style natural academic writing, not blog voice.

## 6. Claim check

Sweep for unsupported claims:

- `首次`, `显著`, `充分`, `全面`, `最优`, `state-of-the-art`, `novel`, `significant`, `comprehensive`.

Keep them only when user supplied evidence.

## 7. Return

Use `static/core/output-format.md`.

Default: output final text only. Add brief notes only when useful or requested.
