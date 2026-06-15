import type { ExtensionAPI, ExtensionCommandContext } from "@mariozechner/pi-coding-agent"
import type { AutocompleteItem } from "@mariozechner/pi-tui"
import type { DcpState } from "./state.js"
import type { DcpConfig } from "./config.js"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Tools whose outputs are always protected from sweep regardless of config. */
const ALWAYS_PROTECTED_TOOLS = ["compress", "write", "edit"] as const

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function fmt(n: number): string {
  return n.toLocaleString()
}

// ---------------------------------------------------------------------------
// Help
// ---------------------------------------------------------------------------

const HELP_TEXT = `DCP — Dynamic Context Pruning

Commands:
  /dcp context      — Show context window usage breakdown
  /dcp stats        — Show pruning statistics for this session
  /dcp sweep [N]    — Prune last N tool outputs (default: all since last user msg)
  /dcp manual       — Show manual mode status
  /dcp manual on    — Enable manual mode (disable autonomous compression)
  /dcp manual off   — Disable manual mode (enable autonomous compression)
  /dcp decompress   — List active compression blocks
  /dcp decompress N — Restore compression block N
  /dcp compress     — Trigger compression (sends compress tool invocation to LLM)`

function handleHelp(ctx: ExtensionCommandContext): void {
  ctx.ui.notify(HELP_TEXT, "info")
}

// ---------------------------------------------------------------------------
// Context usage
// ---------------------------------------------------------------------------

