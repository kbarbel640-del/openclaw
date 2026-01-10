import { describe, expect, it } from "vitest";

import { isWhatsAppGroupJid, normalizeWhatsAppTarget } from "./normalize.js";

describe("normalizeWhatsAppTarget", () => {
  it("preserves group JIDs", () => {
    expect(normalizeWhatsAppTarget("[redacted-email]")).toBe(
      "[redacted-email]",
    );
    expect(normalizeWhatsAppTarget("[redacted-email]")).toBe(
      "[redacted-email]",
    );
    expect(normalizeWhatsAppTarget("whatsapp:[redacted-email]")).toBe(
      "[redacted-email]",
    );
    expect(
      normalizeWhatsAppTarget("whatsapp:group:[redacted-email]"),
    ).toBe("[redacted-email]");
    expect(normalizeWhatsAppTarget("group:[redacted-email]")).toBe(
      "[redacted-email]",
    );
    expect(
      normalizeWhatsAppTarget(" WhatsApp:Group:[redacted-email] "),
    ).toBe("[redacted-email]");
  });

  it("normalizes direct JIDs to E.164", () => {
    expect(normalizeWhatsAppTarget("[redacted-email]")).toBe("+1555123");
  });

  it("rejects invalid targets", () => {
    expect(normalizeWhatsAppTarget("wat")).toBeNull();
    expect(normalizeWhatsAppTarget("whatsapp:")).toBeNull();
    expect(normalizeWhatsAppTarget("@g.us")).toBeNull();
    expect(normalizeWhatsAppTarget("whatsapp:group:@g.us")).toBeNull();
  });

  it("handles repeated prefixes", () => {
    expect(normalizeWhatsAppTarget("whatsapp:whatsapp:+1555")).toBe("+1555");
    expect(normalizeWhatsAppTarget("group:group:[redacted-email]")).toBe("[redacted-email]");
  });
});

describe("isWhatsAppGroupJid", () => {
  it("detects group JIDs with or without prefixes", () => {
    expect(isWhatsAppGroupJid("[redacted-email]")).toBe(true);
    expect(isWhatsAppGroupJid("[redacted-email]")).toBe(true);
    expect(isWhatsAppGroupJid("whatsapp:[redacted-email]")).toBe(true);
    expect(isWhatsAppGroupJid("whatsapp:group:[redacted-email]")).toBe(
      true,
    );
    expect(isWhatsAppGroupJid("[redacted-email]")).toBe(false);
    expect(isWhatsAppGroupJid("@g.us")).toBe(false);
    expect(isWhatsAppGroupJid("[redacted-email]")).toBe(false);
    expect(isWhatsAppGroupJid("+1555123")).toBe(false);
  });
});
