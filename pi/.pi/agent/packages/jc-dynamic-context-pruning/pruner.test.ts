/**
 * Minimal self-contained tests for the applyCompressionBlocks logic inside
 * applyPruning.  No test framework — just assert + console.log.
 *
 * Run with:  bun run pruner.test.ts
 */

import assert from "assert";
import { applyPruning } from "./pruner.js";
import type { DcpState } from "./state.js";
import type { DcpConfig } from "./config.js";

// ---------------------------------------------------------------------------
// Minimal factories
// ---------------------------------------------------------------------------

function makeConfig(): DcpConfig {
  return {
    enabled: true,
    debug: false,
    manualMode: { enabled: false, automaticStrategies: false },
    compress: {
      maxContextPercent: 0.8,
      minContextPercent: 0.4,
      nudgeFrequency: 5,
      iterationNudgeThreshold: 15,
      nudgeForce: "soft",
      protectedTools: [],
      protectUserMessages: false,
    },
    strategies: {
      deduplication: { enabled: false, protectedTools: [] },
      purgeErrors: { enabled: false, turns: 4, protectedTools: [] },
    },
    protectedFilePatterns: [],
    pruneNotification: "off",
  };
}

function makeState(compressionBlocks: DcpState["compressionBlocks"] = []): DcpState {
  return {
    toolCalls: new Map(),
    prunedToolIds: new Set(),
    compressionBlocks,
    nextBlockId: 1,
    messageIdSnapshot: new Map(),
    currentTurn: 0,
    tokensSaved: 0,
    totalPruneCount: 0,
    manualMode: false,
    nudgeCounter: 0,
    lastNudgeTurn: -1,
  };
}

// Four-message sequence that exercises the bug:
//   user(1000) → assistant+toolCall(2000) → toolResult(3000) → user(4000)
function makeMessages(): any[] {
  return [
    {
      role: "user",
      content: [{ type: "text", text: "please read the file" }],
      timestamp: 1000,
    },
    {
      role: "assistant",
      content: [{ type: "toolCall", id: "toolu_abc", name: "read", arguments: {} }],
      timestamp: 2000,
    },
    {
      role: "toolResult",
      toolCallId: "toolu_abc",
      toolName: "read",
      content: [{ type: "text", text: "file content" }],
      isError: false,
      timestamp: 3000,
    },
    {
      role: "user",
      content: [{ type: "text", text: "thanks" }],
      timestamp: 4000,
    },
  ];
}

// ---------------------------------------------------------------------------
// Helper: find the first orphaned tool_use in a result array
//
// An assistant message is "orphaned" if it contains a toolCall block whose
// id does NOT have a matching toolResult as the very next message.
// ---------------------------------------------------------------------------
function findOrphanedToolUse(result: any[]): string | null {
  for (let i = 0; i < result.length; i++) {
    const msg = result[i];
    if (msg.role !== "assistant") continue;

    const content: any[] = Array.isArray(msg.content) ? msg.content : [];
    const toolCallBlocks = content.filter((b: any) => b.type === "toolCall");
    if (toolCallBlocks.length === 0) continue;

    for (const tc of toolCallBlocks) {
      const next = result[i + 1];
      const nextIsMatchingResult =
        next &&
        next.role === "toolResult" &&
        next.toolCallId === tc.id;

      if (!nextIsMatchingResult) {
        return (
          `assistant at index ${i} (ts=${msg.timestamp}) has toolCall id="${tc.id}" ` +
          `but next message is: ${next ? `role="${next.role}" toolCallId="${next.toolCallId}"` : "<nothing>"}`
        );
      }
    }
  }
  return null; // no orphan found
}

