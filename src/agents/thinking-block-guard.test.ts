import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { describe, expect, it } from "vitest";
import {
  containsThinkingBlocks,
  hasThinkingBlocks,
  isThinkingBlock,
  safeFilterAssistantContent,
  validateThinkingBlocks,
} from "./thinking-block-guard.js";

describe("thinking-block-guard", () => {
  describe("isThinkingBlock", () => {
    it("identifies thinking blocks", () => {
      expect(isThinkingBlock({ type: "thinking", thinking: "test" })).toBe(true);
      expect(isThinkingBlock({ type: "redacted_thinking", redacted_thinking: "test" })).toBe(true);
      expect(isThinkingBlock({ type: "text", text: "test" })).toBe(false);
      expect(isThinkingBlock(null)).toBe(false);
      expect(isThinkingBlock(undefined)).toBe(false);
    });
  });

  describe("hasThinkingBlocks", () => {
    it("detects thinking blocks in assistant messages", () => {
      const withThinking: AgentMessage = {
        role: "assistant",
        content: [
          { type: "thinking", thinking: "analyzing..." },
          { type: "text", text: "response" },
        ],
        timestamp: Date.now(),
      };
      expect(hasThinkingBlocks(withThinking as unknown)).toBe(true);

      const withoutThinking: AgentMessage = {
        role: "assistant",
        content: [{ type: "text", text: "response" }],
        timestamp: Date.now(),
      };
      expect(hasThinkingBlocks(withoutThinking as unknown)).toBe(false);
    });
  });

  describe("containsThinkingBlocks", () => {
    it("detects thinking blocks across multiple messages", () => {
      const messages: AgentMessage[] = [
        { role: "user", content: "hello", timestamp: Date.now() },
        {
          role: "assistant",
          content: [
            { type: "thinking", thinking: "hmm..." },
            { type: "text", text: "hi" },
          ],
          timestamp: Date.now(),
        },
      ];
      expect(containsThinkingBlocks(messages)).toBe(true);

      const messagesNoThinking: AgentMessage[] = [
        { role: "user", content: "hello", timestamp: Date.now() },
        { role: "assistant", content: [{ type: "text", text: "hi" }], timestamp: Date.now() },
      ];
      expect(containsThinkingBlocks(messagesNoThinking)).toBe(false);
    });
  });

  describe("safeFilterAssistantContent", () => {
    it("preserves thinking blocks when filtering", () => {
      const message: AgentMessage = {
        role: "assistant",
        content: [
          { type: "thinking", thinking: "test" },
          { type: "toolCall", id: "1", name: "test", arguments: {} },
          { type: "text", text: "result" },
        ],
        timestamp: Date.now(),
      };

      // Filter out tool calls
      const filtered = safeFilterAssistantContent(message as unknown, (block: unknown) => {
        return (block as { type?: string }).type !== "toolCall";
      });

      expect(filtered).not.toBeNull();
      expect(filtered?.content).toHaveLength(2);
      expect(filtered?.content[0]).toEqual({ type: "thinking", thinking: "test" });
      expect(filtered?.content[1]).toEqual({ type: "text", text: "result" });
    });

    it("returns null when only thinking blocks remain after filtering", () => {
      const message: AgentMessage = {
        role: "assistant",
        content: [
          { type: "thinking", thinking: "test" },
          { type: "toolCall", id: "1", name: "test", arguments: {} },
        ],
        timestamp: Date.now(),
      };

      // Filter out everything except thinking blocks
      const filtered = safeFilterAssistantContent(message as unknown, (block: unknown) => {
        return (block as { type?: string }).type === "thinking";
      });

      // Should return null because only thinking blocks remain
      expect(filtered).toBeNull();
    });

    it("returns original message when nothing is filtered", () => {
      const message: AgentMessage = {
        role: "assistant",
        content: [
          { type: "thinking", thinking: "test" },
          { type: "text", text: "result" },
        ],
        timestamp: Date.now(),
      };

      const filtered = safeFilterAssistantContent(message as unknown, () => true);

      expect(filtered).toBe(message); // Same reference
    });
  });

  describe("validateThinkingBlocks", () => {
    it("validates well-formed thinking blocks", () => {
      const message: AgentMessage = {
        role: "assistant",
        content: [
          { type: "thinking", thinking: "valid" },
          { type: "text", text: "response" },
        ],
        timestamp: Date.now(),
      };

      const result = validateThinkingBlocks(message as unknown);
      expect(result.valid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it("detects invalid thinking blocks missing required fields", () => {
      const message: AgentMessage = {
        role: "assistant",
        content: [
          { type: "thinking" }, // Missing 'thinking' field
          { type: "text", text: "response" },
        ],
        timestamp: Date.now(),
      };

      const result = validateThinkingBlocks(message as unknown);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("missing required");
    });

    it("validates redacted_thinking blocks", () => {
      const message: AgentMessage = {
        role: "assistant",
        content: [
          { type: "redacted_thinking", redacted_thinking: "..." },
          { type: "text", text: "response" },
        ],
        timestamp: Date.now(),
      };

      const result = validateThinkingBlocks(message as unknown);
      expect(result.valid).toBe(true);
    });
  });
});
