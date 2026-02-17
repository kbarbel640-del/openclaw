import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { SessionManager } from "@mariozechner/pi-coding-agent";
import { describe, expect, it } from "vitest";
import { stripNonNativeThinkingBlocks } from "./pi-embedded-helpers/openai.js";
import { sanitizeSessionHistory } from "./pi-embedded-runner/google.js";

describe("stripNonNativeThinkingBlocks", () => {
  it("strips all thinking blocks from assistant messages", () => {
    const messages: AgentMessage[] = [
      { role: "user", content: "hi" } as unknown as AgentMessage,
      {
        role: "assistant",
        content: [
          { type: "thinking", thinking: "reasoning..." },
          { type: "text", text: "hello" },
        ],
      } as unknown as AgentMessage,
    ];

    const result = stripNonNativeThinkingBlocks(messages);
    const assistant = result.find((m) => (m as { role?: string }).role === "assistant") as {
      content?: Array<{ type?: string }>;
    };

    expect(assistant.content?.map((b) => b.type)).toEqual(["text"]);
  });

  it("drops assistant message entirely when only thinking blocks remain", () => {
    const messages: AgentMessage[] = [
      { role: "user", content: "hi" } as unknown as AgentMessage,
      {
        role: "assistant",
        content: [{ type: "thinking", thinking: "reasoning..." }],
      } as unknown as AgentMessage,
    ];

    const result = stripNonNativeThinkingBlocks(messages);
    const assistant = result.find((m) => (m as { role?: string }).role === "assistant");
    expect(assistant).toBeUndefined();
  });

  it("preserves non-assistant messages unchanged", () => {
    const messages: AgentMessage[] = [
      { role: "user", content: "hi" } as unknown as AgentMessage,
      { role: "user", content: "hello" } as unknown as AgentMessage,
    ];

    const result = stripNonNativeThinkingBlocks(messages);
    expect(result).toEqual(messages);
  });

  it("preserves assistant messages with no thinking blocks", () => {
    const messages: AgentMessage[] = [
      {
        role: "assistant",
        content: [{ type: "text", text: "hello" }],
      } as unknown as AgentMessage,
    ];

    const result = stripNonNativeThinkingBlocks(messages);
    expect(result).toStrictEqual(messages);
  });

  it("preserves assistant messages with string content", () => {
    const messages: AgentMessage[] = [
      { role: "assistant", content: "hello" } as unknown as AgentMessage,
    ];

    const result = stripNonNativeThinkingBlocks(messages);
    expect(result).toStrictEqual(messages);
  });
});

describe("sanitizeSessionHistory — cross-provider thinking block stripping (#19295)", () => {
  it("strips Anthropic thinking blocks when switching to openai-completions", async () => {
    const sessionManager = SessionManager.inMemory();

    // Set initial model snapshot to Anthropic
    await sanitizeSessionHistory({
      messages: [{ role: "user", content: "Hi" } as unknown as AgentMessage],
      modelApi: "anthropic-messages",
      provider: "anthropic",
      modelId: "claude-sonnet-4-5-20250929",
      sessionManager,
      sessionId: "session:test",
    });

    const history: AgentMessage[] = [
      { role: "user", content: "What is 2+2?" } as unknown as AgentMessage,
      {
        role: "assistant",
        content: [
          { type: "thinking", thinking: "Let me calculate 2+2 = 4" },
          { type: "text", text: "2+2 = 4" },
        ],
      } as unknown as AgentMessage,
      { role: "user", content: "Thanks" } as unknown as AgentMessage,
    ];

    // Switch to OpenAI — thinking blocks should be stripped
    const sanitized = await sanitizeSessionHistory({
      messages: history,
      modelApi: "openai-completions",
      provider: "openai",
      modelId: "gpt-5.2",
      sessionManager,
      sessionId: "session:test",
    });

    const assistant = sanitized.find((m) => (m as { role?: string }).role === "assistant") as {
      content?: Array<{ type?: string }>;
    };

    expect(assistant.content?.map((b) => b.type)).toEqual(["text"]);
  });

  it("strips thinking blocks on round-trip Anthropic → OpenAI → Anthropic", async () => {
    const sessionManager = SessionManager.inMemory();

    const history: AgentMessage[] = [
      { role: "user", content: "What is 2+2?" } as unknown as AgentMessage,
      {
        role: "assistant",
        content: [
          { type: "thinking", thinking: "Calculating..." },
          { type: "text", text: "4" },
        ],
      } as unknown as AgentMessage,
      { role: "user", content: "What is 3+3?" } as unknown as AgentMessage,
    ];

    // Anthropic first
    await sanitizeSessionHistory({
      messages: history.slice(0, 1),
      modelApi: "anthropic-messages",
      provider: "anthropic",
      modelId: "claude-sonnet-4-5-20250929",
      sessionManager,
      sessionId: "session:roundtrip",
    });

    // Switch to OpenAI
    await sanitizeSessionHistory({
      messages: history,
      modelApi: "openai-completions",
      provider: "openai",
      modelId: "gpt-5.2",
      sessionManager,
      sessionId: "session:roundtrip",
    });

    // Switch back to Anthropic
    const sanitized = await sanitizeSessionHistory({
      messages: history,
      modelApi: "anthropic-messages",
      provider: "anthropic",
      modelId: "claude-sonnet-4-5-20250929",
      sessionManager,
      sessionId: "session:roundtrip",
    });

    const assistant = sanitized.find((m) => (m as { role?: string }).role === "assistant") as {
      content?: Array<{ type?: string }>;
    };

    // Thinking blocks should be stripped because model changed
    expect(assistant.content?.map((b) => b.type)).toEqual(["text"]);
  });

  it("preserves thinking blocks when model has NOT changed", async () => {
    const sessionManager = SessionManager.inMemory();

    // Same model both times
    await sanitizeSessionHistory({
      messages: [{ role: "user", content: "Hi" } as unknown as AgentMessage],
      modelApi: "anthropic-messages",
      provider: "anthropic",
      modelId: "claude-sonnet-4-5-20250929",
      sessionManager,
      sessionId: "session:no-change",
    });

    const history: AgentMessage[] = [
      { role: "user", content: "What is 2+2?" } as unknown as AgentMessage,
      {
        role: "assistant",
        content: [
          { type: "thinking", thinking: "Calculating..." },
          { type: "text", text: "4" },
        ],
      } as unknown as AgentMessage,
      { role: "user", content: "Thanks" } as unknown as AgentMessage,
    ];

    const sanitized = await sanitizeSessionHistory({
      messages: history,
      modelApi: "anthropic-messages",
      provider: "anthropic",
      modelId: "claude-sonnet-4-5-20250929",
      sessionManager,
      sessionId: "session:no-change",
    });

    const assistant = sanitized.find((m) => (m as { role?: string }).role === "assistant") as {
      content?: Array<{ type?: string }>;
    };

    expect(assistant.content?.map((b) => b.type)).toEqual(["thinking", "text"]);
  });
});
