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
      "The AI service returned an error. Please try again.",
    );
  });

  it("sanitizes raw API error payloads", () => {
    const raw = '{"type":"error","error":{"message":"Something exploded","type":"server_error"}}';
    expect(sanitizeUserFacingText(raw)).toBe("The AI service returned an error. Please try again.");
  });

  it("does not replace multi-paragraph assistant prose", () => {
    const prose =
      "Error handling is an important part of building robust applications.\n\n" +
      "When a 500 Internal Server Error occurs, you should log the error and return a user-friendly message.";
    expect(sanitizeUserFacingText(prose)).toBe(prose);
  });

  it("does not replace assistant text discussing billing topics", () => {
    const billingProse =
      "Here's how Stripe billing works:\n\n" +
      "1. Create a plan with the pricing you want\n" +
      "2. Subscribe customers to the plan\n" +
      "3. Payment is collected automatically via credits";
    expect(sanitizeUserFacingText(billingProse)).toBe(billingProse);
  });

  it("does not replace long text starting with error-like prefix", () => {
    const longError =
      "Error handling in distributed systems requires careful consideration.\n\n" +
      "You need to handle timeouts, retries, and circuit breakers properly.";
    expect(sanitizeUserFacingText(longError)).toBe(longError);
  });

  it("does not replace text with markdown formatting", () => {
    const markdown = "## Error Codes\n\n- 400: Bad request\n- 500: Internal server error";
    expect(sanitizeUserFacingText(markdown)).toBe(markdown);
  });

  it("still catches short actual error messages", () => {
    expect(sanitizeUserFacingText("Error: rate limit exceeded")).toBe(
      "The AI service is temporarily overloaded. Please try again in a moment.",
    );
    expect(sanitizeUserFacingText("Error: request timed out")).toBe("LLM request timed out.");
    expect(sanitizeUserFacingText("Failed: overloaded")).toBe(
      "The AI service is temporarily overloaded. Please try again in a moment.",
    );
  });
});
