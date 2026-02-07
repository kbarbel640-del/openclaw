import { describe, expect, it } from "vitest";
import {
  redactSecrets,
  truncate,
  sanitizePayload,
  sanitizeForPersistence,
  sanitizeText,
  DEFAULT_SANITIZE_CONFIG,
} from "./redact.js";

describe("sanitize/redact", () => {
  // ── truncate ──────────────────────────────────────────────────────────
  describe("truncate", () => {
    it("returns short strings unchanged", () => {
      expect(truncate("hello", 100)).toBe("hello");
    });

    it("truncates long strings with indicator", () => {
      const long = "a".repeat(200);
      const result = truncate(long, 50);
      expect(result.length).toBeLessThanOrEqual(50);
      expect(result).toContain("truncated");
    });

    it("handles empty string", () => {
      expect(truncate("", 10)).toBe("");
    });

    it("returns string unchanged when exactly at limit", () => {
      const text = "a".repeat(50);
      expect(truncate(text, 50)).toBe(text);
    });

    it("preserves beginning of truncated string", () => {
      const text = "abcdefghijklmnopqrstuvwxyz" + "x".repeat(200);
      const result = truncate(text, 40);
      expect(result.startsWith("abcdef")).toBe(true);
    });
  });

  // ── redactSecrets ─────────────────────────────────────────────────────
  describe("redactSecrets", () => {
    it("redacts API keys (sk- prefix)", () => {
      const text = 'key: "sk-1234567890abcdef1234567890abcdef1234567890abcdef"';
      const result = redactSecrets(text);
      expect(result).toContain("[REDACTED]");
      expect(result).not.toContain("1234567890abcdef");
    });

    it("redacts AWS access key IDs (AKIA pattern)", () => {
      const text = "AWS_KEY=AKIAIOSFODNN7EXAMPLE";
      const result = redactSecrets(text);
      expect(result).toContain("[REDACTED]");
    });

    it("redacts api_key= patterns", () => {
      const text = "api_key=mysupersecretapikeythatislong12345678";
      const result = redactSecrets(text);
      expect(result).toContain("[REDACTED]");
    });

    it("redacts JWT tokens", () => {
      const text =
        "token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";
      const result = redactSecrets(text);
      expect(result).toContain("[REDACTED]");
    });

    it("redacts ghp_ tokens", () => {
      const text = "ghp_1234567890abcdef1234567890abcdef12345678";
      const result = redactSecrets(text);
      expect(result).toContain("[REDACTED]");
    });

    it("leaves clean text unchanged", () => {
      const text = "This is a normal log message with no secrets.";
      expect(redactSecrets(text)).toBe(text);
    });

    it("handles empty string", () => {
      expect(redactSecrets("")).toBe("");
    });

    it("uses custom patterns when provided", () => {
      const text = "custom-secret-12345";
      const result = redactSecrets(text, [/custom-secret-\d+/g]);
      expect(result).toBe("[REDACTED]");
    });
  });

  // ── sanitizeText ──────────────────────────────────────────────────────
  describe("sanitizeText", () => {
    it("redacts secrets in text", () => {
      const text = "key=sk-1234567890abcdef1234567890abcdef1234567890abcdef plus more text";
      const result = sanitizeText(text);
      expect(result).toContain("[REDACTED]");
    });

    it("returns undefined for undefined input", () => {
      expect(sanitizeText(undefined)).toBeUndefined();
    });

    it("returns empty string for empty string", () => {
      expect(sanitizeText("")).toBe("");
    });

    it("returns clean text unchanged", () => {
      expect(sanitizeText("just normal text")).toBe("just normal text");
    });
  });

  // ── sanitizePayload ───────────────────────────────────────────────────
  describe("sanitizePayload", () => {
    it("sanitizes nested object values", () => {
      const payload = {
        key: "sk-1234567890abcdef1234567890abcdef1234567890abcdef",
        nested: { value: "normal" },
        arr: ["item1", "ghp_1234567890abcdef1234567890abcdef12345678"],
      };
      const result = sanitizePayload(payload, 10000);
      expect(result).toContain("[REDACTED]");
      expect(result).not.toContain("1234567890abcdef");
    });

    it("always returns a string", () => {
      expect(typeof sanitizePayload(null, 1000)).toBe("string");
      expect(typeof sanitizePayload(42, 1000)).toBe("string");
      expect(typeof sanitizePayload(true, 1000)).toBe("string");
      expect(typeof sanitizePayload({ a: 1 }, 1000)).toBe("string");
    });

    it("JSON stringifies non-string values", () => {
      expect(sanitizePayload(42, 1000)).toBe("42");
      expect(sanitizePayload(true, 1000)).toBe("true");
      expect(sanitizePayload(null, 1000)).toBe("null");
    });

    it("truncates long payloads", () => {
      const longText = "x".repeat(10000);
      const result = sanitizePayload(longText, 500);
      expect(result.length).toBeLessThan(10000);
    });

    it("both truncates and redacts", () => {
      const payload = {
        normal: "a".repeat(5000),
        secret: "sk-1234567890abcdef1234567890abcdef1234567890abcdef",
      };
      const result = sanitizePayload(payload, 200);
      expect(result.length).toBeLessThanOrEqual(200);
    });
  });

  // ── sanitizeForPersistence ────────────────────────────────────────────
  describe("sanitizeForPersistence", () => {
    it("sanitizes args and result fields", () => {
      const data = {
        args: { token: "sk-1234567890abcdef1234567890abcdef1234567890abcdef" },
        result: { ok: true },
      };
      const result = sanitizeForPersistence(data);
      expect(JSON.stringify(result)).toContain("[REDACTED]");
    });

    it("preserves structure when no args/result", () => {
      const data = { args: { clean: "value" }, result: { clean: "data" } };
      const result = sanitizeForPersistence(data);
      expect(result.args).toBeDefined();
      expect(result.result).toBeDefined();
    });

    it("handles missing args field", () => {
      const data = { result: { ok: true } };
      const result = sanitizeForPersistence(data);
      expect(result.result).toBeDefined();
    });

    it("handles missing result field", () => {
      const data = { args: { cmd: "ls" } };
      const result = sanitizeForPersistence(data);
      expect(result.args).toBeDefined();
    });

    it("accepts custom config with redact patterns", () => {
      const data = {
        args: { secret: "custom_token_12345678" },
        result: { ok: true },
      };
      const result = sanitizeForPersistence(data, {
        redactPatterns: [/custom_token_\d+/g],
      });
      expect(JSON.stringify(result)).toContain("[REDACTED]");
    });
  });
});
