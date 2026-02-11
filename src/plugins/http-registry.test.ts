import { describe, expect, it } from "vitest";
import { safeEqual } from "./http-registry.js";

describe("http-registry safeEqual", () => {
  it("returns true for identical ASCII strings", () => {
    expect(safeEqual("secret-token-123", "secret-token-123")).toBe(true);
  });

  it("returns false for different strings", () => {
    expect(safeEqual("secret", "wrong!")).toBe(false);
  });

  it("returns false for same-length but different strings", () => {
    expect(safeEqual("aaaaaa", "bbbbbb")).toBe(false);
  });

  it("does not throw on non-ASCII strings with equal code-unit length but different byte length", () => {
    // "é" (U+00E9, 1 code unit, 2 bytes) vs "ñ" (U+00F1, 1 code unit, 2 bytes)
    // Both same string length AND same byte length — should not throw.
    expect(() => safeEqual("é", "ñ")).not.toThrow();
    expect(safeEqual("é", "ñ")).toBe(false);
  });

  it("does not throw when string lengths match but byte lengths differ", () => {
    // "\u0041" = "A" (1 byte), "\u00C0" = "À" (2 bytes in UTF-8).
    // Both are 1 JS code unit, but Buffer.from produces different byte lengths.
    // The old implementation would have thrown RangeError here.
    expect(() => safeEqual("\u0041", "\u00C0")).not.toThrow();
    expect(safeEqual("\u0041", "\u00C0")).toBe(false);
  });

  it("handles empty strings", () => {
    expect(safeEqual("", "")).toBe(true);
  });

  it("returns false for empty vs non-empty", () => {
    expect(safeEqual("", "x")).toBe(false);
  });
});
