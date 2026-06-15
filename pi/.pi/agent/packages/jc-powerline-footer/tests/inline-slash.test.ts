import { describe, expect, test } from "bun:test";
import { resolveSubmitRouting } from "../inline-slash/classifier.ts";
import { buildCommandCatalog } from "../inline-slash/command-catalog.ts";
import { InlineSlashProvider } from "../inline-slash/provider.ts";
import { createInlineSlashSubmitStrategy, installInlineSlash } from "../inline-slash/editor.ts";
import { decorateEditorLine, decorateEditorRender, loadEditorDecoratorConfig } from "../editor-decorators.ts";

function command(name: string, source: "skill" | "extension" | "prompt" = "extension") {
  return {
    name,
    description: `${name} description`,
    source,
    sourceInfo: {
      path: `/tmp/${name}`,
      source,
      scope: "user",
      origin: "top-level",
    },
  };
}

function makeDelegate(label: string) {
  return {
    getSuggestions() {
      return {
        items: [{ value: `/${label}`, label: `/${label}` }],
        prefix: "",
      };
    },
    applyCompletion(lines: string[], cursorLine: number, cursorCol: number) {
      return { lines, cursorLine, cursorCol };
    },
  };
}

const catalog = buildCommandCatalog([
  command("powerline"),
  command("skill:review", "skill"),
]);

describe("inline slash routing", () => {
  test("routes root absolute paths as user messages when runtime says path exists", () => {
    expect(resolveSubmitRouting("/tmp", { isAbsolutePath: (token) => token === "/tmp" }).route).toBe("send-user-message");
    expect(resolveSubmitRouting("/home", { isAbsolutePath: (token) => token === "/home" }).route).toBe("send-user-message");
    expect(resolveSubmitRouting("/tmp/file.txt").route).toBe("send-user-message");
    expect(resolveSubmitRouting("/powerline", { isAbsolutePath: () => false }).route).toBe("delegate-core-submit");
    expect(resolveSubmitRouting("/skill:review", { isAbsolutePath: () => false }).route).toBe("delegate-core-submit");
  });

  test("absolute-path submit strategy uses steer delivery", () => {
    const sent: Array<{ text: string; deliverAs?: string }> = [];
    const strategy = createInlineSlashSubmitStrategy({
      sendUserMessage(text, options) {
        sent.push({ text, deliverAs: options?.deliverAs });
      },
    });
    strategy({
      text: "/tmp",
      editor: { getText: () => "", handleInput() {}, setAutocompleteProvider() {}, addToHistory() {} },
      delegateCoreSubmit() {
        throw new Error("absolute path should bypass core submit");
      },
    });
    expect(sent).toEqual([{ text: "/tmp", deliverAs: "steer" }]);
  });
});

describe("inline slash provider", () => {
  test("suggests and applies inline skill completions", () => {
    const provider = new InlineSlashProvider({ catalog, delegate: makeDelegate("fallback") });
    const suggestions = provider.getSuggestions(["please use /rev"], 0, 15, {});
    expect(suggestions && "items" in suggestions ? suggestions.items.map((item) => item.value) : []).toContain("/skill:review");

    const applied = provider.applyCompletion(
      ["please use /rev today"],
      0,
      15,
      { value: "/skill:review", label: "/skill:review" },
      "/rev",
    );
    expect(applied.lines.join("\n")).toBe("please use /skill:review today");
  });

  test("delegates only the leading slash-command token to core provider", () => {
    const provider = new InlineSlashProvider({ catalog, delegate: makeDelegate("core") });
    const rootSuggestions = provider.getSuggestions(["/go"], 0, 3, {});
    expect(rootSuggestions && "items" in rootSuggestions ? rootSuggestions.items[0]?.value : undefined).toBe("/core");

    const argumentSuggestions = provider.getSuggestions(["/goal use /rev"], 0, 14, {});
    expect(argumentSuggestions && "items" in argumentSuggestions ? argumentSuggestions.items.map((item) => item.value) : []).toContain("/skill:review");

    const applied = provider.applyCompletion(
      ["/goal use /rev now"],
      0,
      14,
      { value: "/skill:review", label: "/skill:review" },
      "/rev",
    );
    expect(applied.lines.join("\n")).toBe("/goal use /skill:review now");
  });

  test("installs inline slash behavior on an existing editor instance", () => {
    let provider: any = null;
    let text = "please /rev";
    const editor = {
      getText: () => text,
      getLines: () => [text],
      getCursor: () => ({ line: 0, col: text.length }),
      setAutocompleteProvider(nextProvider: unknown) { provider = nextProvider; },
      handleInput(data: string) { text += data; },
      isShowingAutocomplete: () => false,
      tryTriggerAutocomplete() {},
      updateAutocomplete() {},
    };

    installInlineSlash(editor, { catalog });
    editor.setAutocompleteProvider(makeDelegate("core"));

    const suggestions = provider.getSuggestions([text], 0, text.length, {});
    expect(suggestions && "items" in suggestions ? suggestions.items.map((item: any) => item.value) : []).toContain("/skill:review");
  });

});


describe("editor decorators and config", () => {
  test("decorates real slash and workflow syntax while skipping legacy hints and paths", () => {
    const config = loadEditorDecoratorConfig();
    const theme = { fg: (_color: string, text: string) => `\x1b[35m${text}\x1b[0m` } as any;

    expect(decorateEditorLine(" > /skill:review", config, theme)).toContain("\x1b[38;2;");
    expect(decorateEditorLine(" > workflow review", config, theme)).toContain("\x1b[38;2;");
    expect(decorateEditorLine(" > workflows:review", config, theme)).toContain("\x1b[38;2;");
    expect(decorateEditorLine(" > /powerline", config, theme)).toContain("\x1b[35m/powerline");
    expect(decorateEditorLine(" > /tmp", config, theme)).not.toContain("\x1b[35m/tmp");
    expect(decorateEditorLine(" > skills:review", config, theme)).not.toContain("\x1b[38;2;");

    const editor = { render: () => [" > /skill:review"] };
    const wrapped = decorateEditorRender(editor, () => config, theme);
    const wrappedAgain = decorateEditorRender(wrapped, () => config, theme);
    expect(wrappedAgain.render(80).join("\n")).toContain("\x1b[38;2;");
  });

});
