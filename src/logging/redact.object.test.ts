import { describe, it, expect } from "vitest";
import { redactObject, redactSensitiveText } from "./redact.js";

describe("redactObject", () => {
  it("redacts sensitive string values in nested objects", () => {
    const input = {
      name: "test",
      config: {
        apiKey: "sk-1234567890abcdef12345678",
        nested: {
          clientSecret: "secret-value-123",
          publicData: "visible",
        },
      },
      tokens: ["token-1", "token-2"],
    };

    const output = redactObject(input);

    expect(output.config.apiKey).toContain("sk-123");
    expect(output.config.apiKey).toContain("…");
    expect(output.config.nested.clientSecret).toContain("secret");
    expect(output.config.nested.clientSecret).toContain("…");
    expect(output.config.nested.publicData).toBe("visible");
  });

  it("redacts sensitive non-string values", () => {
    const input = {
      privateKey: { kty: "RSA" }, // Object value
      secretNumber: 12345,
    };

    const output = redactObject(input);

    expect(output.privateKey).toBe("***");
    expect(output.secretNumber).toBe("***");
  });
});

describe("redactSensitiveText (JS object literal support)", () => {
  it("redacts unquoted keys in util.inspect style output", () => {
    const input = "{ apiKey: 'sk-1234567890abcdef', other: 'value' }";
    const output = redactSensitiveText(input);
    expect(output).toContain("apiKey: 'sk-123");
    expect(output).toContain("…");
    expect(output).not.toContain("abcdef");
  });

  it("redacts mixed quoted/unquoted keys", () => {
    const input = "{ \"clientSecret\": \"s3cret-v@lue\", token: \"tok-1234567890\" }";
    const output = redactSensitiveText(input);
    expect(output).toContain("clientSecret\": \"s3cret");
    expect(output).toContain("…");
    expect(output).toContain("token: \"tok-123");
  });
});
