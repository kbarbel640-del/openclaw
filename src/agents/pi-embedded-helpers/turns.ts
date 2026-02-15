import type { AgentMessage } from "@mariozechner/pi-agent-core";

/**
 * Validates and fixes conversation turn sequences for Gemini API.
 * Gemini requires strict alternating user→assistant→tool→user pattern.
 * Merges consecutive assistant messages together.
 */
export function validateGeminiTurns(messages: AgentMessage[]): AgentMessage[] {
  if (!Array.isArray(messages) || messages.length === 0) {
    return messages;
  }

  const result: AgentMessage[] = [];
  let lastRole: string | undefined;

  for (const msg of messages) {
    if (!msg || typeof msg !== "object") {
      result.push(msg);
      continue;
    }

    const msgRole = (msg as { role?: unknown }).role as string | undefined;
    if (!msgRole) {
      result.push(msg);
      continue;
    }

    if (msgRole === lastRole && lastRole === "assistant") {
      const lastMsg = result[result.length - 1];
      const currentMsg = msg as Extract<AgentMessage, { role: "assistant" }>;

      if (lastMsg && typeof lastMsg === "object") {
        const lastAsst = lastMsg as Extract<AgentMessage, { role: "assistant" }>;
        const mergedContent = [
          ...(Array.isArray(lastAsst.content) ? lastAsst.content : []),
          ...(Array.isArray(currentMsg.content) ? currentMsg.content : []),
        ];

        const merged: Extract<AgentMessage, { role: "assistant" }> = {
          ...lastAsst,
          content: mergedContent,
          ...(currentMsg.usage && { usage: currentMsg.usage }),
          ...(currentMsg.stopReason && { stopReason: currentMsg.stopReason }),
          ...(currentMsg.errorMessage && {
            errorMessage: currentMsg.errorMessage,
          }),
        };

        result[result.length - 1] = merged;
        continue;
      }
    }

    result.push(msg);
    lastRole = msgRole;
  }

  return result;
}

export function mergeConsecutiveUserTurns(
  previous: Extract<AgentMessage, { role: "user" }>,
  current: Extract<AgentMessage, { role: "user" }>,
): Extract<AgentMessage, { role: "user" }> {
  const mergedContent = [
    ...(Array.isArray(previous.content) ? previous.content : []),
    ...(Array.isArray(current.content) ? current.content : []),
  ];

  return {
    ...current,
    content: mergedContent,
    timestamp: current.timestamp ?? previous.timestamp,
  };
}

/**
 * Validates and fixes conversation turn sequences for Anthropic API.
 * Anthropic requires strict alternating user→assistant pattern.
 * Merges consecutive user messages together.
 * Also handles system messages which can appear consecutively in subagent contexts.
 */
export function validateAnthropicTurns(messages: AgentMessage[]): AgentMessage[] {
  if (!Array.isArray(messages) || messages.length === 0) {
    return messages;
  }

  const result: AgentMessage[] = [];
  let lastRole: string | undefined;

  for (const msg of messages) {
    if (!msg || typeof msg !== "object") {
      result.push(msg);
      continue;
    }

    const msgRole = (msg as { role?: unknown }).role as string | undefined;
    if (!msgRole) {
      result.push(msg);
      continue;
    }

    // Merge consecutive messages of same role (user, assistant, or system)
    // System messages can appear consecutively in subagent contexts
    if (msgRole === lastRole) {
      const lastMsg = result[result.length - 1];
      
      if (lastMsg && typeof lastMsg === "object" && lastRole === "user") {
        const lastUser = lastMsg as Extract<AgentMessage, { role: "user" }>;
        const currentMsg = msg as Extract<AgentMessage, { role: "user" }>;
        const merged = mergeConsecutiveUserTurns(lastUser, currentMsg);
        result[result.length - 1] = merged;
        continue;
      }
      
      if (lastMsg && typeof lastMsg === "object" && lastRole === "system") {
        // Merge consecutive system messages (common in subagent contexts)
        const lastSystem = lastMsg as Extract<AgentMessage, { role: "system" }>;
        const currentMsg = msg as Extract<AgentMessage, { role: "system" }>;
        
        const mergedContent = [
          ...(Array.isArray(lastSystem.content) ? lastSystem.content : [String(lastSystem.content)]),
          ...(Array.isArray(currentMsg.content) ? currentMsg.content : [String(currentMsg.content)]),
        ];
        
        const merged: Extract<AgentMessage, { role: "system" }> = {
          ...lastSystem,
          content: mergedContent.join("\n\n"),
        };
        result[result.length - 1] = merged;
        continue;
      }

      if (lastMsg && typeof lastMsg === "object" && lastRole === "assistant") {
        // Merge consecutive assistant messages
        const lastAsst = lastMsg as Extract<AgentMessage, { role: "assistant" }>;
        const currentMsg = msg as Extract<AgentMessage, { role: "assistant" }>;

        const mergedContent = [
          ...(Array.isArray(lastAsst.content) ? lastAsst.content : []),
          ...(Array.isArray(currentMsg.content) ? currentMsg.content : []),
        ];

        const merged: Extract<AgentMessage, { role: "assistant" }> = {
          ...lastAsst,
          content: mergedContent,
          ...(currentMsg.usage && { usage: currentMsg.usage }),
          ...(currentMsg.stopReason && { stopReason: currentMsg.stopReason }),
          ...(currentMsg.errorMessage && { errorMessage: currentMsg.errorMessage }),
        };
        result[result.length - 1] = merged;
        continue;
      }
    }

    result.push(msg);
    lastRole = msgRole;
  }

  return result;
}
