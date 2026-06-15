import type { SlashCommandInfo, SourceInfo } from "@earendil-works/pi-coding-agent";

export type SlashCandidateKind = "command" | "skill" | "absolute-path";

export type SlashNoMatchReason =
  | "empty-text"
  | "cursor-out-of-range"
  | "cursor-not-on-token"
  | "not-slash-token"
  | "token-too-short"
  | "unrecognized-token";

export interface SlashTokenBounds {
  start: number;
  end: number;
}

export interface SlashTokenBase {
  bounds: SlashTokenBounds;
  replacement: SlashTokenBounds;
  token: string;
  query: string;
  isAbsolutePathCandidate: boolean;
}

export interface SlashCommandMatch extends SlashTokenBase {
  status: "match";
  kind: "command";
}

export interface SlashSkillMatch extends SlashTokenBase {
  status: "match";
  kind: "skill";
}

export interface SlashAbsolutePathCandidate extends SlashTokenBase {
  status: "absolute-path-candidate";
  kind: "absolute-path";
  isAbsolutePathCandidate: true;
  reason: "contains-path-separator" | "runtime-path-check";
}

export interface SlashNoMatch {
  status: "no-match";
  kind: "none";
  reason: SlashNoMatchReason;
  isAbsolutePathCandidate: false;
}

export type SlashTokenAnalysis =
  | SlashCommandMatch
  | SlashSkillMatch
  | SlashAbsolutePathCandidate
  | SlashNoMatch;

export type SubmitRoute = "delegate-core-submit" | "send-user-message";

export interface SubmitRoutingResult {
  route: SubmitRoute;
  preparedText: string;
  leadingToken: string;
  analysis: SlashTokenAnalysis;
}

export interface SubmitRoutingOptions {
  isAbsolutePath?: (leadingToken: string) => boolean;
}

export interface AutocompleteItemLike {
  value: string;
  label: string;
  description?: string;
}

export interface AutocompleteSuggestions {
  items: AutocompleteItemLike[];
  prefix: string;
}

export interface AutocompleteRequestOptions {
  force?: boolean;
  signal?: AbortSignal;
}

export interface AutocompleteApplyResult {
  lines: string[];
  cursorLine: number;
  cursorCol: number;
}

export type Awaitable<T> = T | Promise<T>;

export interface AutocompleteProviderLike {
  getSuggestions(
    lines: string[],
    cursorLine: number,
    cursorCol: number,
    options?: AutocompleteRequestOptions,
  ): Awaitable<AutocompleteSuggestions | null>;
  applyCompletion(
    lines: string[],
    cursorLine: number,
    cursorCol: number,
    item: AutocompleteItemLike,
    prefix: string,
  ): AutocompleteApplyResult;
}

export type PublicSlashCommandSource = SlashCommandInfo["source"];
export type PublicSlashCommandSourceInfo = SourceInfo;

export interface InlineSlashCatalogEntry {
  name: string;
  queryKey: string;
  matchKeys: string[];
  label: string;
  insertText: string;
  description?: string;
  source: PublicSlashCommandSource;
  sourceInfo: PublicSlashCommandSourceInfo;
}

export interface InlineSlashCatalog {
  scope: "extension-api-public";
  note: string;
  entries: InlineSlashCatalogEntry[];
}