// ---------------------------------------------------------------------------
// Test 1 — BUG SCENARIO
//
// Compression block covers ONLY the toolResult (startTimestamp=3000,
// endTimestamp=3000).  Without the backward-expansion fix, the assistant
// message with the toolCall block survives but its toolResult is gone →
// orphaned tool_use.  With the fix the assistant is pulled into the range
// and both messages are removed together.
// ---------------------------------------------------------------------------
{
  console.log("TEST 1: compression block covers only the toolResult (bug scenario)");

  const messages = makeMessages();
  const state = makeState([
    {
      id: 1,
      topic: "file read",
      summary: "The file was read and contained some data.",
      startTimestamp: 3000,
      endTimestamp: 3000,
      anchorTimestamp: 4000,
      active: true,
      summaryTokenEstimate: 15,
      createdAt: Date.now(),
    },
  ]);
  const config = makeConfig();

  const result = applyPruning(messages, state, config);

  console.log("  Result messages (role, timestamp):");
  for (const m of result) {
    const ts = m.timestamp;
    const preview =
      typeof m.content === "string"
        ? m.content.slice(0, 60)
        : Array.isArray(m.content)
        ? m.content.map((b: any) => b.text ?? b.type ?? "?").join(" | ").slice(0, 60)
        : "?";
    console.log(`    role="${m.role}"  ts=${ts}  content="${preview}"`);
  }

  // 1a. No orphaned tool_use
  const orphan = findOrphanedToolUse(result);
  assert.strictEqual(
    orphan,
    null,
    `FAIL — orphaned tool_use detected: ${orphan}`
  );
  console.log("  PASS: no orphaned tool_use in result");

  // 1b. The assistant message at ts=2000 must NOT survive without its partner
  const assistantInResult = result.find(
    (m) => m.role === "assistant" && m.timestamp === 2000
  );
  if (assistantInResult) {
    // If it survived, its immediate successor must be the matching toolResult
    const idx = result.indexOf(assistantInResult);
    const successor = result[idx + 1];
    assert.ok(
      successor && successor.role === "toolResult" && successor.toolCallId === "toolu_abc",
      `FAIL — assistant(ts=2000) survived but successor is not the matching toolResult ` +
        `(got role="${successor?.role}" toolCallId="${successor?.toolCallId}")`
    );
    console.log("  PASS: assistant survived with its toolResult partner intact");
  } else {
    // The preferred outcome: both removed together
    const toolResultInResult = result.find(
      (m) => m.role === "toolResult" && m.toolCallId === "toolu_abc"
    );
    assert.strictEqual(
      toolResultInResult,
      undefined,
      "FAIL — assistant removed but orphaned toolResult still present"
    );
    console.log("  PASS: both assistant and toolResult removed together");
  }

  console.log("TEST 1 PASSED\n");
}

// ---------------------------------------------------------------------------
// Test 2 — PASSING SCENARIO
//
// Compression block covers BOTH the assistant and the toolResult
// (startTimestamp=2000, endTimestamp=3000).  Both messages must be removed
// and no orphaned tool_use must remain.
// ---------------------------------------------------------------------------
{
  console.log("TEST 2: compression block covers both assistant and toolResult (passing scenario)");

  const messages = makeMessages();
  const state = makeState([
    {
      id: 1,
      topic: "file read",
      summary: "The file was read and contained some data.",
      startTimestamp: 2000,
      endTimestamp: 3000,
      anchorTimestamp: 4000,
      active: true,
      summaryTokenEstimate: 15,
      createdAt: Date.now(),
    },
  ]);
  const config = makeConfig();

  const result = applyPruning(messages, state, config);

  console.log("  Result messages (role, timestamp):");
  for (const m of result) {
    const ts = m.timestamp;
    const preview =
      typeof m.content === "string"
        ? m.content.slice(0, 60)
        : Array.isArray(m.content)
        ? m.content.map((b: any) => b.text ?? b.type ?? "?").join(" | ").slice(0, 60)
        : "?";
    console.log(`    role="${m.role}"  ts=${ts}  content="${preview}"`);
  }

  // 2a. No orphaned tool_use
  const orphan = findOrphanedToolUse(result);
  assert.strictEqual(
    orphan,
    null,
    `FAIL — orphaned tool_use detected: ${orphan}`
  );
  console.log("  PASS: no orphaned tool_use in result");

  // 2b. The assistant at ts=2000 must be absent from the result
  const assistantInResult = result.find(
    (m) => m.role === "assistant" && m.timestamp === 2000
  );
  assert.strictEqual(
    assistantInResult,
    undefined,
    `FAIL — assistant(ts=2000) should have been removed but is still present`
  );
  console.log("  PASS: assistant(ts=2000) removed");

  // 2c. The toolResult must also be absent
  const toolResultInResult = result.find(
    (m) => m.role === "toolResult" && m.toolCallId === "toolu_abc"
  );
  assert.strictEqual(
    toolResultInResult,
    undefined,
    `FAIL — toolResult(toolCallId="toolu_abc") should have been removed but is still present`
  );
  console.log("  PASS: toolResult(toolu_abc) removed");

  // 2d. A synthetic summary message should be present
  const synthetic = result.find(
    (m) => m.role === "user" && typeof m.content?.[0]?.text === "string" && m.content[0].text.includes("Compressed section")
  );
  assert.ok(
    synthetic,
    "FAIL — expected a synthetic [Compressed section] user message in result"
  );
  console.log("  PASS: synthetic summary message present");

  console.log("TEST 2 PASSED\n");
}

