import type { Theme, ThemeColor } from "@earendil-works/pi-coding-agent";
import { existsSync, readFileSync } from "node:fs";
import { analyzeSlashToken } from "./inline-slash/classifier.ts";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { sanitizeErrorForLog, sanitizePathForLog } from "./log-sanitizer.ts";

const CONFIG_FILENAMES = ["editor-decorators.jsonc", "editor-decorators.json"] as const;
const RESET = "\x1b[0m";
const DECORATED_RENDER = Symbol.for("jc.powerline.editor-decorators.render");
const COMMAND_STYLE: RuleStyle = "accent";
const SKILL_STYLE: RuleStyle = "rainbow";
const WORKFLOW_STYLE: RuleStyle = "rainbow";
const MAX_CONFIGURED_REGEX_VISIBLE_LENGTH = 2000;

// Coral → yellow → green → teal → blue → purple → pink.
const RAINBOW_COLORS: [number, number, number][] = [
  [233, 137, 115],
  [228, 186, 103],
  [141, 192, 122],
  [102, 194, 179],
  [121, 157, 207],
  [157, 134, 195],
  [206, 130, 172],
];

type RuleType = "prefix" | "literal" | "regex";
type RuleStyle = "rainbow" | ThemeColor | `#${string}`;

interface RawRule {
  type?: unknown;
  value?: unknown;
  style?: unknown;
  caseSensitive?: unknown;
  group?: unknown;
}

interface RawConfig {
  enabled?: unknown;
  tokens?: unknown;
  prefixes?: unknown;
  literals?: unknown;
  literal?: unknown;
  characters?: unknown;
  rules?: unknown;
}

interface CompiledRule {
  regex: RegExp;
  style: RuleStyle;
  group?: number;
}

export interface EditorDecoratorConfig {
  enabled: boolean;
  configPath: string;
  rules: CompiledRule[];
}

interface VisibleMapEntry {
  rawStart: number;
  rawEnd: number;
}

interface MatchSpan {
  start: number;
  end: number;
  style: RuleStyle;
}

function extensionDir(): string {
  return dirname(fileURLToPath(import.meta.url));
}

function findConfigPath(): string {
  const dir = extensionDir();
  for (const name of CONFIG_FILENAMES) {
    const candidate = join(dir, name);
    if (existsSync(candidate)) return candidate;
  }
  return join(dir, CONFIG_FILENAMES[0]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function removeTrailingCommas(input: string): string {
  let out = "";
  let inString = false;
  let quote = "";
  let escaped = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!;

    if (inString) {
      out += ch;
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === quote) {
        inString = false;
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      inString = true;
      quote = ch;
      out += ch;
      continue;
    }

    if (ch === ",") {
      let j = i + 1;
      while (j < input.length && /\s/.test(input[j]!)) j++;
      if (input[j] === "}" || input[j] === "]") continue;
    }

    out += ch;
  }

  return out;
}

function stripJsonc(input: string): string {
  let out = "";
  let inString = false;
  let quote = "";
  let escaped = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!;
    const next = input[i + 1];

    if (inString) {
      out += ch;
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === quote) {
        inString = false;
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      inString = true;
      quote = ch;
      out += ch;
      continue;
    }

    if (ch === "/" && next === "/") {
      while (i < input.length && input[i] !== "\n") i++;
      out += "\n";
      continue;
    }

    if (ch === "/" && next === "*") {
      i += 2;
      while (i < input.length && !(input[i] === "*" && input[i + 1] === "/")) i++;
      i++;
      continue;
    }

    out += ch;
  }

  return removeTrailingCommas(out);
}

