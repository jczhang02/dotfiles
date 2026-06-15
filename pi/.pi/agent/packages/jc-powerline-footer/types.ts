import type { Theme, ThemeColor } from "@earendil-works/pi-coding-agent";

export type ColorValue = ThemeColor | `#${string}`;
export type ThemeLike = Pick<Theme, "fg">;

export type SemanticColor =
  | "model"
  | "path"
  | "gitDirty"
  | "gitClean"
  | "thinking"
  | "thinkingMinimal"
  | "thinkingLow"
  | "thinkingMedium"
  | "context"
  | "contextWarn"
  | "contextError"
  | "cost"
  | "tokens";

export type ColorScheme = Partial<Record<SemanticColor, ColorValue>>;

export type BuiltinStatusLineSegmentId =
  | "model"
  | "thinking"
  | "path"
  | "git"
  | "context_pct"
  | "cache_read"
  | "cost"
  | "extension_statuses";

export type StatusLineSegmentId = BuiltinStatusLineSegmentId;

export interface StatusLineSegmentOptions {
  model?: { showThinkingLevel?: boolean };
  path?: {
    mode?: "basename" | "abbreviated" | "full";
    maxLength?: number;
  };
  git?: {
    showBranch?: boolean;
    showStaged?: boolean;
    showUnstaged?: boolean;
    showUntracked?: boolean;
    polling?: "full" | "branch" | "off";
  };
}

export interface GitStatus {
  branch: string | null;
  staged: number;
  unstaged: number;
  untracked: number;
}

export interface UsageStats {
  cacheRead: number;
  cost: number;
}

export interface SegmentContext {
  model: { id: string; name?: string; reasoning?: boolean; contextWindow?: number } | undefined;
  thinkingLevel: string;
  cwd?: string;
  usageStats: UsageStats;
  contextPercent: number | null;
  contextWindow: number | null;
  autoCompactEnabled: boolean;
  customCompactionEnabled: boolean;
  usingSubscription: boolean;
  git: GitStatus;
  extensionStatuses: ReadonlyMap<string, string>;
  options: StatusLineSegmentOptions;
  theme: ThemeLike;
  colors: ColorScheme;
}

export interface RenderedSegment {
  content: string;
  visible: boolean;
}

export interface StatusLineSegment {
  id: BuiltinStatusLineSegmentId;
  render(ctx: SegmentContext): RenderedSegment;
}