// ---------------------------------------------------------------------------
// Test 3 — MULTI-TOOLRESULT BACKWARD GAP
//
// assistant has TWO tool_calls (A + B) producing two consecutive toolResult
// messages.  The compression range starts at toolResult_B — meaning there is
// a toolResult message (A) sitting between lo and the assistant.
//
// Bug: backward expansion stopped at toolResult_A (not an assistant) and
// never found the assistant → assistant was kept without its toolResult_B.
// Fix: backward scan skips past toolResult messages to reach the assistant.
//
// Sequence:
//   user(1000) → assistant(2000, toolCall_A + toolCall_B)
//              → toolResult_A(3000) → toolResult_B(4000) → user(5000)
// Compression block: [4000..4000] (only toolResult_B)
// Expected: assistant + toolResult_A + toolResult_B all removed together
// ---------------------------------------------------------------------------
{
  console.log("TEST 3: multi-toolResult backward gap (assistant has 2 tool_calls)");

  const messages: any[] = [
    { role: "user",        content: [{ type: "text", text: "do two things" }], timestamp: 1000 },
    { role: "assistant",   content: [
        { type: "toolCall", id: "toolu_A", name: "read",  arguments: {} },
        { type: "toolCall", id: "toolu_B", name: "write", arguments: {} },
      ], timestamp: 2000 },
    { role: "toolResult",  toolCallId: "toolu_A", toolName: "read",  isError: false, content: [{ type: "text", text: "A result" }], timestamp: 3000 },
    { role: "toolResult",  toolCallId: "toolu_B", toolName: "write", isError: false, content: [{ type: "text", text: "B result" }], timestamp: 4000 },
    { role: "user",        content: [{ type: "text", text: "thanks" }], timestamp: 5000 },
  ];

  const state = makeState([
    {
      id: 1,
      topic: "two-tool work",
      summary: "Both tools were called successfully.",
      startTimestamp: 4000,  // only toolResult_B
      endTimestamp:   4000,
      anchorTimestamp: 5000,
      active: true,
      summaryTokenEstimate: 10,
      createdAt: Date.now(),
    },
  ]);

  const result = applyPruning(messages, state, makeConfig());

  console.log("  Result messages:");
  for (const m of result) {
    const preview = Array.isArray(m.content)
      ? m.content.map((b: any) => b.text ?? b.type ?? "?").join(" | ").slice(0, 60)
      : String(m.content).slice(0, 60);
    console.log(`    role="${m.role}"  ts=${m.timestamp}  content="${preview}"`);
  }

  // Neither the orphaned assistant nor its toolResults should survive unpaired
  const assistantPresent = result.some((m: any) => m.role === "assistant" && m.timestamp === 2000);
  const toolResultAPresent = result.some((m: any) => m.role === "toolResult" && m.toolCallId === "toolu_A");
  const toolResultBPresent = result.some((m: any) => m.role === "toolResult" && m.toolCallId === "toolu_B");

  // All three must be absent (removed atomically) or all three present as a valid group
  if (assistantPresent) {
    assert.ok(toolResultAPresent, "FAIL — assistant present but toolResult_A missing");
    assert.ok(toolResultBPresent, "FAIL — assistant present but toolResult_B missing");
    // Verify ordering: assistant → toolResult_A → toolResult_B
    const aIdx = result.findIndex((m: any) => m.role === "assistant" && m.timestamp === 2000);
    const rAIdx = result.findIndex((m: any) => m.role === "toolResult" && m.toolCallId === "toolu_A");
    const rBIdx = result.findIndex((m: any) => m.role === "toolResult" && m.toolCallId === "toolu_B");
    assert.ok(aIdx < rAIdx && rAIdx < rBIdx, "FAIL — assistant + toolResult ordering wrong");
    console.log("  PASS: assistant + both toolResults kept as a coherent group");
  } else {
    assert.ok(!toolResultAPresent, "FAIL — assistant removed but orphaned toolResult_A still present");
    assert.ok(!toolResultBPresent, "FAIL — assistant removed but orphaned toolResult_B still present");
    console.log("  PASS: assistant + both toolResults removed atomically");
  }

  console.log("TEST 3 PASSED\n");
}

