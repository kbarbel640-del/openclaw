import { describe, it, expect } from "vitest";
import { extractFromClaudeAgentSdkEvent } from "./extract.js";

describe("extractFromClaudeAgentSdkEvent", () => {
  describe("text extraction", () => {
    it("extracts text from direct text field", () => {
      expect(extractFromClaudeAgentSdkEvent({ text: "Hello" }).text).toBe("Hello");
    });

    it("extracts text from delta field", () => {
      expect(extractFromClaudeAgentSdkEvent({ delta: "World" }).text).toBe("World");
    });

    it("extracts text from string input", () => {
      expect(extractFromClaudeAgentSdkEvent("Direct string").text).toBe("Direct string");
    });

    it("extracts text from content array with text blocks", () => {
      const event = {
        content: [
          { type: "text", text: "First" },
          { type: "text", text: "Second" },
        ],
      };
      expect(extractFromClaudeAgentSdkEvent(event).text).toBe("First\nSecond");
    });

    it("extracts text from nested message object", () => {
      const event = {
        message: {
          content: [{ type: "text", text: "Nested text" }],
        },
      };
      expect(extractFromClaudeAgentSdkEvent(event).text).toBe("Nested text");
    });

    it("extracts text from nested data object", () => {
      const event = {
        data: {
          text: "Data text",
        },
      };
      expect(extractFromClaudeAgentSdkEvent(event).text).toBe("Data text");
    });

    it("extracts text from deeply nested delta", () => {
      const event = {
        delta: {
          text: "Deep delta text",
        },
      };
      expect(extractFromClaudeAgentSdkEvent(event).text).toBe("Deep delta text");
    });

    it("returns undefined text for null/undefined input", () => {
      expect(extractFromClaudeAgentSdkEvent(null).text).toBeUndefined();
      expect(extractFromClaudeAgentSdkEvent(undefined).text).toBeUndefined();
    });

    it("returns undefined text for empty text", () => {
      expect(extractFromClaudeAgentSdkEvent({ text: "" }).text).toBeUndefined();
      expect(extractFromClaudeAgentSdkEvent({ text: "   " }).text).toBeUndefined();
    });

    it("returns undefined text for non-object input", () => {
      expect(extractFromClaudeAgentSdkEvent(123).text).toBeUndefined();
      expect(extractFromClaudeAgentSdkEvent(true).text).toBeUndefined();
    });

    it("handles array of strings in content", () => {
      const event = {
        content: ["First string", "Second string"],
      };
      expect(extractFromClaudeAgentSdkEvent(event).text).toBe("First string\nSecond string");
    });

    it("does NOT extract text from thinking field", () => {
      // Thinking content should be in the thinking field, not text
      expect(
        extractFromClaudeAgentSdkEvent({ thinking: "Internal reasoning" }).text,
      ).toBeUndefined();
    });

    it("extracts text field even when thinking field is also present", () => {
      const event = {
        text: "Main text",
        thinking: "Internal reasoning",
      };
      const result = extractFromClaudeAgentSdkEvent(event);
      expect(result.text).toBe("Main text");
      expect(result.thinking).toBe("Internal reasoning");
    });
  });

  describe("thinking extraction", () => {
    it("extracts thinking from direct thinking field", () => {
      expect(extractFromClaudeAgentSdkEvent({ thinking: "My thoughts" }).thinking).toBe(
        "My thoughts",
      );
    });

    it("extracts thinking from content_block with type=thinking", () => {
      const event = {
        type: "content_block_start",
        content_block: {
          type: "thinking",
          thinking: "Block thinking content",
        },
      };
      expect(extractFromClaudeAgentSdkEvent(event).thinking).toBe("Block thinking content");
    });

    it("extracts thinking from delta with type=thinking_delta", () => {
      const event = {
        type: "content_block_delta",
        delta: {
          type: "thinking_delta",
          thinking: "Delta thinking content",
        },
      };
      expect(extractFromClaudeAgentSdkEvent(event).thinking).toBe("Delta thinking content");
    });

    it("extracts thinking from delta.thinking directly", () => {
      const event = {
        delta: {
          thinking: "Direct delta thinking",
        },
      };
      expect(extractFromClaudeAgentSdkEvent(event).thinking).toBe("Direct delta thinking");
    });

    it("extracts thinking from nested message.thinking", () => {
      const event = {
        message: {
          thinking: "Message thinking content",
        },
      };
      expect(extractFromClaudeAgentSdkEvent(event).thinking).toBe("Message thinking content");
    });

    it("extracts thinking from nested data.thinking", () => {
      const event = {
        data: {
          thinking: "Data thinking content",
        },
      };
      expect(extractFromClaudeAgentSdkEvent(event).thinking).toBe("Data thinking content");
    });

    it("returns undefined thinking for null/undefined input", () => {
      expect(extractFromClaudeAgentSdkEvent(null).thinking).toBeUndefined();
      expect(extractFromClaudeAgentSdkEvent(undefined).thinking).toBeUndefined();
    });

    it("returns undefined thinking for empty thinking", () => {
      expect(extractFromClaudeAgentSdkEvent({ thinking: "" }).thinking).toBeUndefined();
      expect(extractFromClaudeAgentSdkEvent({ thinking: "   " }).thinking).toBeUndefined();
    });

    it("returns undefined thinking for non-object input", () => {
      expect(extractFromClaudeAgentSdkEvent(123).thinking).toBeUndefined();
      expect(extractFromClaudeAgentSdkEvent("string").thinking).toBeUndefined();
      expect(extractFromClaudeAgentSdkEvent(true).thinking).toBeUndefined();
    });

    it("returns undefined thinking when content_block type is not thinking", () => {
      const event = {
        type: "content_block_start",
        content_block: {
          type: "text",
          text: "Regular text",
        },
      };
      expect(extractFromClaudeAgentSdkEvent(event).thinking).toBeUndefined();
    });

    it("returns undefined thinking when delta type is not thinking_delta", () => {
      const event = {
        delta: {
          type: "text_delta",
          text: "Regular delta",
        },
      };
      expect(extractFromClaudeAgentSdkEvent(event).thinking).toBeUndefined();
    });

    it("returns undefined thinking when no thinking-related fields exist", () => {
      const event = {
        type: "assistant",
        text: "Regular assistant text",
        message: {
          content: [{ type: "text", text: "Content text" }],
        },
      };
      expect(extractFromClaudeAgentSdkEvent(event).thinking).toBeUndefined();
    });

    it("handles SDK thinking_delta stream event", () => {
      const event = {
        type: "thinking_delta",
        thinking: "Incremental thinking...",
      };
      expect(extractFromClaudeAgentSdkEvent(event).thinking).toBe("Incremental thinking...");
    });
  });

  describe("combined text and thinking extraction", () => {
    it("extracts both thinking and text when both are present", () => {
      const event = {
        thinking: "My internal reasoning",
        text: "My visible response",
      };
      const result = extractFromClaudeAgentSdkEvent(event);
      expect(result.thinking).toBe("My internal reasoning");
      expect(result.text).toBe("My visible response");
    });

    it("extracts thinking from content_block_delta with thinking_delta (text undefined)", () => {
      const event = {
        type: "content_block_delta",
        index: 0,
        delta: {
          type: "thinking_delta",
          thinking: "Streaming thinking content...",
        },
      };
      const result = extractFromClaudeAgentSdkEvent(event);
      expect(result.thinking).toBe("Streaming thinking content...");
      expect(result.text).toBeUndefined();
    });

    it("extracts text from content_block_delta with text_delta (thinking undefined)", () => {
      const event = {
        type: "content_block_delta",
        index: 1,
        delta: {
          type: "text_delta",
          text: "Streaming text content...",
        },
      };
      const result = extractFromClaudeAgentSdkEvent(event);
      expect(result.thinking).toBeUndefined();
      expect(result.text).toBe("Streaming text content...");
    });

    it("separates thinking and text from different events in a stream", () => {
      const thinkingEvent = {
        type: "content_block_delta",
        delta: { type: "thinking_delta", thinking: "Let me think..." },
      };
      const textEvent = {
        type: "content_block_delta",
        delta: { type: "text_delta", text: "Here is my answer" },
      };

      const thinkingResult = extractFromClaudeAgentSdkEvent(thinkingEvent);
      expect(thinkingResult.thinking).toBe("Let me think...");
      expect(thinkingResult.text).toBeUndefined();

      const textResult = extractFromClaudeAgentSdkEvent(textEvent);
      expect(textResult.thinking).toBeUndefined();
      expect(textResult.text).toBe("Here is my answer");
    });

    it("extracts thinking from content array with thinking blocks", () => {
      const event = {
        content: [
          { type: "thinking", thinking: "Internal thought process" },
          { type: "text", text: "Visible response to user" },
        ],
      };
      const result = extractFromClaudeAgentSdkEvent(event);
      expect(result.thinking).toBe("Internal thought process");
      expect(result.text).toBe("Visible response to user");
    });

    it("handles assistant message event with content array", () => {
      const event = {
        type: "assistant",
        message: {
          content: [
            { type: "thinking", thinking: "Internal thought process" },
            { type: "text", text: "Visible response to user" },
          ],
        },
      };
      const result = extractFromClaudeAgentSdkEvent(event);
      // Text extractor should find the text block
      expect(result.text).toBe("Visible response to user");
      // Thinking from content array should also be extracted
      expect(result.thinking).toBe("Internal thought process");
    });

    it("returns empty result for unrecognized event structure", () => {
      const event = {
        type: "unknown",
        someOtherField: "value",
      };
      const result = extractFromClaudeAgentSdkEvent(event);
      expect(result.text).toBeUndefined();
      expect(result.thinking).toBeUndefined();
    });
  });
});
