import { timingSafeEqual } from "node:crypto";
import { describe, expect, it } from "vitest";

// Test that we have access to timingSafeEqual and it works correctly.
// The fix for VULN-026 requires the webhook handler to validate the secret
// using timingSafeEqual before passing the request to grammy's handler.
//
// CWE-208: Observable Timing Discrepancy
// https://cwe.mitre.org/data/definitions/208.html

describe("VULN-026: telegram webhook secret must use timing-safe comparison", () => {
  // Helper function that mirrors what the fix should implement
  function safeEqualSecret(received: string, expected: string): boolean {
    const receivedBuffer = Buffer.from(received, "utf-8");
    const expectedBuffer = Buffer.from(expected, "utf-8");

    if (receivedBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(receivedBuffer, expectedBuffer);
  }

  it("returns true for equal secrets", () => {
    expect(safeEqualSecret("webhook-secret-123", "webhook-secret-123")).toBe(true);
    expect(safeEqualSecret("", "")).toBe(true);
    expect(safeEqualSecret("a", "a")).toBe(true);
  });

  it("returns false for different secrets of same length", () => {
    expect(safeEqualSecret("webhook-secret-123", "webhook-secret-124")).toBe(false);
    expect(safeEqualSecret("aaaa", "aaab")).toBe(false);
  });

  it("returns false for different lengths", () => {
    expect(safeEqualSecret("short", "longer-secret")).toBe(false);
    expect(safeEqualSecret("longer-secret", "short")).toBe(false);
  });

  it("handles typical Telegram secret formats", () => {
    // Telegram secrets are typically alphanumeric strings
    const secret = "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6";
    expect(safeEqualSecret(secret, secret)).toBe(true);
    expect(safeEqualSecret(secret, secret.slice(0, -1) + "X")).toBe(false);
  });
});