// ---------------------------------------------------------------------------
// Test 4 — BASHEXECUTION FORWARD GAP
//
// An assistant calls a tool whose result is stored as role="bashExecution".
// The compression range covers the assistant but NOT the bashExecution result.
//
// Bug (before fix): forward expansion only checked role==="toolResult", so
// bashExecution was left behind as an orphan.
// Fix: forward expansion now also advances hi over bashExecution messages.
//
// Sequence:
//   user(1000) → assistant(2000, toolCall_bash) → bashExecution(3000) → user(4000)
// Compression block: [2000..2000] (only the assistant)
// Expected: assistant + bashExecution removed together
// ---------------------------------------------------------------------------
{
  console.log("TEST 4: bashExecution forward gap");

  const messages: any[] = [
    { role: "user",          content: [{ type: "text", text: "run bash" }], timestamp: 1000 },
    { role: "assistant",     content: [{ type: "toolCall", id: "toolu_bash1", name: "bash", arguments: {} }], timestamp: 2000 },
    { role: "bashExecution", toolCallId: "toolu_bash1", toolName: "bash", isError: false, content: [{ type: "text", text: "exit 0" }], timestamp: 3000 },
    { role: "user",          content: [{ type: "text", text: "done" }], timestamp: 4000 },
  ];

  const state = makeState([
    {
      id: 1,
      topic: "bash run",
      summary: "Ran bash command successfully.",
      startTimestamp: 2000,
      endTimestamp:   2000,
      anchorTimestamp: 4000,
      active: true,
      summaryTokenEstimate: 8,
      createdAt: Date.now(),
    },
  ]);

  const result = applyPruning(messages, state, makeConfig());

  console.log("  Result messages:");
  for (const m of result) {
    const preview = Array.isArray(m.content)
      ? m.content.map((b: any) => b.text ?? b.type ?? "?").join(" | ").slice(0, 60)
      : String(m.content).slice(0, 60);
    console.log(`    role="${m.role}"  ts=${m.timestamp}  content="${preview}"`);
  }

  const assistantPresent   = result.some((m: any) => m.role === "assistant"     && m.timestamp === 2000);
  const bashPresent        = result.some((m: any) => m.role === "bashExecution" && m.toolCallId === "toolu_bash1");

  if (assistantPresent) {
    assert.ok(bashPresent, "FAIL — assistant present but bashExecution result missing");
    console.log("  PASS: assistant + bashExecution kept as a coherent group");
  } else {
    assert.ok(!bashPresent, "FAIL — assistant removed but orphaned bashExecution still present");
    console.log("  PASS: assistant + bashExecution removed atomically");
  }

  console.log("TEST 4 PASSED\n");
}

// ---------------------------------------------------------------------------
// Test 5 — PASSTHROUGH ROLE BETWEEN ASSISTANT AND TOOLRESULT (BACKWARD)
//
// A `compaction` message sits between the assistant and the toolResult.
// The compression range covers only the toolResult.  Backward expansion
// must skip the compaction to find the assistant and include it atomically.
//
// Sequence:
//   user(1000) → assistant(2000, toolCall_X) → compaction(2500)
//              → toolResult_X(3000) → user(4000)
// Compression block: [3000..3000]
// Expected: assistant + toolResult removed together (no orphans)
// ---------------------------------------------------------------------------
{
  console.log("TEST 5: passthrough role between assistant and toolResult (backward expansion)");

  const messages: any[] = [
    { role: "user",        content: [{ type: "text", text: "read file" }], timestamp: 1000 },
    { role: "assistant",   content: [{ type: "toolCall", id: "toolu_X", name: "read", arguments: {} }], timestamp: 2000 },
    { role: "compaction",  content: [{ type: "text", text: "compaction summary" }], timestamp: 2500 },
    { role: "toolResult",  toolCallId: "toolu_X", toolName: "read", isError: false, content: [{ type: "text", text: "file data" }], timestamp: 3000 },
    { role: "user",        content: [{ type: "text", text: "thanks" }], timestamp: 4000 },
  ];

  const state = makeState([
    {
      id: 1,
      topic: "file read",
      summary: "File was read successfully.",
      startTimestamp: 3000,
      endTimestamp:   3000,
      anchorTimestamp: 4000,
      active: true,
      summaryTokenEstimate: 10,
      createdAt: Date.now(),
    },
  ]);

  const result = applyPruning(messages, state, makeConfig());

  console.log("  Result messages:");
  for (const m of result) {
    const preview = Array.isArray(m.content)
      ? m.content.map((b: any) => b.text ?? b.type ?? "?").join(" | ").slice(0, 60)
      : String(m.content).slice(0, 60);
    console.log(`    role="${m.role}"  ts=${m.timestamp}  content="${preview}"`);
  }

  const orphan = findOrphanedToolUse(result);
  assert.strictEqual(orphan, null, `FAIL — orphaned tool_use detected: ${orphan}`);
  console.log("  PASS: no orphaned tool_use in result");

  const assistantPresent = result.some((m: any) => m.role === "assistant" && m.timestamp === 2000);
  const toolResultPresent = result.some((m: any) => m.role === "toolResult" && m.toolCallId === "toolu_X");
  assert.ok(!assistantPresent, "FAIL — assistant should have been removed");
  assert.ok(!toolResultPresent, "FAIL — toolResult should have been removed");
  console.log("  PASS: assistant + toolResult removed atomically despite compaction in between");

  console.log("TEST 5 PASSED\n");
}

