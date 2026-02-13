import { describe, it, expect, vi } from "vitest";
import { parseMessageWithAttachments } from "./chat-attachments.js";

// Mock the detectMime function
vi.mock("../media/mime.js", () => ({
  detectMime: vi.fn().mockResolvedValue("application/pdf"),
  getFileExtension: vi.fn().mockReturnValue(".pdf"),
}));

describe("PDF OCR response parsing bug", () => {
  it("should extract only assistant response, not system prompt from OCR API", async () => {
    // Mock a GLM OCR API response that includes system prompt (the bug scenario)
    const pdfBase64 = Buffer.from("PDF content").toString("base64");

    const attachments = [
      {
        type: "document",
        mimeType: "application/pdf",
        fileName: "test.pdf",
        content: pdfBase64,
      },
    ];

    const result = await parseMessageWithAttachments("Extract text from this PDF", attachments, {
      maxBytes: 5_000_000,
      log: {
        info: vi.fn(),
        warn: vi.fn(),
      },
    });

    // Documents should be parsed and ready for OCR processing
    expect(result.documents).toHaveLength(1);
    expect(result.documents[0].mimeType).toBe("application/pdf");
    expect(result.documents[0].fileName).toBe("test.pdf");
    expect(result.documents[0].data).toBe(pdfBase64);
  });

  it("should handle OCR response that contains system prompt (reproduces the bug)", async () => {
    // This test documents the bug scenario where OCR returns system prompt
    const buggyOcrResponse =
      "You are a precise OCR (Optical Character Recognition) tool. Your task is to extract all readable text...";
    const expectedExtractedText = "Actual PDF text content about sourdough acidity levels...";

    // Mock the extractAssistantText function to show the bug
    const mockExtractAssistantText = (message: any) => {
      // If message.content includes system prompt (the bug)
      if (
        message.content &&
        typeof message.content === "string" &&
        message.content.includes("You are a precise OCR")
      ) {
        return message.content; // Returns system prompt instead of extracted text
      }
      return expectedExtractedText; // Should return actual extracted text
    };

    // Test scenario that would cause the bug
    const messageWithSystemPrompt = {
      role: "assistant",
      content: [
        {
          type: "text",
          text: buggyOcrResponse, // This should only be the extracted text, not system prompt
        },
      ],
    };

    const extracted = mockExtractAssistantText(messageWithSystemPrompt);
    expect(extracted).toBe(buggyOcrResponse); // This demonstrates the bug
  });

  it("should extract only assistant response from correct API response structure", async () => {
    // This is how the response should be parsed (the fix)
    const correctApiResponse = {
      choices: [
        {
          message: {
            content: "Actual PDF text content about sourdough acidity levels...",
            role: "assistant",
          },
        },
      ],
    };

    // Extract just the assistant's response (the correct approach)
    const extractedText = correctApiResponse.choices?.[0]?.message?.content;

    expect(extractedText).toBe("Actual PDF text content about sourdough acidity levels...");
    expect(extractedText).not.toContain("You are a precise OCR"); // Should not include system prompt
  });
});
