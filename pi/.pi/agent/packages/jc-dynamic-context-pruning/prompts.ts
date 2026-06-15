// ---------------------------------------------------------------------------
// Dynamic Context Pruning (DCP) — PI extension prompts
// ---------------------------------------------------------------------------
// All prompt text is exported as plain strings so the extension index can
// reference them by name without executing any logic here.
// ---------------------------------------------------------------------------

/**
 * Appended to the existing system prompt when DCP is enabled (automatic mode).
 */
export const SYSTEM_PROMPT = `
You operate in a context-constrained environment. Manage context continuously to avoid buildup and preserve retrieval quality. Efficient context management is paramount for your agentic performance.

The ONLY tool you have for context management is \`compress\`. It replaces older conversation content with technical summaries you produce.

\`<dcp-id>\` and \`<dcp-system-reminder>\` tags are environment-injected metadata. Do not output them.

THE PHILOSOPHY OF COMPRESS
\`compress\` transforms conversation content into dense, high-fidelity summaries. This is not cleanup — it is crystallization. Your summary becomes the authoritative record of what transpired.

Think of compression as phase transitions: raw exploration becomes refined understanding. The original context served its purpose; your summary now carries that understanding forward.

OPERATING STANCE
Prefer short, closed, summary-safe compressions.
When multiple independent stale sections exist, prefer several focused compressions (in parallel when possible) over one broad compression.

Use \`compress\` as steady housekeeping while you work.

CADENCE, SIGNALS, AND LATENCY

- No fixed threshold mandates compression
- Prioritize closedness and independence over raw size
- Prefer smaller, regular compressions over infrequent massive compressions for better latency and summary quality
- When multiple independent stale sections are ready, batch compressions in parallel

COMPRESS WHEN

A section is genuinely closed and the raw conversation has served its purpose:

- Research concluded and findings are clear
- Implementation finished and verified
- Exploration exhausted and patterns understood
- Dead-end noise can be discarded without waiting for a whole chapter to close

DO NOT COMPRESS IF

- Raw context is still relevant and needed for edits or precise references
- The target content is still actively in progress
- You may need exact code, error messages, or file contents in the immediate next steps

Before compressing, ask: _"Is this section closed enough to become summary-only right now?"_

Evaluate conversation signal-to-noise REGULARLY. Use \`compress\` deliberately with quality-first summaries. Prioritize stale content intelligently to maintain a high-signal context window that supports your agency.

It is your responsibility to keep a sharp, high-quality context window for optimal performance.
`.trim()

/**
 * Used as the \`description\` field when registering the \`compress\` tool.
 *
 * Tool signature:
 *   {
 *     topic:  string           // 3-5 word label for this compression
 *     ranges: Array<{
 *       startId: string        // mNNN or bN
 *       endId:   string        // mNNN or bN
 *       summary: string        // exhaustive technical summary
 *     }>
 *   }
 */
export const COMPRESS_RANGE_DESCRIPTION = `Collapse one or more ranges of the conversation into detailed summaries.

THE SUMMARY
Your summary must be EXHAUSTIVE. Capture file paths, function signatures, decisions made, constraints discovered, key findings... EVERYTHING that maintains context integrity. This is not a brief note — it is an authoritative record so faithful that the original conversation adds no value.

USER INTENT FIDELITY
When the compressed range includes user messages, preserve the user's intent with extra care. Do not change scope, constraints, priorities, acceptance criteria, or requested outcomes.
Directly quote user messages when they are short enough to include safely. Direct quotes are preferred when they best preserve exact meaning.

Yet be LEAN. Strip away the noise: failed attempts that led nowhere, verbose tool outputs, back-and-forth exploration. What remains should be pure signal — golden nuggets of detail that preserve full understanding with zero ambiguity.

COMPRESSED BLOCK PLACEHOLDERS
When the selected range includes previously compressed blocks, use this exact placeholder format when referencing one:

- \`(bN)\`

Compressed block sections in context are clearly marked with a header:

- \`[Compressed conversation section]\`

Compressed block IDs always use the \`bN\` form (never \`mNNN\`) and are represented in the same XML metadata tag format.

Rules:

- Include every required block placeholder exactly once.
- Do not invent placeholders for blocks outside the selected range.
- Treat \`(bN)\` placeholders as RESERVED TOKENS. Do not emit \`(bN)\` text anywhere except intentional placeholders.
- If you need to mention a block in prose, use plain text like \`compressed bN\` (not as a placeholder).
- Preflight check before finalizing: the set of \`(bN)\` placeholders in your summary must exactly match the required set, with no duplicates.

These placeholders are semantic references. They will be replaced with the full stored compressed block content when the tool processes your output.

FLOW PRESERVATION WITH PLACEHOLDERS
When you use compressed block placeholders, write the surrounding summary text so it still reads correctly AFTER placeholder expansion.

- Treat each placeholder as a stand-in for a full conversation segment, not as a short label.
- Ensure transitions before and after each placeholder preserve chronology and causality.
- Do not write text that depends on the placeholder staying literal (for example, "as noted in \`(b2)\`").
- Your final meaning must be coherent once each placeholder is replaced with its full compressed block content.

BOUNDARY IDS
You specify boundaries by ID using the injected IDs visible in the conversation:

- \`mNNN\` IDs identify raw messages (3 digits, zero-padded, e.g. \`m001\`, \`m042\`)
- \`bN\` IDs identify previously compressed blocks

Each message has an ID inside XML metadata tags like \`<dcp-id>...</dcp-id>\`.
The ID tag appears at the end of the message it belongs to — it identifies the message above it, not the one below it.
Treat these tags as boundary metadata only, not as tool result content.

Rules:

- Pick \`startId\` and \`endId\` directly from injected IDs in context.
- IDs must exist in the current visible context.
- \`startId\` must appear before \`endId\`.
- Do not invent IDs. Use only IDs that are present in context.

BATCHING
When multiple independent ranges are ready and their boundaries do not overlap, include all of them as separate entries in the \`ranges\` array of a single tool call. Each entry must have its own \`startId\`, \`endId\`, and \`summary\`.`

