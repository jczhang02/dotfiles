import { basename } from "node:path";
import type {
  BuiltinStatusLineSegmentId,
  RenderedSegment,
  SegmentContext,
  SemanticColor,
  StatusLineSegment,
  StatusLineSegmentId,
} from "./types.ts";
import { fg, rainbow, applyColor } from "./theme.ts";
import { getIcons, SEP_DOT, getThinkingText } from "./icons.ts";
import { isNotificationExtensionStatus } from "./powerline-config.ts";

function color(ctx: SegmentContext, semantic: SemanticColor, text: string): string {
  return fg(ctx.theme, semantic, text, ctx.colors);
}

function withIcon(icon: string, text: string): string {
  return icon ? `${icon} ${text}` : text;
}

function formatTokens(n: number): string {
  if (n < 1000) return n.toString();
  if (n < 10000) return `${(n / 1000).toFixed(1)}k`;
  if (n < 1000000) return `${Math.round(n / 1000)}k`;
  if (n < 10000000) return `${(n / 1000000).toFixed(1)}M`;
  return `${Math.round(n / 1000000)}M`;
}

const SELECTED_EXTENSION_STATUS_KEYS = ["codex-goal", "mcp", "loadout"] as const;

const modelSegment: StatusLineSegment = {
  id: "model",
  render(ctx) {
    const icons = getIcons();
    const opts = ctx.options.model ?? {};
    let modelName = ctx.model?.name || ctx.model?.id || "no-model";
    if (modelName.startsWith("Claude ")) modelName = modelName.slice(7);

    let content = withIcon(icons.model, modelName);
    if (opts.showThinkingLevel !== false && ctx.model?.reasoning) {
      const level = ctx.thinkingLevel || "off";
      if (level !== "off") {
        const thinkingText = getThinkingText(level);
        if (thinkingText) content += `${SEP_DOT}${thinkingText}`;
      }
    }

    return { content: color(ctx, "model", content), visible: true };
  },
};

const thinkingSegment: StatusLineSegment = {
  id: "thinking",
  render(ctx) {
    if (ctx.model?.reasoning === false) return { content: "", visible: false };
    const level = ctx.thinkingLevel || "off";
    const levelText: Record<string, string> = {
      off: "off",
      minimal: "min",
      low: "low",
      medium: "med",
      high: "high",
      xhigh: "xhigh",
    };
    const content = `think:${levelText[level] || level}`;

    if (level === "high" || level === "xhigh") return { content: rainbow(content), visible: true };
    if (level === "minimal") return { content: color(ctx, "thinkingMinimal", content), visible: true };
    if (level === "low") return { content: color(ctx, "thinkingLow", content), visible: true };
    if (level === "medium") return { content: color(ctx, "thinkingMedium", content), visible: true };
    return { content: color(ctx, "thinking", content), visible: true };
  },
};

const pathSegment: StatusLineSegment = {
  id: "path",
  render(ctx) {
    const icons = getIcons();
    const opts = ctx.options.path ?? {};
    const mode = opts.mode ?? "basename";
    let pwd = ctx.cwd ?? process.cwd();
    const home = process.env.HOME || process.env.USERPROFILE;

    if (mode === "basename") {
      pwd = basename(pwd) || pwd;
    } else {
      if (home && pwd.startsWith(home)) pwd = `~${pwd.slice(home.length)}`;
      if (pwd.startsWith("/work/")) pwd = pwd.slice(6);
      if (mode === "abbreviated") {
        const maxLen = opts.maxLength ?? 40;
        if (pwd.length > maxLen) pwd = `…${pwd.slice(-(maxLen - 1))}`;
      }
    }

    return { content: color(ctx, "path", withIcon(icons.folder, pwd)), visible: true };
  },
};

