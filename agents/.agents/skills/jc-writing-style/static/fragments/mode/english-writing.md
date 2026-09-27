# Mode: English writing style

Use for English academic manuscript prose, especially ML/math/algorithm papers and reviewer responses.

Source family: `/home/jc/Documents/research/projects/SFS-SLL`, identified by the user as handwritten paper text.

This mode is not Nature polishing. Preserve JC's direct academic manuscript style.

## Core voice

- Formal, method-paper English.
- Direct argument chain: context → challenge → gap → method → experiment → result.
- Use `we propose`, `we develop`, `we introduce`, `we evaluate`, `experimental results show` when appropriate.
- Prefer bounded claims: `can better`, `is effective`, `outperform ... in terms of ...`, `verify the convergence`.
- Use standard academic transitions without over-decorating.

## Paragraph jobs

1. **Context and challenge**
   - Start from a technical field trend.
   - State both benefit and difficulty if needed.
   - Example pattern: high-dimensional data improves downstream tasks but brings dimensionality and efficiency challenges.

2. **Gap**
   - Define what existing methods fail to exploit, preserve, or model.
   - Avoid unsupported `few studies` unless evidence exists.

3. **Method**
   - `Motivated by the above analysis, we propose...`
   - `Specifically, we first..., then..., and finally...`
   - Keep notation sentences plain and explicit.

4. **Experiment**
   - Name datasets, baselines, metrics, and variables.
   - Use `We conduct experiments on...` and `The experimental results show...`.

5. **Conclusion**
   - Contribution, optimization/implementation, evidence, and future work.

## Sentence habits

- Medium-length sentences, usually one technical claim per sentence.
- Definitions are explicit: `X denotes...`, `d is the dimension of...`.
- Terms repeat for clarity; do not rotate synonyms.
- Passive voice is allowed for method descriptions, but active `we` is common for contributions.
- Use present tense for method and general truths; use past tense only for completed experiments when needed.

## Preferred phrasing

- `High-dimensional data is increasingly prevalent in...`
- `However, ... poses great challenges for...`
- `Therefore, ... has become a critical problem.`
- `In this paper, we propose...`
- `Specifically, we first..., then..., and finally...`
- `Besides, we develop a simple yet effective optimization method...`
- `Extensive experimental results show that...`
- `In future work, we will...`

## Avoid

- Native-speaker over-polish that erases the source voice.
- Nature-style drama: `Here we show`, broad-audience hook, compressed high-impact framing, unless user asks.
- Marketing words: `revolutionary`, `paradigm-shifting`, `groundbreaking`.
- Vague novelty: `novel` or `first` without proof.
- Empty intensifiers: `very`, `extremely`, `remarkably`.

## Reviewer-response submode

When writing replies to reviewers:

- Start with gratitude only once per comment: `Thanks for pointing out this problem.`
- State action taken: `According to your suggestion, we have...`
- Quote or summarize revised content if needed.
- Keep tone polite, concrete, and evidence-based.
