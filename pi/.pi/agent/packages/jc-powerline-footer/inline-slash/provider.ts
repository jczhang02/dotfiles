import { analyzeSlashToken } from "./classifier.ts";
import type {
  AutocompleteApplyResult,
  AutocompleteItemLike,
  AutocompleteProviderLike,
  AutocompleteRequestOptions,
  AutocompleteSuggestions,
  Awaitable,
  InlineSlashCatalog,
  SlashTokenAnalysis,
  SlashTokenBounds,
} from "./types.ts";

export interface InlineSlashProviderOptions {
  catalog: InlineSlashCatalog;
  delegate?: AutocompleteProviderLike | null;
  analyzeToken?: (text: string, cursor: number) => SlashTokenAnalysis;
}

/**
 * Check that token bounds stay within the current text length.
 */
function isValidBounds(bounds: SlashTokenBounds, textLength: number): boolean {
  return bounds.start >= 0 && bounds.start <= bounds.end && bounds.end <= textLength;
}

/**
 * Convert a line/column cursor position into an absolute buffer offset.
 */
function cursorToOffset(lines: readonly string[], cursorLine: number, cursorCol: number): number | null {
  if (cursorLine < 0 || cursorCol < 0) {
    return null;
  }

  const safeLines = lines.length > 0 ? lines : [""];

  if (cursorLine >= safeLines.length) {
    return null;
  }

  const currentLine = safeLines[cursorLine] ?? "";

  if (cursorCol > currentLine.length) {
    return null;
  }

  let offset = 0;

  for (let index = 0; index < cursorLine; index += 1) {
    offset += (safeLines[index] ?? "").length + 1;
  }

  return offset + cursorCol;
}

/**
 * Convert an absolute offset back into line/column coordinates.
 */
function offsetToCursor(text: string, offset: number): { cursorLine: number; cursorCol: number } {
  const boundedOffset = Math.max(0, Math.min(offset, text.length));
  const beforeCursor = text.slice(0, boundedOffset);
  const lines = beforeCursor.split("\n");
  const cursorLine = lines.length - 1;
  const cursorCol = lines.at(-1)?.length ?? 0;

  return { cursorLine, cursorCol };
}

/**
 * Check whether the cursor is in a core-delegated start-of-message slash scenario.
 */
export function isDelegatedStartOfMessage(
  lines: readonly string[],
  cursorLine: number,
  cursorCol: number,
): boolean {
  if (cursorLine !== 0) {
    return false;
  }

  const currentLine = lines[0] ?? "";
  if (!currentLine.startsWith("/")) {
    return false;
  }

  const firstWhitespace = currentLine.search(/\s/);
  const leadingTokenEnd = firstWhitespace === -1 ? currentLine.length : firstWhitespace;
  return cursorCol <= leadingTokenEnd;
}

/**
 * Normalize inserted text so the leading slash is never lost.
 */
function normalizeInsertText(item: AutocompleteItemLike): string {
  const rawValue = item.value.trim();

  if (rawValue.startsWith("/")) {
    return rawValue;
  }

  return `/${rawValue.replace(/^\/+/, "")}`;
}

/**
 * Filter the catalog by the current slash-token prefix.
 */
function filterCatalog(catalog: InlineSlashCatalog, query: string): AutocompleteItemLike[] {
  const normalizedQuery = query.toLowerCase();

  return catalog.entries
    .filter((entry) => entry.matchKeys.some((matchKey) => matchKey.startsWith(normalizedQuery)))
    .map((entry) => ({
      value: entry.insertText,
      label: entry.label,
      ...(entry.description ? { description: entry.description } : {}),
    }));
}

/**
 * Pure provider for inline and second-line slash/skill autocomplete.
 */
export class InlineSlashProvider implements AutocompleteProviderLike {
  private readonly catalog: InlineSlashCatalog;
  private readonly delegate: AutocompleteProviderLike | null;
  private readonly analyzeToken: (text: string, cursor: number) => SlashTokenAnalysis;

