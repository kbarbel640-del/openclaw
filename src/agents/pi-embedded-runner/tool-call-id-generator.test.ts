import { describe, expect, it } from "vitest";

/**
 * Generate a 9-character alphanumeric tool call ID.
 * Required for Mistral API compatibility (strict9 format).
 * Uses only a-z, A-Z, 0-9 characters.
 */
function generateToolCallId(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 9; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

describe("generateToolCallId (Mistral compatibility)", () => {
  it("generates exactly 9 characters", () => {
    const id = generateToolCallId();
    expect(id.length).toBe(9);
  });

  it("generates only alphanumeric characters", () => {
    // Test multiple times to ensure randomness doesn't accidentally pass
    for (let i = 0; i < 100; i++) {
      const id = generateToolCallId();
      expect(id).toMatch(/^[a-zA-Z0-9]{9}$/);
    }
  });

  it("does not contain underscores (Mistral requirement)", () => {
    for (let i = 0; i < 100; i++) {
      const id = generateToolCallId();
      expect(id).not.toContain("_");
    }
  });

  it("does not contain hyphens (Mistral requirement)", () => {
    for (let i = 0; i < 100; i++) {
      const id = generateToolCallId();
      expect(id).not.toContain("-");
    }
  });

  it("generates unique IDs (probabilistic)", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      ids.add(generateToolCallId());
    }
    // With 62^9 possible combinations, collisions in 1000 samples should be extremely rare
    expect(ids.size).toBeGreaterThan(900);
  });
});
