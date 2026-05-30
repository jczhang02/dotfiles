/**
 * Destructive Command Denylist — silent hard-block (zero-confirm).
 *
 * Blocks only catastrophic, irreversible bash commands. No confirmation prompt:
 * a match is denied outright. Scope is deliberately NARROW — `rm -rf ./build`
 * and other ordinary destructive ops are allowed; only root/home/system targets
 * and unrecoverable disk/fork-bomb operations are blocked.
 *
 * Deliberately NOT blocked: `curl | sh` (used for legit installs), shutdown/reboot.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/** `rm` with both recursive AND force flags, targeting a root/home/system path. */
function dangerousRm(cmd: string): boolean {
	const m = cmd.match(/\brm\b([^|;&\n]*)/);
	if (!m) return false;
	const args = m[1];
	const recursive = /(^|\s)-\w*r/i.test(args) || /--recursive/i.test(args);
	const force = /(^|\s)-\w*f/i.test(args) || /--force/i.test(args);
	if (!(recursive && force)) return false;
	// Dangerous targets: / , /* , ~ , ~/ , $HOME , ${HOME} , top-level system dirs.
	return /(^|[\s"'])(\/|\/\*|~|~\/|\$HOME\b|\$\{HOME\}|\/(etc|usr|var|bin|boot|lib|lib64|sys|dev|proc|root)(\/\*?)?)(\s|$|["'])/i.test(
		args,
	);
}

export default function (pi: ExtensionAPI) {
	const denylist: { test: (c: string) => boolean; label: string }[] = [
		{ test: dangerousRm, label: "rm -rf on root/home/system path" },
		{ test: (c) => /\bmkfs(\.\w+)?\b/i.test(c), label: "mkfs (format filesystem)" },
		{ test: (c) => /\bdd\b[^|;&\n]*\bof=\/dev\/(sd|nvme|hd|vd|disk|mmcblk)/i.test(c), label: "dd to raw disk device" },
		{ test: (c) => />\s*\/dev\/(sd|nvme|hd|vd|disk|mmcblk)/i.test(c), label: "redirect to raw disk device" },
		{ test: (c) => /:\s*\(\s*\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/.test(c), label: "fork bomb" },
		{ test: (c) => /\bchmod\b[^|;&\n]*-R[^|;&\n]*\s777\s+\/(?:\s|$)/i.test(c), label: "chmod -R 777 /" },
		{
			test: (c) => /\bgit\s+push\b[^|;&\n]*(--force\b|-f\b)[^|;&\n]*\b(main|master)\b/i.test(c),
			label: "git push --force to main/master",
		},
	];

	pi.on("tool_call", async (event, ctx) => {
		if (event.toolName !== "bash") return undefined;
		const command = String(event.input.command ?? "");

		for (const rule of denylist) {
			if (rule.test(command)) {
				if (ctx.hasUI) ctx.ui.notify(`⛔ Blocked (${rule.label})`, "error");
				return { block: true, reason: `Blocked: ${rule.label}. This is irreversible and is denied by policy.` };
			}
		}
		return undefined;
	});
}
