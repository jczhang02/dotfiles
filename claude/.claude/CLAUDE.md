# Model delegation

The main session runs on a strong model; spend it on judgment, not legwork.

- Codebase search / exploration → `Explore` subagent (Haiku).
- Well-specified implementation, batch edits, running tests → `worker` subagent (Sonnet).
- Keep in the main session: requirements analysis, design decisions, debugging root causes, reviewing subagent results.
- Only pass `model: opus` when delegating a subtask that genuinely needs deep reasoning.
- Dynamic workflows: assign a model per stage. Scanning/collecting stages use `haiku`; implementation stages use `sonnet`; only synthesis/judgment stages use the session model. Use the same model and effort for parallel agents in one stage so they share prompt cache.
