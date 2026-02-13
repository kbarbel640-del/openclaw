import type { AssistantMessage } from "@mariozechner/pi-ai";
import { describe, it, expect, vi } from "vitest";
import { coerceImageAssistantText } from "../agents/tools/image-tool.helpers.js";

// Mock extractAssistantText
vi.mock("../agents/pi-embedded-utils.js", () => ({
  extractAssistantText: vi.fn(),
}));

import { extractAssistantText } from "../agents/pi-embedded-utils.js";

describe("PDF OCR Bug Fix Integration Test", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should fix the PDF OCR output parsing bug for GLM models", () => {
    /**
     * BEFORE THE FIX:
     * When processing PDF files through GLM OCR, the output would show:
     * "You are a precise OCR (Optical Character Recognition) tool. Your task is to extract all readable text..."
     *
     * AFTER THE FIX:
     * Should extract only the actual PDF text content.
     */

    // Simulate a GLM OCR API response that includes system prompt (the bug scenario)
    const buggyOcrContent = [
      "You are a precise OCR (Optical Character Recognition) tool. Your task is to extract all readable text from this PDF document.",
      "",
      "Actual PDF Content:",
      "Sourdough Acidity Levels and Fermentation",
      "",
      "The pH level of sourdough starter typically ranges from 3.5 to 4.2 during active fermentation.",
      "This acidic environment helps develop the characteristic tangy flavor and natural preservatives.",
      "",
      "Optimal fermentation temperature is between 75-80°F (24-27°C) for most wild yeast strains.",
    ].join("\n");

    const mockMessage: AssistantMessage = {
      role: "assistant",
      content: [
        {
          type: "text",
          text: buggyOcrContent,
        },
      ],
      stopReason: "stop",
    };

    // Mock extractAssistantText to return the buggy content
    vi.mocked(extractAssistantText).mockReturnValue(buggyOcrContent);

    // Test with GLM model - should apply OCR filtering
    const extractedText = coerceImageAssistantText({
      message: mockMessage,
      provider: "zai",
      model: "glm-4.7",
    });

    // Verify that system prompts are filtered out
    expect(extractedText).not.toContain("You are a precise OCR");
    expect(extractedText).not.toContain("Your task is to extract");
    expect(extractedText).not.toContain("Optical Character Recognition");

    // Verify that actual PDF content is preserved
    expect(extractedText).toContain("Sourdough Acidity Levels and Fermentation");
    expect(extractedText).toContain(
      "pH level of sourdough starter typically ranges from 3.5 to 4.2",
    );
    expect(extractedText).toContain("Optimal fermentation temperature is between 75-80°F");

    // Verify the extracted text is clean and readable
    expect(extractedText.trim()).toBe(
      [
        "Actual PDF Content:",
        "Sourdough Acidity Levels and Fermentation",
        "",
        "The pH level of sourdough starter typically ranges from 3.5 to 4.2 during active fermentation.",
        "This acidic environment helps develop the characteristic tangy flavor and natural preservatives.",
        "",
        "Optimal fermentation temperature is between 75-80°F (24-27°C) for most wild yeast strains.",
      ]
        .join("\n")
        .trim(),
    );
  });

  it("should handle GLM API response with raw response structure", () => {
    /**
     * Tests the fix for GLM API response format:
     * { choices: [{ message: { content: "..." } }] }
     */

    const mockMessage: AssistantMessage = {
      role: "assistant",
      content: [
        {
          type: "text",
          text: "processed content",
        },
      ],
      stopReason: "stop",
      // Include raw GLM API response that contains system prompt
      rawResponse: {
        choices: [
          {
            message: {
              content:
                "You are a precise OCR tool. Extract text: Sample invoice #12345 Date: 2024-01-15 Amount: $1,234.56",
              role: "assistant",
            },
          },
        ],
      },
    };

    vi.mocked(extractAssistantText).mockReturnValue("processed content");

    const extractedText = coerceImageAssistantText({
      message: mockMessage,
      provider: "zai",
      model: "glm-4.7",
    });

    // Should extract from raw response and filter system prompt
    expect(extractedText).toBe("Sample invoice #12345 Date: 2024-01-15 Amount: $1,234.56");
    expect(extractedText).not.toContain("You are a precise OCR");
    expect(extractedText).not.toContain("Extract text:");
  });

  it("should not affect non-GLM vision models", () => {
    /**
     * Ensures that the fix only applies to GLM OCR processing
     * and doesn't interfere with regular image description for other models
     */

    const regularImageDescription =
      "A beautiful sunset over a mountain lake with vibrant orange and pink colors";

    const mockMessage: AssistantMessage = {
      role: "assistant",
      content: [
        {
          type: "text",
          text: regularImageDescription,
        },
      ],
      stopReason: "stop",
    };

    vi.mocked(extractAssistantText).mockReturnValue(regularImageDescription);

    // Test with non-GLM model - should not apply OCR filtering
    const extractedText = coerceImageAssistantText({
      message: mockMessage,
      provider: "openai",
      model: "gpt-4o",
    });

    expect(extractedText).toBe(regularImageDescription);
  });
});