// ---------------------------------------------------------------------------
// Test 6 — PASSTHROUGH ROLE BETWEEN TOOLRESULTS (FORWARD EXPANSION)
//
// An assistant has two tool calls.  A `branch_summary` message sits between
// the two toolResults.  The compression range covers the assistant.
// Forward expansion must skip the branch_summary to find both toolResults.
//
// Sequence:
//   user(1000) → assistant(2000, toolCall_A + toolCall_B)
//              → toolResult_A(3000) → branch_summary(3500)
//              → toolResult_B(4000) → user(5000)
// Compression block: [2000..2000]
// Expected: assistant + both toolResults removed together (no orphans)
// ---------------------------------------------------------------------------
{
  console.log("TEST 6: passthrough role between toolResults (forward expansion)");

  const messages: any[] = [
    { role: "user",           content: [{ type: "text", text: "do things" }], timestamp: 1000 },
    { role: "assistant",      content: [
        { type: "toolCall", id: "toolu_A", name: "read",  arguments: {} },
        { type: "toolCall", id: "toolu_B", name: "write", arguments: {} },
      ], timestamp: 2000 },
    { role: "toolResult",     toolCallId: "toolu_A", toolName: "read",  isError: false, content: [{ type: "text", text: "A result" }], timestamp: 3000 },
    { role: "branch_summary", content: [{ type: "text", text: "branch summary" }], timestamp: 3500 },
    { role: "toolResult",     toolCallId: "toolu_B", toolName: "write", isError: false, content: [{ type: "text", text: "B result" }], timestamp: 4000 },
    { role: "user",           content: [{ type: "text", text: "thanks" }], timestamp: 5000 },
  ];

  const state = makeState([
    {
      id: 1,
      topic: "two tools",
      summary: "Both tools were called.",
      startTimestamp: 2000,
      endTimestamp:   2000,
      anchorTimestamp: 5000,
      active: true,
      summaryTokenEstimate: 10,
      createdAt: Date.now(),
    },
  ]);

  const result = applyPruning(messages, state, makeConfig());

  console.log("  Result messages:");
  for (const m of result) {
    const preview = Array.isArray(m.content)
      ? m.content.map((b: any) => b.text ?? b.type ?? "?").join(" | ").slice(0, 60)
      : String(m.content).slice(0, 60);
    console.log(`    role="${m.role}"  ts=${m.timestamp}  content="${preview}"`);
  }

  const orphan = findOrphanedToolUse(result);
  assert.strictEqual(orphan, null, `FAIL — orphaned tool_use detected: ${orphan}`);
  console.log("  PASS: no orphaned tool_use in result");

  const assistantPresent = result.some((m: any) => m.role === "assistant" && m.timestamp === 2000);
  const toolResultAPresent = result.some((m: any) => m.role === "toolResult" && m.toolCallId === "toolu_A");
  const toolResultBPresent = result.some((m: any) => m.role === "toolResult" && m.toolCallId === "toolu_B");
  assert.ok(!assistantPresent, "FAIL — assistant should have been removed");
  assert.ok(!toolResultAPresent, "FAIL — toolResult_A should have been removed");
  assert.ok(!toolResultBPresent, "FAIL — toolResult_B should have been removed");
  console.log("  PASS: assistant + both toolResults removed despite branch_summary in between");

  console.log("TEST 6 PASSED\n");
}

