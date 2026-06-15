import { describe, expect, mock, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createRenderScheduler } from "../render-scheduler.ts";
import { decorateEditorLine, type EditorDecoratorConfig } from "../editor-decorators.ts";
import { refreshInlineSlashAutocomplete } from "../inline-slash/editor.ts";
import { buildCommandCatalog } from "../inline-slash/command-catalog.ts";
import { InlineSlashProvider } from "../inline-slash/provider.ts";

mock.module("@earendil-works/pi-coding-agent", () => ({
  CustomEditor: class MockCustomEditor {},
}));
mock.module("@earendil-works/pi-ai", () => ({
  complete: async () => ({ content: [{ type: "text", text: "checking stream..." }], stopReason: "stop" }),
}));
mock.module("@earendil-works/pi-tui", () => ({
  visibleWidth: (value: string) => [...value].length,
  truncateToWidth: (value: string, width: number) => [...value].slice(0, width).join(""),
}));

function command(name: string, source: "skill" | "extension" = "extension") {
  return {
    name,
    description: `${name} description`,
    source,
    sourceInfo: { path: `/tmp/${name}`, source, scope: "user", origin: "top-level" },
  };
}

function makeCtx(previousFactory?: (...args: any[]) => any, cwd = process.cwd()) {
  const statuses = new Map<string, string>();
  const ui: any = {
    theme: { fg: (_color: string, text: string) => text },
    getEditorComponent: () => previousFactory,
    setEditorComponent(factory: any) { ui.editorFactory = factory; },
    setFooter(factory: any) { ui.footerFactory = factory; },
    setWidget() {},
    setHeader(factory: any) { ui.headerFactory = factory; },
    notify() {},
    setWorkingMessage() {},
  };
  return {
    cwd,
    hasUI: true,
    ui,
    model: { provider: "test", id: "model", name: "model" },
    getThinkingLevel: () => "off",
    sessionManager: { getBranch: () => [] },
    modelRegistry: {
      isUsingOAuth: () => false,
      find: () => ({ id: "model" }),
      getApiKeyAndHeaders: async () => ({ ok: true, apiKey: "test", headers: {} }),
    },
    settingsManager: { getCompactionSettings: () => ({ enabled: true }) },
    footerData: {
      getGitBranch: () => null,
      getExtensionStatuses: () => statuses,
      onBranchChange: () => () => {},
    },
  } as any;
}