const gitSegment: StatusLineSegment = {
  id: "git",
  render(ctx) {
    const icons = getIcons();
    const opts = ctx.options.git ?? {};
    const { branch, staged, unstaged, untracked } = ctx.git;
    const isDirty = staged > 0 || unstaged > 0 || untracked > 0;
    if (!branch && !isDirty) return { content: "", visible: false };

    const showBranch = opts.showBranch !== false;
    const branchColor: SemanticColor = isDirty ? "gitDirty" : "gitClean";
    let content = "";

    if (showBranch && branch) {
      content = color(ctx, branchColor, withIcon(icons.branch, branch));
    }

    const indicators: string[] = [];
    if (opts.showUnstaged !== false && unstaged > 0) indicators.push(applyColor(ctx.theme, "warning", `*${unstaged}`));
    if (opts.showStaged !== false && staged > 0) indicators.push(applyColor(ctx.theme, "success", `+${staged}`));
    if (opts.showUntracked !== false && untracked > 0) indicators.push(applyColor(ctx.theme, "muted", `?${untracked}`));
    if (indicators.length > 0) {
      const indicatorText = indicators.join(" ");
      content = content ? `${content} ${indicatorText}` : `${color(ctx, branchColor, icons.git ? `${icons.git} ` : "")}${indicatorText}`;
    }

    return content ? { content, visible: true } : { content: "", visible: false };
  },
};

const contextPctSegment: StatusLineSegment = {
  id: "context_pct",
  render(ctx) {
    if (ctx.customCompactionEnabled || ctx.contextPercent === null || ctx.contextWindow === null) return { content: "", visible: false };

    const icons = getIcons();
    const text = `${ctx.contextPercent.toFixed(1)}%/${formatTokens(ctx.contextWindow)}${ctx.autoCompactEnabled && icons.auto ? ` ${icons.auto}` : ""}`;
    if (ctx.contextPercent > 90) return { content: withIcon(icons.context, color(ctx, "contextError", text)), visible: true };
    if (ctx.contextPercent > 70) return { content: withIcon(icons.context, color(ctx, "contextWarn", text)), visible: true };
    return { content: withIcon(icons.context, color(ctx, "context", text)), visible: true };
  },
};

const cacheReadSegment: StatusLineSegment = {
  id: "cache_read",
  render(ctx) {
    const icons = getIcons();
    const { cacheRead } = ctx.usageStats;
    if (!cacheRead) return { content: "", visible: false };

    const content = [icons.cache, icons.input, formatTokens(cacheRead)].filter(Boolean).join(" ");
    return { content: color(ctx, "tokens", content), visible: true };
  },
};

const costSegment: StatusLineSegment = {
  id: "cost",
  render(ctx) {
    const { cost } = ctx.usageStats;
    if (!cost && !ctx.usingSubscription) return { content: "", visible: false };

    return { content: color(ctx, "cost", ctx.usingSubscription ? "(sub)" : `$${cost.toFixed(2)}`), visible: true };
  },
};

const extensionStatusesSegment: StatusLineSegment = {
  id: "extension_statuses",
  render(ctx) {
    const parts: string[] = [];
    for (const key of SELECTED_EXTENSION_STATUS_KEYS) {
      const value = ctx.extensionStatuses.get(key);
      if (value && !isNotificationExtensionStatus(value)) parts.push(value);
    }
    return parts.length > 0
      ? { content: parts.join(SEP_DOT), visible: true }
      : { content: "", visible: false };
  },
};

export const SEGMENTS: Record<BuiltinStatusLineSegmentId, StatusLineSegment> = {
  model: modelSegment,
  thinking: thinkingSegment,
  path: pathSegment,
  git: gitSegment,
  context_pct: contextPctSegment,
  cache_read: cacheReadSegment,
  cost: costSegment,
  extension_statuses: extensionStatusesSegment,
};

export function renderSegment(id: StatusLineSegmentId, ctx: SegmentContext): RenderedSegment {
  return SEGMENTS[id]?.render(ctx) ?? { content: "", visible: false };
}
