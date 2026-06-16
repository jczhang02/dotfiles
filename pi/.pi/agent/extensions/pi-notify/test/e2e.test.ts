import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

import piNotify, {
	buildPayload,
	detectDangerousTool,
	isInsideTmux,
	loadConfig,
	normalizeConfig,
	resolveBackend,
	sanitizeTerminalText,
	saveConfig,
	wrapForTmuxPassthrough,
	type NotifyConfig,
} from "../index.ts";

type Handler = (event: any, ctx: any) => Promise<any> | any;

type FakePi = {
	handlers: Map<string, Handler[]>;
	commands: Map<string, { description: string; handler: (args: string, ctx: any) => Promise<void> }>;
	on: (event: string, handler: Handler) => void;
	registerCommand: (name: string, command: any) => void;
};

function createFakePi(): FakePi {
	const handlers = new Map<string, Handler[]>();
	const commands = new Map<string, { description: string; handler: (args: string, ctx: any) => Promise<void> }>();
	return {
		handlers,
		commands,
		on(event, handler) {
			handlers.set(event, [...(handlers.get(event) ?? []), handler]);
		},
		registerCommand(name, command) {
			commands.set(name, command);
		},
	};
}

function tempConfig(config?: Partial<NotifyConfig>) {
	const dir = mkdtempSync(join(tmpdir(), "pi-notify-e2e-"));
	const path = join(dir, "config.json");
	if (config) saveConfig(normalizeConfig(config), path);
	return {
		dir,
		path,
		cleanup: () => rmSync(dir, { recursive: true, force: true }),
	};
}

function createCtx(cwd = "/tmp/example-project") {
	const uiCalls: Array<{ method: string; args: unknown[] }> = [];
	return {
		ctx: {
			cwd,
			hasUI: true,
			isIdle: () => true,
			hasPendingMessages: () => false,
			ui: {
				notify: (...args: unknown[]) => uiCalls.push({ method: "notify", args }),
				setStatus: (...args: unknown[]) => uiCalls.push({ method: "setStatus", args }),
			},
		},
		uiCalls,
	};
}

async function emit(pi: FakePi, event: string, payload: any, ctx: any) {
	for (const handler of pi.handlers.get(event) ?? []) await handler(payload, ctx);
}

async function runScheduledNow(callback: () => void | Promise<void>) {
	await callback();
}

const normalAgentEnd = { messages: [{ role: "assistant", stopReason: "stop" }] };
const errorAgentEnd = { messages: [{ role: "assistant", stopReason: "error", errorMessage: "failed" }] };

test("config defaults and invalid config are safe", () => {
	const t = tempConfig();
	try {
		assert.equal(loadConfig(t.path).enabled, true);
		writeFileSync(t.path, "{bad json", "utf8");
		const cfg = loadConfig(t.path);
		assert.equal(cfg.backend, "auto");
		assert.equal(cfg.notifyOnAgentEnd, true);
		assert.equal(cfg.notifyOnDangerousTool, false);
		assert.equal(cfg.notifyOnToolError, false);
		assert.equal(cfg.notifyOnCompaction, false);
		assert.equal(normalizeConfig({ backend: "bogus", quietSeconds: -1 }).backend, "auto");
		assert.equal(normalizeConfig({ backend: "bogus", quietSeconds: -1 }).quietSeconds, 0);
		assert.equal(normalizeConfig({ historyEnabled: "yes", historyMaxEntries: -1 }).historyEnabled, false);
		assert.equal(normalizeConfig({ historyMaxEntries: -1 }).historyMaxEntries, 1);
	} finally {
		t.cleanup();
	}
});

test("backend resolution covers common terminals and OSes", () => {
	assert.equal(resolveBackend("osc777", {}, "linux"), "osc777");
	assert.equal(resolveBackend("auto", { KITTY_WINDOW_ID: "1" }, "linux"), "osc99");
	assert.equal(resolveBackend("auto", { TERM_PROGRAM: "iTerm.app" }, "darwin"), "osc777");
	assert.equal(resolveBackend("auto", {}, "darwin"), "osascript");
	assert.equal(resolveBackend("auto", {}, "linux"), "notify-send");
	assert.equal(resolveBackend("auto", {}, "win32"), "powershell");
});

