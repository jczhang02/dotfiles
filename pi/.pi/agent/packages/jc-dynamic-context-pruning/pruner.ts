import type { DcpState } from "./state.js";
import type { DcpConfig } from "./config.js";

// Always-protected tool names for deduplication
const ALWAYS_PROTECTED_DEDUP = new Set(["compress", "write", "edit"]);

// Roles that get message IDs injected
const ID_ELIGIBLE_ROLES = new Set(["user", "assistant", "toolResult", "bashExecution"]);

// Roles that are PI-internal and should pass through unchanged
const PASSTHROUGH_ROLES = new Set(["compaction", "branch_summary", "custom_message"]);

/**
 * Simple token estimator: chars / 4, rounded.
 */
export function estimateTokens(text: string): number {
  return Math.round(text.length / 4);
}

/**
 * Estimate tokens from a message's content, whatever shape it takes.
 */
function estimateMessageTokens(msg: any): number {
  if (!msg) return 0;
  const content = msg.content;
  if (!content) return 0;
  if (typeof content === "string") return estimateTokens(content);
  if (Array.isArray(content)) {
    let total = 0;
    for (const part of content) {
      if (part && typeof part === "object") {
        if (typeof part.text === "string") total += estimateTokens(part.text);
        else if (typeof part.thinking === "string") total += estimateTokens(part.thinking);
        else if (part.type === "image") total += 500; // rough estimate for images
      }
    }
    return total;
  }
  return 0;
}

/**
 * Apply active compression blocks to the message array.
 * Mutates messages in place (via splice/sort) and returns it.
 */
function applyCompressionBlocks(messages: any[], state: DcpState): any[] {
  const activeBlocks = state.compressionBlocks.filter((b) => b.active);
  if (activeBlocks.length === 0) return messages;

  for (const block of activeBlocks) {
    // Skip blocks with corrupted timestamps (from pre-fix sessions)
    if (!Number.isFinite(block.startTimestamp) || !Number.isFinite(block.endTimestamp)) continue;

    // Find start and end indices by timestamp
    const startIdx = messages.findIndex((m) => m.timestamp === block.startTimestamp);
    const endIdx = messages.findIndex((m) => m.timestamp === block.endTimestamp);

    if (startIdx === -1 || endIdx === -1) continue;

    let lo = Math.min(startIdx, endIdx);
    let hi = Math.max(startIdx, endIdx);

    // Expand lo backward: if there is an assistant before lo whose tool_use
    // blocks have matching tool_results inside [lo..hi], pull the entire
    // assistant + any intermediate result messages into the range so the
    // group is always removed atomically.
    //
    // Critically we must skip backward past any toolResult / bashExecution
    // messages before lo, because an assistant with multiple tool_calls emits
    // N consecutive result messages — the assistant itself sits further back.
    while (lo > 0) {
      // Walk backward past tool-result messages to find the preceding assistant
      let scanIdx = lo - 1;
      while (scanIdx >= 0) {
        const r = (messages[scanIdx] as any).role as string;
        if (r !== "toolResult" && r !== "bashExecution" && !PASSTHROUGH_ROLES.has(r)) break;
        scanIdx--;
      }
      if (scanIdx < 0 || (messages[scanIdx] as any).role !== "assistant") break;

      const prev = messages[scanIdx] as any;
      const toolCallIdsInRange = new Set<string>();
      for (let i = lo; i <= hi; i++) {
        const m = messages[i] as any;
        if (
          (m.role === "toolResult" || m.role === "bashExecution") &&
          typeof m.toolCallId === "string"
        ) {
          toolCallIdsInRange.add(m.toolCallId);
        }
      }
      const prevContent: any[] = Array.isArray(prev.content) ? prev.content : [];
      const hasMatchingToolCalls = prevContent.some(
        (block: any) => block.type === "toolCall" && toolCallIdsInRange.has(block.id)
      );
      if (!hasMatchingToolCalls) break;
      // Pull assistant + all intermediate result messages into the range
      lo = scanIdx;
    }

    // Expand hi forward: for every assistant message in [lo..hi] that has
    // tool_use blocks, include any immediately-following tool_result messages
    // that correspond to those blocks. Loop to fixed point because expanding
    // hi could expose more assistants in theory.
    let prevHi: number;
    do {
      prevHi = hi;
      const assistantToolCallIds = new Set<string>();
      for (let i = lo; i <= hi; i++) {
        const m = messages[i] as any;
        if (m.role !== "assistant") continue;
        const content: any[] = Array.isArray(m.content) ? m.content : [];
        for (const block of content) {
          if (block.type === "toolCall" && typeof block.id === "string") {
            assistantToolCallIds.add(block.id);
          }
        }
      }
      while (hi + 1 < messages.length) {
        const next = messages[hi + 1] as any;
        if (
          (next.role === "toolResult" || next.role === "bashExecution") &&
          assistantToolCallIds.has(next.toolCallId)
        ) {
          hi++;
        } else if (PASSTHROUGH_ROLES.has(next.role)) {
          hi++;
        } else {
          break;
        }
      }
    } while (hi !== prevHi);

    // Estimate tokens removed
    let removedTokens = 0;
    for (let i = lo; i <= hi; i++) {
      removedTokens += estimateMessageTokens(messages[i]);
    }

    // Remove the range (inclusive)
    messages.splice(lo, hi - lo + 1);

    // Build synthetic user message for the compressed block
    const syntheticMsg = {
      role: "user",
      content: [
        {
          type: "text",
          text:
            "[Compressed section: " +
            block.topic +
            "]\n\n" +
            block.summary +
            "\n\n<dcp-block-id>b" +
            block.id +
            "</dcp-block-id>",
        },
      ],
      // anchorTimestamp is always finite (resolveAnchorTimestamp returns
      // endTimestamp + 1 instead of Infinity), but guard against corrupted
      // state from older sessions where Infinity/null could leak in.
      timestamp: Number.isFinite(block.anchorTimestamp) ? block.anchorTimestamp - 0.5 : block.endTimestamp + 0.5,
    };

    // Estimate tokens added by the summary
    const addedTokens = estimateMessageTokens(syntheticMsg);

    // Insert the synthetic message
    messages.push(syntheticMsg);

    // Re-sort by timestamp
    messages.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));

    // Update tokens saved
    const saved = removedTokens - addedTokens;
    if (saved > 0) state.tokensSaved += saved;
  }

  return messages;
}

