import { describe, expect, it } from "vitest";
import type { MeridiaToolResultContext } from "./types.js";
import {
  detectContentSignals,
  extractTextForAnalysis,
  computeSignalStrength,
} from "./content-signals.js";

// ────────────────────────────────────────────────────────────────────────────
// extractTextForAnalysis
// ────────────────────────────────────────────────────────────────────────────

describe("extractTextForAnalysis", () => {
  it("combines args, result, and meta into a single string", () => {
    const ctx: MeridiaToolResultContext = {
      tool: { name: "exec", callId: "c1", isError: false, meta: "deploy step" },
      args: { command: "npm publish" },
      result: "published successfully",
    };
    const text = extractTextForAnalysis(ctx);
    expect(text).toContain("deploy step");
    expect(text).toContain("npm publish");
    expect(text).toContain("published successfully");
  });

  it("handles undefined args and result gracefully", () => {
    const ctx: MeridiaToolResultContext = {
      tool: { name: "read", callId: "c1", isError: false },
    };
    const text = extractTextForAnalysis(ctx);
    expect(text).toBe("");
  });

  it("caps output at 4096 characters", () => {
    const ctx: MeridiaToolResultContext = {
      tool: { name: "exec", callId: "c1", isError: false },
      result: "x".repeat(10000),
    };
    const text = extractTextForAnalysis(ctx);
    expect(text.length).toBeLessThanOrEqual(4096);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// detectContentSignals — Emotional
// ────────────────────────────────────────────────────────────────────────────

describe("detectContentSignals — emotional", () => {
  it("detects 'I feel' patterns", () => {
    const signals = detectContentSignals("I feel excited about this new feature");
    expect(signals.emotional.detected).toBe(true);
    expect(signals.emotional.keywords.length).toBeGreaterThan(0);
  });

  it("detects emotion keywords", () => {
    const signals = detectContentSignals("There was a lot of frustration with the build system");
    expect(signals.emotional.detected).toBe(true);
  });

  it("returns no detection for neutral text", () => {
    const signals = detectContentSignals("The function returns an integer value");
    expect(signals.emotional.detected).toBe(false);
    expect(signals.emotional.strength).toBe(0);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// detectContentSignals — Uncertainty
// ────────────────────────────────────────────────────────────────────────────

describe("detectContentSignals — uncertainty", () => {
  it("detects 'I don't know' patterns", () => {
    const signals = detectContentSignals("I don't know if this approach will work");
    expect(signals.uncertainty.detected).toBe(true);
  });

  it("detects 'I wonder' patterns", () => {
    const signals = detectContentSignals("I wonder if there's a better way to do this");
    expect(signals.uncertainty.detected).toBe(true);
  });

  it("detects uncertain expressions", () => {
    const signals = detectContentSignals("I'm not sure whether we should proceed");
    expect(signals.uncertainty.detected).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// detectContentSignals — Identity
// ────────────────────────────────────────────────────────────────────────────

describe("detectContentSignals — identity", () => {
  it("detects 'I am' patterns", () => {
    const signals = detectContentSignals("I am a software engineer who values clean code");
    expect(signals.identity.detected).toBe(true);
  });

  it("detects 'I value' patterns", () => {
    const signals = detectContentSignals("I value simplicity and clarity in design");
    expect(signals.identity.detected).toBe(true);
  });

  it("detects 'who I am' patterns", () => {
    const signals = detectContentSignals("This is core to who I am as a developer");
    expect(signals.identity.detected).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// detectContentSignals — Relational
// ────────────────────────────────────────────────────────────────────────────

describe("detectContentSignals — relational", () => {
  it("detects 'our dynamic' patterns", () => {
    const signals = detectContentSignals("Our dynamic has shifted since we started pairing");
    expect(signals.relational.detected).toBe(true);
  });

  it("detects 'changed how I see' patterns", () => {
    const signals = detectContentSignals("That conversation changed how I see the problem");
    expect(signals.relational.detected).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// detectContentSignals — Satisfaction
// ────────────────────────────────────────────────────────────────────────────

describe("detectContentSignals — satisfaction", () => {
  it("detects positive satisfaction", () => {
    const signals = detectContentSignals("Finally, the tests are passing! This is working");
    expect(signals.satisfaction.detected).toBe(true);
    expect(signals.satisfaction.valence).toBe("positive");
  });

  it("detects negative satisfaction", () => {
    const signals = detectContentSignals("This is frustrating, I keep hitting the same error");
    expect(signals.satisfaction.detected).toBe(true);
    expect(signals.satisfaction.valence).toBe("negative");
  });

  it("detects mixed satisfaction", () => {
    const signals = detectContentSignals("Finally solved it, but the process was frustrating");
    expect(signals.satisfaction.detected).toBe(true);
    expect(signals.satisfaction.valence).toBe("mixed");
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Edge Cases
// ────────────────────────────────────────────────────────────────────────────

describe("detectContentSignals — edge cases", () => {
  it("handles empty string", () => {
    const signals = detectContentSignals("");
    expect(signals.emotional.detected).toBe(false);
    expect(signals.uncertainty.detected).toBe(false);
    expect(signals.identity.detected).toBe(false);
    expect(signals.relational.detected).toBe(false);
    expect(signals.satisfaction.detected).toBe(false);
  });

  it("handles text with multiple signal types", () => {
    const signals = detectContentSignals(
      "I feel uncertain about who I am in this collaboration. Our dynamic changed how I see things. Finally I understand.",
    );
    expect(signals.emotional.detected).toBe(true);
    expect(signals.uncertainty.detected).toBe(true);
    expect(signals.identity.detected).toBe(true);
    expect(signals.relational.detected).toBe(true);
    expect(signals.satisfaction.detected).toBe(true);
  });

  it("does not produce false positives on technical text", () => {
    const signals = detectContentSignals(
      "SELECT * FROM users WHERE id = 1; DROP TABLE sessions; CREATE INDEX idx_name ON users(name);",
    );
    expect(signals.emotional.detected).toBe(false);
    expect(signals.identity.detected).toBe(false);
    expect(signals.relational.detected).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// computeSignalStrength
// ────────────────────────────────────────────────────────────────────────────

describe("computeSignalStrength", () => {
  it("returns 0 for no signals", () => {
    const signals = detectContentSignals("just a plain string with nothing special");
    expect(computeSignalStrength(signals)).toBe(0);
  });

  it("returns > 0 for detected signals", () => {
    const signals = detectContentSignals("I feel excited about who I am");
    expect(computeSignalStrength(signals)).toBeGreaterThan(0);
  });

  it("returns value in [0, 1]", () => {
    const signals = detectContentSignals(
      "I feel uncertain about who I am. Our dynamic changed. Finally it's working but it's frustrating.",
    );
    const strength = computeSignalStrength(signals);
    expect(strength).toBeGreaterThanOrEqual(0);
    expect(strength).toBeLessThanOrEqual(1);
  });
});
