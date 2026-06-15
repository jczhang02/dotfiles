import { existsSync } from "node:fs";
import { resolveSubmitRouting } from "./classifier.ts";
import {
  InlineSlashProvider,
  isDelegatedStartOfMessage,
} from "./provider.ts";
import type {
  AutocompleteProviderLike,
  AutocompleteSuggestions,
  InlineSlashCatalog,
  SlashTokenAnalysis,
} from "./types.ts";

export interface InlineSlashEditorOptions {
  catalog: InlineSlashCatalog;
  submitStrategy?: InlineSlashSubmitStrategy;
}

export interface EditorCursorPosition {
  line: number;
  col: number;
}

export interface EditorSnapshot {
  text: string;
  lines: string[];
  cursorLine: number;
  cursorCol: number;
}

export interface InlineSlashEditorBase {
  getText(): string;
  getLines?(): string[];
  getCursor?(): EditorCursorPosition;
  handleInput(data: string): void;
  setAutocompleteProvider(provider: unknown): void;
  addToHistory?(text: string): void;
  onSubmit?: (text: string) => void;
}

export interface InlineSlashSubmitStrategyContext {
  text: string;
  editor: InlineSlashEditorBase;
  delegateCoreSubmit: (text: string) => void;
}

export type InlineSlashSubmitStrategy = (
  context: InlineSlashSubmitStrategyContext,
) => void;

export interface InlineSlashSubmitTransport {
  sendUserMessage?: (text: string, options?: { deliverAs?: "steer" | "followUp" }) => void;
}

interface InlineSlashAutocompleteHooks {
  isShowingAutocomplete(): boolean;
  tryTriggerAutocomplete(explicitTab?: boolean): void;
  updateAutocomplete(): void;
}

const INLINE_SLASH_INSTALLED = Symbol.for("jc.powerline.inlineSlashInstalled");

/**
 * Runtime submit strategy for absolute-path bypass without changing core slash behavior.
 */
export function createInlineSlashSubmitStrategy(
  transport: InlineSlashSubmitTransport,
): InlineSlashSubmitStrategy {
  return ({ text, editor, delegateCoreSubmit }) => {
    const routing = resolveSubmitRouting(text, { isAbsolutePath: (token) => token.startsWith("/") && existsSync(token) });

    if (routing.route !== "send-user-message") {
      delegateCoreSubmit(routing.preparedText);
      return;
    }

    if (typeof transport.sendUserMessage !== "function") {
      throw new Error("Inline slash extension requires api.sendUserMessage for absolute path submit bypass.");
    }

    editor.addToHistory?.(routing.preparedText);
    transport.sendUserMessage(routing.preparedText, { deliverAs: "steer" });
  };
}

/**
 * Install a submit shim on top of the instance property because the base editor keeps `onSubmit` as an own field.
 */
function installSubmitStrategy(
  editor: InlineSlashEditorBase,
  submitStrategy?: InlineSlashSubmitStrategy,
): void {
  if (!submitStrategy) {
    return;
  }

  let delegateCoreSubmit = editor.onSubmit;
  const wrappedSubmit = (text: string): void => {
    submitStrategy({
      text,
      editor,
      delegateCoreSubmit: (preparedText: string) => {
        delegateCoreSubmit?.(preparedText);
      },
    });
  };

  Reflect.deleteProperty(editor, "onSubmit");
  Object.defineProperty(editor, "onSubmit", {
    configurable: true,
    enumerable: true,
    get: () => wrappedSubmit,
    set: (handler: ((text: string) => void) | undefined) => {
      delegateCoreSubmit = handler;
    },
  });
}

/**
 * Extract only the minimal set of private autocomplete hooks.
 */
function getInlineSlashAutocompleteHooks(
  editor: InlineSlashEditorBase,
): InlineSlashAutocompleteHooks | null {
  const candidate = editor as Partial<InlineSlashAutocompleteHooks>;

  if (
    typeof candidate.isShowingAutocomplete !== "function"
    || typeof candidate.tryTriggerAutocomplete !== "function"
    || typeof candidate.updateAutocomplete !== "function"
  ) {
    return null;
  }

  return {
    isShowingAutocomplete: candidate.isShowingAutocomplete.bind(editor),
    tryTriggerAutocomplete: candidate.tryTriggerAutocomplete.bind(editor),
    updateAutocomplete: candidate.updateAutocomplete.bind(editor),
  };
}

/**
 * Read the current text and cursor snapshot using only public editor methods.
 */
export function readEditorSnapshot(editor: InlineSlashEditorBase): EditorSnapshot | null {
  if (typeof editor.getLines !== "function" || typeof editor.getCursor !== "function") {
    return null;
  }

  const text = editor.getText();
  const lines = editor.getLines();
  const cursor = editor.getCursor();

  return {
    text,
    lines,
    cursorLine: cursor.line,
    cursorCol: cursor.col,
  };
}