/**
 * Remove orphaned toolResult/bashExecution messages whose corresponding
 * assistant toolCall was removed, and strip orphaned toolCall blocks from
 * assistant messages whose toolResult was removed.
 *
 * This is a safety net that runs after all compression blocks are applied.
 */
function repairOrphanedToolPairs(messages: any[]): void {
  // 1. Build set of all toolCall IDs present in assistant messages
  const assistantToolCallIds = new Set<string>();
  for (const msg of messages) {
    if (msg.role !== "assistant") continue;
    const content: any[] = Array.isArray(msg.content) ? msg.content : [];
    for (const block of content) {
      if (block.type === "toolCall" && typeof block.id === "string") {
        assistantToolCallIds.add(block.id);
      }
    }
  }

  // 2. Build set of all toolCallIds present in toolResult/bashExecution messages
  const resultToolCallIds = new Set<string>();
  for (const msg of messages) {
    if (msg.role !== "toolResult" && msg.role !== "bashExecution") continue;
    if (typeof msg.toolCallId === "string") {
      resultToolCallIds.add(msg.toolCallId);
    }
  }

  // 3. Remove orphaned toolResult/bashExecution messages (no matching assistant toolCall)
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== "toolResult" && msg.role !== "bashExecution") continue;
    if (typeof msg.toolCallId === "string" && !assistantToolCallIds.has(msg.toolCallId)) {
      messages.splice(i, 1);
    }
  }

  // 4. Strip orphaned toolCall blocks from assistant messages (no matching toolResult)
  for (const msg of messages) {
    if (msg.role !== "assistant") continue;
    const content: any[] = Array.isArray(msg.content) ? msg.content : [];
    const hasToolCalls = content.some((b: any) => b.type === "toolCall");
    if (!hasToolCalls) continue;

    const filtered = content.filter((block: any) => {
      if (block.type !== "toolCall") return true;
      return typeof block.id === "string" && resultToolCallIds.has(block.id);
    });

    // Only update if we actually removed something
    if (filtered.length !== content.length) {
      // If the assistant has no content left at all, keep at least an empty array
      msg.content = filtered.length > 0 ? filtered : [];
    }
  }
}

