// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A record of a single tool call, keyed by toolCallId in DcpState.toolCalls.
 */
export interface ToolRecord {
  /** Matches ToolResultMessage.toolCallId */
  toolCallId: string
  /** Matches ToolResultMessage.toolName */
  toolName: string
  /** The arguments passed to the tool (from the corresponding ToolCall) */
  inputArgs: Record<string, unknown>
  /**
   * Deduplication fingerprint: `toolName::JSON(sortedArgs)`
   * Two calls with the same name + identical args share the same fingerprint.
   */
  inputFingerprint: string
  /** Whether the tool result was an error */
  isError: boolean
  /**
   * Zero-based index of the user turn during which this tool was called.
   * Incremented each time a user message is encountered in the context stream.
   */
  turnIndex: number
  /** message.timestamp from the ToolResultMessage */
  timestamp: number
  /** Rough token estimate: sum of result text content lengths divided by 4 */
  tokenEstimate: number
}

/**
 * A compression block created by the `compress` tool.
 * Tracks the range of messages that were summarised and where to inject the
 * summary back into the context.
 */
export interface CompressionBlock {
  /** Auto-incrementing integer ID */
  id: number
  /** Short human-readable topic label */
  topic: string
  /** LLM-generated summary text */
  summary: string
  /** Timestamp of the first message in the compressed range */
  startTimestamp: number
  /** Timestamp of the last message in the compressed range */
  endTimestamp: number
  /**
   * Timestamp of the first message *after* the range — the summary is injected
   * immediately before this message.  Set to `Infinity` when the range extends
   * to the end of the conversation.
   */
  anchorTimestamp: number
  /** Whether this block is still being applied (false = soft-deleted) */
  active: boolean
  /** Token estimate for the summary text itself */
  summaryTokenEstimate: number
  /** Wall-clock time the block was created (Date.now()) */
  createdAt: number
}

/**
 * Full runtime state for the DCP extension.
 */
export interface DcpState {
  // ── Tool tracking ──────────────────────────────────────────────────────────
  /** toolCallId → ToolRecord, populated when a tool_result event fires */
  toolCalls: Map<string, ToolRecord>
  /** Set of toolCallIds whose result messages should be suppressed in context */
  prunedToolIds: Set<string>

  // ── Compression ────────────────────────────────────────────────────────────
  /** All compression blocks (both active and soft-deleted) */
  compressionBlocks: CompressionBlock[]
  /** Monotonically increasing counter used to assign CompressionBlock.id */
  nextBlockId: number

  // ── Message ID snapshot ────────────────────────────────────────────────────
  /**
   * Maps the short LLM-visible message IDs (e.g. "m001") to the actual
   * `timestamp` of that message as seen in the last `context` event.
   *
   * The `compress` tool receives ID strings from the LLM; this map lets us
   * translate them back to real timestamps so compression blocks can reference
   * message positions by timestamp (which is stable across pruning passes).
   */
  messageIdSnapshot: Map<string, number>

  // ── Turn tracking ──────────────────────────────────────────────────────────
  /**
   * Zero-based index of the current user turn.
   * Incremented each time a user message is encountered while processing the
   * context array in the `context` event handler.
   */
  currentTurn: number

  // ── Statistics ─────────────────────────────────────────────────────────────
  /** Running total of tokens estimated to have been saved by pruning/compression */
  tokensSaved: number
  /** Number of discrete pruning operations performed */
  totalPruneCount: number

  // ── Mode ───────────────────────────────────────────────────────────────────
  /**
   * When true, the extension will not autonomously emit compress nudges.
   * Automatic deduplication/error-purge strategies may still run depending on
   * the `manualMode.automaticStrategies` config flag.
   */
  manualMode: boolean

  // ── Nudge state ────────────────────────────────────────────────────────────
  /**
   * How many `context` events have fired since the last compress nudge was
   * emitted.  Reset to 0 after each nudge.
   */
  nudgeCounter: number
  /**
   * The value of `currentTurn` at the time the last nudge was emitted.
   * Used to avoid nudging more than once per user turn when nudgeFrequency is
   * satisfied within the same turn.
   */
  lastNudgeTurn: number
}

// ---------------------------------------------------------------------------
// Factory functions
// ---------------------------------------------------------------------------

/** Create a fresh, zeroed DcpState instance. */
export function createState(): DcpState {
  return {
    toolCalls: new Map(),
    prunedToolIds: new Set(),
    compressionBlocks: [],
    nextBlockId: 1,
    messageIdSnapshot: new Map(),
    currentTurn: 0,
    tokensSaved: 0,
    totalPruneCount: 0,
    manualMode: false,
    nudgeCounter: 0,
    lastNudgeTurn: -1,
  }
}

/**
 * Reset `state` back to its initial values **in-place**.
 * Preserves the object reference so other modules holding a reference see the
 * reset immediately.
 */
export function resetState(state: DcpState): void {
  state.toolCalls.clear()
  state.prunedToolIds.clear()
  state.compressionBlocks = []
  state.nextBlockId = 1
  state.messageIdSnapshot.clear()
  state.currentTurn = 0
  state.tokensSaved = 0
  state.totalPruneCount = 0
  state.manualMode = false
  state.nudgeCounter = 0
  state.lastNudgeTurn = -1
}

// ---------------------------------------------------------------------------
// Fingerprinting
// ---------------------------------------------------------------------------

/**
 * Recursively sort the keys of a plain object so that two argument objects
 * with the same entries in different key-insertion order produce the same JSON.
 */
function sortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortObjectKeys)
  }
  if (value !== null && typeof value === "object") {
    const obj = value as Record<string, unknown>
    const sorted: Record<string, unknown> = {}
    for (const key of Object.keys(obj).sort()) {
      sorted[key] = sortObjectKeys(obj[key])
    }
    return sorted
  }
  return value
}

/**
 * Create a stable deduplication fingerprint for a tool call.
 *
 * Two calls with the same `toolName` and semantically identical `args`
 * (regardless of key ordering) will produce the same fingerprint.
 *
 * Format: `<toolName>::<JSON of recursively key-sorted args>`
 */
export function createInputFingerprint(
  toolName: string,
  args: Record<string, unknown>,
): string {
  const sorted = sortObjectKeys(args)
  return `${toolName}::${JSON.stringify(sorted)}`
}
