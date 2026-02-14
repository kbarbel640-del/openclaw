import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../../config/config.js";
import {
  DEFAULT_PROACTIVE_THRESHOLD,
  resolveProactiveContextWindowTokens,
  resolveProactiveThreshold,
  shouldRunProactiveCompaction,
} from "./proactive-compaction.js";

describe("resolveProactiveThreshold", () => {
  it("returns default threshold when config is undefined", () => {
    const result = resolveProactiveThreshold(undefined);
    expect(result).toBe(DEFAULT_PROACTIVE_THRESHOLD);
  });

  it("returns default when proactiveThreshold is not set", () => {
    const cfg = {
      agents: { defaults: { compaction: {} } },
    } satisfies OpenClawConfig;
    const result = resolveProactiveThreshold(cfg);
    expect(result).toBe(DEFAULT_PROACTIVE_THRESHOLD);
  });

  it("returns configured threshold within valid range", () => {
    const cfg = {
      agents: { defaults: { compaction: { proactiveThreshold: 0.6 } } },
    } satisfies OpenClawConfig;
    const result = resolveProactiveThreshold(cfg);
    expect(result).toBe(0.6);
  });

  it("returns default when threshold is below 0.1", () => {
    const cfg = {
      agents: { defaults: { compaction: { proactiveThreshold: 0.05 } } },
    } satisfies OpenClawConfig;
    const result = resolveProactiveThreshold(cfg);
    expect(result).toBe(DEFAULT_PROACTIVE_THRESHOLD);
  });

  it("returns default when threshold is above 1.0", () => {
    const cfg = {
      agents: { defaults: { compaction: { proactiveThreshold: 1.5 } } },
    } satisfies OpenClawConfig;
    const result = resolveProactiveThreshold(cfg);
    expect(result).toBe(DEFAULT_PROACTIVE_THRESHOLD);
  });

  it("returns default when threshold is NaN", () => {
    const cfg = {
      agents: { defaults: { compaction: { proactiveThreshold: Number.NaN } } },
    } satisfies OpenClawConfig;
    const result = resolveProactiveThreshold(cfg);
    expect(result).toBe(DEFAULT_PROACTIVE_THRESHOLD);
  });

  it("accepts boundary value 0.1", () => {
    const cfg = {
      agents: { defaults: { compaction: { proactiveThreshold: 0.1 } } },
    } satisfies OpenClawConfig;
    const result = resolveProactiveThreshold(cfg);
    expect(result).toBe(0.1);
  });

  it("accepts boundary value 1.0", () => {
    const cfg = {
      agents: { defaults: { compaction: { proactiveThreshold: 1.0 } } },
    } satisfies OpenClawConfig;
    const result = resolveProactiveThreshold(cfg);
    expect(result).toBe(1.0);
  });
});

describe("resolveProactiveContextWindowTokens", () => {
  it("falls back to default when no parameters provided", () => {
    const result = resolveProactiveContextWindowTokens({});
    // Should return the default context tokens (200_000)
    expect(result).toBeGreaterThan(0);
  });

  it("uses agentCfgContextTokens when provided", () => {
    const result = resolveProactiveContextWindowTokens({
      agentCfgContextTokens: 100_000,
    });
    expect(result).toBe(100_000);
  });
});

describe("shouldRunProactiveCompaction", () => {
  it("returns false when already attempted", () => {
    const result = shouldRunProactiveCompaction({
      entry: { totalTokens: 80_000, contextTokens: 100_000 },
      contextWindowTokens: 100_000,
      threshold: 0.75,
      alreadyAttempted: true,
    });
    expect(result).toBe(false);
  });

  it("returns false when entry is undefined", () => {
    const result = shouldRunProactiveCompaction({
      entry: undefined,
      contextWindowTokens: 100_000,
      threshold: 0.75,
    });
    expect(result).toBe(false);
  });

  it("returns false when totalTokens is missing", () => {
    const result = shouldRunProactiveCompaction({
      entry: { totalTokens: undefined, contextTokens: 100_000 },
      contextWindowTokens: 100_000,
      threshold: 0.75,
    });
    expect(result).toBe(false);
  });

  it("returns false when usage is below threshold", () => {
    const result = shouldRunProactiveCompaction({
      entry: { totalTokens: 50_000, contextTokens: 100_000 },
      contextWindowTokens: 100_000,
      threshold: 0.75,
    });
    expect(result).toBe(false);
  });

  it("returns true when usage equals threshold", () => {
    const result = shouldRunProactiveCompaction({
      entry: { totalTokens: 75_000, contextTokens: 100_000 },
      contextWindowTokens: 100_000,
      threshold: 0.75,
    });
    expect(result).toBe(true);
  });

  it("returns true when usage exceeds threshold", () => {
    const result = shouldRunProactiveCompaction({
      entry: { totalTokens: 85_000, contextTokens: 100_000 },
      contextWindowTokens: 100_000,
      threshold: 0.75,
    });
    expect(result).toBe(true);
  });

  it("uses contextWindowTokens when entry lacks contextTokens", () => {
    const result = shouldRunProactiveCompaction({
      entry: { totalTokens: 80_000, contextTokens: undefined },
      contextWindowTokens: 100_000,
      threshold: 0.75,
    });
    expect(result).toBe(true);
  });

  it("prefers entry contextTokens over contextWindowTokens", () => {
    // totalTokens 80k against entry's 200k = 40% (below threshold)
    const result = shouldRunProactiveCompaction({
      entry: { totalTokens: 80_000, contextTokens: 200_000 },
      contextWindowTokens: 100_000, // Would be 80% if used
      threshold: 0.75,
    });
    expect(result).toBe(false);
  });

  it("exports DEFAULT_PROACTIVE_THRESHOLD", () => {
    expect(DEFAULT_PROACTIVE_THRESHOLD).toBe(0.75);
  });
});