// ---------------------------------------------------------------------------
// Test 7 — CONTENT MUTATION ISOLATION
//
// Verifies that applyPruning does not mutate the original message objects.
// After calling applyPruning, the original messages' content arrays should
// remain unchanged (no injected dcp-id blocks).
// ---------------------------------------------------------------------------
{
  console.log("TEST 7: content mutation isolation");

  const messages = makeMessages();
  // Deep-snapshot the original content for comparison
  const originalContents = messages.map((m: any) =>
    JSON.stringify(m.content)
  );

  const state = makeState(); // no compression blocks
  const config = makeConfig();

  // Run applyPruning — this should NOT mutate the originals
  applyPruning(messages, state, config);

  let mutated = false;
  for (let i = 0; i < messages.length; i++) {
    const current = JSON.stringify(messages[i].content);
    if (current !== originalContents[i]) {
      console.log(`  FAIL — message[${i}] content was mutated`);
      console.log(`    before: ${originalContents[i]}`);
      console.log(`    after:  ${current}`);
      mutated = true;
    }
  }

  assert.ok(!mutated, "FAIL — original message content was mutated by applyPruning");
  console.log("  PASS: original message content unchanged after applyPruning");

  console.log("TEST 7 PASSED\n");
}

// ---------------------------------------------------------------------------
// Test 8 — ORPHANED TOOLRESULT REPAIR
//
// Two compression blocks where the second removes an assistant but forward
// expansion cannot reach its toolResult due to processing order.  The repair
// function should clean up the orphan.
//
// Sequence:
//   user(1000) → assistant_1(2000, toolCall_X) → toolResult_X(3000) →
//   user(4000) → assistant_2(5000, toolCall_Y) → toolResult_Y(6000) → user(7000)
//
// Block 1: [1000..3000] — removes user, assistant_1, toolResult_X
// Block 2: [4000..5000] — removes user, assistant_2 (toolResult_Y is outside)
//   Forward expansion from assistant_2 should catch toolResult_Y, but if it
//   doesn't (edge case), repair must clean it up.
// ---------------------------------------------------------------------------
{
  console.log("TEST 8: orphaned toolResult repair (post-compression safety net)");

  const messages: any[] = [
    { role: "user",       content: [{ type: "text", text: "first" }], timestamp: 1000 },
    { role: "assistant",  content: [{ type: "toolCall", id: "toolu_X", name: "read", arguments: {} }], timestamp: 2000 },
    { role: "toolResult", toolCallId: "toolu_X", toolName: "read", isError: false, content: [{ type: "text", text: "X data" }], timestamp: 3000 },
    { role: "user",       content: [{ type: "text", text: "second" }], timestamp: 4000 },
    { role: "assistant",  content: [{ type: "toolCall", id: "toolu_Y", name: "write", arguments: {} }], timestamp: 5000 },
    { role: "toolResult", toolCallId: "toolu_Y", toolName: "write", isError: false, content: [{ type: "text", text: "Y data" }], timestamp: 6000 },
    { role: "user",       content: [{ type: "text", text: "done" }], timestamp: 7000 },
  ];

  const state = makeState([
    {
      id: 1,
      topic: "block one",
      summary: "First block compressed.",
      startTimestamp: 1000,
      endTimestamp:   3000,
      anchorTimestamp: 4000,
      active: true,
      summaryTokenEstimate: 10,
      createdAt: Date.now(),
    },
    {
      id: 2,
      topic: "block two",
      summary: "Second block compressed.",
      startTimestamp: 4000,
      endTimestamp:   5000,
      anchorTimestamp: 7000,
      active: true,
      summaryTokenEstimate: 10,
      createdAt: Date.now(),
    },
  ]);

  const result = applyPruning(messages, state, makeConfig());

  console.log("  Result messages:");
  for (const m of result) {
    const preview = Array.isArray(m.content)
      ? m.content.map((b: any) => b.text ?? b.type ?? "?").join(" | ").slice(0, 60)
      : String(m.content).slice(0, 60);
    console.log(`    role="${m.role}"  ts=${m.timestamp}  content="${preview}"`);
  }

  // No orphaned tool_use or tool_result should remain
  const orphan = findOrphanedToolUse(result);
  assert.strictEqual(orphan, null, `FAIL — orphaned tool_use detected: ${orphan}`);

  const orphanedResults = result.filter(
    (m: any) => (m.role === "toolResult" || m.role === "bashExecution") &&
    !result.some((a: any) =>
      a.role === "assistant" &&
      Array.isArray(a.content) &&
      a.content.some((b: any) => b.type === "toolCall" && b.id === m.toolCallId)
    )
  );
  assert.strictEqual(orphanedResults.length, 0, `FAIL — ${orphanedResults.length} orphaned toolResult(s) found`);
  console.log("  PASS: no orphaned tool_use or toolResult in result");

  console.log("TEST 8 PASSED\n");
}

