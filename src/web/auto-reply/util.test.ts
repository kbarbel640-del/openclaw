import { describe, expect, it } from "vitest";
import { elide, isLikelyWhatsAppCryptoError } from "./util.js";

describe("elide", () => {
  it("returns undefined for undefined", () => {
    expect(elide(undefined)).toBeUndefined();
  });

  it("returns empty string for empty string", () => {
    expect(elide("")).toBe("");
  });

  it("returns text unchanged when within limit", () => {
    expect(elide("hello", 10)).toBe("hello");
  });

  it("returns text unchanged at exact limit", () => {
    expect(elide("hello", 5)).toBe("hello");
  });

  it("truncates text over limit", () => {
    const result = elide("hello world", 5);
    expect(result).toContain("hello");
    expect(result).toContain("truncated");
    expect(result).toContain("6 chars");
  });

  it("uses default limit of 400", () => {
    const short = "a".repeat(400);
    expect(elide(short)).toBe(short);

    const long = "a".repeat(401);
    expect(elide(long)).toContain("truncated");
  });
});

describe("isLikelyWhatsAppCryptoError", () => {
  it("returns false for null", () => {
    expect(isLikelyWhatsAppCryptoError(null)).toBe(false);
  });

  it("returns false for generic error", () => {
    expect(isLikelyWhatsAppCryptoError(new Error("network timeout"))).toBe(false);
  });

  it("returns false for auth error without baileys", () => {
    expect(
      isLikelyWhatsAppCryptoError(new Error("unsupported state or unable to authenticate data")),
    ).toBe(false);
  });

  it("returns true for baileys crypto error", () => {
    expect(
      isLikelyWhatsAppCryptoError(
        new Error("unsupported state or unable to authenticate data at @whiskeysockets/baileys"),
      ),
    ).toBe(true);
  });

  it("detects bad mac with baileys", () => {
    expect(isLikelyWhatsAppCryptoError(new Error("bad mac in baileys noise-handler"))).toBe(true);
  });

  it("works with string reason", () => {
    expect(
      isLikelyWhatsAppCryptoError("unsupported state or unable to authenticate data baileys"),
    ).toBe(true);
  });

  it("returns false for number", () => {
    expect(isLikelyWhatsAppCryptoError(42)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isLikelyWhatsAppCryptoError(undefined)).toBe(false);
  });
});
