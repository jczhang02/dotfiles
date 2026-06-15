import {
  CustomEditor,
  type ExtensionAPI,
  type ReadonlyFooterDataProvider,
  type Theme,
} from "@earendil-works/pi-coding-agent";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

import type {
  ColorScheme,
  SegmentContext,
  StatusLineSegmentId,
  StatusLineSegmentOptions,
} from "./types.ts";
import { getNotificationExtensionStatuses } from "./powerline-config.ts";
import { renderSegment } from "./segments.ts";
import {
  getGitStatus,
  invalidateGitStatus,
  invalidateGitBranch,
} from "./git-status.ts";
import { ansi, getFgAnsiCode } from "./colors.ts";
import { getIcons } from "./icons.ts";
import { WelcomeComponent, WelcomeHeader, discoverLoadedCounts, getRecentSessions } from "./welcome.ts";
import { createRenderScheduler } from "./render-scheduler.ts";
import { readCoreContextUsage } from "./context-usage.ts";
import { getDefaultColors } from "./theme.ts";
import { sanitizeErrorForLog, sanitizePathForLog } from "./log-sanitizer.ts";
import {
  decorateEditorRender,
  loadEditorDecoratorConfig,
  type EditorDecoratorConfig,
} from "./editor-decorators.ts";
import {
  EditorFactoryOwnerState,
  isPowerlineEditorFactory,
  markPowerlineEditorFactory,
} from "./editor-factory-state.ts";
import {
  buildCommandCatalog,
  PUBLIC_COMMAND_CATALOG_NOTE,
} from "./inline-slash/command-catalog.ts";
import type { InlineSlashCatalog } from "./inline-slash/types.ts";
import {
  createInlineSlashSubmitStrategy,
  installInlineSlash,
} from "./inline-slash/editor.ts";
import {
  initVibeManager,
  onVibeBeforeAgentStart,
  onVibeAgentStart,
  onVibeAgentEnd,
  onVibeToolCall,
  onVibeUsageUpdate,
  onVibeTextDelta,
  shutdownVibeManager,
  getActionVibeEnabled,
  setActionVibeEnabled,
  getVibeModel,
  setVibeModel,
  getVibeRefreshIntervalSeconds,
  setVibeRefreshIntervalSeconds,
  getVibeMaxLength,
  setVibeMaxLength,
} from "./working-vibes.ts";

const JC_STATUSLINE_SEGMENTS: StatusLineSegmentId[] = [
  "model",
  "thinking",
  "path",
  "git",
  "context_pct",
  "cache_read",
  "cost",
  "extension_statuses",
];
const JC_SEPARATOR = "|";
const JC_SEGMENT_OPTIONS: StatusLineSegmentOptions = {
  model: { showThinkingLevel: false },
  path: { mode: "basename" },
  git: {
    showBranch: true,
    showStaged: true,
    showUnstaged: true,
    showUntracked: true,
    polling: "full",
  },
};

const CUSTOM_COMPACTION_STATUS_KEY = "compact-policy";
const POWERLINE_EDITOR_INSTANCE = Symbol.for("jc.powerline.editorInstance");
let customCompactionEnabled = false;

const LAYOUT_CACHE_TTL_MS = 250;
const STREAMING_LAYOUT_CACHE_TTL_MS = 1000;
const STATUS_RENDER_DEBOUNCE_MS = 33;
const CONTEXT_STATUS_RENDER_MS = 250;
const EDITOR_STATUS_DEFER_MS = 150;

