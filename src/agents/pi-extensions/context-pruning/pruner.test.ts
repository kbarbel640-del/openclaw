import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { AssistantMessage, UserMessage } from "@mariozechner/pi-ai";
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import { describe, expect, it } from "vitest";

import {
  condenseAssistantMessage,
  condenseUserMessage,
  findMidTrimCutoffIndex,
  pruneContextMessages,
  truncateToSentence,
} from "./pruner.js";
import { DEFAULT_CONTEXT_PRUNING_SETTINGS } from "./settings.js";

function makeUser(content: UserMessage["content"]): UserMessage {
  return { role: "user", content, timestamp: Date.now() };
}

function makeAssistant(content: AssistantMessage["content"]): AssistantMessage {
  return {
    role: "assistant",
    content,
    api: "openai-responses",
    provider: "openai",
    model: "fake",
    usage: {
      input: 1,
      output: 1,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 2,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: "stop",
    timestamp: Date.now(),
  };
}

describe("truncateToSentence", () => {
  it("returns original text if under maxChars", () => {
    expect(truncateToSentence("Hello world.", 100)).toBe("Hello world.");
  });

  it("truncates at sentence boundary", () => {
    const text = "First sentence. Second sentence. Third sentence.";
    const result = truncateToSentence(text, 25);
    expect(result).toBe("First sentence.");
  });

  it("truncates at word boundary if no sentence found", () => {
    const text = "This is a very long sentence without periods";
    const result = truncateToSentence(text, 25);
    expect(result).toContain("...");
    expect(result.length).toBeLessThanOrEqual(28); // 25 + "..."
  });

  it("handles newline sentence endings", () => {
    const text = "First sentence.\nSecond sentence.\nThird.";
    const result = truncateToSentence(text, 20);
    expect(result).toBe("First sentence.");
  });

  it("truncates with ellipsis if no good boundary", () => {
    const text = "abcdefghijklmnopqrstuvwxyz";
    const result = truncateToSentence(text, 10);
    expect(result).toBe("abcdefghij...");
  });
});

describe("condenseUserMessage", () => {
  it("returns null for short messages", () => {
    const msg: UserMessage = makeUser("Short message");
    expect(condenseUserMessage(msg, 300)).toBeNull();
  });

  it("condenses long string content", () => {
    const msg: UserMessage = makeUser(`First sentence. ${"x".repeat(500)}`);
    const result = condenseUserMessage(msg, 100);
    expect(result).not.toBeNull();
    expect(result?.content).toContain("[Message condensed]");
    expect((result?.content as string | undefined)?.length ?? 0).toBeLessThan(
      msg.content.length,
    );
  });

  it("preserves images in array content", () => {
    const msg: UserMessage = makeUser([
      { type: "text", text: "x".repeat(500) },
      { type: "image", data: "AA==", mimeType: "image/png" },
    ]);
    const result = condenseUserMessage(msg, 100);
    expect(result).not.toBeNull();
    const content = result?.content as Array<{ type: string }>;
    const hasImage = content.some((b) => b.type === "image");
    expect(hasImage).toBe(true);
  });

  it("returns null if array content is already short", () => {
    const msg: UserMessage = makeUser([{ type: "text", text: "Short text" }]);
    expect(condenseUserMessage(msg, 300)).toBeNull();
  });
});

describe("condenseAssistantMessage", () => {
  it("returns null for short messages", () => {
    const msg: AssistantMessage = makeAssistant([
      { type: "text", text: "Short response" },
    ]);
    expect(condenseAssistantMessage(msg, 500)).toBeNull();
  });

  it("condenses long text blocks", () => {
    const msg: AssistantMessage = makeAssistant([
      { type: "text", text: `First paragraph. ${"x".repeat(1000)}` },
    ]);
    const result = condenseAssistantMessage(msg, 200);
    expect(result).not.toBeNull();
    const text = result?.content.find(
      (b) => b.type === "text" && b.text.includes("[Response condensed]"),
    );
    expect(text).toBeTruthy();
  });

  it("preserves tool calls", () => {
    const msg: AssistantMessage = makeAssistant([
      { type: "text", text: "x".repeat(1000) },
      {
        type: "toolCall",
        id: "123",
        name: "read",
        arguments: { path: "/test" },
      },
    ]);
    const result = condenseAssistantMessage(msg, 200);
    expect(result).not.toBeNull();
    const hasToolCall = result?.content.some((b) => b.type === "toolCall");
    expect(hasToolCall).toBe(true);
  });

  it("condenses thinking blocks", () => {
    const msg: AssistantMessage = makeAssistant([
      { type: "thinking", thinking: "x".repeat(500) },
      { type: "text", text: "x".repeat(500) },
    ]);
    const result = condenseAssistantMessage(msg, 150);
    expect(result).not.toBeNull();
    const thinking = result?.content.find((b) => b.type === "thinking") as
      | { type: "thinking"; thinking: string }
      | undefined;
    if (thinking) {
      expect(thinking.thinking).toContain("[thinking condensed]");
    }
  });
});

describe("findMidTrimCutoffIndex", () => {
  it("returns null when not enough assistant messages", () => {
    const messages: AgentMessage[] = [
      makeUser("Hello"),
      makeAssistant([{ type: "text", text: "Hi" }]),
    ];
    expect(findMidTrimCutoffIndex(messages, 5)).toBeNull();
  });

  it("finds correct cutoff with enough messages", () => {
    const messages: AgentMessage[] = [
      makeUser("1"),
      makeAssistant([{ type: "text", text: "1" }]),
      makeUser("2"),
      makeAssistant([{ type: "text", text: "2" }]),
      makeUser("3"),
      makeAssistant([{ type: "text", text: "3" }]),
      makeUser("4"),
      makeAssistant([{ type: "text", text: "4" }]),
      makeUser("5"),
      makeAssistant([{ type: "text", text: "5" }]),
    ];
    const cutoff = findMidTrimCutoffIndex(messages, 3);
    expect(cutoff).toBe(5);
  });

  it("returns null when turnsThreshold is 0 (midTrim disabled)", () => {
    const messages: AgentMessage[] = [
      makeUser("Hello"),
      makeAssistant([{ type: "text", text: "Hi" }]),
    ];
    expect(findMidTrimCutoffIndex(messages, 0)).toBeNull();
  });
});

describe("pruneContextMessages with midTrim", () => {
  const mockCtx = { model: { contextWindow: 1000 } } as unknown as Pick<
    ExtensionContext,
    "model"
  >;

  it("condenses older messages when ratio exceeds softTrimRatio", () => {
    // Create messages that exceed 30% of context window (1200+ chars)
    const longUserContent = `User message. ${"x".repeat(800)}`;
    const longAssistantContent = `Assistant response. ${"y".repeat(800)}`;

    const messages: AgentMessage[] = [
      makeUser(longUserContent),
      makeAssistant([{ type: "text", text: longAssistantContent }]),
      makeUser(longUserContent),
      makeAssistant([{ type: "text", text: longAssistantContent }]),
      makeUser(longUserContent),
      makeAssistant([{ type: "text", text: longAssistantContent }]),
      makeUser("Recent question"),
      makeAssistant([{ type: "text", text: "Recent answer" }]),
    ];

    const result = pruneContextMessages({
      messages,
      settings: {
        ...DEFAULT_CONTEXT_PRUNING_SETTINGS,
        midTrim: {
          turnsThreshold: 3,
          maxUserChars: 100,
          maxAssistantChars: 150,
        },
      },
      ctx: mockCtx as unknown as Pick<ExtensionContext, "model">,
    });

    // Older messages should be condensed
    const firstUserContent = (result[0] as UserMessage).content;
    expect(
      typeof firstUserContent === "string" &&
        firstUserContent.includes("[Message condensed]"),
    ).toBe(true);
  });

  it("does not condense when below softTrimRatio", () => {
    const messages: AgentMessage[] = [
      makeUser("Short"),
      makeAssistant([{ type: "text", text: "Short" }]),
    ];

    const result = pruneContextMessages({
      messages,
      settings: DEFAULT_CONTEXT_PRUNING_SETTINGS,
      ctx: mockCtx as unknown as Pick<ExtensionContext, "model">,
    });

    // Should return original messages unchanged
    expect(result).toEqual(messages);
  });

  it("protects recent messages from condensing", () => {
    const longContent = "x".repeat(1000);
    const messages: AgentMessage[] = [
      makeUser(longContent),
      makeAssistant([{ type: "text", text: longContent }]),
      makeUser(longContent),
      makeAssistant([{ type: "text", text: longContent }]),
      makeUser(longContent),
      makeAssistant([{ type: "text", text: longContent }]),
      makeUser("Recent question that should stay intact"),
      makeAssistant([
        { type: "text", text: "Recent answer that should stay intact" },
      ]),
    ];

    const result = pruneContextMessages({
      messages,
      settings: {
        ...DEFAULT_CONTEXT_PRUNING_SETTINGS,
        midTrim: {
          turnsThreshold: 2, // Protect last 2 assistant turns
          maxUserChars: 100,
          maxAssistantChars: 150,
        },
      },
      ctx: mockCtx as unknown as Pick<ExtensionContext, "model">,
    });

    // Recent messages (last 2 assistant turns) should not be condensed
    const lastUserContent = (result[result.length - 2] as UserMessage).content;
    expect(lastUserContent).toBe("Recent question that should stay intact");
  });
});
