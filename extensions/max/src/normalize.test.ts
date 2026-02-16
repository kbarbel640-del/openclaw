import { describe, expect, it } from "vitest";
import { looksLikeMaxTargetId, normalizeMaxMessagingTarget } from "./normalize.js";

describe("looksLikeMaxTargetId", () => {
  it("accepts positive numeric IDs", () => {
    expect(looksLikeMaxTargetId("12345")).toBe(true);
    expect(looksLikeMaxTargetId("1")).toBe(true);
    expect(looksLikeMaxTargetId("999999999")).toBe(true);
  });

  it("accepts negative numeric IDs (groups)", () => {
    expect(looksLikeMaxTargetId("-12345")).toBe(true);
    expect(looksLikeMaxTargetId("-1")).toBe(true);
  });

  it("accepts max: prefixed IDs (case-insensitive)", () => {
    expect(looksLikeMaxTargetId("max:12345")).toBe(true);
    expect(looksLikeMaxTargetId("MAX:12345")).toBe(true);
    expect(looksLikeMaxTargetId("Max:999")).toBe(true);
  });

  it("rejects empty and whitespace strings", () => {
    expect(looksLikeMaxTargetId("")).toBe(false);
    expect(looksLikeMaxTargetId("   ")).toBe(false);
  });

  it("rejects non-numeric, non-prefixed strings", () => {
    expect(looksLikeMaxTargetId("hello")).toBe(false);
    expect(looksLikeMaxTargetId("@username")).toBe(false);
    expect(looksLikeMaxTargetId("telegram:12345")).toBe(false);
    expect(looksLikeMaxTargetId("abc123")).toBe(false);
  });

  it("trims input before checking", () => {
    expect(looksLikeMaxTargetId("  12345  ")).toBe(true);
    expect(looksLikeMaxTargetId("  max:123  ")).toBe(true);
  });

  it("rejects max: prefix with no ID", () => {
    // "max:" alone still matches the regex /^max:/i — it looks like a MAX target
    expect(looksLikeMaxTargetId("max:")).toBe(true);
  });
});

describe("normalizeMaxMessagingTarget", () => {
  it("returns numeric IDs unchanged", () => {
    expect(normalizeMaxMessagingTarget("12345")).toBe("12345");
    expect(normalizeMaxMessagingTarget("999")).toBe("999");
  });

  it("returns negative numeric IDs (groups)", () => {
    expect(normalizeMaxMessagingTarget("-12345")).toBe("-12345");
  });

  it("strips max: prefix and returns numeric part", () => {
    expect(normalizeMaxMessagingTarget("max:12345")).toBe("12345");
    expect(normalizeMaxMessagingTarget("MAX:67890")).toBe("67890");
    expect(normalizeMaxMessagingTarget("Max:1")).toBe("1");
  });

  it("strips max: prefix with negative IDs", () => {
    expect(normalizeMaxMessagingTarget("max:-100")).toBe("-100");
  });

  it("returns undefined for empty input", () => {
    expect(normalizeMaxMessagingTarget("")).toBeUndefined();
    expect(normalizeMaxMessagingTarget("   ")).toBeUndefined();
  });

  it("returns undefined for non-numeric after stripping prefix", () => {
    expect(normalizeMaxMessagingTarget("max:abc")).toBeUndefined();
    expect(normalizeMaxMessagingTarget("max:")).toBeUndefined();
    expect(normalizeMaxMessagingTarget("hello")).toBeUndefined();
  });

  it("returns undefined for mixed alphanumeric", () => {
    expect(normalizeMaxMessagingTarget("abc123")).toBeUndefined();
    expect(normalizeMaxMessagingTarget("max:12abc")).toBeUndefined();
  });

  it("trims whitespace", () => {
    expect(normalizeMaxMessagingTarget("  12345  ")).toBe("12345");
    expect(normalizeMaxMessagingTarget("  max:123  ")).toBe("123");
  });
});
