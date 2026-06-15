import type { AssistantMessage, Message, ToolCall } from "@earendil-works/pi-ai";

function isToolCallContent(content: AssistantMessage["content"][number]): content is ToolCall {
	return content.type === "toolCall";
}

export function sanitizeToolPairs(messages: Message[]): Message[] {
	const resultIds = new Set(messages.filter((msg) => msg.role === "toolResult").map((msg) => msg.toolCallId));
	const keptToolCallIds = new Set<string>();
	const sanitized: Message[] = [];

	for (const message of messages) {
		if (message.role === "assistant") {
			let removedOrphan = false;
			const content = message.content.filter((part) => {
				if (!isToolCallContent(part)) return true;
				if (!resultIds.has(part.id)) {
					removedOrphan = true;
					return false;
				}
				keptToolCallIds.add(part.id);
				return true;
			});

			if (content.length === 0) continue;
			const hasToolCall = content.some(isToolCallContent);
			sanitized.push(
				removedOrphan && !hasToolCall && message.stopReason === "toolUse"
					? { ...message, content, stopReason: "stop" as const }
					: removedOrphan
						? { ...message, content }
						: message,
			);
			continue;
		}

		if (message.role === "toolResult") {
			if (keptToolCallIds.has(message.toolCallId)) sanitized.push(message);
			continue;
		}

		sanitized.push(message);
	}

	return sanitized;
}
