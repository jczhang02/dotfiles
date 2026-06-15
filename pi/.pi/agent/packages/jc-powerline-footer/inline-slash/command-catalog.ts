import type { SlashCommandInfo } from "@earendil-works/pi-coding-agent";

import type {
  InlineSlashCatalog,
  InlineSlashCatalogEntry,
  PublicSlashCommandSource,
} from "./types.ts";

const SUPPORTED_SOURCES = new Set<PublicSlashCommandSource>(["extension", "prompt", "skill"]);
const SKILL_PREFIX = "skill:";

export const PUBLIC_COMMAND_CATALOG_NOTE =
  "The catalog is built only from public `pi.getCommands()` output and intentionally does not pretend to be a full built-in slash catalog.";

/**
 * Check whether the value is a non-empty string.
 */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Check whether the raw value matches a real Pi `SlashCommandInfo` shape.
 */
function isSlashCommandInfo(value: unknown): value is SlashCommandInfo {
  if (!value || typeof value !== "object") {
    return false;
  }

  const command = value as Partial<SlashCommandInfo>;

  return isNonEmptyString(command.name)
    && isNonEmptyString(command.source)
    && !!command.sourceInfo
    && typeof command.sourceInfo === "object"
    && isNonEmptyString(command.sourceInfo.path)
    && isNonEmptyString(command.sourceInfo.source)
    && isNonEmptyString(command.sourceInfo.scope)
    && isNonEmptyString(command.sourceInfo.origin);
}

/**
 * Normalize a public command name into a local alias without the leading slash.
 */
function normalizeCommandName(name: string): string {
  return name.trim().replace(/^\/+/, "");
}

/**
 * Build the set of match aliases used by the autocomplete catalog.
 */
function buildMatchKeys(name: string, source: PublicSlashCommandSource): string[] {
  const matchKeys = new Set<string>([name.toLowerCase()]);

  if (source === "skill" && name.toLowerCase().startsWith(SKILL_PREFIX)) {
    const shortAlias = name.slice(SKILL_PREFIX.length).trim().toLowerCase();

    if (shortAlias.length > 0) {
      matchKeys.add(shortAlias);
    }
  }

  return [...matchKeys];
}

/**
 * Convert raw `pi.getCommands()` data into a local catalog entry.
 */
function toCatalogEntry(rawCommand: unknown): InlineSlashCatalogEntry | null {
  if (!isSlashCommandInfo(rawCommand)) {
    return null;
  }

  if (!SUPPORTED_SOURCES.has(rawCommand.source)) {
    return null;
  }

  const name = normalizeCommandName(rawCommand.name);

  if (name.length === 0 || /\s/.test(name)) {
    return null;
  }

  const description = isNonEmptyString(rawCommand.description)
    ? rawCommand.description.trim()
    : undefined;

  return {
    name,
    queryKey: name.toLowerCase(),
    matchKeys: buildMatchKeys(name, rawCommand.source),
    label: `/${name}`,
    insertText: `/${name}`,
    description,
    source: rawCommand.source,
    sourceInfo: rawCommand.sourceInfo,
  };
}

/**
 * Build a truth-first catalog only from public extension/prompt/skill commands.
 */
export function buildCommandCatalog(commands: readonly unknown[]): InlineSlashCatalog {
  const entries: InlineSlashCatalogEntry[] = [];
  const seenAliases = new Set<string>();

  for (const rawCommand of commands) {
    const entry = toCatalogEntry(rawCommand);

    if (!entry || seenAliases.has(entry.queryKey)) {
      continue;
    }

    seenAliases.add(entry.queryKey);
    entries.push(entry);
  }

  entries.sort((left, right) => left.queryKey.localeCompare(right.queryKey));

  return {
    scope: "extension-api-public",
    note: PUBLIC_COMMAND_CATALOG_NOTE,
    entries,
  };
}