function readRawConfig(): { configPath: string; value: RawConfig } {
  const configPath = findConfigPath();
  if (!existsSync(configPath)) {
    return { configPath, value: {} };
  }

  try {
    const parsed = JSON.parse(stripJsonc(readFileSync(configPath, "utf8")));
    return { configPath, value: isRecord(parsed) ? parsed : {} };
  } catch (error) {
    console.debug(`[jc-powerline-footer] Failed to parse editor decorators config ${sanitizePathForLog(configPath)}: ${sanitizeErrorForLog(error)}`);
    return { configPath, value: {} };
  }
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeStyle(value: unknown): RuleStyle {
  return typeof value === "string" && value.trim() ? (value.trim() as RuleStyle) : "rainbow";
}

function regexWithIndices(pattern: string, baseFlags: string): RegExp {
  try {
    return new RegExp(pattern, `${baseFlags}d`);
  } catch {
    return new RegExp(pattern, baseFlags);
  }
}

function compilePrefixRule(prefix: string, style: RuleStyle, caseSensitive = true): CompiledRule | null {
  const value = prefix.trim();
  if (!value) return null;
  const flags = caseSensitive ? "g" : "gi";
  return {
    // Capture leading whitespace separately so only token text gets styled.
    regex: regexWithIndices(`(^|\\s)(${escapeRegExp(value)}[^\\s]*)`, flags),
    style,
    group: 2,
  };
}

function compileLiteralRule(value: string, style: RuleStyle, caseSensitive = true): CompiledRule | null {
  if (!value) return null;
  const flags = caseSensitive ? "g" : "gi";
  return { regex: regexWithIndices(escapeRegExp(value), flags), style };
}

function compileRegexRule(value: string, style: RuleStyle, caseSensitive = true, group?: number): CompiledRule | null {
  if (!value) return null;
  if (/(?:\([^)]*[+*][^)]*\)|\[[^\]]+[+*]\])\s*[+*{]/.test(value)) {
    console.debug(`[jc-powerline-footer] Skipping high-risk editor decorator regex "${value}"`);
    return null;
  }
  try {
    const flags = caseSensitive ? "g" : "gi";
    return { regex: regexWithIndices(value, flags), style, group };
  } catch (error) {
    console.debug(`[jc-powerline-footer] Invalid editor decorator regex "${value}": ${sanitizeErrorForLog(error)}`);
    return null;
  }
}

function compileRawRule(raw: unknown): CompiledRule | null {
  if (!isRecord(raw)) return null;
  const rule = raw as RawRule;
  const type: RuleType = rule.type === "literal" || rule.type === "regex" || rule.type === "prefix" ? rule.type : "prefix";
  const value = typeof rule.value === "string" ? rule.value : "";
  const style = normalizeStyle(rule.style);
  const caseSensitive = rule.caseSensitive !== false;
  const group = typeof rule.group === "number" && Number.isInteger(rule.group) && rule.group > 0 ? rule.group : undefined;

  if (type === "literal") return compileLiteralRule(value, style, caseSensitive);
  if (type === "regex") return compileRegexRule(value, style, caseSensitive, group);
  return compilePrefixRule(value, style, caseSensitive);
}

export function loadEditorDecoratorConfig(): EditorDecoratorConfig {
  const { configPath, value } = readRawConfig();
  const raw = value as RawConfig;
  const rules: CompiledRule[] = [];

  const tokenValues = Array.isArray(raw.tokens) ? raw.tokens : [];
  const prefixValues = Array.isArray(raw.prefixes) ? raw.prefixes : [];
  for (const token of [...tokenValues, ...prefixValues]) {
    if (typeof token !== "string") continue;
    const compiled = compilePrefixRule(token, "rainbow");
    if (compiled) rules.push(compiled);
  }

  const literalValues = [
    ...(Array.isArray(raw.literals) ? raw.literals : []),
    ...(Array.isArray(raw.literal) ? raw.literal : []),
    ...(Array.isArray(raw.characters) ? raw.characters : []),
  ];
  for (const literal of literalValues) {
    if (typeof literal !== "string") continue;
    const compiled = compileLiteralRule(literal, "rainbow");
    if (compiled) rules.push(compiled);
  }

  if (Array.isArray(raw.rules)) {
    for (const rule of raw.rules) {
      const compiled = compileRawRule(rule);
      if (compiled) rules.push(compiled);
    }
  }

  return {
    enabled: raw.enabled !== false,
    configPath,
    rules,
  };
}