// ---------------------------------------------------------------------------
// Test 9 — DIRECT ORPHAN REPAIR (pre-broken state)
//
// Directly construct a message array with an orphaned toolResult (no matching
// assistant toolCall exists).  The repair function should remove it.
// ---------------------------------------------------------------------------
{
  console.log("TEST 9: direct orphan repair (pre-broken toolResult)");

  const messages: any[] = [
    { role: "user",       content: [{ type: "text", text: "hello" }], timestamp: 1000 },
    { role: "toolResult", toolCallId: "orphan_id", toolName: "read", isError: false, content: [{ type: "text", text: "orphan data" }], timestamp: 2000 },
    { role: "user",       content: [{ type: "text", text: "bye" }], timestamp: 3000 },
  ];

  const state = makeState(); // no compression blocks — repair runs as safety net
  const config = makeConfig();

  const result = applyPruning(messages, state, config);

  console.log("  Result messages:");
  for (const m of result) {
    const preview = Array.isArray(m.content)
      ? m.content.map((b: any) => b.text ?? b.type ?? "?").join(" | ").slice(0, 60)
      : String(m.content).slice(0, 60);
    console.log(`    role="${m.role}"  ts=${m.timestamp}  content="${preview}"`);
  }

  const orphanPresent = result.some((m: any) => m.role === "toolResult" && m.toolCallId === "orphan_id");
  assert.ok(!orphanPresent, "FAIL — orphaned toolResult should have been removed by repair");
  console.log("  PASS: orphaned toolResult removed by repair function");

  console.log("TEST 9 PASSED\n");
}

// ---------------------------------------------------------------------------
// Test 10 — CORRUPTED BLOCK WITH NULL/INFINITY TIMESTAMPS (resilience)
//
// Blocks from older sessions may have null/Infinity timestamps due to JSON
// round-trip corruption. These blocks should be skipped during compression
// application and should not block new compress operations.
// ---------------------------------------------------------------------------
{
  console.log("TEST 10: corrupted block with null/Infinity timestamps is skipped");

  const messages: any[] = [
    { role: "user",       content: [{ type: "text", text: "hello" }], timestamp: 1000 },
    { role: "assistant",  content: [{ type: "text", text: "hi" }], timestamp: 2000 },
    { role: "user",       content: [{ type: "text", text: "bye" }], timestamp: 3000 },
  ];

  // Block with corrupted timestamps (null from JSON round-trip)
  const state = makeState([
    {
      id: 1,
      topic: "ghost block",
      summary: "This block has corrupted timestamps.",
      startTimestamp: null as any,  // null from JSON deserialization of Infinity
      endTimestamp: null as any,
      anchorTimestamp: null as any,
      active: true,
      summaryTokenEstimate: 5,
      createdAt: Date.now(),
    },
  ]);

  const result = applyPruning(messages, state, makeConfig());

  console.log("  Result messages:");
  for (const m of result) {
    const preview = Array.isArray(m.content)
      ? m.content.map((b: any) => b.text ?? b.type ?? "?").join(" | ").slice(0, 60)
      : String(m.content).slice(0, 60);
    console.log(`    role="${m.role}"  ts=${m.timestamp}  content="${preview}"`);
  }

  // All 3 original messages should survive (ghost block was skipped)
  assert.strictEqual(result.length, 3, `FAIL — expected 3 messages, got ${result.length}`);
  console.log("  PASS: corrupted block skipped, all original messages preserved");

  console.log("TEST 10 PASSED\n");
}

console.log("All tests passed.");
