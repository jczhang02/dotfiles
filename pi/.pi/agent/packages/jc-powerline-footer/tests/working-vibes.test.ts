import { afterEach, describe, expect, mock, test } from "bun:test";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

mock.module("@earendil-works/pi-ai", () => ({
  complete: async () => ({ content: [{ type: "text", text: "checking config..." }], stopReason: "stop" }),
}));

let previousHome: string | undefined;
let tempHome: string | null = null;

function useTempHome(): string {
  previousHome = process.env.HOME;
  tempHome = join(tmpdir(), `powerline-vibes-${process.pid}-${Date.now()}-${Math.random()}`);
  mkdirSync(join(tempHome, ".pi", "agent"), { recursive: true });
  process.env.HOME = tempHome;
  return join(tempHome, ".pi", "agent", "settings.json");
}

afterEach(() => {
  if (tempHome) {
    if (previousHome === undefined) delete process.env.HOME;
    else process.env.HOME = previousHome;
    rmSync(tempHome, { recursive: true, force: true });
  }
  previousHome = undefined;
  tempHome = null;
});

async function loadVibes() {
  return import(`../working-vibes.ts?test=${Date.now()}-${Math.random()}`);
}

describe("action vibes", () => {
  test("builds safe current-action prompt", async () => {
    const { buildVibePromptForTest, getSafeVibeToolHint } = await loadVibes();
    const prompt = buildVibePromptForTest(getSafeVibeToolHint("bash"));
    expect(prompt).toContain("running command");
    expect(prompt).toContain("Safe action hint");

    const unsafe = buildVibePromptForTest("run SECRET_TOKEN from /private/client/file.ts using `cat ~/.ssh/id_rsa`");
    for (const secret of ["SECRET_TOKEN", "/private/client/file.ts", "~/.ssh/id_rsa"]) {
      expect(unsafe).not.toContain(secret);
    }
  });

  test("maps tool names to safe action hints", async () => {
    const { getSafeVibeToolHint } = await loadVibes();
    expect(getSafeVibeToolHint("subagent")).toBe("calling subagent");
    expect(getSafeVibeToolHint("workflow")).toBe("running workflow");
    expect(getSafeVibeToolHint("read")).toBe("reading file");
    expect(getSafeVibeToolHint("bash")).toBe("running command");
  });

  test("migrates legacy workingVibeEnabled when toggled", async () => {
    const settingsPath = useTempHome();
    writeFileSync(settingsPath, JSON.stringify({ workingVibe: "off", workingVibeEnabled: false, workingVibeMode: "file" }));

    const { setActionVibeEnabled } = await loadVibes();
    expect(setActionVibeEnabled(true)).toBe(true);

    const saved = JSON.parse(readFileSync(settingsPath, "utf8"));
    expect(saved.workingVibe).toBe("action");
    expect("workingVibeEnabled" in saved).toBe(false);
    expect("workingVibeMode" in saved).toBe(false);
  });

  test("formats working message with elapsed time and token count", async () => {
    const { formatWorkingMessageForTest } = await loadVibes();
    expect(formatWorkingMessageForTest("using experiment tool...", 12_300, 1532, "usage")).toBe("using experiment tool... · 12s · 1.5k tok");
    expect(formatWorkingMessageForTest("checking config...", 61_000, 105, "estimate")).toBe("checking config... · 1m01s · ≈105 tok");
    expect(formatWorkingMessageForTest("reading prompt...", 0, 0, "estimate")).toBe("reading prompt... · 0s");
  });

  test("normalizes action text and numeric settings", async () => {
    const settingsPath = useTempHome();
    writeFileSync(settingsPath, "{}\n");

    const {
      getVibeMaxLength,
      getVibeRefreshIntervalSeconds,
      normalizeVibeActionForTest,
      setVibeMaxLength,
      setVibeRefreshIntervalSeconds,
    } = await loadVibes();

    expect(normalizeVibeActionForTest("checking config")).toBe("checking config...");
    expect(normalizeVibeActionForTest("检查配置中", "checking config")).toBe("checking config...");
    expect(normalizeVibeActionForTest("reading files")).toBe("reading files...");

    expect(setVibeRefreshIntervalSeconds(-5)).toBe(true);
    expect(getVibeRefreshIntervalSeconds()).toBe(0);
    expect(setVibeMaxLength(1)).toBe(true);
    expect(getVibeMaxLength()).toBe(8);
  });

  test("combines abort signals without AbortSignal.any", async () => {
    const originalAny = AbortSignal.any;
    try {
      Object.defineProperty(AbortSignal, "any", { configurable: true, value: undefined });
      const { combineAbortSignals } = await loadVibes();
      const controller = new AbortController();
      const combined = combineAbortSignals([controller.signal]);
      expect(combined.aborted).toBe(false);
      controller.abort();
      expect(combined.aborted).toBe(true);
    } finally {
      Object.defineProperty(AbortSignal, "any", { configurable: true, value: originalAny });
    }
  });

  test("creates timeout signals without AbortSignal.timeout", async () => {
    const originalTimeout = AbortSignal.timeout;
    try {
      Object.defineProperty(AbortSignal, "timeout", { configurable: true, value: undefined });
      const { createTimeoutSignal } = await loadVibes();
      const handle = createTimeoutSignal(5);
      await new Promise((resolve) => setTimeout(resolve, 15));
      expect(handle.signal.aborted).toBe(true);
      handle.dispose();
    } finally {
      Object.defineProperty(AbortSignal, "timeout", { configurable: true, value: originalTimeout });
    }
  });
});
