import { describe, expect, test } from "bun:test";
import {
  EditorFactoryOwnerState,
  isPowerlineEditorFactory,
  markPowerlineEditorFactory,
} from "../editor-factory-state.ts";

describe("editor factory owner state", () => {
  test("captures non-Powerline factories and ignores Powerline factories", () => {
    const state = new EditorFactoryOwnerState();
    const previous = () => null;
    const powerline = () => null;
    markPowerlineEditorFactory(powerline);

    expect(state.capture(previous)).toBe(previous);
    expect(state.capture(powerline)).toBe(previous);
    expect(isPowerlineEditorFactory(powerline)).toBe(true);
  });

  test("restores previous when current is Powerline or empty", () => {
    const state = new EditorFactoryOwnerState();
    const previous = () => null;
    const powerline = () => null;
    markPowerlineEditorFactory(powerline);

    state.capture(previous);
    expect(state.restoreTarget(powerline)).toEqual({ shouldRestore: true, factory: previous });

    state.capture(previous);
    expect(state.restoreTarget(undefined)).toEqual({ shouldRestore: true, factory: previous });
  });

  test("does not clobber third-party factory installed while active", () => {
    const state = new EditorFactoryOwnerState();
    const previous = () => null;
    const thirdParty = () => null;

    state.capture(previous);
    expect(state.restoreTarget(thirdParty)).toEqual({ shouldRestore: false, factory: previous });
    expect(state.restoreTarget(undefined)).toEqual({ shouldRestore: true, factory: undefined });
  });
});
