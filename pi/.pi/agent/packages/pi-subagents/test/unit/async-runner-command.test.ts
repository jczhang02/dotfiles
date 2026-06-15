import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isNodeExecutableName, resolveAsyncRunnerCommand } from "../../src/runs/background/async-runner-command.ts";

function spawnProbe(versions: Record<string, string | Error | { status?: number | null; stdout?: string; stderr?: string; error?: Error }>) {
	const calls: Array<{ command: string; args: string[]; options: { encoding: "utf-8"; timeout: number; killSignal: NodeJS.Signals; windowsHide: boolean } }> = [];
	const spawnSync = (command: string, args: string[], options: { encoding: "utf-8"; timeout: number; killSignal: NodeJS.Signals; windowsHide: boolean }) => {
		calls.push({ command, args, options });
		const value = versions[command];
		if (value === undefined) return { status: null, error: new Error("ENOENT") };
		if (value instanceof Error) return { status: null, error: value };
		if (typeof value === "string") return { status: 0, stdout: value };
		return value;
	};
	return { spawnSync, calls };
}

const input = {
	jitiCliPath: "/repo/node_modules/jiti/lib/jiti-cli.mjs",
	runner: "/repo/src/runs/background/subagent-runner.ts",
	cfgPath: "/tmp/async-cfg-run.json",
};

describe("async runner command resolution", () => {
	it("recognizes node executable names", () => {
		assert.equal(isNodeExecutableName("/usr/bin/node"), true);
		assert.equal(isNodeExecutableName("C:/Program Files/nodejs/node.exe"), true);
		assert.equal(isNodeExecutableName("/usr/bin/nodejs"), true);
		assert.equal(isNodeExecutableName("/opt/pi-coding-agent/pi"), false);
	});

	it("uses process.execPath when it is Node", () => {
		const probe = spawnProbe({ "/usr/bin/node": "v22.19.0\n" });
		const result = resolveAsyncRunnerCommand(input, {
			execPath: "/usr/bin/node",
			env: {},
			spawnSync: probe.spawnSync,
		});

		assert.ok("command" in result);
		assert.equal(result.command.command, "/usr/bin/node");
		assert.equal(result.command.source, "process.execPath");
		assert.deepEqual(result.command.args, [input.jitiCliPath, input.runner, input.cfgPath]);
		assert.deepEqual(probe.calls.map((call) => call.command), ["/usr/bin/node"]);
	});

	it("rejects standalone Pi execPath and falls back to PATH node", () => {
		const probe = spawnProbe({ node: "v22.19.0\n" });
		const result = resolveAsyncRunnerCommand(input, {
			execPath: "/opt/pi-coding-agent/pi",
			env: {},
			spawnSync: probe.spawnSync,
		});

		assert.ok("command" in result);
		assert.equal(result.command.command, "node");
		assert.equal(result.command.source, "PATH");
		assert.deepEqual(probe.calls.map((call) => call.command), ["node"]);
	});

	it("prefers PI_SUBAGENTS_NODE over process.execPath", () => {
		const probe = spawnProbe({ "/opt/node/bin/node": "v22.19.0\n" });
		const result = resolveAsyncRunnerCommand(input, {
			execPath: "/usr/bin/node",
			env: { PI_SUBAGENTS_NODE: "/opt/node/bin/node" },
			spawnSync: probe.spawnSync,
		});

		assert.ok("command" in result);
		assert.equal(result.command.command, "/opt/node/bin/node");
		assert.equal(result.command.source, "PI_SUBAGENTS_NODE");
		assert.deepEqual(probe.calls.map((call) => call.command), ["/opt/node/bin/node"]);
	});

	it("prefers PI_SUBAGENTS_ASYNC_NODE over PI_SUBAGENTS_NODE", () => {
		const probe = spawnProbe({ "/async/node": "v22.19.0\n" });
		const result = resolveAsyncRunnerCommand(input, {
			execPath: "/usr/bin/node",
			env: { PI_SUBAGENTS_ASYNC_NODE: "/async/node", PI_SUBAGENTS_NODE: "/opt/node/bin/node" },
			spawnSync: probe.spawnSync,
		});

		assert.ok("command" in result);
		assert.equal(result.command.command, "/async/node");
		assert.equal(result.command.source, "PI_SUBAGENTS_ASYNC_NODE");
	});

	it("returns an actionable error when no Node runtime is available", () => {
		const probe = spawnProbe({});
		const result = resolveAsyncRunnerCommand(input, {
			execPath: "/opt/pi-coding-agent/pi",
			env: {},
			spawnSync: probe.spawnSync,
		});

		assert.ok("error" in result);
		assert.match(result.error, /Node runtime for async runner could not be found/);
		assert.match(result.error, /process\.execPath is not Node/);
		assert.match(result.error, /PI_SUBAGENTS_NODE/);
	});

	it("returns an actionable error for an invalid env override", () => {
		const probe = spawnProbe({ "/bad/node": new Error("ENOENT") });
		const result = resolveAsyncRunnerCommand(input, {
			execPath: "/usr/bin/node",
			env: { PI_SUBAGENTS_NODE: "/bad/node" },
			spawnSync: probe.spawnSync,
		});

		assert.ok("error" in result);
		assert.match(result.error, /PI_SUBAGENTS_NODE did not run as Node/);
		assert.match(result.error, /\/bad\/node/);
	});

	it("uses SIGKILL for runtime probes so bad shims cannot trap SIGTERM and hang the parent", () => {
		const probe = spawnProbe({ "/usr/bin/node": "v22.19.0\n" });
		const result = resolveAsyncRunnerCommand(input, {
			execPath: "/usr/bin/node",
			env: {},
			spawnSync: probe.spawnSync,
		});

		assert.ok("command" in result);
		assert.equal(probe.calls[0]?.options.timeout, 2000);
		assert.equal(probe.calls[0]?.options.killSignal, "SIGKILL");
	});
});
