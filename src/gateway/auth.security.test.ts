import { describe, expect, it } from "vitest";
import { generateSecureGatewayToken, isTokenSecure } from "./auth.js";

describe("gateway security (Issue #1971)", () => {
  describe("generateSecureGatewayToken", () => {
    it("generates tokens of expected length (64 hex chars = 32 bytes)", () => {
      const token = generateSecureGatewayToken();
      expect(token.length).toBe(64);
    });

    it("generates unique tokens each time", () => {
      const token1 = generateSecureGatewayToken();
      const token2 = generateSecureGatewayToken();
      expect(token1).not.toBe(token2);
    });

    it("generates hex-only tokens", () => {
      const token = generateSecureGatewayToken();
      expect(token).toMatch(/^[a-f0-9]+$/);
    });
  });

  describe("isTokenSecure", () => {
    it("accepts strong tokens (>=32 chars, no weak patterns)", () => {
      expect(isTokenSecure("a3f7b2d8e9c1a4b5f6e7d8c9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b")).toBe(true);
      expect(isTokenSecure(generateSecureGatewayToken())).toBe(true);
    });

    it("rejects short tokens (<32 chars)", () => {
      expect(isTokenSecure("short")).toBe(false);
      expect(isTokenSecure("1234567890123456789012345678901")).toBe(false); // 31 chars
    });

    it("rejects tokens with weak patterns", () => {
      expect(isTokenSecure("password1234567890123456789012345678901234567890")).toBe(false);
      expect(isTokenSecure("admin1234567890123456789012345678901234567890123")).toBe(false);
      expect(isTokenSecure("token12345678901234567890123456789012345678901234")).toBe(false);
      expect(isTokenSecure("123456789012345678901234567890secret1234567890")).toBe(false);
    });
  });
});
