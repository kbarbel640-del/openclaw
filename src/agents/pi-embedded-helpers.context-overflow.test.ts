import { describe, expect, it } from "vitest";
import { sanitizeUserFacingText } from "./pi-embedded-helpers.js";

describe("sanitizeUserFacingText - Context Overflow Fix", () => {
  it("should rewrite raw context overflow errors", () => {
    const error = "context overflow: maximum context length exceeded";
    expect(sanitizeUserFacingText(error)).toContain("Context overflow: prompt too large");
  });

  it("should NOT rewrite conversational text mentioning context overflow", () => {
    const conversational =
      "I encountered a context overflow error earlier, but I have adjusted my response length to fit within the limits. Here is the answer you requested.";

    expect(sanitizeUserFacingText(conversational)).toBe(conversational);
  });

  it("should NOT rewrite markdown text mentioning context overflow", () => {
    const markdown =
      "## Error Analysis\n\nThe previous attempt failed due to a context overflow error. Let me summarize differently.";

    expect(sanitizeUserFacingText(markdown)).toBe(markdown);
  });
});
