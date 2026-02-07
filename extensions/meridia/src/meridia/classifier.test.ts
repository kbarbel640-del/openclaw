import { describe, expect, it } from "vitest";
import type { MeridiaToolResultContext } from "./types.js";
import { classifyMemoryType } from "./classifier.js";
import { detectContentSignals } from "./content-signals.js";

// ────────────────────────────────────────────────────────────────────────────
// Test Helpers
// ────────────────────────────────────────────────────────────────────────────

function makeCtx(overrides: Partial<MeridiaToolResultContext> = {}): MeridiaToolResultContext {
  return {
    tool: { name: "exec", callId: "test-1", isError: false },
    ...overrides,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Identity Classification
// ────────────────────────────────────────────────────────────────────────────

describe("classifyMemoryType — identity", () => {
  it("classifies identity signals as identity type", () => {
    const signals = detectContentSignals("I am a developer. I value clean code and simplicity.");
    const result = classifyMemoryType({ ctx: makeCtx(), signals });

    expect(result.memoryType).toBe("identity");
    expect(result.confidence).toBe(0.85);
    expect(result.reasons).toContain("identity_patterns:2");
  });

  it("detects 'who I am' as identity", () => {
    const signals = detectContentSignals("This is core to who I am");
    const result = classifyMemoryType({ ctx: makeCtx(), signals });

    expect(result.memoryType).toBe("identity");
  });

  it("identity takes priority over experiential signals", () => {
    const signals = detectContentSignals(
      "I feel excited about who I am becoming. I'm uncertain about my values.",
    );
    const result = classifyMemoryType({ ctx: makeCtx(), signals });

    // Identity should win even with emotional + uncertainty present
    expect(result.memoryType).toBe("identity");
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Experiential Classification
// ────────────────────────────────────────────────────────────────────────────

describe("classifyMemoryType — experiential", () => {
  it("classifies strong emotional content as experiential", () => {
    const signals = detectContentSignals(
      "I feel deeply frustrated. This anxiety about the deadline is overwhelming.",
    );
    const result = classifyMemoryType({ ctx: makeCtx(), signals });

    expect(result.memoryType).toBe("experiential");
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.reasons).toContain("emotional_content");
  });

  it("classifies experience_capture tool as experiential", () => {
    const ctx = makeCtx({
      tool: { name: "experience_capture", callId: "c1", isError: false },
    });
    const signals = detectContentSignals("some plain text");
    const result = classifyMemoryType({ ctx, signals });

    expect(result.memoryType).toBe("experiential");
    expect(result.confidence).toBe(0.7);
    expect(result.reasons).toContain("experience_capture_tool");
  });

  it("classifies precompact kind as experiential", () => {
    const signals = detectContentSignals("session context summary");
    const result = classifyMemoryType({
      ctx: makeCtx(),
      signals,
      kind: "precompact",
    });

    expect(result.memoryType).toBe("experiential");
    expect(result.confidence).toBe(0.6);
  });

  it("classifies session_end kind as experiential", () => {
    const signals = detectContentSignals("session ended");
    const result = classifyMemoryType({
      ctx: makeCtx(),
      signals,
      kind: "session_end",
    });

    expect(result.memoryType).toBe("experiential");
    expect(result.confidence).toBe(0.6);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Factual Classification
// ────────────────────────────────────────────────────────────────────────────

describe("classifyMemoryType — factual", () => {
  it("classifies neutral tool output as factual", () => {
    const signals = detectContentSignals("File written: src/main.ts (234 bytes)");
    const result = classifyMemoryType({ ctx: makeCtx(), signals });

    expect(result.memoryType).toBe("factual");
    expect(result.confidence).toBe(0.7);
  });

  it("classifies code output as factual", () => {
    const signals = detectContentSignals(
      "function add(a: number, b: number): number { return a + b; }",
    );
    const result = classifyMemoryType({ ctx: makeCtx(), signals });

    expect(result.memoryType).toBe("factual");
  });

  it("classifies technical data as factual", () => {
    const signals = detectContentSignals(
      "SELECT COUNT(*) FROM users WHERE created_at > '2024-01-01'; Result: 42 rows",
    );
    const result = classifyMemoryType({ ctx: makeCtx(), signals });

    expect(result.memoryType).toBe("factual");
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Confidence Levels
// ────────────────────────────────────────────────────────────────────────────

describe("classifyMemoryType — confidence", () => {
  it("returns high confidence for identity signals", () => {
    const signals = detectContentSignals("I believe in open source. I value transparency.");
    const result = classifyMemoryType({ ctx: makeCtx(), signals });

    expect(result.confidence).toBe(0.85);
  });

  it("returns proportional confidence for experiential signals", () => {
    const signals = detectContentSignals(
      "I feel very anxious about this. I wonder if it will work. Our collaboration has changed.",
    );
    const result = classifyMemoryType({ ctx: makeCtx(), signals });

    if (result.memoryType === "experiential") {
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.confidence).toBeLessThanOrEqual(0.95);
    }
  });

  it("returns 0.7 confidence for factual default", () => {
    const signals = detectContentSignals("plain data output");
    const result = classifyMemoryType({ ctx: makeCtx(), signals });

    expect(result.memoryType).toBe("factual");
    expect(result.confidence).toBe(0.7);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Reasons
// ────────────────────────────────────────────────────────────────────────────

describe("classifyMemoryType — reasons", () => {
  it("always returns at least one reason", () => {
    const signals = detectContentSignals("");
    const result = classifyMemoryType({ ctx: makeCtx(), signals });

    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("includes specific signal types in reasons", () => {
    const signals = detectContentSignals("I feel uncertain about our dynamic");
    const result = classifyMemoryType({ ctx: makeCtx(), signals });

    // Should have at least one signal-related reason
    const hasSignalReason = result.reasons.some(
      (r) =>
        r.includes("emotional") ||
        r.includes("uncertainty") ||
        r.includes("relational") ||
        r.includes("identity"),
    );
    expect(hasSignalReason).toBe(true);
  });
});
