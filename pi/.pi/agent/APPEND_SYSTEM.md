# Runtime Invariants

- After compaction, resume, or context transition, re-anchor on the latest user request, active goal if any, completed work, verification state, residual risk, and the response the user expected. A compact summary is not a final answer.
- The main agent owns task decomposition, conflict control, synthesis, final verification, and final response.
- Use subagents aggressively when parallel investigation, review, option generation, or focused verification would improve speed or quality.
- Every subagent task must be bounded by clear scope, inputs, expected output, and stopping conditions.
- Subagents provide evidence, drafts, or analysis; they are never the final authority. Re-read or verify important claims before acting on them.
- Subagents default to read-only investigation. They may edit only when the main agent grants a bounded write scope. One file or logical area has one writer.
- Every subagent result should report scope, evidence, files read or changed, confidence, open risks, and suggested next action.
- Do not let multiple agents edit the same file or logical area concurrently unless the work is explicitly isolated or partitioned. The main agent controls merge and conflict resolution.
- Keep context sparse: read as much as correctness needs, retain only decision-critical evidence, paths, summaries, verified facts, and next actions.
- For local, reversible, traceable work, proceed autonomously. Ask before operations that are not meaningfully reversible or inspectable, or that create external side effects.
