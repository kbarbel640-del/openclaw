import type { AssistantMessage } from "@mariozechner/pi-ai";
import { describe, it, expect, vi } from "vitest";
import { coerceImageAssistantText } from "./image-tool.helpers.js";

// Mock extractAssistantText to control its behavior in tests
vi.mock("../pi-embedded-utils.js", () => ({
  extractAssistantText: vi.fn(),
}));

import { extractAssistantText } from "../pi-embedded-utils.js";

describe("coerceImageAssistantText OCR bug fix", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should extract only assistant response, not system prompt for GLM models", () => {
    // Mock message with OCR system prompt content (the bug scenario)
    const mockMessage: AssistantMessage = {
      role: "assistant",
      content: [
        {
          type: "text",
          text: "You are a precise OCR (Optical Character Recognition) tool. Your task is to extract all readable text from the document. Actual PDF text content about sourdough acidity levels and fermentation processes...",
        },
      ],
      stopReason: "stop",
    };

    // Mock extractAssistantText to return the buggy content
    vi.mocked(extractAssistantText).mockReturnValue(
      "You are a precise OCR (Optical Character Recognition) tool. Your task is to extract all readable text from the document. Actual PDF text content about sourdough acidity levels and fermentation processes...",
    );

    // Test with GLM model - should filter out system prompt
    const result = coerceImageAssistantText({
      message: mockMessage,
      provider: "zai",
      model: "glm-4.7",
    });

    // Should contain only the actual extracted text, not the system prompt
    expect(result).toBe(
      "Actual PDF text content about sourdough acidity levels and fermentation processes...",
    );
    expect(result).not.toContain("You are a precise OCR");
    expect(result).not.toContain("Your task is to extract");
  });

  it("should handle GLM response with raw response format", () => {
    const mockMessage: AssistantMessage = {
      role: "assistant",
      content: [
        {
          type: "text",
          text: "GLM response content",
        },
      ],
      stopReason: "stop",
      // Include raw response that contains system prompt (the bug scenario)
      rawResponse: {
        choices: [
          {
            message: {
              content:
                "You are a precise OCR tool. Your task is to extract text. Actual extracted content...",
              role: "assistant",
            },
          },
        ],
      },
    };

    vi.mocked(extractAssistantText).mockReturnValue("GLM response content");

    const result = coerceImageAssistantText({
      message: mockMessage,
      provider: "zai",
      model: "glm-4.7",
    });

    // Should extract from raw response and filter out system prompt
    expect(result).toBe("Actual extracted content...");
    expect(result).not.toContain("You are a precise OCR");
  });

  it("should not filter content for non-GLM models", () => {
    const mockMessage: AssistantMessage = {
      role: "assistant",
      content: [
        {
          type: "text",
          text: "Regular image description without OCR prompts",
        },
      ],
      stopReason: "stop",
    };

    vi.mocked(extractAssistantText).mockReturnValue(
      "Regular image description without OCR prompts",
    );

    // Test with non-GLM model - should not apply OCR filtering
    const result = coerceImageAssistantText({
      message: mockMessage,
      provider: "openai",
      model: "gpt-4o",
    });

    expect(result).toBe("Regular image description without OCR prompts");
  });

  it("should handle error cases properly", () => {
    const mockMessage: AssistantMessage = {
      role: "assistant",
      content: [],
      stopReason: "error",
      errorMessage: "Model processing failed",
    };

    expect(() => {
      coerceImageAssistantText({
        message: mockMessage,
        provider: "zai",
        model: "glm-4.7",
      });
    }).toThrow("Image model failed (zai/glm-4.7): Model processing failed");
  });

  it("should handle empty text after filtering", () => {
    const mockMessage: AssistantMessage = {
      role: "assistant",
      content: [
        {
          type: "text",
          text: "You are a precise OCR tool. Your task is to extract text.",
        },
      ],
      stopReason: "stop",
    };

    vi.mocked(extractAssistantText).mockReturnValue(
      "You are a precise OCR tool. Your task is to extract text.",
    );

    expect(() => {
      coerceImageAssistantText({
        message: mockMessage,
        provider: "zai",
        model: "glm-4.7",
      });
    }).toThrow("Image model returned no text (zai/glm-4.7)");
  });
});
