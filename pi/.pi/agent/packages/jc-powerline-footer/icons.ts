import { loadThemeConfig } from "./theme.ts";

export interface IconSet {
  model: string;
  folder: string;
  branch: string;
  git: string;
  context: string;
  cache: string;
  input: string;
  auto: string;
}

export const SEP_DOT = " · ";

const THINKING_TEXT_UNICODE: Record<string, string> = {
  minimal: "[min]",
  low: "[low]",
  medium: "[med]",
  high: "[high]",
  xhigh: "[xhi]",
};

const THINKING_TEXT_NERD: Record<string, string> = {
  minimal: "\u{F0E7} min",
  low: "\u{F10C} low",
  medium: "\u{F192} med",
  high: "\u{F111} high",
  xhigh: "\u{F06D} xhi",
};

export function getThinkingText(level: string): string | undefined {
  return (hasNerdFonts() ? THINKING_TEXT_NERD : THINKING_TEXT_UNICODE)[level];
}

const NERD_ICONS: IconSet = {
  model: "\uEC19",
  folder: "\uF115",
  branch: "\uF126",
  git: "\uF1D3",
  context: "\uE70F",
  cache: "\uF1C0",
  input: "\uF090",
  auto: "\u{F0068}",
};

const ASCII_ICONS: IconSet = {
  model: "",
  folder: "dir",
  branch: "⎇",
  git: "⎇",
  context: "◫",
  cache: "cache",
  input: "in:",
  auto: "AC",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeUserIconOverrides(value: unknown): Partial<IconSet> {
  if (!isRecord(value)) return {};

  const sanitized: Partial<IconSet> = {};
  const validKeys = Object.keys(NERD_ICONS) as Array<keyof IconSet>;
  for (const key of validKeys) {
    const icon = value[key];
    if (typeof icon === "string") sanitized[key] = icon;
  }
  return sanitized;
}

export function hasNerdFonts(): boolean {
  if (process.env.POWERLINE_NERD_FONTS === "1") return true;
  if (process.env.POWERLINE_NERD_FONTS === "0") return false;
  if (process.env.GHOSTTY_RESOURCES_DIR) return true;

  const term = (process.env.TERM_PROGRAM || "").toLowerCase();
  return ["iterm", "wezterm", "kitty", "ghostty", "alacritty"].some((name) => term.includes(name));
}

export function getIcons(): IconSet {
  return {
    ...(hasNerdFonts() ? NERD_ICONS : ASCII_ICONS),
    ...sanitizeUserIconOverrides(loadThemeConfig().icons),
  };
}