test("tmux passthrough wraps terminal OSC sequences", () => {
	const raw = "\x1b]777;notify;Title;Body\x07";
	assert.equal(isInsideTmux({ TMUX: "/tmp/tmux-1000/default,1,0" }), true);
	assert.equal(isInsideTmux({ TERM_PROGRAM: "tmux" }), true);
	assert.equal(isInsideTmux({ TERM: "tmux-256color" }), true);
	assert.equal(isInsideTmux({ TERM_PROGRAM: "Ghostty" }), false);
	assert.equal(wrapForTmuxPassthrough(raw), "\x1bPtmux;\x1b\x1b]777;notify;Title;Body\x07\x1b\\");
});

test("terminal text sanitizer removes OSC-breaking characters", () => {
	assert.equal(sanitizeTerminalText("Title;with\nfields\x1b]777;bad\x07"), "Title：with fields]777：bad");
	assert.equal(sanitizeTerminalText("\x1b\x07\n"), " ");
});

test("payloads include project name and full path", () => {
	const payload = buildPayload("done", "/home/me/work/my-app", "Agent stopped");
	assert.equal(payload.title, "Pi needs input - my-app");
	assert.match(payload.body, /Project: my-app \(\/home\/me\/work\/my-app\)/);
});

test("danger detector covers bash and mutation tools", () => {
	assert.match(detectDangerousTool("bash", { command: "rm -rf ./dist" }) ?? "", /Bash:/);
	assert.match(detectDangerousTool("bash", { command: "sudo apt update" }) ?? "", /sudo/);
	assert.equal(detectDangerousTool("bash", { command: "ls -la" }), null);
	assert.match(detectDangerousTool("write", { path: "src/a.ts" }) ?? "", /src\/a.ts/);
	assert.match(detectDangerousTool("edit", { file_path: "src/b.ts" }) ?? "", /src\/b.ts/);
	assert.equal(
		detectDangerousTool("multi_tool_use.parallel", {
			tool_uses: [{ recipient_name: "functions.read", parameters: { path: "src/a.ts" } }],
		}),
		null,
	);
	assert.match(
		detectDangerousTool("multi_tool_use.parallel", {
			tool_uses: [{ recipient_name: "functions.write", parameters: { path: "src/a.ts" } }],
		}) ?? "",
		/parallel: write: src\/a.ts/,
	);
});

test("extension registers global events and command", () => {
	const t = tempConfig({ backend: "osc777" });
	try {
		const pi = createFakePi();
		piNotify(pi as any, { configPath: t.path });
		for (const event of ["session_start", "agent_start", "agent_end", "tool_call", "tool_result", "session_compact"]) {
			assert.equal(pi.handlers.has(event), true, event);
		}
		assert.equal(pi.commands.has("notify"), true);
	} finally {
		t.cleanup();
	}
});

test("session_start sets status and agent_end sends one needs-input notification", async () => {
	const t = tempConfig({ backend: "osc777", quietSeconds: 10, sound: false });
	const stdout: string[] = [];
	let clock = 100_000;
	try {
		const pi = createFakePi();
		piNotify(pi as any, {
			configPath: t.path,
			writeStdout: (text) => stdout.push(text),
			now: () => clock,
			schedule: runScheduledNow,
			env: {},
		});
		const { ctx, uiCalls } = createCtx();

		await emit(pi, "session_start", {}, ctx);
		assert.deepEqual(uiCalls[0], { method: "setStatus", args: ["pi-notify", "notify:on"] });

		await emit(pi, "agent_start", {}, ctx);
		await emit(pi, "agent_end", normalAgentEnd, ctx);
		await emit(pi, "agent_end", normalAgentEnd, ctx);
		assert.equal(stdout.length, 1);
		assert.match(stdout[0], /\x1b\]777;notify;Pi needs input - example-project;Agent stopped\. Review result or send next instruction\./);

		clock += 11_000;
		await emit(pi, "agent_end", normalAgentEnd, ctx);
		assert.equal(stdout.length, 1);
	} finally {
		t.cleanup();
	}
});