/**
 * Apply deduplication: mark redundant tool outputs for pruning.
 * Mutates state.prunedToolIds.
 */
function applyDeduplication(messages: any[], state: DcpState, config: DcpConfig): void {
  if (!config.strategies.deduplication.enabled) return;
  if (state.manualMode && !config.manualMode.automaticStrategies) return;

  const protectedTools = new Set([
    ...ALWAYS_PROTECTED_DEDUP,
    ...(config.strategies.deduplication.protectedTools ?? []),
  ]);

  // fingerprint → array of toolCallIds in timestamp order
  const fingerprintMap = new Map<string, string[]>();

  for (const msg of messages) {
    if (msg.role !== "toolResult") continue;
    const toolName: string = msg.toolName ?? "";
    if (protectedTools.has(toolName)) continue;

    // Look up the fingerprint from the recorded tool call
    const record = state.toolCalls.get(msg.toolCallId);
    if (!record) continue;

    const fp = record.inputFingerprint;
    if (!fingerprintMap.has(fp)) {
      fingerprintMap.set(fp, []);
    }
    fingerprintMap.get(fp)!.push(msg.toolCallId);
  }

  // For each fingerprint with duplicates, prune all but the last
  for (const [, ids] of fingerprintMap) {
    if (ids.length <= 1) continue;
    // Keep the last one; prune the rest
    for (let i = 0; i < ids.length - 1; i++) {
      state.prunedToolIds.add(ids[i]);
      state.totalPruneCount++;
    }
  }
}

/**
 * Apply error purging: mark old error tool outputs for pruning.
 * Mutates state.prunedToolIds.
 */
function applyErrorPurging(messages: any[], state: DcpState, config: DcpConfig): void {
  if (!config.strategies.purgeErrors.enabled) return;
  if (state.manualMode && !config.manualMode.automaticStrategies) return;

  const protectedTools = new Set(config.strategies.purgeErrors.protectedTools ?? []);
  const turnsThreshold = config.strategies.purgeErrors.turns ?? 3;

  for (const msg of messages) {
    if (msg.role !== "toolResult") continue;
    if (!msg.isError) continue;

    const toolName: string = msg.toolName ?? "";
    if (protectedTools.has(toolName)) continue;

    const record = state.toolCalls.get(msg.toolCallId);
    if (!record) continue;

    if (state.currentTurn - record.turnIndex >= turnsThreshold) {
      state.prunedToolIds.add(msg.toolCallId);
      state.totalPruneCount++;
    }
  }
}

/**
 * Apply explicit tool output pruning from state.prunedToolIds.
 * Replaces content of matching toolResult messages in place.
 */
function applyToolOutputPruning(messages: any[], state: DcpState): void {
  for (const msg of messages) {
    if (msg.role !== "toolResult") continue;
    if (!state.prunedToolIds.has(msg.toolCallId)) continue;

    if (msg.isError) {
      msg.content = [
        {
          type: "text",
          text: "[Error output removed - tool failed more than N turns ago]",
        },
      ];
    } else {
      msg.content = [
        {
          type: "text",
          text: "[Output removed to save context - information superseded or no longer needed]",
        },
      ];
    }
  }
}

/**
 * Inject sequential message IDs into eligible messages.
 * Updates state.messageIdSnapshot.
 */
