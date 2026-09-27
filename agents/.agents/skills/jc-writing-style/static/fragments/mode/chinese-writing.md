# Mode: Chinese writing style

Use for Chinese academic prose, research reports, project summaries, manuscript sections, and technical explanations.

Source family: C/D groups — Chinese papers, competition papers, project closing reports, and Chinese comments in technical manuscripts. Do not use A group.

## Core voice

- Formal, technical, and objective.
- Written from problem to method to evidence.
- Prefer `本文`, `该方法`, `该模型`, `实验结果表明`; use `我们` when describing author actions or project work.
- Keep claims bounded. The style is confident but not promotional.
- Chinese punctuation and full-width commas are acceptable; keep terminology precise.

## Paragraph jobs

Common paragraph shapes:

1. **Background → tension**
   - `随着...的发展，...不断涌现。`
   - `一方面，...；另一方面，...。`
   - End with concrete problem, not broad significance.

2. **Problem → need**
   - `因此，如何...成为一个关键问题。`
   - `然而，现有方法...，难以...。`

3. **Method → mechanism**
   - `为了解决上述问题，本文提出...。`
   - `具体来说，首先...；随后...；最后...。`
   - Define symbols and modules directly; avoid metaphor.

4. **Experiment → conclusion**
   - `在...数据集上进行实验。`
   - `实验结果表明，...在...方面优于...。`

5. **Conclusion → future work**
   - `本文提出...，并设计...。`
   - `未来工作将进一步...。`

## Sentence habits

- Medium-long sentences are normal when giving definitions, motivations, and method details.
- One sentence may contain condition + object + purpose, but should not carry two paragraph jobs.
- Use stable repeated nouns instead of synonym rotation: `特征选择` stays `特征选择`, not `特征筛选/变量挑选/维度压缩` unless meaning changes.
- Use `此外`, `因此`, `在此基础上`, `进一步`, `与...相比`, `具体来说` sparingly but naturally.

## Preferred phrasing

- `随着...的发展，...不断涌现。`
- `这给...带来了挑战。`
- `事实上，...只有一部分...是有价值的。`
- `为了...，本文提出...。`
- `该方法通过...，实现...。`
- `大量实验结果表明，...。`
- `在未来，我们希望...。`

## Avoid

- Speech openings: `各位老师，大家好`, `下面由我介绍`.
- Over-oral questions: `那么，如何...呢？` unless user wants popularized explanation.
- AI praise: `具有里程碑意义`, `充分彰显`, `为领域发展注入新动能`.
- Empty broad endings: `具有重要的理论价值和现实意义` without specifics.
- Excessive `首先/其次/最后` if the paragraph is not actually procedural.

## Rewrite calibration

When rewriting user prose:

- Preserve technical content and order unless structure is broken.
- Make vague claims concrete by naming object, method, metric, dataset, or limitation.
- Convert chatty explanations into paper/report prose.
- Keep a mild Chinese-author academic rhythm; do not over-polish into government-report language.
