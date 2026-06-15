// ---------------------------------------------------------------------------
// Dynamic Context Pruning (DCP) — compress tool registration
// ---------------------------------------------------------------------------

import { Type } from "@sinclair/typebox"
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent"
import type { CompressionBlock, DcpState } from "./state.js"
import type { DcpConfig } from "./config.js"
import { COMPRESS_RANGE_DESCRIPTION } from "./prompts.js"
import { estimateTokens } from "./pruner.js"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Replace `(bN)` placeholders in a summary with the stored content of the
 * referenced compression block.  Unrecognised placeholders are left as-is.
 */
function expandBlockPlaceholders(summary: string, state: DcpState): string {
  return summary.replace(/\(b(\d+)\)/g, (match, idStr) => {
    const id = parseInt(idStr, 10)
    const block = state.compressionBlocks.find((b) => b.id === id && b.active)
    return block
      ? `[Previously compressed: ${block.topic}]\n${block.summary}`
      : match
  })
}

/**
 * Resolve a user-supplied ID string (e.g. "m001" or "b3") to an actual
 * message timestamp.
 *
 * - `mNNN` ids  → looked up directly in `state.messageIdSnapshot`
 * - `bN`   ids  → matched against `state.compressionBlocks` by integer id;
 *                 `field` selects whether we return the block's start or end
 *                 timestamp depending on whether the id is used as a range
 *                 start or end boundary.
 *
 * Throws `Error("Unknown message ID: <id>")` when the id cannot be resolved.
 */
function resolveIdToTimestamp(
  rawId: string,
  field: "startTimestamp" | "endTimestamp",
  state: DcpState,
): number {
  const id = rawId.trim()

  // Block ID: b1, b2, b10, …
  const blockMatch = id.match(/^b(\d+)$/i)
  if (blockMatch) {
    const blockId = parseInt(blockMatch[1]!, 10)
    const block = state.compressionBlocks.find((b) => b.id === blockId && b.active)
    if (!block) throw new Error(`Unknown message ID: ${id}`)
    return block[field]
  }

  // Message ID: m001, m042, …
  const ts = state.messageIdSnapshot.get(id)
  if (ts === undefined) throw new Error(`Unknown message ID: ${id}`)
  return ts
}

/**
 * Determine the anchor timestamp for a compression block — the timestamp of
 * the first raw message that appears strictly after `endTimestamp`.
 *
 * Returns `endTimestamp + 1` when the range extends to the very end of the
 * visible conversation (nothing comes after it). We never use Infinity because
 * it corrupts JSON serialization (becomes null) and breaks numeric comparisons.
 */
function resolveAnchorTimestamp(endTimestamp: number, state: DcpState): number {
  let anchor: number | null = null
  for (const ts of state.messageIdSnapshot.values()) {
    if (ts > endTimestamp && (anchor === null || ts < anchor)) {
      anchor = ts
    }
  }
  // Fall back to endTimestamp + 1 instead of Infinity to avoid JSON
  // serialization corruption (Infinity → null) and comparison breakage.
  return anchor ?? endTimestamp + 1
}

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

export function registerCompressTool(
  pi: ExtensionAPI,
  state: DcpState,
  config: DcpConfig,
): void {
  pi.registerTool({
    name: "compress",
    label: "Compress Context",
    description: COMPRESS_RANGE_DESCRIPTION,
    promptSnippet: "Compress ranges of conversation into summaries to manage context",
    parameters: Type.Object({
      topic: Type.String({
        description:
          "Short label (3-5 words) for display - e.g., 'Auth System Exploration'",
      }),
      ranges: Type.Array(
        Type.Object({
          startId: Type.String({
            description:
              "Message ID marking start of range (e.g. m001, b2)",
          }),
          endId: Type.String({
            description:
              "Message ID marking end of range (e.g. m042, b5)",
          }),
          summary: Type.String({
            description:
              "Complete technical summary replacing all content in range",
          }),
        }),
        { description: "One or more ranges to compress" },
      ),
    }),

    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const newBlockIds: number[] = []

      for (const range of params.ranges) {
        const { startId, endId, summary } = range

        // ── Resolve boundary timestamps ──────────────────────────────────
        const startTimestamp = resolveIdToTimestamp(startId, "startTimestamp", state)
        const endTimestamp = resolveIdToTimestamp(endId, "endTimestamp", state)

        if (startTimestamp > endTimestamp) {
          throw new Error(
            `Range start "${startId}" must appear before end "${endId}" in the conversation`,
          )
        }

        // ── Validate timestamps are finite ──────────────────────────────
        if (!Number.isFinite(startTimestamp)) {
          throw new Error(
            `Start ID "${startId}" resolved to a non-finite timestamp (${startTimestamp}). ` +
            `This usually means the referenced message has a corrupted timestamp.`,
          )
        }
        if (!Number.isFinite(endTimestamp)) {
          throw new Error(
            `End ID "${endId}" resolved to a non-finite timestamp (${endTimestamp}). ` +
            `This usually means the referenced message has a corrupted timestamp.`,
          )
        }

        // ── Overlap check against existing active blocks ─────────────────
        for (const existing of state.compressionBlocks) {
          if (!existing.active) continue
          // Skip blocks with corrupted timestamps
          if (!Number.isFinite(existing.startTimestamp) || !Number.isFinite(existing.endTimestamp)) {
            continue
          }
          const overlaps =
            startTimestamp <= existing.endTimestamp &&
            existing.startTimestamp <= endTimestamp
          if (overlaps) {
            throw new Error(
              `Overlapping compression ranges are not supported. ` +
              `New range (${startId}..${endId}) overlaps existing block ` +
              `b${existing.id} "${existing.topic}" ` +
              `(b${existing.id} covers ${existing.startTimestamp}..${existing.endTimestamp}, ` +
              `new range covers ${startTimestamp}..${endTimestamp})`,
            )
          }
        }

        // ── Anchor: first raw message after the range ────────────────────
        const anchorTimestamp = resolveAnchorTimestamp(endTimestamp, state)

        // ── Expand any (bN) placeholders in the summary ──────────────────
        const expandedSummary = expandBlockPlaceholders(summary, state)

        // ── Create and store the compression block ───────────────────────
        const block: CompressionBlock = {
          id: state.nextBlockId++,
          topic: params.topic,
          summary: expandedSummary,
          startTimestamp,
          endTimestamp,
          anchorTimestamp,
          active: true,
          summaryTokenEstimate: estimateTokens(expandedSummary),
          createdAt: Date.now(),
        }

        state.compressionBlocks.push(block)
        newBlockIds.push(block.id)
      }

      // ── Notification ────────────────────────────────────────────────────
      if (config.pruneNotification !== "off") {
        const count = params.ranges.length
        const rangeWord = count === 1 ? "range" : "ranges"

        if (config.pruneNotification === "detailed") {
          const totalTokens = newBlockIds.reduce((sum, id) => {
            const b = state.compressionBlocks.find((block) => block.id === id)
            return sum + (b?.summaryTokenEstimate ?? 0)
          }, 0)
          ctx.ui.notify(
            `Compressed: ${params.topic} (${count} ${rangeWord}, ~${totalTokens} tokens in summaries)`,
            "info",
          )
        } else {
          // "minimal"
          ctx.ui.notify(`Compressed: ${params.topic}`, "info")
        }
      }

      // ── Return result ───────────────────────────────────────────────────
      return {
        content: [
          {
            type: "text",
            text: `Compressed ${params.ranges.length} range(s): ${params.topic}`,
          },
        ],
        details: {
          blockIds: newBlockIds,
          topic: params.topic,
        },
      }
    },
  })
}