test("each agent run can notify even inside quiet window", async () => {
	const t = tempConfig({ backend: "osc777", quietSeconds: 60, sound: false });
	const stdout: string[] = [];
	let clock = 100_000;
	try {
		const pi = createFakePi();
		piNotify(pi as any, { configPath: t.path, writeStdout: (text) => stdout.push(text), now: () => clock, schedule: runScheduledNow, env: {} });
		const { ctx } = createCtx();

		await emit(pi, "agent_start", {}, ctx);
		await emit(pi, "agent_end", normalAgentEnd, ctx);
		clock += 1000;
		await emit(pi, "agent_start", {}, ctx);
		await emit(pi, "agent_end", normalAgentEnd, ctx);

		assert.equal(stdout.length, 2);
		assert.match(stdout[0], /Pi needs input - example-project/);
		assert.match(stdout[1], /Pi needs input - example-project/);
	} finally {
		t.cleanup();
	}
});

test("agent_end tolerates missing messages and readiness helpers", async () => {
	const t = tempConfig({ backend: "osc777", quietSeconds: 0, sound: false });
	const stdout: string[] = [];
	try {
		const pi = createFakePi();
		piNotify(pi as any, { configPath: t.path, writeStdout: (text) => stdout.push(text), schedule: runScheduledNow, env: {} });
		const { ctx } = createCtx();
		const minimalCtx = { cwd: ctx.cwd, hasUI: ctx.hasUI, ui: ctx.ui };

		await emit(pi, "agent_start", {}, minimalCtx);
		await emit(pi, "agent_end", {}, minimalCtx);

		assert.equal(stdout.length, 1);
		assert.match(stdout[0], /Pi needs input - example-project/);
	} finally {
		t.cleanup();
	}
});

test("stale delayed agent_end callback cannot notify after a new run starts", async () => {
	const t = tempConfig({ backend: "osc777", quietSeconds: 0, sound: false });
	const stdout: string[] = [];
	const scheduled: Array<() => void | Promise<void>> = [];
	try {
		const pi = createFakePi();
		piNotify(pi as any, {
			configPath: t.path,
			writeStdout: (text) => stdout.push(text),
			schedule: (callback) => scheduled.push(callback),
			env: {},
		});
		const { ctx } = createCtx();

		await emit(pi, "agent_start", {}, ctx);
		await emit(pi, "agent_end", normalAgentEnd, ctx);
		await emit(pi, "agent_start", {}, ctx);
		await emit(pi, "agent_end", normalAgentEnd, ctx);

		assert.equal(scheduled.length, 2);
		await scheduled[0]!();
		assert.equal(stdout.length, 0);
		await scheduled[1]!();
		assert.equal(stdout.length, 1);
	} finally {
		t.cleanup();
	}
});

test("multiple delayed callbacks for one run still notify once", async () => {
	const t = tempConfig({ backend: "osc777", quietSeconds: 0, sound: false });
	const stdout: string[] = [];
	const scheduled: Array<() => void | Promise<void>> = [];
	try {
		const pi = createFakePi();
		piNotify(pi as any, {
			configPath: t.path,
			writeStdout: (text) => stdout.push(text),
			schedule: (callback) => scheduled.push(callback),
			env: {},
		});
		const { ctx } = createCtx();

		await emit(pi, "agent_start", {}, ctx);
		await emit(pi, "agent_end", normalAgentEnd, ctx);
		await emit(pi, "agent_end", normalAgentEnd, ctx);

		assert.equal(scheduled.length, 2);
		await Promise.all(scheduled.map((callback) => callback()));
		assert.equal(stdout.length, 1);
	} finally {
		t.cleanup();
	}
});

