import { describe, expect, it } from "vitest";

import { normalizeDeepResearchTopic } from "./topic.js";

describe("normalizeDeepResearchTopic", () => {
  it("normalizes whitespace and trims", () => {
    const result = normalizeDeepResearchTopic("  AI \n safety  ");

    expect(result).toEqual({ topic: "AI safety", truncated: false });
  });

  it("returns null for empty topics", () => {
    expect(normalizeDeepResearchTopic("   ")).toBeNull();
  });

  it("keeps long topics intact", () => {
    const longTopic = "a".repeat(400);
    const result = normalizeDeepResearchTopic(longTopic);

    expect(result?.topic).toBe(longTopic);
    expect(result?.truncated).toBe(false);
  });
});
