import { describe, expect, it } from "vitest";
import { isRenderablePayload } from "./reply-payloads.js";

describe("isRenderablePayload", () => {
  it("returns true for payload with text", () => {
    expect(isRenderablePayload({ text: "hello" })).toBe(true);
  });

  it("returns true for payload with mediaUrl", () => {
    expect(isRenderablePayload({ mediaUrl: "https://example.com/img.png" })).toBe(true);
  });

  it("returns true for payload with mediaUrls", () => {
    expect(isRenderablePayload({ mediaUrls: ["https://example.com/a.png"] })).toBe(true);
  });

  it("returns true for payload with audioAsVoice", () => {
    expect(isRenderablePayload({ audioAsVoice: true })).toBe(true);
  });

  it("returns true for payload with channelData", () => {
    expect(isRenderablePayload({ channelData: { key: "value" } })).toBe(true);
  });

  it("returns false for empty payload", () => {
    expect(isRenderablePayload({})).toBe(false);
  });

  it("returns false for error payload even with text", () => {
    expect(isRenderablePayload({ text: "Context overflow error", isError: true })).toBe(false);
  });

  it("returns false for error payload with media", () => {
    expect(isRenderablePayload({ mediaUrl: "https://example.com/img.png", isError: true })).toBe(
      false,
    );
  });

  it("returns true for non-error payload with isError explicitly false", () => {
    expect(isRenderablePayload({ text: "hello", isError: false })).toBe(true);
  });
});