test("scheduled retry is canceled when a new run starts", async () => {
	const t = tempConfig({ backend: "osc777", quietSeconds: 0, sound: false });
	const stdout: string[] = [];
	const scheduled: Array<() => void | Promise<void>> = [];
	let idle = false;
	try {
		const pi = createFakePi();
		piNotify(pi as any, {
			configPath: t.path,
			writeStdout: (text) => stdout.push(text),
			schedule: (callback) => scheduled.push(callback),
			env: {},
		});
		const { ctx } = createCtx();
		const settlingCtx = { ...ctx, isIdle: () => idle };

		await emit(pi, "agent_start", {}, settlingCtx);
		await emit(pi, "agent_end", normalAgentEnd, settlingCtx);
		await scheduled[0]!();
		assert.equal(scheduled.length, 2);

		await emit(pi, "agent_start", {}, ctx);
		idle = true;
		await scheduled[1]!();
		assert.equal(stdout.length, 0);

		await emit(pi, "agent_end", normalAgentEnd, ctx);
		await scheduled[2]!();
		assert.equal(stdout.length, 1);
	} finally {
		t.cleanup();
	}
});

test("scheduled notification respects config disabled before callback", async () => {
	const t = tempConfig({ backend: "osc777", quietSeconds: 0, sound: false });
	const stdout: string[] = [];
	const scheduled: Array<() => void | Promise<void>> = [];
	try {
		const pi = createFakePi();
		piNotify(pi as any, {
			configPath: t.path,
			writeStdout: (text) => stdout.push(text),
			schedule: (callback) => scheduled.push(callback),
			env: {},
		});
		const { ctx } = createCtx();

		await emit(pi, "agent_start", {}, ctx);
		await emit(pi, "agent_end", normalAgentEnd, ctx);
		saveConfig(normalizeConfig({ backend: "osc777", quietSeconds: 0, notifyOnAgentEnd: false, sound: false }), t.path);
		await scheduled[0]!();
		assert.equal(stdout.length, 0);
	} finally {
		t.cleanup();
	}
});

test("local history writes action-required notifications only", async () => {
	const t = tempConfig({
		backend: "osc777",
		quietSeconds: 0,
		sound: false,
		historyEnabled: true,
		historyPath: join(mkdtempSync(join(tmpdir(), "pi-notify-history-")), "history.jsonl"),
		historyMaxEntries: 2,
	});
	const stdout: string[] = [];
	let clock = 100_000;
	try {
		const pi = createFakePi();
		piNotify(pi as any, { configPath: t.path, writeStdout: (text) => stdout.push(text), now: () => clock, schedule: runScheduledNow, env: {} });
		const { ctx } = createCtx();

		await emit(pi, "agent_start", {}, ctx);
		await emit(pi, "agent_end", normalAgentEnd, ctx);
		clock += 1000;
		await emit(pi, "session_compact", {}, ctx);
		clock += 1000;
		await emit(pi, "tool_call", { toolName: "bash", input: { command: "sudo true" } }, ctx);

		const cfg = loadConfig(t.path);
		const lines = readFileSync(cfg.historyPath, "utf8").trim().split("\n");
		assert.equal(lines.length, 1);
		const records = lines.map((line) => JSON.parse(line));
		assert.equal(records[0].kind, "done");
		assert.equal(records[0].backend, "osc777");
		assert.match(records[0].body, /Agent stopped/);
	} finally {
		rmSync(dirname(loadConfig(t.path).historyPath), { recursive: true, force: true });
		t.cleanup();
	}
});

test("tool calls, intermediate tool errors, and compaction do not notify directly", async () => {
	const t = tempConfig({ backend: "osc99", quietSeconds: 0, notifyOnToolError: true, sound: false });
	const stdout: string[] = [];
	try {
		const pi = createFakePi();
		piNotify(pi as any, { configPath: t.path, writeStdout: (text) => stdout.push(text), env: {} });
		const { ctx } = createCtx();

		await emit(pi, "tool_call", { toolName: "bash", input: { command: "sudo rm -rf /tmp/x" } }, ctx);
		await emit(pi, "tool_result", { toolName: "bash", isError: true }, ctx);
		await emit(pi, "session_compact", {}, ctx);

		assert.equal(stdout.length, 0);
	} finally {
		t.cleanup();
	}
});

