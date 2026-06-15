import { describe, expect, test } from "bun:test";
import { deriveBlocks, detectCycle } from "./task-graph.js";

const task = (id: number, blockedBy: number[] = []) => ({
	id,
	subject: `task ${id}`,
	status: "pending" as const,
	blockedBy,
});

describe("detectCycle", () => {
	test("detects a cycle introduced by new blockedBy edges", () => {
		const tasks = [task(1), task(2, [1]), task(3, [2])];

		expect(detectCycle(tasks, 1, [3])).toBe(true);
	});

	test("allows acyclic dependency additions", () => {
		const tasks = [task(1), task(2, [1]), task(3, [2])];

		expect(detectCycle(tasks, 3, [1])).toBe(false);
	});
});

describe("deriveBlocks", () => {
	test("builds inverse blockedBy adjacency", () => {
		const blocks = deriveBlocks([
			task(1),
			task(2, [1]),
			task(3, [1]),
			task(4, [2, 3]),
		]);

		expect(blocks.get(1)).toEqual([2, 3]);
		expect(blocks.get(2)).toEqual([4]);
		expect(blocks.get(3)).toEqual([4]);
		expect(blocks.has(4)).toBe(false);
	});
});
