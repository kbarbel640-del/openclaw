import { describe, expect, it } from "vitest";
import { stripImageContentForTextModel } from "./images.js";

describe("stripImageContentForTextModel", () => {
  it("returns messages unchanged when there are no image blocks", () => {
    const messages = [
      { role: "user" as const, content: [{ type: "text" as const, text: "Hello" }] },
      { role: "assistant" as const, content: [{ type: "text" as const, text: "Hi there" }] },
    ];
    const { messages: result, strippedCount } = stripImageContentForTextModel(messages);
    expect(strippedCount).toBe(0);
    expect(result).toEqual(messages);
  });

  it("strips image blocks from user messages", () => {
    const messages = [
      {
        role: "user" as const,
        content: [
          { type: "text" as const, text: "What is in this image?" },
          { type: "image" as const, data: "base64data", mediaType: "image/png" },
        ],
      },
    ];
    const { messages: result, strippedCount } = stripImageContentForTextModel(messages);
    expect(strippedCount).toBe(1);
    expect(result).toHaveLength(1);
    const content = (result[0] as { content: unknown[] }).content;
    expect(content).toHaveLength(2);
    expect(content[0]).toEqual({ type: "text", text: "What is in this image?" });
    expect(content[1]).toEqual({
      type: "text",
      text: "[An image was shared but is not available to this model]",
    });
  });

  it("strips multiple image blocks from a single user message", () => {
    const messages = [
      {
        role: "user" as const,
        content: [
          { type: "text" as const, text: "Compare these" },
          { type: "image" as const, data: "img1", mediaType: "image/png" },
          { type: "image" as const, data: "img2", mediaType: "image/jpeg" },
        ],
      },
    ];
    const { messages: result, strippedCount } = stripImageContentForTextModel(messages);
    expect(strippedCount).toBe(2);
    const content = (result[0] as { content: unknown[] }).content;
    expect(content).toHaveLength(2);
    expect(content[1]).toEqual({
      type: "text",
      text: "[2 images were shared but are not available to this model]",
    });
  });

  it("strips image blocks from toolResult messages", () => {
    const messages = [
      {
        role: "toolResult" as const,
        toolCallId: "call_123",
        content: [
          { type: "text" as const, text: "Screenshot taken" },
          { type: "image" as const, data: "screenshot", mediaType: "image/png" },
        ],
      },
    ];
    const { messages: result, strippedCount } = stripImageContentForTextModel(messages);
    expect(strippedCount).toBe(1);
    const content = (result[0] as { content: unknown[] }).content;
    expect(content).toHaveLength(2);
    expect(content[0]).toEqual({ type: "text", text: "Screenshot taken" });
    expect(content[1]).toEqual({
      type: "text",
      text: "[image content stripped for text model]",
    });
  });

  it("does not modify assistant messages", () => {
    const messages = [
      {
        role: "assistant" as const,
        content: [{ type: "text" as const, text: "I can see the image" }],
      },
    ];
    const { messages: result, strippedCount } = stripImageContentForTextModel(messages);
    expect(strippedCount).toBe(0);
    expect(result).toEqual(messages);
  });

  it("handles user messages with string content", () => {
    const messages = [{ role: "user" as const, content: "Hello" }];
    const { messages: result, strippedCount } = stripImageContentForTextModel(messages);
    expect(strippedCount).toBe(0);
    expect(result).toEqual(messages);
  });

  it("handles empty messages array", () => {
    const { messages: result, strippedCount } = stripImageContentForTextModel([]);
    expect(strippedCount).toBe(0);
    expect(result).toEqual([]);
  });

  it("strips images across multiple messages", () => {
    const messages = [
      {
        role: "user" as const,
        content: [
          { type: "text" as const, text: "Image 1" },
          { type: "image" as const, data: "img1", mediaType: "image/png" },
        ],
      },
      {
        role: "assistant" as const,
        content: [{ type: "text" as const, text: "I see a cat" }],
      },
      {
        role: "user" as const,
        content: [
          { type: "text" as const, text: "Image 2" },
          { type: "image" as const, data: "img2", mediaType: "image/jpeg" },
        ],
      },
    ];
    const { messages: result, strippedCount } = stripImageContentForTextModel(messages);
    expect(strippedCount).toBe(2);
    expect(result).toHaveLength(3);
    // First user message stripped
    const content1 = (result[0] as { content: unknown[] }).content;
    expect(content1.some((b: { type?: string }) => b.type === "image")).toBe(false);
    // Assistant message unchanged
    expect(result[1]).toEqual(messages[1]);
    // Second user message stripped
    const content2 = (result[2] as { content: unknown[] }).content;
    expect(content2.some((b: { type?: string }) => b.type === "image")).toBe(false);
  });

  it("preserves message properties other than content", () => {
    const messages = [
      {
        role: "user" as const,
        content: [
          { type: "text" as const, text: "test" },
          { type: "image" as const, data: "img", mediaType: "image/png" },
        ],
      },
    ];
    const { messages: result } = stripImageContentForTextModel(messages);
    expect((result[0] as { role: string }).role).toBe("user");
  });
});
