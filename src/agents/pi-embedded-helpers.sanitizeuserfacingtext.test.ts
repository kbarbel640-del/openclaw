import { describe, expect, it } from "vitest";
import { sanitizeUserFacingText } from "./pi-embedded-helpers.js";

describe("sanitizeUserFacingText", () => {
  it("strips final tags", () => {
    expect(sanitizeUserFacingText("<final>Hello</final>")).toBe("Hello");
    expect(sanitizeUserFacingText("Hi <final>there</final>!")).toBe("Hi there!");
  });

  it("does not clobber normal numeric prefixes", () => {
    expect(sanitizeUserFacingText("202 results found")).toBe("202 results found");
    expect(sanitizeUserFacingText("400 days left")).toBe("400 days left");
  });

  it("sanitizes role ordering errors", () => {
    const result = sanitizeUserFacingText("400 Incorrect role information");
    expect(result).toContain("Message ordering conflict");
  });

  it("sanitizes HTTP status errors with error hints", () => {
    expect(sanitizeUserFacingText("500 Internal Server Error")).toBe(
      "HTTP 500: Internal Server Error",
    );
  });

  it("sanitizes raw API error payloads", () => {
    const raw = '{"type":"error","error":{"message":"Something exploded","type":"server_error"}}';
    expect(sanitizeUserFacingText(raw)).toBe("LLM error server_error: Something exploded");
  });

  it("collapses consecutive duplicate paragraphs", () => {
    const text = "Hello there!\n\nHello there!";
    expect(sanitizeUserFacingText(text)).toBe("Hello there!");
  });

  it("does not collapse distinct paragraphs", () => {
    const text = "Hello there!\n\nDifferent line.";
    expect(sanitizeUserFacingText(text)).toBe(text);
  });

  it("sanitizes Brave Search API rate limit errors", () => {
    const raw =
      'Brave Search API error (429): {"type":"ErrorResponse","error":{"id":"32433a2a-3426-4831-8123-4553d4be9455","status":429,"detail":"Request rate limit exceeded for plan","meta":{"plan":"Free","rate_limit":1,"rate_current":1,"quota_limit":2000,"quota_current":210},"code":"RATE_LIMITED"},"time":1771039449}';
    const result = sanitizeUserFacingText(raw);
    expect(result).not.toContain("32433a2a");
    expect(result).not.toContain("quota_current");
    expect(result).not.toContain("ErrorResponse");
    expect(result.toLowerCase()).toMatch(/rate.?limit|too many requests|try again/);
  });

  it("sanitizes tool execution errors with filesystem paths", () => {
    const raw =
      "Could not find exact text to replace in /Users/wade.digital/.openclaw/workspace/memory/2026-02-14.md";
    const result = sanitizeUserFacingText(raw);
    expect(result).not.toContain("/Users/wade.digital");
    expect(result).not.toContain(".openclaw/workspace");
  });

  it("sanitizes generic external API error JSON payloads", () => {
    const raw =
      '{"type":"ErrorResponse","error":{"status":429,"detail":"Request rate limit exceeded for plan","meta":{"plan":"Free","rate_limit":1},"code":"RATE_LIMITED"}}';
    const result = sanitizeUserFacingText(raw);
    expect(result).not.toContain("RATE_LIMITED");
    expect(result).not.toContain('"meta"');
  });
});
