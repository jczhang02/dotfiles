/**
 * Protected Paths — silent hard-block (zero-confirm).
 *
 * Blocks write/edit to secret / credential paths. No prompt: matches are
 * denied outright, only a non-blocking notify is shown. Reads via bash are
 * not intercepted here (fragile to match); this guards accidental writes.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	const home = process.env.HOME ?? "";

	// Substring matches (relative or absolute paths both work).
	const protectedSubstrings = [
		"/.ssh/",
		"/.gnupg/",
		"/.cli-proxy-api/",
		"/.pi/agent/auth.json",
		"/.aws/credentials",
		"/.config/gh/hosts.yml",
		"/.netrc",
	];

	// Filename / suffix patterns for secrets.
	const protectedPatterns: RegExp[] = [
		/(^|\/)\.env(\.[^/]+)?$/, // .env, .env.local — but see allow list below
		/(^|\/)auth\.json$/,
		/\.(pem|key|p12|pfx)$/,
		/(^|\/)id_(rsa|ed25519|ecdsa|dsa)(\.pub)?$/,
	];

	// Explicit allows (templates that are safe to write).
	const allowPatterns: RegExp[] = [/\.env\.example$/, /\.env\.sample$/, /\.env\.template$/];

	pi.on("tool_call", async (event, ctx) => {
		if (event.toolName !== "write" && event.toolName !== "edit") return undefined;

		const raw = String(event.input.path ?? "");
		const path = raw.startsWith("~") ? home + raw.slice(1) : raw;

		if (allowPatterns.some((p) => p.test(path))) return undefined;

		const hit =
			protectedSubstrings.some((s) => path.includes(s)) || protectedPatterns.some((p) => p.test(path));

		if (hit) {
			if (ctx.hasUI) ctx.ui.notify(`🔒 Blocked write to protected path: ${raw}`, "warning");
			return { block: true, reason: `Path "${raw}" is protected (secret/credential).` };
		}

		return undefined;
	});
}
