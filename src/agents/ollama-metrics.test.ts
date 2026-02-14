import { describe, it, expect } from "vitest";
import { extractMetrics, formatMetrics, formatMetricsCompact } from "./ollama-metrics.js";

describe("ollama-metrics", () => {
  // Realistic Ollama response fields (nanoseconds)
  const fullResponse = {
    total_duration: 5_000_000_000, // 5s
    load_duration: 200_000_000, // 200ms
    prompt_eval_count: 42,
    prompt_eval_duration: 800_000_000, // 800ms
    eval_count: 156,
    eval_duration: 3_700_000_000, // 3.7s
  };

  it("extracts metrics from complete response", () => {
    const m = extractMetrics(fullResponse);
    expect(m).not.toBeNull();
    expect(m!.totalDurationMs).toBeCloseTo(5000, 0);
    expect(m!.loadDurationMs).toBeCloseTo(200, 0);
    expect(m!.promptEvalDurationMs).toBeCloseTo(800, 0);
    expect(m!.evalDurationMs).toBeCloseTo(3700, 0);
    expect(m!.promptTokens).toBe(42);
    expect(m!.evalTokens).toBe(156);
    expect(m!.timeToFirstToken).toBeCloseTo(1000, 0); // 200 + 800
  });

  it("calculates tokens/sec correctly", () => {
    const m = extractMetrics(fullResponse)!;
    // 156 / 3.7 ≈ 42.16
    expect(m.tokensPerSecond).toBeCloseTo(42.16, 1);
    // 42 / 0.8 = 52.5
    expect(m.promptTokensPerSecond).toBeCloseTo(52.5, 1);
  });

  it("returns null when no eval fields present", () => {
    expect(extractMetrics({})).toBeNull();
    expect(extractMetrics({ total_duration: 1000 })).toBeNull();
  });

  it("handles partial fields gracefully", () => {
    const m = extractMetrics({ eval_count: 10, eval_duration: 1_000_000_000 });
    expect(m).not.toBeNull();
    expect(m!.evalTokens).toBe(10);
    expect(m!.tokensPerSecond).toBeCloseTo(10, 0);
    expect(m!.loadDurationMs).toBe(0);
    expect(m!.promptTokens).toBe(0);
  });

  it("avoids division by zero with zero duration", () => {
    const m = extractMetrics({ eval_count: 5, eval_duration: 0 });
    expect(m).not.toBeNull();
    expect(m!.tokensPerSecond).toBe(0);
    expect(m!.promptTokensPerSecond).toBe(0);
  });

  it("formatMetrics produces expected string", () => {
    const m = extractMetrics(fullResponse)!;
    const s = formatMetrics(m);
    expect(s).toMatch(/42\.\d tok\/s/);
    expect(s).toContain("to first token");
    expect(s).toContain("156 tokens generated");
  });

  it("formatMetricsCompact produces expected string", () => {
    const m = extractMetrics(fullResponse)!;
    const s = formatMetricsCompact(m);
    expect(s).toMatch(/42\.\d t\/s/);
    expect(s).toContain("TTFT");
  });

  it("formats sub-second TTFT in ms", () => {
    const m = extractMetrics({
      eval_count: 10,
      eval_duration: 500_000_000,
      load_duration: 50_000_000,
      prompt_eval_duration: 100_000_000,
    })!;
    // TTFT = 50 + 100 = 150ms
    expect(formatMetricsCompact(m)).toContain("150ms TTFT");
  });
});