describe("regressions", () => {
  test("Powerline wraps editor factory that existed before session_start", async () => {
    const sentinelEditor = {
      getText: () => "",
      getLines: () => [""],
      getCursor: () => ({ line: 0, col: 0 }),
      handleInput() {},
      setAutocompleteProvider() {},
      render: () => ["sentinel"],
    };
    const previousFactory = () => sentinelEditor;
    const handlers: Record<string, Function> = {};
    const pi = {
      on(event: string, handler: Function) { handlers[event] = handler; },
      registerCommand() {},
      getCommands: () => [command("powerline")],
      sendUserMessage() {},
    } as any;

    const { default: powerlineFooter } = await import("../index.ts");
    powerlineFooter(pi);
    const ctx = makeCtx(previousFactory);
    await handlers.session_start?.({ reason: "startup" }, ctx);

    expect(ctx.ui.editorFactory).toBeFunction();
    expect(ctx.ui.editorFactory({}, {}, {})).toBe(sentinelEditor);
  });

  test("Powerline footer renders last submitted prompt on the second line", async () => {
    const handlers: Record<string, Function> = {};
    const pi = {
      on(event: string, handler: Function) { handlers[event] = handler; },
      registerCommand() {},
      getCommands: () => [command("powerline")],
      sendUserMessage() {},
    } as any;

    const { default: powerlineFooter } = await import("../index.ts");
    powerlineFooter(pi);
    const ctx = makeCtx();
    await handlers.session_start?.({ reason: "startup" }, ctx);
    const footer = ctx.ui.footerFactory({ requestRender() {} }, ctx.ui.theme, ctx.footerData);

    const prompt = "explain statusline prompt display with enough detail that it exceeds old prompt segment truncation";
    await handlers.before_agent_start?.({ prompt }, { ...ctx, hasUI: false });

    const lines = footer.render(64);
    expect(lines.length).toBeGreaterThanOrEqual(2);
    expect(lines[0]).not.toContain("explain statusline prompt display");
    expect(lines[1]).toContain("explain statusline prompt display");
    expect(lines[1]).toContain("enough detail");
  });

  test("welcome header stays through input, submit, agent runs, and control keys", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "powerline-welcome-"));
    mkdirSync(join(tmp, ".pi"));
    writeFileSync(join(tmp, ".pi", "settings.json"), JSON.stringify({ quietStartup: true }));

    const editor = {
      getText: () => "",
      getLines: () => [""],
      getCursor: () => ({ line: 0, col: 0 }),
      handleInput() {},
      setAutocompleteProvider() {},
      render: () => ["editor"],
    };
    const handlers: Record<string, Function> = {};
    const pi = {
      on(event: string, handler: Function) { handlers[event] = handler; },
      registerCommand() {},
      getCommands: () => [command("powerline")],
      sendUserMessage() {},
    } as any;

    const { default: powerlineFooter } = await import("../index.ts");
    powerlineFooter(pi);
    const ctx = makeCtx(() => editor, tmp);
    await handlers.session_start?.({ reason: "startup" }, ctx);
    ctx.ui.editorFactory({}, {}, {});

    expect(ctx.ui.headerFactory).toBeFunction();
    editor.handleInput("a");
    expect(ctx.ui.headerFactory).toBeFunction();
    editor.handleInput("\r");
    expect(ctx.ui.headerFactory).toBeFunction();
    await handlers.agent_start?.({}, { ...ctx, hasUI: false });
    expect(ctx.ui.headerFactory).toBeFunction();
    await handlers.tool_call?.({ toolName: "bash", input: {} }, { ...ctx, hasUI: false });
    expect(ctx.ui.headerFactory).toBeFunction();
    editor.handleInput("\x1b");
    expect(ctx.ui.headerFactory).toBeFunction();
    editor.handleInput("\x03");
    expect(ctx.ui.headerFactory).toBeFunction();
    editor.handleInput("\x04");
    expect(ctx.ui.headerFactory).toBeFunction();
  });

  test("vibe token count starts nonzero before usage arrives", async () => {
    const messages: string[] = [];
    const handlers: Record<string, Function> = {};
    const pi = {
      on(event: string, handler: Function) { handlers[event] = handler; },
      registerCommand() {},
      getCommands: () => [command("powerline")],
      sendUserMessage() {},
    } as any;

    const { default: powerlineFooter } = await import("../index.ts");
    powerlineFooter(pi);
    const ctx = makeCtx();
    ctx.ui.setWorkingMessage = (message?: string) => {
      if (message) messages.push(message);
    };

    await handlers.session_start?.({ reason: "startup" }, ctx);
    await handlers.before_agent_start?.({ prompt: "count starting tokens" }, ctx);
    await handlers.agent_end?.({}, ctx);

    expect(messages.at(-1)).toBe("reading prompt... · 0s · ≈1 tok");
  });

  test("vibe token count falls back to streamed text estimate when usage is zero", async () => {
    const messages: string[] = [];
    const handlers: Record<string, Function> = {};
    const pi = {
      on(event: string, handler: Function) { handlers[event] = handler; },
      registerCommand() {},
      getCommands: () => [command("powerline")],
      sendUserMessage() {},
    } as any;

    const { default: powerlineFooter } = await import("../index.ts");
    powerlineFooter(pi);
    const ctx = makeCtx();
    ctx.ui.setWorkingMessage = (message?: string) => {
      if (message) messages.push(message);
    };

    await handlers.session_start?.({ reason: "startup" }, ctx);
    await handlers.before_agent_start?.({ prompt: "count streamed tokens" }, ctx);
    await handlers.message_update?.({
      assistantMessageEvent: { type: "text_delta", delta: "x".repeat(80) },
      message: {
        role: "assistant",
        content: [{ type: "text", text: "x".repeat(80) }],
        usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: { total: 0 } },
      },
    }, ctx);
    await handlers.agent_end?.({}, ctx);

    expect(messages.at(-1)).toContain("writing response...");
    expect(messages.at(-1)).toContain("≈20 tok");
    expect(messages.at(-1)).not.toContain("Pondering");
  });

  test("render scheduler immediate schedule preempts pending delayed render", async () => {
    const calls: number[] = [];
    const scheduler = createRenderScheduler(() => calls.push(Date.now()), 50);
    scheduler.schedule(50);
    scheduler.schedule(0);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(calls.length).toBe(1);
    scheduler.cancel();
  });

  test("render scheduler earlier nonzero schedule preempts later render", async () => {
    const calls: number[] = [];
    const scheduler = createRenderScheduler(() => calls.push(Date.now()), 100);
    scheduler.schedule(80);
    scheduler.schedule(10);
    await new Promise((resolve) => setTimeout(resolve, 35));
    expect(calls.length).toBe(1);
    scheduler.cancel();
  });

  test("inline slash refresh triggers autocomplete for async suggestions", async () => {
    const catalog = buildCommandCatalog([command("skill:review", "skill")]);
    const provider = new InlineSlashProvider({ catalog });
    const originalGetSuggestions = provider.getSuggestions.bind(provider);
    provider.getSuggestions = ((...args: Parameters<typeof provider.getSuggestions>) => Promise.resolve(originalGetSuggestions(...args))) as typeof provider.getSuggestions;

    let triggered = 0;
    const editor = {
      getText: () => "please /rev",
      getLines: () => ["please /rev"],
      getCursor: () => ({ line: 0, col: "please /rev".length }),
      handleInput() {},
      setAutocompleteProvider() {},
      isShowingAutocomplete: () => false,
      tryTriggerAutocomplete: () => { triggered += 1; },
      updateAutocomplete() {},
    };

    refreshInlineSlashAutocomplete(editor, provider);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(triggered).toBe(1);
  });

  test("inline slash async refresh ignores stale editor snapshot", async () => {
    const catalog = buildCommandCatalog([command("skill:review", "skill")]);
    const provider = new InlineSlashProvider({ catalog });
    const originalGetSuggestions = provider.getSuggestions.bind(provider);
    provider.getSuggestions = ((...args: Parameters<typeof provider.getSuggestions>) => Promise.resolve(originalGetSuggestions(...args))) as typeof provider.getSuggestions;

    let text = "please /rev";
    let triggered = 0;
    const editor = {
      getText: () => text,
      getLines: () => [text],
      getCursor: () => ({ line: 0, col: text.length }),
      handleInput() {},
      setAutocompleteProvider() {},
      isShowingAutocomplete: () => false,
      tryTriggerAutocomplete: () => { triggered += 1; },
      updateAutocomplete() {},
    };

    refreshInlineSlashAutocomplete(editor, provider);
    text = "changed";
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(triggered).toBe(0);
  });

  test("configured decorator regex skips long visible lines", () => {
    const config: EditorDecoratorConfig = {
      enabled: true,
      configPath: "/tmp/editor-decorators.jsonc",
      rules: [{ regex: /(.+)+$/g, style: "rainbow" }],
    };
    const theme = { fg: (_color: string, text: string) => text } as any;
    const longLine = "x".repeat(3000);
    expect(decorateEditorLine(longLine, config, theme)).toBe(longLine);
  });
});
