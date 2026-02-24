import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { describe, expect, it } from "vitest";
import { dropThinkingBlocks, isAssistantMessageWithContent } from "./thinking.js";

describe("isAssistantMessageWithContent", () => {
  it("accepts assistant messages with array content and rejects others", () => {
    const assistant = {
      role: "assistant",
      content: [{ type: "text", text: "ok" }],
    } as AgentMessage;
    const user = { role: "user", content: "hi" } as AgentMessage;
    const malformed = { role: "assistant", content: "not-array" } as unknown as AgentMessage;

    expect(isAssistantMessageWithContent(assistant)).toBe(true);
    expect(isAssistantMessageWithContent(user)).toBe(false);
    expect(isAssistantMessageWithContent(malformed)).toBe(false);
  });
});

describe("dropThinkingBlocks", () => {
  it("returns the original reference when no thinking blocks are present", () => {
    const messages: AgentMessage[] = [
      { role: "user", content: "hello" } as AgentMessage,
      { role: "assistant", content: [{ type: "text", text: "world" }] } as AgentMessage,
    ];

    const result = dropThinkingBlocks(messages);
    expect(result).toBe(messages);
  });

  it("drops thinking blocks while preserving non-thinking assistant content", () => {
    const messages: AgentMessage[] = [
      {
        role: "assistant",
        content: [
          { type: "thinking", thinking: "internal" },
          { type: "text", text: "first" },
        ],
      } as unknown as AgentMessage,
      { role: "user", content: "follow-up" } as AgentMessage,
      {
        role: "assistant",
        content: [{ type: "text", text: "latest" }],
      } as AgentMessage,
    ];

    const result = dropThinkingBlocks(messages);
    const firstAssistant = result[0] as Extract<AgentMessage, { role: "assistant" }>;
    expect(firstAssistant.content).toEqual([{ type: "text", text: "first" }]);
  });

  it("keeps assistant turn structure when all content blocks were thinking", () => {
    const messages: AgentMessage[] = [
      {
        role: "assistant",
        content: [{ type: "thinking", thinking: "internal-only" }],
      } as unknown as AgentMessage,
      { role: "user", content: "follow-up" } as AgentMessage,
      {
        role: "assistant",
        content: [{ type: "text", text: "latest" }],
      } as AgentMessage,
    ];

    const result = dropThinkingBlocks(messages);
    const firstAssistant = result[0] as Extract<AgentMessage, { role: "assistant" }>;
    expect(firstAssistant.content).toEqual([{ type: "text", text: "" }]);
  });

  it("preserves thinking blocks in the latest assistant message (Anthropic API requirement)", () => {
    const messages: AgentMessage[] = [
      { role: "user", content: "first" } as AgentMessage,
      {
        role: "assistant",
        content: [
          { type: "thinking", thinking: "old reasoning" },
          { type: "text", text: "old response" },
        ],
      } as unknown as AgentMessage,
      { role: "user", content: "second" } as AgentMessage,
      {
        role: "assistant",
        content: [
          { type: "thinking", thinking: "latest reasoning" },
          { type: "text", text: "latest response" },
        ],
      } as unknown as AgentMessage,
    ];

    const result = dropThinkingBlocks(messages);
    const oldAssistant = result[1] as Extract<AgentMessage, { role: "assistant" }>;
    const latestAssistant = result[3] as Extract<AgentMessage, { role: "assistant" }>;

    // Old assistant: thinking blocks should be dropped
    expect(oldAssistant.content).toEqual([{ type: "text", text: "old response" }]);
    // Latest assistant: thinking blocks must be preserved
    expect(latestAssistant.content).toEqual([
      { type: "thinking", thinking: "latest reasoning" },
      { type: "text", text: "latest response" },
    ]);
  });

  it("preserves thinking blocks when latest assistant is the only assistant message", () => {
    const messages: AgentMessage[] = [
      { role: "user", content: "hello" } as AgentMessage,
      {
        role: "assistant",
        content: [
          { type: "thinking", thinking: "my reasoning" },
          { type: "text", text: "response" },
        ],
      } as unknown as AgentMessage,
    ];

    const result = dropThinkingBlocks(messages);
    expect(result).toBe(messages);
  });

  it("handles multiple assistant messages with only the latest preserved", () => {
    const messages: AgentMessage[] = [
      {
        role: "assistant",
        content: [{ type: "thinking", thinking: "first" }],
      } as unknown as AgentMessage,
      { role: "user", content: "follow-up" } as AgentMessage,
      {
        role: "assistant",
        content: [{ type: "thinking", thinking: "second" }],
      } as unknown as AgentMessage,
      { role: "user", content: "last" } as AgentMessage,
      {
        role: "assistant",
        content: [{ type: "thinking", thinking: "third" }],
      } as unknown as AgentMessage,
    ];

    const result = dropThinkingBlocks(messages);
    const first = result[0] as Extract<AgentMessage, { role: "assistant" }>;
    const second = result[2] as Extract<AgentMessage, { role: "assistant" }>;
    const third = result[4] as Extract<AgentMessage, { role: "assistant" }>;

    // First two assistants: thinking blocks dropped
    expect(first.content).toEqual([{ type: "text", text: "" }]);
    expect(second.content).toEqual([{ type: "text", text: "" }]);
    // Latest assistant: thinking blocks preserved
    expect(third.content).toEqual([{ type: "thinking", thinking: "third" }]);
  });
});