function handleContext(ctx: ExtensionCommandContext, state: DcpState): void {
  const usage = ctx.getContextUsage()

  const lines: string[] = []

  if (usage) {
    if (usage.tokens !== null) {
      const pct = ((usage.tokens / usage.contextWindow) * 100).toFixed(1)
      lines.push(
        `Context Usage: ${pct}% (${fmt(usage.tokens)} / ${fmt(usage.contextWindow)} tokens)`,
      )
    } else {
      lines.push(`Context Usage: unknown / ${fmt(usage.contextWindow)} tokens`)
    }
  } else {
    lines.push("Context Usage: unavailable")
  }

  lines.push("")
  lines.push("Session Stats:")
  lines.push(`  Tool calls tracked: ${fmt(state.toolCalls.size)}`)
  lines.push(`  Pruned tools: ${fmt(state.prunedToolIds.size)}`)
  lines.push(`  Compression blocks: ${state.compressionBlocks.filter((b) => b.active).length}`)
  lines.push(`  Tokens saved (estimated): ${fmt(state.tokensSaved)}`)

  ctx.ui.notify(lines.join("\n"), "info")
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

function handleStats(ctx: ExtensionCommandContext, state: DcpState): void {
  const activeBlocks = state.compressionBlocks.filter((b) => b.active).length
  const totalBlocks = state.compressionBlocks.length

  const lines: string[] = []
  lines.push("DCP Session Statistics:")
  lines.push(`  Tokens saved (estimated): ${fmt(state.tokensSaved)}`)
  lines.push(`  Total pruning operations: ${fmt(state.totalPruneCount)}`)
  lines.push(`  Compression blocks active: ${activeBlocks} / ${totalBlocks} total`)
  lines.push(`  Manual mode: ${state.manualMode ? "on" : "off"}`)

  ctx.ui.notify(lines.join("\n"), "info")
}

// ---------------------------------------------------------------------------
// Sweep
// ---------------------------------------------------------------------------

async function handleSweep(
  ctx: ExtensionCommandContext,
  state: DcpState,
  config: DcpConfig,
  n: number,
): Promise<void> {
  await ctx.waitForIdle()

  const branch = ctx.sessionManager.getBranch()

  // Build the full set of protected tool names.
  const protectedTools = new Set<string>([
    ...ALWAYS_PROTECTED_TOOLS,
    ...config.strategies.deduplication.protectedTools,
  ])

  // Walk the branch (root → leaf) collecting toolCallIds in encounter order,
  // and tracking where the last real user message was.
  const allToolCallIds: string[] = []
  const toolCallIdsSinceLastUser: string[] = []
  let lastUserMsgBranchIndex = -1

  // First pass: find the last user message index.
  for (let i = 0; i < branch.length; i++) {
    const entry = branch[i]
    if (entry.type !== "message") continue
    const msg = (entry as any).message
    if (msg.role === "user") {
      lastUserMsgBranchIndex = i
    }
  }

  // Second pass: collect tool result IDs in encounter order.
  for (let i = 0; i < branch.length; i++) {
    const entry = branch[i]
    if (entry.type !== "message") continue
    const msg = (entry as any).message
    if (msg.role !== "toolResult") continue

    const toolCallId = msg.toolCallId as string
    allToolCallIds.push(toolCallId)

    if (lastUserMsgBranchIndex >= 0 && i > lastUserMsgBranchIndex) {
      toolCallIdsSinceLastUser.push(toolCallId)
    }
  }

  // Determine the candidate set based on the N argument.
  let candidates: string[]
  if (n > 0) {
    // Last N tool results from the full session branch.
    candidates = allToolCallIds.slice(-n)
  } else {
    // All tool results since the last user message (or everything if no user
    // message exists yet — e.g. in a purely agentic session).
    candidates =
      lastUserMsgBranchIndex >= 0 ? toolCallIdsSinceLastUser : allToolCallIds
  }

  // Filter: skip already-pruned IDs and protected tool names.
  const toAdd = candidates.filter((toolCallId) => {
    if (state.prunedToolIds.has(toolCallId)) return false

    // Tool name lookup: prefer the DCP tool-call record if tracked; fall back
    // to the AgentMessage itself (msg.toolName is present on ToolResultMessage).
    const record = state.toolCalls.get(toolCallId)
    const toolName = record?.toolName

    if (toolName !== undefined && protectedTools.has(toolName)) return false

    return true
  })

  for (const toolCallId of toAdd) {
    state.prunedToolIds.add(toolCallId)
  }

  const count = toAdd.length
  ctx.ui.notify(`Swept ${count} tool output${count === 1 ? "" : "s"}`, "info")
}

// ---------------------------------------------------------------------------
// Manual mode
// ---------------------------------------------------------------------------

function handleManual(
  ctx: ExtensionCommandContext,
  state: DcpState,
  subArg: string | undefined,
): void {
  if (subArg === "on") {
    state.manualMode = true
    ctx.ui.notify(
      "Manual mode: on\nAutonomous compression is disabled. Use /dcp compress to trigger manually.",
      "info",
    )
  } else if (subArg === "off") {
    state.manualMode = false
    ctx.ui.notify("Manual mode: off\nAutonomous compression is enabled.", "info")
  } else {
    // Status display (no argument).
    const status = state.manualMode ? "on" : "off"
    ctx.ui.notify(
      `Manual mode: ${status}\nWhen on: compress tool only fires when you explicitly request it.`,
      "info",
    )
  }
}

// ---------------------------------------------------------------------------
// Decompress
// ---------------------------------------------------------------------------

function handleDecompress(
  ctx: ExtensionCommandContext,
  state: DcpState,
  nArg: string | undefined,
): void {
  if (nArg === undefined) {
    // List all active compression blocks.
    const activeBlocks = state.compressionBlocks.filter((b) => b.active)

    if (activeBlocks.length === 0) {
      ctx.ui.notify("No active compression blocks.", "info")
      return
    }

    const lines: string[] = ["Active compression blocks:"]
    for (const block of activeBlocks) {
      lines.push(
        `  b${block.id} — "${block.topic}" (est. ${fmt(block.summaryTokenEstimate)} tokens)`,
      )
    }
    lines.push("")
    lines.push("Run /dcp decompress N to restore a block.")

    ctx.ui.notify(lines.join("\n"), "info")
  } else {
    // Restore block N.
    const id = parseInt(nArg, 10)

    if (isNaN(id)) {
      ctx.ui.notify(
        `Invalid block ID: "${nArg}". Usage: /dcp decompress N`,
        "error",
      )
      return
    }

    const block = state.compressionBlocks.find((b) => b.id === id)

    if (!block) {
      ctx.ui.notify(`No compression block found with id ${id}.`, "error")
      return
    }

    if (!block.active) {
      ctx.ui.notify(`Compression block b${id} is already decompressed.`, "info")
      return
    }

    block.active = false
    ctx.ui.notify(`Decompressed block b${id}: "${block.topic}"`, "info")
  }
}

// ---------------------------------------------------------------------------
// Compress (trigger)
// ---------------------------------------------------------------------------

async function handleCompress(pi: ExtensionAPI, ctx: ExtensionCommandContext): Promise<void> {
  await ctx.waitForIdle()

  pi.sendMessage(
    {
      customType: "dcp-compress-trigger",
      content:
        "Please compress stale conversation sections using the compress tool now.",
      display: false,
    },
    { triggerTurn: true, deliverAs: "followUp" },
  )

  ctx.ui.notify("Triggered compression", "info")
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function registerCommands(
  pi: ExtensionAPI,
  state: DcpState,
  config: DcpConfig,
): void {
  pi.registerCommand("dcp", {
    description: "Dynamic Context Pruning — manage context window usage",
    getArgumentCompletions(prefix: string): AutocompleteItem[] | null {
      const subcommands: AutocompleteItem[] = [
        { value: "context", label: "context", description: "Show context window usage breakdown" },
        { value: "stats", label: "stats", description: "Show pruning statistics" },
        { value: "sweep", label: "sweep", description: "Prune tool outputs" },
        { value: "manual", label: "manual", description: "Toggle manual mode" },
        { value: "decompress", label: "decompress", description: "List or restore compression blocks" },
        { value: "compress", label: "compress", description: "Trigger LLM compression" },
        { value: "help", label: "help", description: "Show help" },
      ]
      const matched = subcommands
        .filter((s) => typeof s.value === "string")
        .filter((s) => s.value.startsWith(prefix))
      return matched.length > 0 ? matched : null
    },

    async handler(args: string, ctx: ExtensionCommandContext): Promise<void> {
      const parts = args.trim().split(/\s+/).filter(Boolean)
      const sub = parts[0] ?? ""

      switch (sub) {
        case "":
        case "help":
          handleHelp(ctx)
          break

        case "context":
          handleContext(ctx, state)
          break

        case "stats":
          handleStats(ctx, state)
          break

        case "sweep": {
          const rawN = parts[1] !== undefined ? parseInt(parts[1], 10) : 0
          const n = isNaN(rawN) || rawN < 0 ? 0 : rawN
          await handleSweep(ctx, state, config, n)
          break
        }

        case "manual":
          handleManual(ctx, state, parts[1])
          break

        case "decompress":
          handleDecompress(ctx, state, parts[1])
          break

        case "compress":
          await handleCompress(pi, ctx)
          break

        default:
          ctx.ui.notify(
            `Unknown DCP command: "${sub}". Run /dcp help for available commands.`,
            "error",
          )
          break
      }
    },
  })
}
