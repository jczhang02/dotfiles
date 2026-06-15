import { describe, expect, test } from "bun:test";
import type { AssistantMessage, Message, ToolCall, ToolResultMessage, Usage } from "@earendil-works/pi-ai";
import { sanitizeToolPairs } from "./tool-pairs.ts";

const usage: Usage = {
	input: 0,
	output: 0,
	cacheRead: 0,
	cacheWrite: 0,
	totalTokens: 0,
	cost: {
		input: 0,
		output: 0,
		cacheRead: 0,
		cacheWrite: 0,
		total: 0,
	},
};

function toolCall(id: string): ToolCall {
	return {
		type: "toolCall",
		id,
		name: "read",
		arguments: { path: "README.md" },
	};
}

function assistant(content: AssistantMessage["content"], stopReason: AssistantMessage["stopReason"]): AssistantMessage {
	return {
		role: "assistant",
		content,
		api: "anthropic-messages",
		provider: "anthropic",
		model: "claude-sonnet-4",
		usage,
		stopReason,
		timestamp: 0,
	};
}

function toolResult(toolCallId: string): ToolResultMessage {
	return {
		role: "toolResult",
		toolCallId,
		toolName: "read",
		content: [{ type: "text", text: "file contents" }],
		isError: false,
		timestamp: 1,
	};
}

describe("sanitizeToolPairs", () => {
	test("drops orphaned assistant tool calls before side prompt conversion", () => {
		const messages: Message[] = [
			assistant(
				[
					{ type: "text", text: "I'll inspect that." },
					toolCall("call-1"),
				],
				"toolUse",
			),
		];

		const sanitized = sanitizeToolPairs(messages);

		expect(sanitized).toHaveLength(1);
		expect(sanitized[0]?.role).toBe("assistant");
		if (sanitized[0]?.role !== "assistant") throw new Error("expected assistant");
		expect(sanitized[0].stopReason).toBe("stop");
		expect(sanitized[0].content).toEqual([{ type: "text", text: "I'll inspect that." }]);
	});

	test("keeps matched assistant tool calls and tool results", () => {
		const messages: Message[] = [assistant([toolCall("call-1")], "toolUse"), toolResult("call-1")];

		const sanitized = sanitizeToolPairs(messages);

		expect(sanitized).toHaveLength(2);
		expect(sanitized[0]).toBe(messages[0]);
		expect(sanitized[1]).toBe(messages[1]);
	});

	test("drops tool results when matching tool call was not kept", () => {
		const messages: Message[] = [toolResult("missing-call")];

		expect(sanitizeToolPairs(messages)).toEqual([]);
	});
});
