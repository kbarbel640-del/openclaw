import { describe, it, expect } from "vitest";
import { buildUntrustedChannelMetadata } from "./channel-metadata.js";

describe("channel-metadata truncation surrogate safety", () => {
  it("does not break emoji in metadata entries", () => {
    // Create an entry with emoji near the truncation boundary
    const emoji = "🎉";
    const long = "a".repeat(398) + emoji;
    const result = buildUntrustedChannelMetadata({
      source: "test",
      label: "test",
      entries: [long],
    });
    expect(result).toBeDefined();
    // Must not contain lone surrogates
    expect(result).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
    expect(result).not.toMatch(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/);
  });
});
