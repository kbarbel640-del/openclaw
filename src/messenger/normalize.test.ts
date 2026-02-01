import { describe, expect, it } from "vitest";
import {
  formatMessengerTarget,
  isMessengerPsid,
  looksLikeMessengerTarget,
  normalizeMessengerAllowFromEntry,
  normalizeMessengerTarget,
} from "./normalize.js";

describe("isMessengerPsid", () => {
  it("accepts valid PSIDs", () => {
    expect(isMessengerPsid("1234567890123456")).toBe(true);
    expect(isMessengerPsid("12345678901234567890")).toBe(true);
    expect(isMessengerPsid("1234567890")).toBe(true);
  });

  it("accepts prefixed PSIDs", () => {
    expect(isMessengerPsid("messenger:1234567890123456")).toBe(true);
    expect(isMessengerPsid("fb:1234567890123456")).toBe(true);
    expect(isMessengerPsid("facebook:1234567890123456")).toBe(true);
  });

  it("rejects invalid values", () => {
    expect(isMessengerPsid("")).toBe(false);
    expect(isMessengerPsid("abc")).toBe(false);
    expect(isMessengerPsid("123")).toBe(false); // too short
    expect(isMessengerPsid("123456789012345678901")).toBe(false); // too long
    expect(isMessengerPsid("12345abc67890")).toBe(false); // contains letters
  });
});

describe("normalizeMessengerTarget", () => {
  it("normalizes plain PSIDs", () => {
    expect(normalizeMessengerTarget("1234567890123456")).toBe("1234567890123456");
  });

  it("strips prefixes", () => {
    expect(normalizeMessengerTarget("messenger:1234567890123456")).toBe("1234567890123456");
    expect(normalizeMessengerTarget("fb:1234567890123456")).toBe("1234567890123456");
    expect(normalizeMessengerTarget("facebook:1234567890123456")).toBe("1234567890123456");
  });

  it("handles case-insensitive prefixes", () => {
    expect(normalizeMessengerTarget("MESSENGER:1234567890123456")).toBe("1234567890123456");
    expect(normalizeMessengerTarget("FB:1234567890123456")).toBe("1234567890123456");
  });

  it("handles whitespace", () => {
    expect(normalizeMessengerTarget("  1234567890123456  ")).toBe("1234567890123456");
    expect(normalizeMessengerTarget("  messenger:1234567890123456  ")).toBe("1234567890123456");
  });

  it("returns null for invalid targets", () => {
    expect(normalizeMessengerTarget("")).toBe(null);
    expect(normalizeMessengerTarget("abc")).toBe(null);
    expect(normalizeMessengerTarget("123")).toBe(null);
    expect(normalizeMessengerTarget("messenger:abc")).toBe(null);
  });
});

describe("looksLikeMessengerTarget", () => {
  it("recognizes prefixed targets", () => {
    expect(looksLikeMessengerTarget("messenger:123")).toBe(true);
    expect(looksLikeMessengerTarget("fb:123")).toBe(true);
    expect(looksLikeMessengerTarget("facebook:123")).toBe(true);
  });

  it("recognizes valid PSIDs without prefix", () => {
    expect(looksLikeMessengerTarget("1234567890123456")).toBe(true);
  });

  it("rejects non-PSID values without prefix", () => {
    expect(looksLikeMessengerTarget("abc")).toBe(false);
    expect(looksLikeMessengerTarget("123")).toBe(false);
  });
});

describe("formatMessengerTarget", () => {
  it("adds messenger prefix", () => {
    expect(formatMessengerTarget("1234567890123456")).toBe("messenger:1234567890123456");
  });
});

describe("normalizeMessengerAllowFromEntry", () => {
  it("preserves wildcard", () => {
    expect(normalizeMessengerAllowFromEntry("*")).toBe("*");
  });

  it("normalizes string entries", () => {
    expect(normalizeMessengerAllowFromEntry("messenger:1234567890123456")).toBe("1234567890123456");
    expect(normalizeMessengerAllowFromEntry("1234567890123456")).toBe("1234567890123456");
  });

  it("converts numeric entries", () => {
    expect(normalizeMessengerAllowFromEntry(1234567890123456)).toBe("1234567890123456");
  });

  it("preserves invalid entries as-is", () => {
    expect(normalizeMessengerAllowFromEntry("abc")).toBe("abc");
  });
});