type SessionAssistantUsage = AssistantMessage["usage"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getUsageTokenTotal(usage: SessionAssistantUsage): number {
  const totalTokens =
    "totalTokens" in usage && typeof usage.totalTokens === "number"
      ? usage.totalTokens
      : 0;
  return (
    totalTokens ||
    usage.input + usage.output + usage.cacheRead + usage.cacheWrite
  );
}

function getTextCharCount(value: unknown): number {
  if (typeof value === "string") return value.length;
  if (Array.isArray(value)) return value.reduce((sum, entry) => sum + getTextCharCount(entry), 0);
  if (!isRecord(value)) return 0;
  if (typeof value.text === "string") return value.text.length;
  if ("content" in value) return getTextCharCount(value.content);
  return 0;
}

function estimateAssistantMessageTokens(message: AssistantMessage): number {
  return Math.max(0, Math.ceil(getTextCharCount(message.content) / 4));
}

function hasSessionAssistantUsage(value: unknown): value is SessionAssistantUsage {
  if (!isRecord(value)) return false;
  if (
    typeof value.input !== "number" ||
    typeof value.output !== "number" ||
    typeof value.cacheRead !== "number" ||
    typeof value.cacheWrite !== "number"
  ) {
    return false;
  }
  return isRecord(value.cost) && typeof value.cost.total === "number";
}

function isSessionAssistantMessage(value: unknown): value is AssistantMessage {
  return (
    isRecord(value) &&
    value.role === "assistant" &&
    hasSessionAssistantUsage(value.usage) &&
    (value.stopReason === undefined || typeof value.stopReason === "string")
  );
}

function getGlobalCompactionPolicyPath(): string {
  const homeDir = process.env.HOME || process.env.USERPROFILE || homedir();
  return join(homeDir, ".pi", "agent", "compaction-policy.json");
}

function getCustomCompactionExtensionPath(): string {
  const homeDir = process.env.HOME || process.env.USERPROFILE || homedir();
  return join(homeDir, ".pi", "agent", "extensions", "pi-custom-compaction");
}

function readCompactionPolicyEnabled(configPath: string): boolean | undefined {
  if (!existsSync(configPath)) return undefined;
  try {
    const parsed = JSON.parse(readFileSync(configPath, "utf-8"));
    if (!isRecord(parsed) || typeof parsed.enabled !== "boolean") return false;
    return parsed.enabled;
  } catch (error) {
    console.debug(`[jc-powerline-footer] Failed to read compaction policy from ${sanitizePathForLog(configPath)}: ${sanitizeErrorForLog(error)}`);
    return false;
  }
}

function detectCustomCompactionEnabled(cwd: string): boolean {
  if (!existsSync(getCustomCompactionExtensionPath())) return false;
  const projectSetting = readCompactionPolicyEnabled(join(cwd, ".pi", "compaction-policy.json"));
  if (projectSetting !== undefined) return projectSetting;
  return readCompactionPolicyEnabled(getGlobalCompactionPolicyPath()) ?? false;
}

function readQuietStartup(cwd: string): boolean {
  const homeDir = process.env.HOME || process.env.USERPROFILE || homedir();
  const paths = [join(cwd, ".pi", "settings.json"), join(homeDir, ".pi", "agent", "settings.json")];
  for (const settingsPath of paths) {
    if (!existsSync(settingsPath)) continue;
    try {
      const parsed = JSON.parse(readFileSync(settingsPath, "utf-8"));
      if (isRecord(parsed) && typeof parsed.quietStartup === "boolean") return parsed.quietStartup;
    } catch (error) {
      console.debug(`[jc-powerline-footer] Failed to read settings from ${sanitizePathForLog(settingsPath)}: ${sanitizeErrorForLog(error)}`);
    }
  }
  return false;
}

function isStaleExtensionContextError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("This extension instance is stale");
}