  constructor(options: InlineSlashProviderOptions) {
    this.catalog = options.catalog;
    this.delegate = options.delegate ?? null;
    this.analyzeToken = options.analyzeToken ?? analyzeSlashToken;
  }

  private getDelegateSuggestions(
    lines: string[],
    cursorLine: number,
    cursorCol: number,
    options: AutocompleteRequestOptions,
  ): Awaitable<AutocompleteSuggestions | null> {
    return this.delegate?.getSuggestions(lines, cursorLine, cursorCol, options) ?? null;
  }

  private applyDelegateCompletion(
    lines: string[],
    cursorLine: number,
    cursorCol: number,
    item: AutocompleteItemLike,
    prefix: string,
  ): AutocompleteApplyResult {
    return this.delegate?.applyCompletion(lines, cursorLine, cursorCol, item, prefix) ?? {
      lines,
      cursorLine,
      cursorCol,
    };
  }

  /**
   * Expose token analysis for the editor refresh gate without leaking runtime details.
   */
  analyzeSnapshotToken(text: string, cursor: number): SlashTokenAnalysis {
    return this.analyzeToken(text, cursor);
  }

  /**
   * Build suggestions for an inline slash token or delegate to the core provider.
   */
  getSuggestions(
    lines: string[],
    cursorLine: number,
    cursorCol: number,
    options: AutocompleteRequestOptions = {},
  ): Awaitable<AutocompleteSuggestions | null> {
    if (isDelegatedStartOfMessage(lines, cursorLine, cursorCol)) {
      return this.getDelegateSuggestions(lines, cursorLine, cursorCol, options);
    }

    const offset = cursorToOffset(lines, cursorLine, cursorCol);

    if (offset === null) {
      return this.getDelegateSuggestions(lines, cursorLine, cursorCol, options);
    }

    const text = lines.join("\n");
    const analysis = this.analyzeToken(text, offset);

    if (analysis.status !== "match" || !isValidBounds(analysis.replacement, text.length)) {
      return this.getDelegateSuggestions(lines, cursorLine, cursorCol, options);
    }

    const items = filterCatalog(this.catalog, analysis.query);

    if (items.length === 0) {
      return this.getDelegateSuggestions(lines, cursorLine, cursorCol, options);
    }

    return {
      items,
      prefix: analysis.token,
    };
  }

  /**
   * Apply a completion only to the current token without damaging neighboring text.
   */
  applyCompletion(
    lines: string[],
    cursorLine: number,
    cursorCol: number,
    item: AutocompleteItemLike,
    prefix: string,
  ): AutocompleteApplyResult {
    if (isDelegatedStartOfMessage(lines, cursorLine, cursorCol)) {
      return this.applyDelegateCompletion(lines, cursorLine, cursorCol, item, prefix);
    }

    const offset = cursorToOffset(lines, cursorLine, cursorCol);

    if (offset === null) {
      return this.applyDelegateCompletion(lines, cursorLine, cursorCol, item, prefix);
    }

    const text = lines.join("\n");
    const analysis = this.analyzeToken(text, offset);

    if (analysis.status !== "match" || !isValidBounds(analysis.replacement, text.length)) {
      return this.applyDelegateCompletion(lines, cursorLine, cursorCol, item, prefix);
    }

    const insertText = normalizeInsertText(item);
    const beforeToken = text.slice(0, analysis.replacement.start);
    const afterToken = text.slice(analysis.replacement.end);
    const suffix = afterToken.length === 0 ? " " : "";
    const updatedText = `${beforeToken}${insertText}${suffix}${afterToken}`;
    const updatedCursor = offsetToCursor(updatedText, analysis.replacement.start + insertText.length + suffix.length);

    return {
      lines: updatedText.split("\n"),
      cursorLine: updatedCursor.cursorLine,
      cursorCol: updatedCursor.cursorCol,
    };
  }
}
