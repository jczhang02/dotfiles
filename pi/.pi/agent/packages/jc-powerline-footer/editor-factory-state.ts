export const POWERLINE_EDITOR_FACTORY = Symbol.for("jc.powerline.editorFactory");

export function markPowerlineEditorFactory(factory: object): void {
  Reflect.set(factory, POWERLINE_EDITOR_FACTORY, true);
}

export function isPowerlineEditorFactory(factory: unknown): boolean {
  return !!(factory && Reflect.get(factory as object, POWERLINE_EDITOR_FACTORY));
}

export class EditorFactoryOwnerState {
  private previousFactory: unknown = undefined;

  capture(currentFactory: unknown): unknown {
    if (currentFactory && !isPowerlineEditorFactory(currentFactory)) {
      this.previousFactory = currentFactory;
    }
    return this.previousFactory;
  }

  restoreTarget(currentFactory: unknown): { shouldRestore: boolean; factory: unknown } {
    const factory = this.previousFactory;
    this.previousFactory = undefined;

    if (currentFactory && !isPowerlineEditorFactory(currentFactory)) {
      return { shouldRestore: false, factory };
    }

    return { shouldRestore: true, factory };
  }
}