function parseNumberSettingValue(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function renderSegmentWithWidth(
  segId: StatusLineSegmentId,
  ctx: SegmentContext,
): { content: string; width: number; visible: boolean } {
  const rendered = renderSegment(segId, ctx);
  if (!rendered.visible || !rendered.content) {
    return { content: "", width: 0, visible: false };
  }
  return {
    content: rendered.content,
    width: visibleWidth(rendered.content),
    visible: true,
  };
}

function buildContentFromParts(parts: string[]): string {
  if (parts.length === 0) return "";
  const sepAnsi = getFgAnsiCode("sep");
  return " " + parts.join(` ${sepAnsi}${JC_SEPARATOR}${ansi.reset} `) + ansi.reset + " ";
}

function buildPromptLine(prompt: string | null, width: number): string {
  const normalized = prompt?.replace(/\s+/g, " ").trim();
  if (!normalized || width <= 4) return "";
  const icon = getIcons().input;
  const prefix = icon ? ` ${icon} ` : " ";
  const available = Math.max(1, width - visibleWidth(prefix) - 1);
  return prefix + truncateToWidth(normalized, available) + ansi.reset + " ";
}

function buildFooterLines(layout: { topContent: string; secondaryContent: string }, promptLine: string): string[] {
  if (!promptLine) return [layout.topContent, layout.secondaryContent].filter(Boolean);
  return [layout.topContent || " ", promptLine, layout.secondaryContent].filter(Boolean);
}

function renderVisibleSegments(segmentIds: readonly StatusLineSegmentId[], ctx: SegmentContext): { content: string; width: number }[] {
  const renderedSegments: { content: string; width: number }[] = [];
  for (const segId of segmentIds) {
    const { content, width, visible } = renderSegmentWithWidth(segId, ctx);
    if (visible) renderedSegments.push({ content, width });
  }
  return renderedSegments;
}

function takeFittingSegments(
  segments: { content: string; width: number }[],
  availableWidth: number,
): { selected: string[]; overflow: { content: string; width: number }[] } {
  const sepWidth = visibleWidth(JC_SEPARATOR) + 2;
  const selected: string[] = [];
  const overflow: { content: string; width: number }[] = [];
  let currentWidth = 2;
  let hasOverflowed = false;

  for (const seg of segments) {
    const neededWidth = seg.width + (selected.length > 0 ? sepWidth : 0);
    if (!hasOverflowed && currentWidth + neededWidth <= availableWidth) {
      selected.push(seg.content);
      currentWidth += neededWidth;
    } else {
      hasOverflowed = true;
      overflow.push(seg);
    }
  }

  return { selected, overflow };
}

function computeResponsiveLayout(
  ctx: SegmentContext,
  availableWidth: number,
): { topContent: string; secondaryContent: string } {
  const primary = renderVisibleSegments(JC_STATUSLINE_SEGMENTS, ctx);
  const { selected: topSegments, overflow } = takeFittingSegments(primary, availableWidth);
  const { selected: secondarySegments } = takeFittingSegments(overflow, availableWidth);

  return {
    topContent: buildContentFromParts(topSegments),
    secondaryContent: buildContentFromParts(secondarySegments),
  };
}

function mightChangeGitBranch(cmd: string): boolean {
  const gitBranchPatterns = [
    /\bgit\s+(checkout|switch|branch\s+-[dDmM]|merge|rebase|pull|reset|worktree)/,
    /\bgit\s+stash\s+(pop|apply)/,
  ];
  return gitBranchPatterns.some((pattern) => pattern.test(cmd));
}

function notifyPersistence(ctx: any, message: string, persisted: boolean): void {
  ctx.ui.notify(
    persisted ? message : `${message} (not persisted; check settings.json)`,
    persisted ? "info" : "warning",
  );
}

export default function powerlineFooter(pi: ExtensionAPI) {
  let editorDecoratorConfig: EditorDecoratorConfig = loadEditorDecoratorConfig();
  let inlineSlashCatalog: InlineSlashCatalog = {
    scope: "extension-api-public",
    note: PUBLIC_COMMAND_CATALOG_NOTE,
    entries: [],
  };

  let enabled = true;
  let currentCtx: any = null;
  let footerDataRef: ReadonlyFooterDataProvider | null = null;
  let getThinkingLevelFn: (() => string) | null = null;
  let currentThinkingLevel: string | null = null;
  let liveAssistantUsage: SessionAssistantUsage | null = null;
  let lastPrompt: string | null = null;
  let isStreaming = false;
  let tuiRef: any = null;
  let restoreEditorComponentHook: (() => void) | null = null;
  let welcomeHeaderActive = false;
  let dismissWelcomeOverlay: (() => void) | null = null;
  let currentEditor: any = null;
  const editorFactoryState = new EditorFactoryOwnerState();

  let lastLayoutWidth = 0;
  let lastLayoutResult: { topContent: string; secondaryContent: string } | null = null;
  let lastLayoutTimestamp = 0;
  let layoutDirty = true;
  let forceNextLayoutRecompute = false;
  let lastEditorInputAt = 0;

  const delayedRenderTimers = new Set<ReturnType<typeof setTimeout>>();

  const statusRenderScheduler = createRenderScheduler(() => {
    const msSinceInput = Date.now() - lastEditorInputAt;
    if (layoutDirty && !forceNextLayoutRecompute && msSinceInput < EDITOR_STATUS_DEFER_MS) {
      statusRenderScheduler.schedule(Math.max(0, EDITOR_STATUS_DEFER_MS - msSinceInput));
      return;
    }
    tuiRef?.requestRender();
  }, STATUS_RENDER_DEBOUNCE_MS);

  const resetLayoutCache = () => {
    lastLayoutResult = null;
    layoutDirty = true;
  };

  const requestStatusRender = (delayMs?: number) => {
    if (!currentCtx) return;
    layoutDirty = true;
    statusRenderScheduler.schedule(delayMs);
  };

  const scheduleStatusRender = (delayMs: number) => {
    const timer = setTimeout(() => {
      delayedRenderTimers.delete(timer);
      requestStatusRender();
    }, delayMs);
    delayedRenderTimers.add(timer);
  };

  const clearDelayedStatusRenders = () => {
    for (const timer of delayedRenderTimers) clearTimeout(timer);
    delayedRenderTimers.clear();
  };

  const requestImmediateStatusRender = (options: { deferDuringTyping?: boolean } = {}) => {
    layoutDirty = true;
    if (
      options.deferDuringTyping !== false &&
      Date.now() - lastEditorInputAt < EDITOR_STATUS_DEFER_MS
    ) {
      statusRenderScheduler.schedule();
      return;
    }
    forceNextLayoutRecompute = true;
    statusRenderScheduler.cancel();
    statusRenderScheduler.schedule(0);
  };

  function reloadEditorDecorators(ctx: any): void {
    editorDecoratorConfig = loadEditorDecoratorConfig();
    currentEditor?.invalidate?.();
    tuiRef?.requestRender?.();
    ctx.ui.notify(
      `Powerline editor decorators: ${editorDecoratorConfig.enabled ? "on" : "off"}, ${editorDecoratorConfig.rules.length} rule(s), ${editorDecoratorConfig.configPath}`,
      "info",
    );
  }

  function cleanupWelcome(ctx: any): void {
    dismissWelcomeOverlay?.();
    dismissWelcomeOverlay = null;
    if (welcomeHeaderActive) {
      welcomeHeaderActive = false;
      ctx.ui.setHeader(undefined);
    }
  }

  pi.on("session_start", async (event, ctx) => {
    currentCtx = ctx;
    customCompactionEnabled = detectCustomCompactionEnabled(ctx.cwd);
    isStreaming = false;
    liveAssistantUsage = null;
    lastPrompt = null;

    editorDecoratorConfig = loadEditorDecoratorConfig();
    inlineSlashCatalog = buildCommandCatalog(pi.getCommands());
    getThinkingLevelFn = typeof ctx.getThinkingLevel === "function" ? () => ctx.getThinkingLevel() : null;
    currentThinkingLevel = getThinkingLevelFn?.() ?? null;

    initVibeManager(ctx);

    if (enabled && ctx.hasUI) {
      setupCustomEditor(ctx);
      if (event.reason === "startup") {
        if (readQuietStartup(ctx.cwd)) setupWelcomeHeader(ctx);
        else setupWelcomeOverlay(ctx);
      }
    }
  });

  pi.on("session_shutdown", async (_event) => {
    clearDelayedStatusRenders();
    statusRenderScheduler.cancel();
    shutdownVibeManager();
    restoreEditorComponentHook?.();
    restoreEditorComponentHook = null;
    welcomeHeaderActive = false;
    dismissWelcomeOverlay?.();
    dismissWelcomeOverlay = null;
    currentCtx = null;
    footerDataRef = null;
    getThinkingLevelFn = null;
    currentThinkingLevel = null;
    liveAssistantUsage = null;
    lastPrompt = null;
    tuiRef = null;
    currentEditor = null;
    resetLayoutCache();
  });

  pi.on("tool_result", async (event) => {
    if (event.toolName === "write" || event.toolName === "edit") {
      invalidateGitStatus();
    }
    if (event.toolName === "bash" && event.input?.command) {
      const cmd = String(event.input.command);
      if (mightChangeGitBranch(cmd)) {
        invalidateGitStatus();
        invalidateGitBranch();
        scheduleStatusRender(100);
      }
    }
  });

  pi.on("user_bash", async (event) => {
    if (mightChangeGitBranch(event.command)) {
      invalidateGitStatus();
      invalidateGitBranch();
      scheduleStatusRender(100);
      scheduleStatusRender(300);
      scheduleStatusRender(500);
    }
  });

  pi.on("model_select", async (_event, ctx) => {
    currentCtx = ctx;
    requestStatusRender();
  });

  pi.on("thinking_level_select", async (event, ctx) => {
    currentCtx = ctx;
    currentThinkingLevel = getThinkingLevelFn?.() ?? (typeof event.level === "string" ? event.level : null);
    requestImmediateStatusRender({ deferDuringTyping: false });
  });

  pi.on("session_tree", async (_event, ctx) => {
    currentCtx = ctx;
    currentThinkingLevel = null;
    liveAssistantUsage = null;
    requestImmediateStatusRender({ deferDuringTyping: false });
  });

  pi.on("before_agent_start", async (event, ctx) => {
    lastPrompt = event.prompt;
    currentCtx = ctx;
    requestImmediateStatusRender({ deferDuringTyping: false });
    if (enabled && ctx.hasUI) {
      onVibeBeforeAgentStart(event.prompt, ctx.ui.setWorkingMessage);
    }
  });

  pi.on("agent_start", async (_event, ctx) => {
    isStreaming = true;
    liveAssistantUsage = null;
    currentCtx = ctx;
    if (enabled) onVibeAgentStart();
  });

  pi.on("message_update", async (event, ctx) => {
    const assistantEvent = event.assistantMessageEvent as unknown;
    if (isRecord(assistantEvent) && assistantEvent.type === "text_delta" && typeof assistantEvent.delta === "string") {
      onVibeTextDelta(assistantEvent.delta.length);
    }
    if (
      isSessionAssistantMessage(event.message) &&
      event.message.stopReason !== "error" &&
      event.message.stopReason !== "aborted"
    ) {
      const usageTokens = getUsageTokenTotal(event.message.usage);
      const displayTokens = usageTokens || estimateAssistantMessageTokens(event.message);
      if (displayTokens > 0) onVibeUsageUpdate(displayTokens, usageTokens > 0 ? "usage" : "estimate");
      if (usageTokens > 0) liveAssistantUsage = event.message.usage;
      currentCtx = ctx;
      layoutDirty = true;
      statusRenderScheduler.schedule(CONTEXT_STATUS_RENDER_MS);
    }
  });

  pi.on("message_end", async (event, ctx) => {
    currentCtx = ctx;
    if (isSessionAssistantMessage(event.message)) {
      if (event.message.stopReason === "error" || event.message.stopReason === "aborted") {
        liveAssistantUsage = null;
      } else if (getUsageTokenTotal(event.message.usage) > 0) {
        liveAssistantUsage = event.message.usage;
        onVibeUsageUpdate(getUsageTokenTotal(event.message.usage), "usage");
      }
    }
    requestImmediateStatusRender({ deferDuringTyping: false });
  });

  pi.on("turn_end", async (_event, ctx) => {
    currentCtx = ctx;
    requestImmediateStatusRender({ deferDuringTyping: false });
  });

  pi.on("tool_call", async (event, ctx) => {
    if (enabled && ctx.hasUI) {
      onVibeToolCall(event.toolName, event.input, ctx.ui.setWorkingMessage);
    }
  });

  pi.on("agent_end", async (_event, ctx) => {
    isStreaming = false;
    liveAssistantUsage = null;
    currentCtx = ctx;
    if (ctx.hasUI) onVibeAgentEnd(ctx.ui.setWorkingMessage);
    requestStatusRender();
  });

  pi.registerCommand("powerline", {
    description: "Configure Powerline statusline",
    handler: async (args, ctx) => {
      currentCtx = ctx;
      const normalizedArgs = args?.trim().toLowerCase() ?? "";

      if (!normalizedArgs || normalizedArgs === "status") {
        ctx.ui.notify(`Powerline ${enabled ? "on" : "off"}; layout jc`, "info");
        return;
      }

      const powerlineModeMatch = /^(on|off|toggle)$/.exec(normalizedArgs);
      if (powerlineModeMatch) {
        const mode = powerlineModeMatch[1];
        setPowerlineEnabled(ctx, mode === "toggle" ? !enabled : mode === "on");
        return;
      }

      const editorDecoratorsMatch = /^editor-decorators(?:\s+(reload|status))?$/.exec(normalizedArgs);
      if (editorDecoratorsMatch) {
        reloadEditorDecorators(ctx);
        return;
      }

      ctx.ui.notify("Usage: /powerline [status|on|off|toggle|editor-decorators reload]", "info");
    },
  });

  pi.registerCommand("editor-decorators", {
    description: "Reload/show powerline editor decorator config",
    handler: async (_args, ctx) => reloadEditorDecorators(ctx),
  });

  pi.registerCommand("vibe", {
    description: "Configure action vibe line. Usage: /vibe [status|on|off|model|refresh|max-length]",
    handler: async (args, ctx) => {
      const parts = args?.trim().split(/\s+/).filter(Boolean) ?? [];
      const subcommand = parts[0]?.toLowerCase() ?? "status";

      if (subcommand === "status") {
        ctx.ui.notify(
          `Action vibe: ${getActionVibeEnabled() ? "on" : "off"} | Model: ${getVibeModel()} | Refresh: ${getVibeRefreshIntervalSeconds()}s | Max: ${getVibeMaxLength()}`,
          "info",
        );
        return;
      }

      if (subcommand === "on" || subcommand === "off") {
        const enabledValue = subcommand === "on";
        const persisted = setActionVibeEnabled(enabledValue);
        notifyPersistence(ctx, `Action vibe ${enabledValue ? "enabled" : "disabled"}`, persisted);
        return;
      }

      if (subcommand === "model") {
        const modelSpec = parts.slice(1).join(" ");
        if (!modelSpec) {
          ctx.ui.notify(`Current vibe model: ${getVibeModel()}`, "info");
          return;
        }
        if (!modelSpec.includes("/")) {
          ctx.ui.notify("Invalid model format. Use: provider/modelId", "error");
          return;
        }
        const persisted = setVibeModel(modelSpec);
        notifyPersistence(ctx, `Vibe model set to: ${modelSpec}`, persisted);
        return;
      }

      if (subcommand === "refresh") {
        const seconds = parseNumberSettingValue(parts[1]);
        if (seconds === null) {
          ctx.ui.notify(`Current vibe refresh: ${getVibeRefreshIntervalSeconds()}s`, "info");
          return;
        }
        const persisted = setVibeRefreshIntervalSeconds(seconds);
        const normalizedSeconds = getVibeRefreshIntervalSeconds();
        notifyPersistence(ctx, `Vibe refresh set to: ${normalizedSeconds}s`, persisted);
        return;
      }

      if (subcommand === "max-length") {
        const maxLength = parseNumberSettingValue(parts[1]);
        if (maxLength === null) {
          ctx.ui.notify(`Current vibe max length: ${getVibeMaxLength()}`, "info");
          return;
        }
        const persisted = setVibeMaxLength(maxLength);
        const normalizedMaxLength = getVibeMaxLength();
        notifyPersistence(ctx, `Vibe max length set to: ${normalizedMaxLength}`, persisted);
        return;
      }

      if (subcommand === "fallback") {
        ctx.ui.notify("/vibe fallback is deprecated; vibe line now uses action · time · tokens", "info");
        return;
      }

      ctx.ui.notify("Usage: /vibe [status|on|off|model <provider/model>|refresh <sec>|max-length <n>]", "info");
    },
  });

  function setPowerlineEnabled(ctx: any, nextEnabled: boolean): void {
    enabled = nextEnabled;
    if (enabled) {
      initVibeManager(ctx);
      setupCustomEditor(ctx);
      ctx.ui.notify("Powerline enabled", "info");
      return;
    }

    if (ctx.hasUI) shutdownVibeManager(ctx.ui.setWorkingMessage);
    cleanupWelcome(ctx);
    restoreEditorComponentHook?.();
    restoreEditorComponentHook = null;
    restorePreviousEditorFactory(ctx);
    ctx.ui.setFooter(undefined);
    ctx.ui.setHeader(undefined);
    ctx.ui.setWidget("powerline-status", undefined);
    ctx.ui.setWidget("powerline-top", undefined);
    ctx.ui.setWidget("powerline-secondary", undefined);
    footerDataRef = null;
    tuiRef = null;
    currentEditor = null;
    clearDelayedStatusRenders();
    statusRenderScheduler.cancel();
    resetLayoutCache();
    ctx.ui.notify("Powerline disabled", "info");
  }

  function buildSegmentContext(ctx: any, theme: Theme): SegmentContext {
    const colors: ColorScheme = getDefaultColors();
    let cacheRead = 0;
    let cost = 0;
    let lastAssistant: AssistantMessage | undefined;
    let thinkingLevelFromSession: string | null = null;

    const sessionEvents = ctx.sessionManager?.getBranch?.() ?? [];
    for (const entry of sessionEvents) {
      if (!isRecord(entry)) continue;
      if (entry.type === "thinking_level_change" && typeof entry.thinkingLevel === "string") {
        thinkingLevelFromSession = entry.thinkingLevel;
      }
      if (entry.type !== "message" || !isSessionAssistantMessage(entry.message)) continue;
      const message = entry.message;
      if (message.stopReason === "error" || message.stopReason === "aborted") continue;
      cacheRead += message.usage.cacheRead;
      cost += message.usage.cost.total;
      if (getUsageTokenTotal(message.usage) > 0) lastAssistant = message;
    }

    const latestUsage = isStreaming ? (liveAssistantUsage ?? lastAssistant?.usage) : lastAssistant?.usage;
    const coreContextUsage = isStreaming && liveAssistantUsage ? null : readCoreContextUsage(ctx);
    let contextPercent: number | null = null;
    let contextWindow: number | null = null;
    if (coreContextUsage) {
      contextPercent = coreContextUsage.contextPercent;
      contextWindow = coreContextUsage.contextWindow;
    } else if (latestUsage) {
      const contextTokens = getUsageTokenTotal(latestUsage);
      contextWindow = ctx.model?.contextWindow ?? null;
      contextPercent = contextWindow && contextWindow > 0 ? (contextTokens / contextWindow) * 100 : null;
    }

    const gitBranch = footerDataRef?.getGitBranch() ?? null;
    const gitStatus = getGitStatus(gitBranch, JC_SEGMENT_OPTIONS.git?.polling, ctx.cwd);
    const extensionStatuses = footerDataRef?.getExtensionStatuses() ?? new Map();
    const usingSubscription = ctx.model ? (ctx.modelRegistry?.isUsingOAuth?.(ctx.model) ?? false) : false;
    const thinkingLevel = currentThinkingLevel ?? thinkingLevelFromSession ?? getThinkingLevelFn?.() ?? "off";

    return {
      model: ctx.model,
      thinkingLevel,
      cwd: ctx.cwd,
      usageStats: { cacheRead, cost },
      contextPercent,
      contextWindow,
      autoCompactEnabled: ctx.settingsManager?.getCompactionSettings?.()?.enabled ?? true,
      customCompactionEnabled: customCompactionEnabled || extensionStatuses.has(CUSTOM_COMPACTION_STATUS_KEY),
      usingSubscription,
      git: gitStatus,
      extensionStatuses,
      options: JC_SEGMENT_OPTIONS,
      theme,
      colors,
    };
  }

  function getResponsiveLayout(width: number, theme: Theme): { topContent: string; secondaryContent: string } {
    const now = Date.now();
    const cacheTtl = isStreaming ? STREAMING_LAYOUT_CACHE_TTL_MS : LAYOUT_CACHE_TTL_MS;

    if (lastLayoutResult && lastLayoutWidth === width) {
      const msSinceInput = now - lastEditorInputAt;
      const typingRecently = msSinceInput < EDITOR_STATUS_DEFER_MS;
      if (!forceNextLayoutRecompute && typingRecently && (layoutDirty || now - lastLayoutTimestamp >= cacheTtl)) {
        return lastLayoutResult;
      }
      if (!layoutDirty && now - lastLayoutTimestamp < cacheTtl) return lastLayoutResult;
    }

    let segmentCtx: SegmentContext;
    try {
      segmentCtx = buildSegmentContext(currentCtx, theme);
    } catch (error) {
      if (!isStaleExtensionContextError(error)) throw error;
      currentCtx = null;
      lastLayoutWidth = width;
      lastLayoutResult = { topContent: "", secondaryContent: "" };
      lastLayoutTimestamp = now;
      layoutDirty = false;
      forceNextLayoutRecompute = false;
      return lastLayoutResult;
    }

    lastLayoutWidth = width;
    lastLayoutResult = computeResponsiveLayout(segmentCtx, width);
    lastLayoutTimestamp = now;
    layoutDirty = false;
    forceNextLayoutRecompute = false;
    return lastLayoutResult;
  }

  function renderPowerlineStatusLines(width: number): string[] {
    if (!currentCtx || !footerDataRef) return [];
    const statuses = footerDataRef.getExtensionStatuses();
    if (!statuses || statuses.size === 0) return [];
    const notifications: string[] = [];
    for (const value of getNotificationExtensionStatuses(statuses)) {
      const lineContent = ` ${value}`;
      if (visibleWidth(lineContent) <= width) notifications.push(lineContent);
    }
    return notifications;
  }

  function renderPowerlineFooterLines(width: number, theme: Theme): string[] {
    if (!currentCtx) return [];
    const layout = getResponsiveLayout(width, theme);
    const promptLine = buildPromptLine(lastPrompt, width);
    return buildFooterLines(layout, promptLine);
  }

  function installNotificationWidget(ctx: any): void {
    ctx.ui.setWidget(
      "powerline-status",
      () => ({
        dispose() {},
        invalidate() { requestStatusRender(); },
        render(width: number): string[] { return renderPowerlineStatusLines(width); },
      }),
      { placement: "aboveEditor" },
    );
  }

  function getCurrentEditorFactory(ctx: any): any {
    return typeof ctx.ui.getEditorComponent === "function" ? ctx.ui.getEditorComponent() : undefined;
  }

  function capturePreviousEditorFactory(ctx: any): any {
    return editorFactoryState.capture(getCurrentEditorFactory(ctx));
  }

  const WRAPPED_EDITOR_BASE = Symbol.for("jc.powerline.wrappedEditorBase");

  function getWrappedEditorBase(factory: unknown): unknown {
    return factory && Reflect.get(factory as object, WRAPPED_EDITOR_BASE);
  }

  function restorePreviousEditorFactory(ctx: any): void {
    const currentFactory = getCurrentEditorFactory(ctx);
    const wrappedBase = getWrappedEditorBase(currentFactory);
    if (wrappedBase) {
      editorFactoryState.restoreTarget(wrappedBase);
      ctx.ui.setEditorComponent(wrappedBase);
      return;
    }

    const restore = editorFactoryState.restoreTarget(currentFactory);
    if (restore.shouldRestore) ctx.ui.setEditorComponent(restore.factory);
  }

  function enhanceEditor(editor: any, ctx: any): any {
    if (!editor || typeof editor !== "object") return editor;
    currentEditor = editor;

    const target = editor as any;
    if (!target[POWERLINE_EDITOR_INSTANCE]) {
      installInlineSlash(target, {
        catalog: inlineSlashCatalog,
        submitStrategy: createInlineSlashSubmitStrategy({
          sendUserMessage: pi.sendUserMessage?.bind(pi),
        }),
      });

    if (typeof target.handleInput === "function") {
      const originalHandleInput = target.handleInput.bind(target);
      target.handleInput = (data: string) => {
        lastEditorInputAt = Date.now();
        originalHandleInput(data);
      };
    }
      target[POWERLINE_EDITOR_INSTANCE] = true;
    }

    return typeof target.render === "function"
      ? decorateEditorRender(target, () => editorDecoratorConfig, ctx.ui.theme)
      : target;
  }

  function createPowerlineEditorFactory(ctx: any, baseFactory: (...args: any[]) => any, wrappedBase?: unknown): (...args: any[]) => any {
    const editorFactory = (...args: any[]) => enhanceEditor(baseFactory(...args), ctx);
    markPowerlineEditorFactory(editorFactory);
    if (wrappedBase) Reflect.set(editorFactory, WRAPPED_EDITOR_BASE, wrappedBase);
    return editorFactory;
  }

  function installEditorComponentHook(ctx: any): void {
    if (restoreEditorComponentHook || typeof ctx.ui.setEditorComponent !== "function") return;
    const originalSetEditorComponent = ctx.ui.setEditorComponent.bind(ctx.ui);
    const setEditorComponentWithPowerline = (factory: unknown) => {
      if (!enabled || !factory || isPowerlineEditorFactory(factory) || typeof factory !== "function") {
        originalSetEditorComponent(factory);
        return;
      }
      originalSetEditorComponent(createPowerlineEditorFactory(ctx, factory as (...args: any[]) => any, factory));
    };

    ctx.ui.setEditorComponent = setEditorComponentWithPowerline;
    restoreEditorComponentHook = () => {
      if (ctx.ui.setEditorComponent === setEditorComponentWithPowerline) {
        ctx.ui.setEditorComponent = originalSetEditorComponent;
      }
    };
  }

  function setupCustomEditor(ctx: any): void {
    if (!enabled) return;

    ctx.ui.setWidget("powerline-status", undefined);
    ctx.ui.setWidget("powerline-top", undefined);
    ctx.ui.setWidget("powerline-secondary", undefined);

    const previousEditorFactory = capturePreviousEditorFactory(ctx);
    installEditorComponentHook(ctx);
    const baseEditorFactory = typeof previousEditorFactory === "function"
      ? previousEditorFactory as (...args: any[]) => any
      : (tui: any, editorTheme: any, keybindings: any) => new (CustomEditor as any)(tui, editorTheme, keybindings);
    ctx.ui.setEditorComponent(createPowerlineEditorFactory(
      ctx,
      baseEditorFactory,
      typeof previousEditorFactory === "function" ? previousEditorFactory : undefined,
    ));

    ctx.ui.setFooter((tui: any, footerTheme: Theme, footerData: ReadonlyFooterDataProvider) => {
      footerDataRef = footerData;
      tuiRef = tui;
      const unsub = footerData.onBranchChange(() => requestStatusRender());
      return {
        dispose() { unsub(); },
        invalidate() {
          resetLayoutCache();
          requestStatusRender();
        },
        render(width: number): string[] { return renderPowerlineFooterLines(width, footerTheme); },
      };
    });

    installNotificationWidget(ctx);
  }

  function setupWelcomeHeader(ctx: any): void {
    const modelName = ctx.model?.name || ctx.model?.id || "No model";
    const providerName = ctx.model?.provider || "Unknown";
    const loadedCounts = discoverLoadedCounts();
    const recentSessions = getRecentSessions(3);
    const header = new WelcomeHeader(modelName, providerName, recentSessions, loadedCounts);
    welcomeHeaderActive = true;

    ctx.ui.setHeader(() => ({
      render(width: number): string[] { return header.render(width); },
      invalidate() { header.invalidate(); },
    }));
  }

  function setupWelcomeOverlay(ctx: any): void {
    const modelName = ctx.model?.name || ctx.model?.id || "No model";
    const providerName = ctx.model?.provider || "Unknown";
    const loadedCounts = discoverLoadedCounts();
    const recentSessions = getRecentSessions(3);
    const overlaySessionCtx = currentCtx;

    setTimeout(() => {
      if (!enabled || overlaySessionCtx !== currentCtx) {
        return;
      }

      const sessionEvents = ctx.sessionManager?.getBranch?.() ?? [];
      const hasActivity = Array.isArray(sessionEvents) && sessionEvents.some((entry: unknown) => {
        if (!isRecord(entry)) return false;
        if (entry.type === "tool_call" || entry.type === "tool_result") return true;
        return entry.type === "message" && isRecord(entry.message) && entry.message.role === "assistant";
      });
      if (hasActivity) return;

      ctx.ui.custom(
        (tui: any, _theme: any, _keybindings: any, done: (result: void) => void) => {
          const welcome = new WelcomeComponent(modelName, providerName, recentSessions, loadedCounts);
          let dismissed = false;

          const dismiss = () => {
            if (dismissed) return;
            dismissed = true;
            dismissWelcomeOverlay = null;
            done();
          };

          dismissWelcomeOverlay = dismiss;

          return {
            focused: false,
            invalidate: () => welcome.invalidate(),
            render: (width: number): string[] => welcome.render(width),
            handleInput: () => {},
            dispose: () => {
              dismissed = true;
            },
          };
        },
        {
          overlay: true,
          overlayOptions: () => ({
            verticalAlign: "center",
            horizontalAlign: "center",
          }),
        },
      ).catch((error: unknown) => {
        console.debug(`[powerline-footer] Welcome overlay failed: ${sanitizeErrorForLog(error)}`);
      });
    }, 100);
  }
}