test("legacy event flags do not re-enable direct tool or compaction popups", async () => {
	const t = tempConfig({
		backend: "osc777",
		quietSeconds: 0,
		notifyOnDangerousTool: true,
		notifyOnToolError: true,
		notifyOnCompaction: true,
		sound: false,
	});
	const stdout: string[] = [];
	try {
		const pi = createFakePi();
		piNotify(pi as any, { configPath: t.path, writeStdout: (text) => stdout.push(text), schedule: runScheduledNow, env: {} });
		const { ctx } = createCtx();

		await emit(pi, "tool_call", { toolName: "bash", input: { command: "sudo rm -rf /tmp/x" } }, ctx);
		await emit(pi, "tool_call", { toolName: "write", input: { path: "src/a.ts" } }, ctx);
		await emit(pi, "tool_result", { toolName: "bash", isError: true }, ctx);
		await emit(pi, "session_compact", {}, ctx);
		assert.equal(stdout.length, 0);

		await emit(pi, "agent_start", {}, ctx);
		await emit(pi, "agent_end", normalAgentEnd, ctx);
		assert.equal(stdout.length, 1);
	} finally {
		t.cleanup();
	}
});

test("tool error only notifies when final agent state needs attention", async () => {
	const t = tempConfig({ backend: "osc777", quietSeconds: 0, sound: false });
	const stdout: string[] = [];
	try {
		const pi = createFakePi();
		piNotify(pi as any, { configPath: t.path, writeStdout: (text) => stdout.push(text), schedule: runScheduledNow, env: {} });
		const { ctx } = createCtx();

		await emit(pi, "agent_start", {}, ctx);
		await emit(pi, "tool_result", { toolName: "bash", isError: true }, ctx);
		await emit(pi, "agent_end", normalAgentEnd, ctx);
		assert.equal(stdout.length, 1);
		assert.match(stdout[0], /Pi needs input - example-project/);

		await emit(pi, "agent_start", {}, ctx);
		await emit(pi, "tool_result", { toolName: "bash", isError: true }, ctx);
		await emit(pi, "agent_end", errorAgentEnd, ctx);
		assert.equal(stdout.length, 2);
		assert.match(stdout[1], /Pi needs attention - example-project/);
		assert.match(stdout[1], /Agent stopped after a tool error/);
	} finally {
		t.cleanup();
	}
});

test("final assistant error without tool error sends generic attention notification", async () => {
	const t = tempConfig({ backend: "osc777", quietSeconds: 0, sound: false });
	const stdout: string[] = [];
	try {
		const pi = createFakePi();
		piNotify(pi as any, { configPath: t.path, writeStdout: (text) => stdout.push(text), schedule: runScheduledNow, env: {} });
		const { ctx } = createCtx();

		await emit(pi, "agent_start", {}, ctx);
		await emit(pi, "agent_end", errorAgentEnd, ctx);

		assert.equal(stdout.length, 1);
		assert.match(stdout[0], /Pi needs attention - example-project/);
		assert.match(stdout[0], /Agent stopped after an error/);
	} finally {
		t.cleanup();
	}
});

test("osc backends use tmux DCS passthrough inside tmux", async () => {
	for (const backend of ["osc777", "osc99"] as const) {
		const t = tempConfig({ backend, quietSeconds: 0, sound: false });
		const stdout: string[] = [];
		try {
			const pi = createFakePi();
			piNotify(pi as any, {
				configPath: t.path,
				writeStdout: (text) => stdout.push(text),
				schedule: runScheduledNow,
				env: { TMUX: "/tmp/tmux-1000/default,1,0", TERM_PROGRAM: "tmux", GHOSTTY_RESOURCES_DIR: "/usr/share/ghostty" },
			});
			const { ctx } = createCtx("/tmp/example;project");
			await emit(pi, "agent_start", {}, ctx);
			await emit(pi, "agent_end", normalAgentEnd, ctx);
			assert.ok(stdout.every((text) => text.startsWith("\x1bPtmux;\x1b\x1b]")), backend);
			assert.ok(stdout.every((text) => text.endsWith("\x1b\\")), backend);
			assert.equal(stdout.join("").includes(";project"), false, backend);
			assert.match(stdout.join(""), backend === "osc777" ? /\]777;notify;/ : /\]99;/);
		} finally {
			t.cleanup();
		}
	}
});

