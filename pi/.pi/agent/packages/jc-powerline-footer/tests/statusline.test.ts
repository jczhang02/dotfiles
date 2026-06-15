import { describe, expect, test } from "bun:test";
import { readCoreContextUsage } from "../context-usage.ts";
import { renderSegment } from "../segments.ts";
import type { SegmentContext } from "../types.ts";

const theme = { fg: (_color: string, text: string) => text } as any;

function segmentContext(overrides: Partial<SegmentContext> = {}): SegmentContext {
  return {
    model: { id: "plain", reasoning: false, contextWindow: 1000 },
    thinkingLevel: "off",
    cwd: "/tmp",
    usageStats: { cacheRead: 0, cost: 0 },
    contextPercent: 50,
    contextWindow: 1000,
    autoCompactEnabled: true,
    customCompactionEnabled: false,
    usingSubscription: false,
    git: { branch: null, staged: 0, unstaged: 0, untracked: 0 },
    extensionStatuses: new Map(),
    options: {},
    theme,
    colors: {},
    ...overrides,
  };
}

describe("statusline core", () => {
  test("preserves core context unknown instead of inventing stale percent", () => {
    const usage = readCoreContextUsage({
      getContextUsage: () => ({ tokens: null, contextWindow: 200000, percent: null }),
    });
    expect(usage).toEqual({ contextTokens: null, contextWindow: 200000, contextPercent: null });

    const rendered = renderSegment("context_pct", segmentContext({ contextPercent: null, contextWindow: 200000 }));
    expect(rendered.visible).toBe(false);
  });

  test("hides thinking segment for non-reasoning models", () => {
    expect(renderSegment("thinking", segmentContext({ model: { id: "plain", reasoning: false } })).visible).toBe(false);
    expect(renderSegment("thinking", segmentContext({ model: { id: "reasoning", reasoning: true }, thinkingLevel: "high" })).visible).toBe(true);
  });


  test("renders selected extension statuses only", () => {
    const statuses = new Map([
      ["codex-goal", "Goal paused (/goal resume)"],
      ["mcp", "MCP: 0/3 servers"],
      ["loadout", "default* · 23/30 tools · 24/77 skills"],
      ["dcp", "DCP [manual]"],
      ["notice", "[busy] running"],
    ]);

    const rendered = renderSegment("extension_statuses", segmentContext({ extensionStatuses: statuses }));
    expect(rendered.visible).toBe(true);
    expect(rendered.content).toContain("Goal paused");
    expect(rendered.content).toContain("MCP: 0/3 servers");
    expect(rendered.content).toContain("default*");
    expect(rendered.content).not.toContain("DCP");
    expect(rendered.content).not.toContain("[busy]");
  });
});