function ansiFg(r: number, g: number, b: number): string {
  return `\x1b[38;2;${r};${g};${b}m`;
}

function hexToAnsi(hex: string): string | null {
  const match = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!match) return null;
  const h = match[1]!;
  return ansiFg(Number.parseInt(h.slice(0, 2), 16), Number.parseInt(h.slice(2, 4), 16), Number.parseInt(h.slice(4, 6), 16));
}

function rainbow(text: string): string {
  let result = "";
  let index = 0;
  for (const char of text) {
    if (/\s/.test(char)) {
      result += char;
      continue;
    }
    const [r, g, b] = RAINBOW_COLORS[index % RAINBOW_COLORS.length]!;
    result += `${ansiFg(r, g, b)}${char}`;
    index++;
  }
  return result + RESET;
}

function applyStyle(text: string, style: RuleStyle, theme: Theme): string {
  if (style === "rainbow") return rainbow(text);

  if (typeof style === "string" && style.startsWith("#")) {
    const ansi = hexToAnsi(style);
    if (ansi) return `${ansi}${text}${RESET}`;
  }

  try {
    return theme.fg(style as ThemeColor, text);
  } catch {
    return text;
  }
}

function parseEscapeEnd(raw: string, start: number): number {
  const marker = raw[start + 1];

  if (marker === "[") {
    let i = start + 2;
    while (i < raw.length) {
      const code = raw.charCodeAt(i);
      if (code >= 0x40 && code <= 0x7e) return i + 1;
      i++;
    }
    return raw.length;
  }

  if (marker === "]") {
    let i = start + 2;
    while (i < raw.length) {
      if (raw[i] === "\x07") return i + 1;
      if (raw[i] === "\x1b" && raw[i + 1] === "\\") return i + 2;
      i++;
    }
    return raw.length;
  }

  if (marker === "P" || marker === "_" || marker === "^" || marker === "X") {
    let i = start + 2;
    while (i < raw.length) {
      if (raw[i] === "\x1b" && raw[i + 1] === "\\") return i + 2;
      i++;
    }
    return raw.length;
  }

  return Math.min(raw.length, start + 2);
}

function visibleTextAndMap(raw: string): { visible: string; map: VisibleMapEntry[] } {
  let visible = "";
  const map: VisibleMapEntry[] = [];

  for (let i = 0; i < raw.length;) {
    if (raw[i] === "\x1b") {
      i = parseEscapeEnd(raw, i);
      continue;
    }

    const codePoint = raw.codePointAt(i);
    if (codePoint === undefined) break;
    const char = String.fromCodePoint(codePoint);
    const rawEnd = i + char.length;
    visible += char;
    for (let unit = 0; unit < char.length; unit++) {
      map.push({ rawStart: i, rawEnd });
    }
    i = rawEnd;
  }

  return { visible, map };
}

function matchGroupRange(match: RegExpMatchArray, group: number): [number, number] | null {
  const indices = (match as RegExpMatchArray & { indices?: Array<[number, number] | undefined> }).indices;
  const range = indices?.[group];
  if (range && range[0] >= 0 && range[1] > range[0]) {
    return range;
  }

  const groupText = match[group];
  if (!groupText) return null;
  const full = match[0];
  const offset = full.indexOf(groupText);
  if (offset < 0) return null;
  const start = (match.index ?? 0) + offset;
  return [start, start + groupText.length];
}

function removeOverlappingSpans(spans: MatchSpan[]): MatchSpan[] {
  const result: MatchSpan[] = [];
  let cursor = -1;
  for (const span of spans.sort((a, b) => a.start - b.start || b.end - a.end)) {
    if (span.start < cursor) continue;
    result.push(span);
    cursor = span.end;
  }
  return result;
}

