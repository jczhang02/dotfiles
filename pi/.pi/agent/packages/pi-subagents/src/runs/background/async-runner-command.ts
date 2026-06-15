import { spawnSync } from "node:child_process";
import * as path from "node:path";

export type AsyncRunnerCommandSource = "PI_SUBAGENTS_ASYNC_NODE" | "PI_SUBAGENTS_NODE" | "process.execPath" | "PATH";

export interface AsyncRunnerCommandInput {
	jitiCliPath: string;
	runner: string;
	cfgPath: string;
}

interface ProbeResultLike {
	status?: number | null;
	error?: Error;
	stdout?: string | Buffer | null;
	stderr?: string | Buffer | null;
}

type SpawnSyncLike = (command: string, args: string[], options: { encoding: "utf-8"; timeout: number; killSignal: NodeJS.Signals; windowsHide: boolean }) => ProbeResultLike;

export interface AsyncRunnerCommandDeps {
	execPath?: string;
	env?: NodeJS.ProcessEnv;
	spawnSync?: SpawnSyncLike;
}

export interface AsyncRunnerCommand {
	command: string;
	args: string[];
	runtime: "node";
	source: AsyncRunnerCommandSource;
}

interface NodeCommand {
	command: string;
	source: AsyncRunnerCommandSource;
}

function outputText(value: string | Buffer | null | undefined): string {
	if (!value) return "";
	return Buffer.isBuffer(value) ? value.toString("utf-8") : value;
}

function executableName(command: string): string {
	return path.basename(command).toLowerCase();
}

export function isNodeExecutableName(command: string): boolean {
	const name = executableName(command);
	return name === "node" || name === "node.exe" || name === "nodejs" || name === "nodejs.exe";
}

function probeNode(command: string, spawnSyncImpl: SpawnSyncLike): { ok: true } | { ok: false; reason: string } {
	const result = spawnSyncImpl(command, ["--version"], {
		encoding: "utf-8",
		timeout: 2000,
		killSignal: "SIGKILL",
		windowsHide: true,
	});
	if (result.error) return { ok: false, reason: result.error.message };
	if (result.status !== 0) return { ok: false, reason: `exit status ${result.status ?? "unknown"}` };
	const version = `${outputText(result.stdout)}${outputText(result.stderr)}`.trim();
	if (!/^v\d+\./.test(version)) return { ok: false, reason: version ? `unexpected version output: ${version}` : "missing version output" };
	return { ok: true };
}

function resolveNodeCommand(deps: AsyncRunnerCommandDeps = {}): { node: NodeCommand } | { error: string } {
	const env = deps.env ?? process.env;
	const spawnSyncImpl = deps.spawnSync ?? spawnSync;
	const execPath = deps.execPath ?? process.execPath;
	const diagnostics: string[] = [];

	for (const [source, value] of [
		["PI_SUBAGENTS_ASYNC_NODE", env.PI_SUBAGENTS_ASYNC_NODE],
		["PI_SUBAGENTS_NODE", env.PI_SUBAGENTS_NODE],
	] as const) {
		const command = value?.trim();
		if (!command) continue;
		const probe = probeNode(command, spawnSyncImpl);
		if (probe.ok) return { node: { command, source } };
		return { error: `${source} did not run as Node: ${command} (${probe.reason})` };
	}

	if (isNodeExecutableName(execPath)) {
		const probe = probeNode(execPath, spawnSyncImpl);
		if (probe.ok) return { node: { command: execPath, source: "process.execPath" } };
		diagnostics.push(`process.execPath looked like Node but failed probe: ${execPath} (${probe.reason})`);
	} else {
		diagnostics.push(`process.execPath is not Node: ${execPath}`);
	}

	for (const command of ["node", "nodejs"]) {
		const probe = probeNode(command, spawnSyncImpl);
		if (probe.ok) return { node: { command, source: "PATH" } };
		diagnostics.push(`${command} probe failed: ${probe.reason}`);
	}

	return {
		error: [
			"Node runtime for async runner could not be found.",
			...diagnostics,
			"Install Node or set PI_SUBAGENTS_NODE=/path/to/node.",
		].join(" "),
	};
}

export function resolveAsyncRunnerCommand(input: AsyncRunnerCommandInput, deps: AsyncRunnerCommandDeps = {}): { command: AsyncRunnerCommand } | { error: string } {
	const resolved = resolveNodeCommand(deps);
	if ("error" in resolved) return { error: resolved.error };
	return {
		command: {
			command: resolved.node.command,
			args: [input.jitiCliPath, input.runner, input.cfgPath],
			runtime: "node",
			source: resolved.node.source,
		},
	};
}