function injectMessageIds(messages: any[], state: DcpState): void {
  // Clear the snapshot and rebuild
  state.messageIdSnapshot.clear();

  let counter = 1;

  for (const msg of messages) {
    const role: string = msg.role ?? "";

    // Skip PI-internal passthrough messages
    if (PASSTHROUGH_ROLES.has(role)) continue;
    // Skip non-eligible roles
    if (!ID_ELIGIBLE_ROLES.has(role)) continue;

    const id = "m" + String(counter).padStart(3, "0");
    counter++;

    const idTag = `\n<dcp-id>${id}</dcp-id>`;

    if (role === "user") {
      if (typeof msg.content === "string") {
        msg.content = msg.content + `\n\n<dcp-id>${id}</dcp-id>`;
      } else if (Array.isArray(msg.content)) {
        msg.content = [...msg.content, { type: "text", text: idTag }];
      }
    } else if (role === "toolResult" || role === "bashExecution") {
      if (Array.isArray(msg.content)) {
        msg.content = [...msg.content, { type: "text", text: idTag }];
      } else if (typeof msg.content === "string") {
        msg.content = msg.content + idTag;
      }
    } else if (role === "assistant") {
      if (Array.isArray(msg.content)) {
        // Insert the ID tag before any tool_use (toolCall) blocks.
        // Anthropic requires: thinking → text → tool_use.
        // Appending after tool_use blocks violates that constraint.
        const firstToolCallIdx = msg.content.findIndex(
          (b: any) => b.type === "toolCall",
        );
        const idBlock = { type: "text", text: idTag };
        if (firstToolCallIdx === -1) {
          // No tool_use blocks — append as usual
          msg.content = [...msg.content, idBlock];
        } else {
          // Insert immediately before the first tool_use block
          msg.content = [
            ...msg.content.slice(0, firstToolCallIdx),
            idBlock,
            ...msg.content.slice(firstToolCallIdx),
          ];
        }
      } else if (typeof msg.content === "string") {
        msg.content = msg.content + idTag;
      }
    }

    if (msg.timestamp !== undefined) {
      state.messageIdSnapshot.set(id, msg.timestamp);
    }
  }
}

/**
 * Main transform: applies all pruning and returns modified message array.
 * Called from the `context` event handler.
 */
export function applyPruning(
  messages: any[],
  state: DcpState,
  config: DcpConfig
): any[] {
  // Deep-clone each message and its content to prevent mutations from
  // affecting the original objects across context events.
  const msgs: any[] = messages.map((m: any) => {
    const clone = { ...m };
    if (Array.isArray(clone.content)) {
      clone.content = clone.content.map((block: any) =>
        typeof block === "object" && block !== null ? { ...block } : block
      );
    }
    return clone;
  });

  // 1. Count user turns → update state.currentTurn
  state.currentTurn = msgs.filter((m) => m.role === "user").length;

  // 2. Apply active compression blocks
  applyCompressionBlocks(msgs, state);

  // 2b. Post-compression safety net: remove any orphaned tool pairs that the
  // expansion logic could not catch (e.g. multi-block interactions, pre-broken state).
  repairOrphanedToolPairs(msgs);

  // 3. Apply deduplication
  applyDeduplication(msgs, state, config);

  // 4. Apply error purging
  applyErrorPurging(msgs, state, config);

  // 5. Apply explicit tool output pruning (prunedToolIds)
  applyToolOutputPruning(msgs, state);

  // 6. Inject message IDs into visible messages
  injectMessageIds(msgs, state);

  // 7. state.messageIdSnapshot is already updated by injectMessageIds

  return msgs;
}

/**
 * Inject context limit nudge as a synthetic user message at the end of messages.
 * Mutates messages in place.
 */
export function injectNudge(messages: any[], nudgeText: string): void {
  messages.push({
    role: "user",
    content: nudgeText,
    timestamp: Date.now(),
  });
}

/**
 * Determine if a nudge should fire and return the nudge type, or null.
 */
export function getNudgeType(
  contextPercent: number,
  state: DcpState,
  config: DcpConfig,
  toolCallsSinceLastUser: number
): "context-strong" | "context-soft" | "turn" | "iteration" | null {
  const { maxContextPercent, minContextPercent, nudgeFrequency, nudgeForce, iterationNudgeThreshold } =
    config.compress;

  if (contextPercent > maxContextPercent) {
    // Only fire if nudge counter has reached frequency threshold
    if (state.nudgeCounter >= nudgeFrequency) {
      return nudgeForce === "strong" ? "context-strong" : "context-soft";
    }
    // Still above max but haven't hit frequency yet — fall through to lower checks
  }

  if (contextPercent > minContextPercent && contextPercent <= maxContextPercent) {
    if (toolCallsSinceLastUser >= iterationNudgeThreshold) {
      return "iteration";
    }
    return "turn";
  }

  return null;
}
