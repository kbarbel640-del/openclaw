import { describe, expect, test } from "vitest";
import { sanitize } from "./payload-sanitizer.js";

describe("sanitize", () => {
  describe("API key detection", () => {
    test("redacts Anthropic API keys", () => {
      const { sanitized, redactionCount } = sanitize(
        "key: sk-ant-api03-abcdefghijklmnopqrstuvwxyz",
      );
      expect(sanitized).toContain("[REDACTED:ANTHROPIC_API_KEY]");
      expect(sanitized).not.toContain("sk-ant-");
      expect(redactionCount).toBe(1);
    });

    test("redacts OpenAI API keys", () => {
      const { sanitized } = sanitize("key: sk-abcdefghijklmnopqrstuvwxyz1234567890");
      expect(sanitized).toContain("[REDACTED:OPENAI_API_KEY]");
    });

    test("redacts OpenAI project keys", () => {
      const { sanitized } = sanitize("key: sk-proj-abcdefghijklmnopqrstuvwxyz12345");
      expect(sanitized).toContain("[REDACTED:OPENAI_PROJECT_KEY]");
    });

    test("redacts GitHub tokens", () => {
      const { sanitized } = sanitize("ghp_abcdefghijklmnopqrstuvwxyz1234567890");
      expect(sanitized).toContain("[REDACTED:GITHUB_TOKEN]");
    });

    test("redacts GitHub fine-grained tokens", () => {
      const { sanitized } = sanitize("github_pat_abcdefghijklmnopqrstuvwxyz");
      expect(sanitized).toContain("[REDACTED:GITHUB_FINE_GRAINED]");
    });

    test("redacts Bearer tokens", () => {
      const { sanitized } = sanitize("Authorization: Bearer abc123xyz789token");
      expect(sanitized).toContain("[REDACTED:BEARER_TOKEN]");
    });

    test("redacts JWT tokens", () => {
      const jwt =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";
      const { sanitized } = sanitize(jwt);
      expect(sanitized).not.toContain("eyJ");
    });

    test("redacts AWS access keys", () => {
      const { sanitized } = sanitize("AKIAIOSFODNN7EXAMPLE");
      expect(sanitized).toContain("[REDACTED:AWS_ACCESS_KEY]");
    });
  });

  describe("PII detection", () => {
    test("redacts SSNs", () => {
      const { sanitized } = sanitize("My SSN is 123-45-6789");
      expect(sanitized).not.toContain("123-45-6789");
      expect(sanitized).toContain("[REDACTED:SSN]");
    });

    test("redacts credit card numbers", () => {
      for (const card of ["4111111111111111", "5500000000000004", "340000000000009"]) {
        const { sanitized } = sanitize(`Card: ${card}`);
        expect(sanitized).toContain("[REDACTED:CREDIT_CARD]");
      }
    });

    test("redacts email addresses", () => {
      const { sanitized } = sanitize("Contact me at john.doe@example.com");
      expect(sanitized).not.toContain("john.doe@example.com");
      expect(sanitized).toContain("[REDACTED:EMAIL]");
    });
  });

  describe("sensitive field filtering", () => {
    test("redacts password fields", () => {
      const { sanitized } = sanitize({ username: "john", password: "secret123" });
      const result = sanitized as Record<string, unknown>;
      expect(result.username).toBe("john");
      expect(result.password).toBe("[REDACTED:SENSITIVE_FIELD]");
    });

    test("normalizes field name casing and separators", () => {
      const { sanitized, redactionCount } = sanitize({
        apiKey: "key1",
        api_key: "key2",
        "api-key": "key3",
      });
      const result = sanitized as Record<string, unknown>;
      expect(result.apiKey).toBe("[REDACTED:SENSITIVE_FIELD]");
      expect(result.api_key).toBe("[REDACTED:SENSITIVE_FIELD]");
      expect(result["api-key"]).toBe("[REDACTED:SENSITIVE_FIELD]");
      expect(redactionCount).toBe(3);
    });

    test("redacts nested sensitive fields", () => {
      const { sanitized } = sanitize({
        user: { profile: { password: "secret", name: "John" } },
      });
      const result = sanitized as { user: { profile: { password: string; name: string } } };
      expect(result.user.profile.password).toBe("[REDACTED:SENSITIVE_FIELD]");
      expect(result.user.profile.name).toBe("John");
    });
  });

  describe("edge cases", () => {
    test("handles null and undefined", () => {
      expect(sanitize(null).sanitized).toBeNull();
      expect(sanitize(undefined).sanitized).toBeUndefined();
    });

    test("handles empty objects and arrays", () => {
      expect(sanitize({}).sanitized).toEqual({});
      expect(sanitize([]).sanitized).toEqual([]);
    });

    test("preserves numbers and booleans", () => {
      expect(sanitize(42).sanitized).toBe(42);
      expect(sanitize(true).sanitized).toBe(true);
    });

    test("handles arrays with sensitive data", () => {
      const { sanitized } = sanitize([{ password: "secret" }, "sk-ant-test12345678901234567890"]);
      const result = sanitized as [Record<string, unknown>, string];
      expect(result[0].password).toBe("[REDACTED:SENSITIVE_FIELD]");
      expect(result[1]).toContain("[REDACTED:");
    });

    test("handles circular references without throwing", () => {
      const obj: Record<string, unknown> = { name: "test" };
      obj.self = obj;
      const result = sanitize(obj);
      expect(result.sanitized).toBeDefined();
    });

    test("preserves non-sensitive data unchanged", () => {
      const input = {
        username: "john_doe",
        age: 30,
        preferences: ["dark_mode"],
        metadata: { created: "2023-01-01", version: "1.0.0" },
      };
      const { sanitized, redactionCount } = sanitize(input);
      expect(sanitized).toEqual(input);
      expect(redactionCount).toBe(0);
    });

    test("truncates very long strings", () => {
      const long = "a".repeat(20_000);
      const { sanitized } = sanitize(long);
      expect((sanitized as string).length).toBeLessThan(20_000);
      expect(sanitized as string).toContain("...[TRUNCATED]");
    });

    test("multiple secrets in one string are all redacted", () => {
      const input = "keys: sk-ant-api03-abcdefghijklmnopqrstuvwxyz and 123-45-6789";
      const { sanitized, redactionCount } = sanitize(input);
      expect(sanitized).not.toContain("sk-ant-");
      expect(sanitized).not.toContain("123-45-6789");
      expect(redactionCount).toBe(2);
    });
  });
});