/**
 * Check whether editor state actually changed after `handleInput`.
 */
export function didEditorSnapshotChange(
  before: EditorSnapshot | null,
  after: EditorSnapshot | null,
): boolean {
  if (!before || !after) {
    return false;
  }

  return (
    before.text !== after.text
    || before.cursorLine !== after.cursorLine
    || before.cursorCol !== after.cursorCol
  );
}

function cursorOffsetFromSnapshot(snapshot: EditorSnapshot): number {
  let offset = 0;

  for (let index = 0; index < snapshot.cursorLine; index += 1) {
    offset += (snapshot.lines[index] ?? "").length + 1;
  }

  return offset + snapshot.cursorCol;
}

/**
 * Refresh autocomplete after regular editing for inline and second-line slash scenarios.
 */
function hasSuggestionItems(
  suggestions: AutocompleteSuggestions | null,
): suggestions is AutocompleteSuggestions {
  return !!suggestions
    && typeof suggestions === "object"
    && "items" in suggestions
    && Array.isArray(suggestions.items)
    && suggestions.items.length > 0;
}

function isSuggestionPromise(
  suggestions: AutocompleteSuggestions | null | Promise<AutocompleteSuggestions | null>,
): suggestions is Promise<AutocompleteSuggestions | null> {
  return !!suggestions && typeof (suggestions as Promise<AutocompleteSuggestions | null>).then === "function";
}

function isInlineSlashRefreshContext(
  analysis: SlashTokenAnalysis,
): boolean {
  return analysis.status === "match";
}

export function refreshInlineSlashAutocomplete(
  editor: InlineSlashEditorBase,
  provider: InlineSlashProvider,
): void {
  const snapshot = readEditorSnapshot(editor);

  if (!snapshot) {
    return;
  }

  if (isDelegatedStartOfMessage(snapshot.lines, snapshot.cursorLine, snapshot.cursorCol)) {
    return;
  }

  const hooks = getInlineSlashAutocompleteHooks(editor);

  if (!hooks) {
    return;
  }

  const analysis = provider.analyzeSnapshotToken(
    snapshot.lines.join("\n"),
    cursorOffsetFromSnapshot(snapshot),
  );

  if (!isInlineSlashRefreshContext(analysis)) {
    return;
  }

  const suggestions = provider.getSuggestions(
    snapshot.lines,
    snapshot.cursorLine,
    snapshot.cursorCol,
    { signal: new AbortController().signal },
  );

  if (hooks.isShowingAutocomplete()) {
    hooks.updateAutocomplete();
    return;
  }

  if (isSuggestionPromise(suggestions)) {
    suggestions
      .then((resolvedSuggestions) => {
        const currentSnapshot = readEditorSnapshot(editor);
        if (!currentSnapshot || didEditorSnapshotChange(snapshot, currentSnapshot)) return;
        if (hasSuggestionItems(resolvedSuggestions) && !hooks.isShowingAutocomplete()) {
          hooks.tryTriggerAutocomplete();
        }
      })
      .catch(() => {});
    return;
  }

  if (hasSuggestionItems(suggestions)) {
    hooks.tryTriggerAutocomplete();
  }
}

export function installInlineSlash(editor: InlineSlashEditorBase, options: InlineSlashEditorOptions): void {
  const target = editor as InlineSlashEditorBase & { [INLINE_SLASH_INSTALLED]?: boolean };
  if (target[INLINE_SLASH_INSTALLED]) return;
  if (typeof editor.setAutocompleteProvider !== "function" || typeof editor.handleInput !== "function") return;

  let inlineSlashProvider = new InlineSlashProvider({ catalog: options.catalog });
  const originalSetAutocompleteProvider = editor.setAutocompleteProvider.bind(editor);
  editor.setAutocompleteProvider = (provider: AutocompleteProviderLike): void => {
    inlineSlashProvider = new InlineSlashProvider({
      catalog: options.catalog,
      delegate: provider,
    });
    originalSetAutocompleteProvider(inlineSlashProvider);
  };

  const originalHandleInput = editor.handleInput.bind(editor);
  editor.handleInput = (data: string): void => {
    const before = readEditorSnapshot(editor);
    originalHandleInput(data);
    const after = readEditorSnapshot(editor);
    if (didEditorSnapshotChange(before, after)) refreshInlineSlashAutocomplete(editor, inlineSlashProvider);
  };

  installSubmitStrategy(editor, options.submitStrategy);
  target[INLINE_SLASH_INSTALLED] = true;
}