function collectConfiguredSpans(visible: string, rules: CompiledRule[]): MatchSpan[] {
  const spans: MatchSpan[] = [];

  for (const rule of rules) {
    rule.regex.lastIndex = 0;
    for (const match of visible.matchAll(rule.regex)) {
      const full = match[0];
      if (!full) continue;

      let start = match.index ?? 0;
      let end = start + full.length;

      if (rule.group !== undefined) {
        const range = matchGroupRange(match, rule.group);
        if (!range) continue;
        [start, end] = range;
      }

      if (end > start) spans.push({ start, end, style: rule.style });
    }
  }
  return removeOverlappingSpans(spans);
}

function isTokenSeparator(ch: string): boolean {
  return /\s/.test(ch);
}

function collectBuiltinSpans(visible: string): MatchSpan[] {
  const spans: MatchSpan[] = [];

  for (let start = 0; start < visible.length;) {
    while (start < visible.length && isTokenSeparator(visible[start]!)) start++;
    if (start >= visible.length) break;

    let end = start;
    while (end < visible.length && !isTokenSeparator(visible[end]!)) end++;

    const token = visible.slice(start, end);

    if (/^workflows?(?::\S+)?$/i.test(token)) {
      spans.push({ start, end, style: WORKFLOW_STYLE });
    } else if (token.startsWith("/") && !existsSync(token)) {
      const analysis = analyzeSlashToken(token, token.length);
      if (analysis.status === "match") {
        if (analysis.kind === "skill") {
          spans.push({ start, end, style: SKILL_STYLE });
        } else if (analysis.kind === "command") {
          spans.push({ start, end, style: COMMAND_STYLE });
        }
      }
    }

    start = end;
  }

  return spans;
}

function collectSpans(visible: string, rules: CompiledRule[]): MatchSpan[] {
  const configuredSpans = visible.length > MAX_CONFIGURED_REGEX_VISIBLE_LENGTH
    ? []
    : collectConfiguredSpans(visible, rules);
  return removeOverlappingSpans([...collectBuiltinSpans(visible), ...configuredSpans]);
}

export function decorateEditorLine(line: string, config: EditorDecoratorConfig, theme: Theme): string {
  if (!config.enabled) return line;

  const { visible, map } = visibleTextAndMap(line);
  const spans = collectSpans(visible, config.rules);
  if (spans.length === 0) return line;

  let result = "";
  let rawCursor = 0;

  for (const span of spans) {
    const startEntry = map[span.start];
    const endEntry = map[span.end - 1];
    if (!startEntry || !endEntry) continue;

    const rawStart = startEntry.rawStart;
    const rawEnd = endEntry.rawEnd;
    const rawSlice = line.slice(rawStart, rawEnd);

    result += line.slice(rawCursor, rawStart);

    // Cursor uses inverse-video SGR inside rendered text. Styling across it
    // corrupts cursor state, so leave that token plain for this frame.
    if (rawSlice.includes("\x1b[7m")) {
      result += rawSlice;
    } else {
      result += applyStyle(rawSlice, span.style, theme);
    }

    rawCursor = rawEnd;
  }

  result += line.slice(rawCursor);
  return result;
}

export function decorateEditorLines(lines: string[], config: EditorDecoratorConfig, theme: Theme): string[] {
  if (!config.enabled) return lines;
  return lines.map((line) => decorateEditorLine(line, config, theme));
}

export function decorateEditorRender<T extends { render(width: number): string[] }>(
  editor: T,
  getConfig: () => EditorDecoratorConfig,
  theme: Theme,
): T {
  const target = editor as T & { [DECORATED_RENDER]?: boolean };
  if (target[DECORATED_RENDER]) return editor;

  const originalRender = editor.render.bind(editor);
  editor.render = (width: number): string[] => decorateEditorLines(originalRender(width), getConfig(), theme);
  target[DECORATED_RENDER] = true;
  return editor;
}
