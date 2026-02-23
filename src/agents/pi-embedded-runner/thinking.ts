import type { AgentMessage } from "@mariozechner/pi-agent-core";

type AssistantContentBlock = Extract<AgentMessage, { role: "assistant" }>["content"][number];
type AssistantMessage = Extract<AgentMessage, { role: "assistant" }>;

export function isAssistantMessageWithContent(message: AgentMessage): message is AssistantMessage {
  return (
    !!message &&
    typeof message === "object" &&
    message.role === "assistant" &&
    Array.isArray(message.content)
  );
}

/**
 * Handle `type: "thinking"` and `type: "redacted_thinking"` content blocks in assistant messages.
 *
 * CRITICAL: Per Anthropic's API requirements, thinking and redacted_thinking blocks
 * must remain byte-for-byte identical to how they were originally returned by the API.
 * Any modification causes API rejection with:
 * "messages.N.content.N: `thinking` or `redacted_thinking` blocks in the
 * latest assistant message cannot be modified."
 *
 * This function now PRESERVES thinking blocks (previously it dropped them) to comply
 * with Anthropic's requirements. If a message would end up with only thinking blocks
 * after filtering other content, the entire message is dropped rather than sending
 * a potentially malformed message.
 *
 * Returns the original array reference when nothing was changed (callers can
 * use reference equality to skip downstream work).
 */
export function dropThinkingBlocks(messages: AgentMessage[]): AgentMessage[] {
  // NOTE: Despite the function name, this now PRESERVES thinking blocks to comply
  // with Anthropic's API requirements. The name is kept for backward compatibility.
  // Consider renaming to `sanitizeThinkingBlocks` in a future refactor.
  let touched = false;
  const out: AgentMessage[] = [];
  for (const msg of messages) {
    if (!isAssistantMessageWithContent(msg)) {
      out.push(msg);
      continue;
    }
    const nextContent: AssistantContentBlock[] = [];
    let hasNonThinkingContent = false;
    let changed = false;
    for (const block of msg.content) {
      const isThinkingBlock =
        block &&
        typeof block === "object" &&
        ((block as { type?: unknown }).type === "thinking" ||
          (block as { type?: unknown }).type === "redacted_thinking");

      if (isThinkingBlock) {
        // CRITICAL: Always preserve thinking blocks unchanged
        nextContent.push(block);
        continue;
      }

      nextContent.push(block);
      hasNonThinkingContent = true;
    }

    // If we only have thinking blocks left (no other content), drop the entire message
    // rather than sending a message with only thinking blocks, as this may not be valid
    if (nextContent.length > 0 && !hasNonThinkingContent) {
      touched = true;
      changed = true;
      continue;
    }

    if (!changed) {
      out.push(msg);
      continue;
    }

    // Preserve the assistant turn even if all blocks were thinking-only
    const content =
      nextContent.length > 0 ? nextContent : [{ type: "text", text: "" } as AssistantContentBlock];
    out.push({ ...msg, content });
  }
  return touched ? out : messages;
}
