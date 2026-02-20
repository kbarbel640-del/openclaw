import { vi, describe, it, expect, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — MUST be before imports
// ---------------------------------------------------------------------------

vi.mock("../../src/agents/pi-embedded-runner.js", () => ({
  runEmbeddedPiAgent: vi.fn(),
}));

import type { ChannelMessages, TgMessage } from "./types.js";
// Import AFTER mocks
import { runEmbeddedPiAgent } from "../../src/agents/pi-embedded-runner.js";
import { buildUserPrompt, buildPrompt, summarize, formatFallback } from "./summarize.js";

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

function makeMessage(overrides: Partial<TgMessage> = {}): TgMessage {
  return {
    id: 1,
    channel: "@test",
    date: new Date("2026-02-20T10:00:00Z"),
    text: "Test message content",
    views: 100,
    forwards: 5,
    replies: 10,
    reactions: 20,
    ...overrides,
  };
}

function makeChannelMessages(
  channel = "@test",
  messages: TgMessage[] = [makeMessage()],
): ChannelMessages {
  return { channel, messages };
}

// ---------------------------------------------------------------------------
// buildUserPrompt
// ---------------------------------------------------------------------------

describe("buildUserPrompt", () => {
  it("wraps messages in XML tags with stats", () => {
    const result = buildUserPrompt([makeChannelMessages()]);
    expect(result).toContain("<message");
    expect(result).toContain('channel="@test"');
    expect(result).toContain('views="100"');
    expect(result).toContain('forwards="5"');
    expect(result).toContain("Test message content");
    expect(result).toContain("</message>");
  });

  it("truncates long messages", () => {
    const longMsg = makeMessage({ text: "x".repeat(2000) });
    const result = buildUserPrompt([makeChannelMessages("@test", [longMsg])]);
    expect(result).toContain("[...truncated]");
  });

  it("handles multiple channels", () => {
    const result = buildUserPrompt([makeChannelMessages("@chan1"), makeChannelMessages("@chan2")]);
    expect(result).toContain('channel="@chan1"');
    expect(result).toContain('channel="@chan2"');
  });

  it("returns empty string for no messages", () => {
    const result = buildUserPrompt([]);
    expect(result).toBe("");
  });
});

// ---------------------------------------------------------------------------
// buildPrompt
// ---------------------------------------------------------------------------

describe("buildPrompt", () => {
  it("uses correct system prompt for each variant", () => {
    const cm = [makeChannelMessages()];
    expect(buildPrompt("digest", cm).system).toContain("digest assistant");
    expect(buildPrompt("channel", cm).system).toContain("analysis assistant");
    expect(buildPrompt("topics", cm).system).toContain("topic extraction");
    expect(buildPrompt("top", cm).system).toContain("engagement analyst");
  });

  it("adds language instruction when specified", () => {
    const { system } = buildPrompt("digest", [makeChannelMessages()], "ru");
    expect(system).toContain("Respond in ru");
  });

  it("adds auto-detect instruction when no language specified", () => {
    const { system } = buildPrompt("digest", [makeChannelMessages()]);
    expect(system).toContain("Detect the dominant language");
  });
});

// ---------------------------------------------------------------------------
// summarize (LLM invocation)
// ---------------------------------------------------------------------------

describe("summarize", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns summary text from LLM", async () => {
    // oxlint-disable-next-line typescript/no-explicit-any
    (runEmbeddedPiAgent as any).mockResolvedValueOnce({
      payloads: [{ text: "LLM summary result" }],
      meta: {},
    });

    const result = await summarize("digest", [makeChannelMessages()], {});
    expect(result).toBe("LLM summary result");

    // oxlint-disable-next-line typescript/no-explicit-any
    const call = (runEmbeddedPiAgent as any).mock.calls[0]?.[0];
    expect(call.disableTools).toBe(true);
    expect(call.timeoutMs).toBe(60_000);
  });

  it("falls back on empty payloads", async () => {
    // oxlint-disable-next-line typescript/no-explicit-any
    (runEmbeddedPiAgent as any).mockResolvedValueOnce({
      payloads: [],
      meta: {},
    });

    const result = await summarize("digest", [makeChannelMessages()], {});
    expect(result).toContain("@test");
    expect(result).toContain("Test message content");
  });

  it("falls back on error payloads", async () => {
    // oxlint-disable-next-line typescript/no-explicit-any
    (runEmbeddedPiAgent as any).mockResolvedValueOnce({
      payloads: [{ isError: true, text: "error" }],
      meta: {},
    });

    const result = await summarize("digest", [makeChannelMessages()], {});
    expect(result).toContain("@test");
  });

  it("falls back when runner throws", async () => {
    // oxlint-disable-next-line typescript/no-explicit-any
    (runEmbeddedPiAgent as any).mockRejectedValueOnce(new Error("LLM unavailable"));

    const result = await summarize("digest", [makeChannelMessages()], {});
    expect(result).toContain("@test");
  });

  it("passes provider and model to runner", async () => {
    // oxlint-disable-next-line typescript/no-explicit-any
    (runEmbeddedPiAgent as any).mockResolvedValueOnce({
      payloads: [{ text: "ok" }],
    });

    await summarize("channel", [makeChannelMessages()], {
      provider: "cloudru-fm",
      model: "test-model",
    });

    // oxlint-disable-next-line typescript/no-explicit-any
    const call = (runEmbeddedPiAgent as any).mock.calls[0]?.[0];
    expect(call.provider).toBe("cloudru-fm");
    expect(call.model).toBe("test-model");
  });
});

// ---------------------------------------------------------------------------
// formatFallback
// ---------------------------------------------------------------------------

describe("formatFallback", () => {
  it("returns no-messages text for empty input", () => {
    expect(formatFallback("digest", [])).toContain("No messages");
  });

  it("formats digest fallback with channel grouping", () => {
    const result = formatFallback("digest", [
      makeChannelMessages("@chan1", [makeMessage({ text: "msg1" })]),
      makeChannelMessages("@chan2", [makeMessage({ text: "msg2" })]),
    ]);
    expect(result).toContain("**@chan1**");
    expect(result).toContain("**@chan2**");
    expect(result).toContain("msg1");
    expect(result).toContain("msg2");
  });

  it("formats top fallback sorted by engagement", () => {
    const low = makeMessage({
      id: 1,
      views: 10,
      forwards: 0,
      replies: 0,
      reactions: 0,
      text: "low",
    });
    const high = makeMessage({
      id: 2,
      views: 1000,
      forwards: 50,
      replies: 100,
      reactions: 200,
      text: "high",
    });

    const result = formatFallback("top", [makeChannelMessages("@ch", [low, high])]);
    const lines = result.split("\n");
    expect(lines[0]).toContain("high");
    expect(lines[1]).toContain("low");
  });

  it("limits digest to 5 previews per channel", () => {
    const msgs = Array.from({ length: 8 }, (_, i) => makeMessage({ id: i, text: `Message ${i}` }));
    const result = formatFallback("digest", [makeChannelMessages("@ch", msgs)]);
    expect(result).toContain("and 3 more");
  });
});