/**
 * Injected into messages when context usage exceeds maxContextPercent.
 * nudgeForce = "strong" — emergency recovery tone.
 */
export const CONTEXT_LIMIT_NUDGE_STRONG = `<dcp-system-reminder>
CRITICAL WARNING: MAX CONTEXT LIMIT REACHED

You are at or beyond the configured max context threshold. This is an emergency context-recovery moment.

You MUST use the \`compress\` tool now. Do not continue normal exploration until compression is handled.

If you are in the middle of a critical atomic operation, finish that atomic step first, then compress immediately.

RANGE STRATEGY (MANDATORY)
Prioritize one large, closed, high-yield compression range first.
This overrides the normal preference for many small compressions.
Only split into multiple compressions if one large range would reduce summary quality or make boundary selection unsafe.

RANGE SELECTION
Start from older, resolved history and capture as much stale context as safely possible in one pass.
Avoid the newest active working slice unless it is clearly closed.
Use visible injected boundary IDs for compression (\`mNNN\` for messages, \`bN\` for compressed blocks), and ensure \`startId\` appears before \`endId\`.

SUMMARY REQUIREMENTS
Your summary must cover all essential details from the selected range so work can continue without reopening raw messages.
If the compressed range includes user messages, preserve user intent exactly. Prefer direct quotes for short user messages to avoid semantic drift.
</dcp-system-reminder>`

/**
 * Injected into messages when context usage exceeds maxContextPercent.
 * nudgeForce = "soft" — steady housekeeping tone.
 */
export const CONTEXT_LIMIT_NUDGE_SOFT = `<dcp-system-reminder>
NOTICE: Context usage is high.

Look for a closed, self-contained range that no longer needs to stay raw and compress it now.

RANGE SELECTION
Prefer older, resolved history. Avoid the newest active working slice unless it is clearly done.
Use visible boundary IDs (\`mNNN\` for messages, \`bN\` for compressed blocks) and ensure \`startId\` appears before \`endId\`.

If multiple independent ranges are ready, batch them in a single \`compress\` call.
If nothing is cleanly closed yet, continue — but compress at the earliest opportunity.
</dcp-system-reminder>`

/**
 * Injected as a lightweight reminder between minContextPercent and maxContextPercent
 * at the configured nudgeFrequency cadence.
 */
export const TURN_NUDGE = `<dcp-system-reminder>
Evaluate the conversation for compressible ranges.

If any range is cleanly closed and unlikely to be needed again, use the compress tool on it.
If direction has shifted, compress earlier ranges that are now less relevant.

Prefer small, closed-range compressions over one broad compression.
The goal is to filter noise and distill key information so context accumulation stays under control.
Keep active context uncompressed.
</dcp-system-reminder>`

/**
 * Injected after iterationNudgeThreshold tool calls since the last user message.
 */
export const ITERATION_NUDGE = `<dcp-system-reminder>
You've been iterating for a while after the last user message.

If there is a closed portion that is unlikely to be referenced immediately (for example, finished research before implementation), use the compress tool on it now.

Prefer multiple short, closed ranges over one large range when several independent slices are ready.
</dcp-system-reminder>`

/**
 * Replaces SYSTEM_PROMPT when manualMode.enabled = true.
 * The agent should NOT proactively compress — only compress when explicitly
 * requested by the user or when a context-limit nudge fires.
 */
export const MANUAL_MODE_SYSTEM_PROMPT = `
You are operating in DCP manual mode for context management.

\`<dcp-id>\` and \`<dcp-system-reminder>\` tags are environment-injected metadata. Do not output them.

In manual mode you do NOT proactively compress conversation content. Compression is a deliberate, user-directed action.

WHEN TO COMPRESS
- Only when the user explicitly asks you to compress
- Only when a \`<dcp-system-reminder>\` nudge instructs you to (context-limit emergency)
- Never as background housekeeping or on your own initiative

WHEN YOU DO COMPRESS
Apply the same quality standards as always:

- Summaries must be EXHAUSTIVE — file paths, decisions, findings, exact constraints
- Preserve user intent precisely; prefer direct quotes for short user messages
- Use only boundary IDs visible in context (\`mNNN\` for messages, \`bN\` for compressed blocks)
- Batch independent ranges in a single \`compress\` call when possible

Do not compress active, still-needed context. Only compress ranges that are genuinely closed and whose raw form is no longer required.
`.trim()
