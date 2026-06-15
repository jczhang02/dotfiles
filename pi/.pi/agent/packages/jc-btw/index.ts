/**
 * @juicesharp/rpiv-btw — Pi extension entry point.
 *
 * Registers /btw command + snapshot/live-context lifecycle hooks. No tool,
 * no model picker, no disk persistence. History lives in process-scoped
 * globalThis state — survives
 * /new, /fork, /reload, /resume; lost on Pi process exit.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerBtwCommand, registerInvalidationHooks, registerMessageEndSnapshot } from "./btw.js";

export default function (pi: ExtensionAPI): void {
	registerBtwCommand(pi);
	registerMessageEndSnapshot(pi);
	registerInvalidationHooks(pi);
}