test("agent_end retries until idle with no pending messages before notifying", async () => {
	const t = tempConfig({ backend: "osc777", quietSeconds: 0, sound: false });
	const stdout: string[] = [];
	const scheduled: Array<() => void | Promise<void>> = [];
	let idle = false;
	let pending = true;
	try {
		const pi = createFakePi();
		piNotify(pi as any, {
			configPath: t.path,
			writeStdout: (text) => stdout.push(text),
			schedule: (callback) => scheduled.push(callback),
			env: {},
		});
		const { ctx } = createCtx();
		const settlingCtx = { ...ctx, isIdle: () => idle, hasPendingMessages: () => pending };

		await emit(pi, "agent_start", {}, settlingCtx);
		await emit(pi, "agent_end", normalAgentEnd, settlingCtx);
		assert.equal(scheduled.length, 1);

		await scheduled[0]!();
		assert.equal(stdout.length, 0);
		assert.equal(scheduled.length, 2);

		idle = true;
		pending = false;
		await scheduled[1]!();
		assert.equal(stdout.length, 1);
	} finally {
		t.cleanup();
	}
});

test("agent_end retries after readiness helper throws", async () => {
	const t = tempConfig({ backend: "osc777", quietSeconds: 0, sound: false });
	const stdout: string[] = [];
	const scheduled: Array<() => void | Promise<void>> = [];
	let calls = 0;
	try {
		const pi = createFakePi();
		piNotify(pi as any, {
			configPath: t.path,
			writeStdout: (text) => stdout.push(text),
			schedule: (callback) => scheduled.push(callback),
			env: {},
		});
		const { ctx } = createCtx();
		const flakyCtx = {
			...ctx,
			isIdle: () => {
				calls++;
				if (calls === 1) throw new Error("not ready yet");
				return true;
			},
		};

		await emit(pi, "agent_start", {}, flakyCtx);
		await emit(pi, "agent_end", normalAgentEnd, flakyCtx);
		await scheduled[0]!();
		assert.equal(stdout.length, 0);
		await scheduled[1]!();
		assert.equal(stdout.length, 1);
	} finally {
		t.cleanup();
	}
});

test("disabled config suppresses event notifications", async () => {
	const t = tempConfig({ enabled: false, backend: "osc777", quietSeconds: 0 });
	const stdout: string[] = [];
	try {
		const pi = createFakePi();
		piNotify(pi as any, { configPath: t.path, writeStdout: (text) => stdout.push(text), schedule: runScheduledNow });
		const { ctx } = createCtx();
		await emit(pi, "agent_start", {}, ctx);
		await emit(pi, "agent_end", normalAgentEnd, ctx);
		assert.equal(stdout.length, 0);
	} finally {
		t.cleanup();
	}
});

test("event handlers use latest config flags", async () => {
	const t = tempConfig({ backend: "osc777", quietSeconds: 0, notifyOnAgentEnd: false, sound: false });
	const stdout: string[] = [];
	try {
		const pi = createFakePi();
		piNotify(pi as any, { configPath: t.path, writeStdout: (text) => stdout.push(text), schedule: runScheduledNow, env: {} });
		const { ctx } = createCtx();

		await emit(pi, "agent_start", {}, ctx);
		await emit(pi, "agent_end", normalAgentEnd, ctx);
		assert.equal(stdout.length, 0);

		saveConfig(normalizeConfig({ backend: "osc777", quietSeconds: 0, notifyOnAgentEnd: true, sound: false }), t.path);
		await emit(pi, "agent_end", normalAgentEnd, ctx);
		assert.equal(stdout.length, 1);

		saveConfig(normalizeConfig({ backend: "osc777", quietSeconds: 0, notifyOnAgentEnd: false, sound: false }), t.path);
		await emit(pi, "agent_end", normalAgentEnd, ctx);
		assert.equal(stdout.length, 1);
	} finally {
		t.cleanup();
	}
});

test("failed native notification does not consume dedupe window", async () => {
	const t = tempConfig({ backend: "notify-send", quietSeconds: 10 });
	let attempts = 0;
	try {
		const pi = createFakePi();
		piNotify(pi as any, {
			configPath: t.path,
			schedule: runScheduledNow,
			execFile: async () => {
				attempts++;
				throw new Error("missing notifier");
			},
			now: () => 100_000,
		});
		const { ctx } = createCtx();

		await emit(pi, "agent_start", {}, ctx);
		await emit(pi, "agent_end", normalAgentEnd, ctx);
		await emit(pi, "agent_end", normalAgentEnd, ctx);
		assert.equal(attempts, 2);
	} finally {
		t.cleanup();
	}
});

