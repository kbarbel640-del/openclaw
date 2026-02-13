import { describe, it, expect, vi } from "vitest";
import { coerceImageAssistantText } from "../src/agents/tools/image-tool.helpers.js";
import type { AssistantMessage } from "@mariozechner/pi-ai";

// Mock extractAssistantText
vi.mock("../src/agents/pi-embedded-utils.js", () => ({
  extractAssistantText: vi.fn(),
}));

import { extractAssistantText } from "../src/agents/pi-embedded-utils.js";

describe("PDF OCR Bug Fix - Exact Issue Scenario", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should fix the exact issue: return PDF content, not OCR system prompt", () => {
    /**
     * ISSUE: When processing PDF files through GLM OCR, the output shows:
     * "You are a precise OCR (Optical Character Recognition) tool. Your task is to extract all readable text..."
     * 
     * EXPECTED: [Actual PDF text content about sourdough acidity...]
     */

    // Simulate the exact buggy response from the issue
    const buggyOcrResponse = [
      "You are a precise OCR (Optical Character Recognition) tool. Your task is to extract all readable text from this document.",
      "",
      "Sourdough Acidity Levels and Fermentation",
      "",
      "The pH level of sourdough starter typically ranges from 3.5 to 4.2 during active fermentation.",
      "This acidic environment helps develop the characteristic tangy flavor and natural preservatives.",
      "For best results, maintain a consistent feeding schedule and optimal temperature range."
    ].join("\n");

    const mockMessage: AssistantMessage = {
      role: "assistant",
      content: [
        {
          type: "text",
          text: buggyOcrResponse,
        },
      ],
      stopReason: "stop",
    };

    // Mock extractAssistantText to return the buggy content
    vi.mocked(extractAssistantText).mockReturnValue(buggyOcrResponse);

    // Test with GLM model - should apply OCR filtering
    const result = coerceImageAssistantText({
      message: mockMessage,
      provider: "zai",
      model: "glm-4.7",
    });

    // Verify that the fix works
    expect(result).not.toContain("You are a precise OCR");
    expect(result).not.toContain("Your task is to extract");
    expect(result).not.toContain("Optical Character Recognition");
    
    // Verify that actual PDF content is preserved
    expect(result).toContain("Sourdough Acidity Levels and Fermentation");
    expect(result).toContain("pH level of sourdough starter typically ranges from 3.5 to 4.2");
    expect(result).toContain("acidic environment helps develop the characteristic tangy flavor");
    
    // Verify that the result is clean and readable
    expect(result.trim()).toBe([
      "Sourdough Acidity Levels and Fermentation",
      "",
      "The pH level of sourdough starter typically ranges from 3.5 to 4.2 during active fermentation.",
      "This acidic environment helps develop the characteristic tangy flavor and natural preservatives.",
      "For best results, maintain a consistent feeding schedule and optimal temperature range.",
    ].join("\n").trim());
  });

  it("should handle GLM API response with choices structure", () => {
    /**
     * Tests the fix for GLM API response format mentioned in the issue:
     * { choices: [{ message: { content: "..." } }] }
     */

    const mockMessage: AssistantMessage = {
      role: "assistant",
      content: [
        {
          type: "text",
          text: "processed text",
        },
      ],
      stopReason: "stop",
      // Include the raw GLM API response structure
      rawResponse: {
        choices: [
          {
            message: {
              content: "You are a precise OCR tool. Extract text from this PDF: Sourdough Recipe - Contains detailed instructions for creating the perfect sourdough starter with proper acidity levels.",
              role: "assistant"
            }
          }
        ]
      }
    };

    vi.mocked(extractAssistantText).mockReturnValue("processed text");

    const result = coerceImageAssistantText({
      message: mockMessage,
      provider: "zai",
      model: "glm-4.7",
    });

    // Should extract from raw response and filter system prompt
    expect(result).toBe("Sourdough Recipe - Contains detailed instructions for creating the perfect sourdough starter with proper acidity levels.");
    expect(result).not.toContain("You are a precise OCR");
    expect(result).not.toContain("Extract text from this PDF:");
  });
});

// Run if called directly
if (typeof module !== 'undefined' && module.exports === undefined) {
  console.log("Running PDF OCR bug fix verification...");
  
  // Simulate the fix function for demonstration
  function filterOcrSystemPrompt(text) {
    const singleLinePattern = /^(You are a precise OCR[^:]*:|Your task is to extract[^:]*:|Extract text[^:]*:)\s*(.*)$/i;
    const match = text.match(singleLinePattern);
    if (match && match[2]?.trim().length >= 10) {
      return match[2].trim();
    }
    
    const ocrSystemPatterns = [
      /^You are a precise OCR.*$/mi,
      /^Your task is to extract.*$/mi,
    ];
    
    const lines = text.split('\n');
    const filteredLines = [];
    let inOcrPrompt = false;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      const isOcrPromptLine = ocrSystemPatterns.some(pattern => pattern.test(trimmedLine));
      
      if (isOcrPromptLine) {
        inOcrPrompt = true;
        continue;
      }
      
      if (!inOcrPrompt) {
        filteredLines.push(line);
      } else {
        if (!isOcrPromptLine && trimmedLine.length > 5) {
          inOcrPrompt = false;
          filteredLines.push(line);
        }
      }
    }
    
    return filteredLines.join('\n').trim();
  }
  
  // Test the exact scenario from the issue
  const issueExample = "You are a precise OCR (Optical Character Recognition) tool. Your task is to extract all readable text from this document.\n\nSourdough Acidity Levels and Fermentation\n\nThe pH level of sourdough starter typically ranges from 3.5 to 4.2 during active fermentation.";
  
  console.log("=== ISSUE SCENARIO TEST ===");
  console.log("Original (buggy) response:");
  console.log(issueExample.substring(0, 100) + "...");
  
  const fixed = filterOcrSystemPrompt(issueExample);
  console.log("\nFixed response:");
  console.log(fixed);
  
  console.log("\n✅ FIX VERIFICATION:");
  console.log("- Removed OCR system prompt:", !fixed.includes("You are a precise OCR"));
  console.log("- Preserved actual content:", fixed.includes("Sourdough Acidity Levels"));
  console.log("- Clean output:", !fixed.includes("Your task is to extract"));
}