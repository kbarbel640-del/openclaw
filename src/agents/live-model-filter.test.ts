import { describe, expect, it } from "vitest";
import { isModernModelRef } from "./live-model-filter.js";

describe("isModernModelRef", () => {
  it("matches anthropic sonnet 4.6 model refs", () => {
    expect(isModernModelRef({ provider: "anthropic", id: "claude-sonnet-4-6" })).toBe(true);
    expect(
      isModernModelRef({
        provider: "openrouter",
        id: "anthropic/claude-sonnet-4-6",
      }),
    ).toBe(true);
  });

  it("does not match older anthropic sonnet ids that are not in modern prefixes", () => {
    expect(isModernModelRef({ provider: "anthropic", id: "claude-sonnet-3-5" })).toBe(false);
  });
});