test("notify command covers status, test, backend, disable, enable, events", async () => {
	const t = tempConfig({ backend: "ui", quietSeconds: 0, sound: false });
	try {
		const pi = createFakePi();
		piNotify(pi as any, { configPath: t.path });
		const command = pi.commands.get("notify");
		assert.ok(command);
		const historyPath = join(t.dir, "command-history.jsonl");

		const { ctx, uiCalls } = createCtx();
		await command.handler("status", ctx);
		await command.handler("events", ctx);
		await command.handler("events action_required off", ctx);
		await command.handler("events nope on", ctx);
		await command.handler("history", ctx);
		await command.handler("history on", ctx);
		await command.handler(`history path ${historyPath}`, ctx);
		await command.handler("history max 3", ctx);
		await command.handler("history clear", ctx);
		await command.handler("history nope", ctx);
		await command.handler("test", ctx);
		await command.handler("sound on", ctx);
		await command.handler("sound nope", ctx);
		await command.handler("backend osc777", ctx);
		await command.handler("disable", ctx);
		await command.handler("enable", ctx);
		await command.handler("backend nope", ctx);

		const messages = uiCalls.filter((c) => c.method === "notify").map((c) => String(c.args[0]));
		assert.ok(messages.some((m) => m.includes("backend: ui -> ui")));
		assert.ok(messages.some((m) => m.includes("action_required=true")));
		assert.ok(messages.some((m) => m.includes("Pi notify test - example-project")));
		assert.ok(messages.some((m) => m.includes("Pi notify event action_required = false")));
		assert.ok(messages.some((m) => m.includes("Invalid events command")));
		assert.ok(messages.some((m) => m.includes("maxEntries: 200")));
		assert.ok(messages.some((m) => m.includes("Pi notify history = true")));
		assert.ok(messages.some((m) => m.includes(`Pi notify history path = ${historyPath}`)));
		assert.ok(messages.some((m) => m.includes("Pi notify history max = 3")));
		assert.ok(messages.some((m) => m.includes(`Pi notify history cleared: ${historyPath}`)));
		assert.ok(messages.some((m) => m.includes("Invalid history command")));
		assert.ok(messages.some((m) => m.includes("Pi notify sound = true")));
		assert.ok(messages.some((m) => m.includes("Invalid sound command")));
		assert.ok(messages.some((m) => m.includes("Pi notify backend = osc777")));
		assert.ok(messages.some((m) => m.includes("Pi notify disabled")));
		assert.ok(messages.some((m) => m.includes("Pi notify enabled")));
		assert.ok(messages.some((m) => m.includes("Invalid backend")));

		const saved = JSON.parse(readFileSync(t.path, "utf8"));
		assert.equal(saved.enabled, true);
		assert.equal(saved.backend, "osc777");
		assert.equal(saved.historyEnabled, true);
		assert.equal(saved.historyPath, historyPath);
		assert.equal(saved.historyMaxEntries, 3);
		assert.equal(saved.notifyOnAgentEnd, false);
		assert.equal(saved.sound, true);
	} finally {
		t.cleanup();
	}
});

test("notify events agent_end alias toggles action-required notifications", async () => {
	const t = tempConfig({ backend: "osc777", quietSeconds: 0, sound: false });
	const stdout: string[] = [];
	try {
		const pi = createFakePi();
		piNotify(pi as any, { configPath: t.path, writeStdout: (text) => stdout.push(text), schedule: runScheduledNow, env: {} });
		const command = pi.commands.get("notify");
		assert.ok(command);
		const { ctx } = createCtx();

		await command.handler("events agent_end off", ctx);
		await emit(pi, "agent_start", {}, ctx);
		await emit(pi, "agent_end", normalAgentEnd, ctx);
		assert.equal(stdout.length, 0);

		await command.handler("events agent_end on", ctx);
		await emit(pi, "agent_start", {}, ctx);
		await emit(pi, "agent_end", normalAgentEnd, ctx);
		assert.equal(stdout.length, 1);
	} finally {
		t.cleanup();
	}
});

