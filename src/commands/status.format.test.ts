import { describe, expect, it } from "vitest";
import { formatTokensCompact } from "./status.format.js";

describe("formatTokensCompact", () => {
  const base = {
    totalTokens: 28_000,
    contextTokens: 200_000,
    percentUsed: 14,
  };

  it("shows cache hit rate when cacheRead is present", () => {
    const result = formatTokensCompact({ ...base, cacheRead: 14_000 });
    expect(result).toContain("50% cached");
  });

  it("caps cache hit rate at 100% when cacheRead exceeds totalTokens", () => {
    // Reproduces the 1142% bug seen in cron sessions where cumulative cacheRead
    // can be much larger than the totalTokens of the last run.
    const result = formatTokensCompact({ ...base, cacheRead: 320_000 });
    // Should be clamped to 100%, not raw 1142%
    expect(result).toContain("100% cached");
  });

  it("does not show cache section when cacheRead is 0", () => {
    const result = formatTokensCompact({ ...base, cacheRead: 0 });
    expect(result).not.toContain("cached");
  });

  it("does not show cache section when cacheRead is absent", () => {
    const result = formatTokensCompact(base);
    expect(result).not.toContain("cached");
  });
});
