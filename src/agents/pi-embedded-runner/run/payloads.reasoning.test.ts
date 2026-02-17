import type { AssistantMessage } from "@mariozechner/pi-ai";
import { describe, expect, it } from "vitest";
import { buildEmbeddedRunPayloads } from "./payloads.js";

describe("reasoning suppression in payloads", () => {
  const makeAssistant = (overrides: Partial<AssistantMessage>): AssistantMessage => ({
    role: "assistant",
    api: "anthropic-messages",
    provider: "anthropic",
    model: "claude-opus-4-6",
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    timestamp: 0,
    stopReason: "stop",
    content: [
      {
        type: "thinking",
        thinking: "Let me think about this...",
        signature: "sig123",
      },
      { type: "text", text: "Here is the answer." },
    ],
    ...overrides,
  });

  type BuildPayloadParams = Parameters<typeof buildEmbeddedRunPayloads>[0];
  const buildPayloads = (overrides: Partial<BuildPayloadParams> = {}) =>
    buildEmbeddedRunPayloads({
      assistantTexts: [],
      toolMetas: [],
      lastAssistant: undefined,
      sessionKey: "session:telegram",
      inlineToolResultsAllowed: false,
      verboseLevel: "off",
      reasoningLevel: "off",
      toolResultFormat: "plain",
      ...overrides,
    });

  it("does not include reasoning text in payloads when reasoningLevel is on", () => {
    const payloads = buildPayloads({
      assistantTexts: ["Here is the answer."],
      lastAssistant: makeAssistant({}),
      reasoningLevel: "on",
    });

    // Should only contain the answer, not the reasoning
    expect(payloads).toHaveLength(1);
    expect(payloads[0]?.text).toBe("Here is the answer.");
    // Reasoning text should NOT be in any payload
    expect(payloads.some((p) => p.text?.includes("think"))).toBe(false);
  });

  it("still includes assistant answer text normally", () => {
    const payloads = buildPayloads({
      assistantTexts: ["The result is 42."],
      lastAssistant: makeAssistant({
        content: [{ type: "text", text: "The result is 42." }],
      }),
      reasoningLevel: "off",
    });

    expect(payloads).toHaveLength(1);
    expect(payloads[0]?.text).toBe("The result is 42.");
  });
});