test("notify status has headless output fallback", async () => {
	const t = tempConfig({ backend: "ui", quietSeconds: 0 });
	const stdout: string[] = [];
	try {
		const pi = createFakePi();
		piNotify(pi as any, { configPath: t.path, writeStdout: (text) => stdout.push(text) });
		const command = pi.commands.get("notify");
		assert.ok(command);

		await command.handler("status", { ...createCtx().ctx, hasUI: false });
		assert.match(stdout.join(""), /backend: ui -> ui/);
	} finally {
		t.cleanup();
	}
});

test("notify test reports not sent when headless ui backend cannot deliver", async () => {
	const t = tempConfig({ backend: "ui", quietSeconds: 0 });
	const stdout: string[] = [];
	try {
		const pi = createFakePi();
		piNotify(pi as any, { configPath: t.path, writeStdout: (text) => stdout.push(text) });
		const command = pi.commands.get("notify");
		assert.ok(command);

		await command.handler("test", { ...createCtx().ctx, hasUI: false });
		assert.match(stdout.join(""), /Pi notify test not sent/);
	} finally {
		t.cleanup();
	}
});

test("linux sound uses canberra after successful notification", async () => {
	const t = tempConfig({ backend: "osc777", quietSeconds: 0, sound: true });
	const stdout: string[] = [];
	const calls: Array<{ file: string; args: string[]; timeout?: number }> = [];
	try {
		const pi = createFakePi();
		piNotify(pi as any, {
			configPath: t.path,
			platform: "linux",
			writeStdout: (text) => stdout.push(text),
			schedule: runScheduledNow,
			execFile: async (file, args, options) => {
				calls.push({ file, args, timeout: options?.timeout });
			},
		});
		const { ctx } = createCtx();
		await emit(pi, "agent_start", {}, ctx);
		await emit(pi, "agent_end", normalAgentEnd, ctx);
		assert.match(stdout[0], /\x1b\]777;notify;Pi needs input - example-project/);
		assert.deepEqual(calls, [
			{ file: "canberra-gtk-play", args: ["--id=message-new-instant", "--description=Pi notification"], timeout: 2000 },
		]);
	} finally {
		t.cleanup();
	}
});

test("canberra failure does not fail notification", async () => {
	const t = tempConfig({ backend: "osc777", quietSeconds: 0, sound: true });
	const stdout: string[] = [];
	try {
		const pi = createFakePi();
		piNotify(pi as any, {
			configPath: t.path,
			platform: "linux",
			writeStdout: (text) => stdout.push(text),
			schedule: runScheduledNow,
			execFile: async () => {
				throw new Error("missing canberra");
			},
		});
		const { ctx } = createCtx();
		await emit(pi, "agent_start", {}, ctx);
		await emit(pi, "agent_end", normalAgentEnd, ctx);
		assert.equal(stdout.length, 1);
	} finally {
		t.cleanup();
	}
});

test("native exec backends use execFile args, not shell strings", async () => {
	for (const [backend, expectedFile, os] of [
		["notify-send", "notify-send", "linux"],
		["osascript", "osascript", "darwin"],
		["powershell", "powershell", "win32"],
	] as const) {
		const t = tempConfig({ backend, quietSeconds: 0 });
		const calls: Array<{ file: string; args: string[] }> = [];
		try {
			const pi = createFakePi();
			piNotify(pi as any, {
				configPath: t.path,
				platform: os,
				schedule: runScheduledNow,
				execFile: async (file, args) => {
					calls.push({ file, args });
				},
			});
			const { ctx } = createCtx();
			await emit(pi, "agent_start", {}, ctx);
			await emit(pi, "agent_end", normalAgentEnd, ctx);
			assert.equal(calls[0]?.file, expectedFile);
			assert.ok(calls[0]?.args.join("\n").includes("Pi needs input - example-project"));
			assert.ok(calls[0]?.args.join("\n").includes("Project: example-project"));
			if (os === "linux") assert.equal(calls[1]?.file, "canberra-gtk-play");
		} finally {
			t.cleanup();
		}
	}
});
