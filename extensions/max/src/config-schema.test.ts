import { describe, expect, it } from "vitest";
import { MaxConfigSchema } from "./config-schema.js";

describe("MaxConfigSchema", () => {
  it("accepts a minimal valid config", () => {
    const result = MaxConfigSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts config with botToken", () => {
    const result = MaxConfigSchema.safeParse({ botToken: "my-token" });
    expect(result.success).toBe(true);
  });

  it("accepts config with tokenFile", () => {
    const result = MaxConfigSchema.safeParse({ tokenFile: "/path/to/token" });
    expect(result.success).toBe(true);
  });

  it("accepts config with webhookUrl", () => {
    const result = MaxConfigSchema.safeParse({
      botToken: "tok",
      webhookUrl: "https://example.com/webhook",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid webhookUrl", () => {
    const result = MaxConfigSchema.safeParse({
      webhookUrl: "not-a-url",
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown keys (strict mode)", () => {
    const result = MaxConfigSchema.safeParse({
      botToken: "tok",
      unknownField: "value",
    });
    expect(result.success).toBe(false);
  });

  it("defaults dmPolicy to pairing", () => {
    const result = MaxConfigSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dmPolicy).toBe("pairing");
    }
  });

  it("defaults groupPolicy to allowlist", () => {
    const result = MaxConfigSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.groupPolicy).toBe("allowlist");
    }
  });

  it("accepts dmPolicy=open with wildcard allowFrom", () => {
    const result = MaxConfigSchema.safeParse({
      dmPolicy: "open",
      allowFrom: ["*"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects dmPolicy=open without wildcard allowFrom", () => {
    const result = MaxConfigSchema.safeParse({
      dmPolicy: "open",
      allowFrom: ["12345"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects dmPolicy=open without allowFrom", () => {
    const result = MaxConfigSchema.safeParse({
      dmPolicy: "open",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid dmPolicy values", () => {
    for (const policy of ["pairing", "allowlist", "open"]) {
      const result = MaxConfigSchema.safeParse({
        dmPolicy: policy,
        ...(policy === "open" ? { allowFrom: ["*"] } : {}),
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid dmPolicy", () => {
    const result = MaxConfigSchema.safeParse({ dmPolicy: "invalid" });
    expect(result.success).toBe(false);
  });

  it("accepts valid groupPolicy values", () => {
    for (const policy of ["allowlist", "open"]) {
      const result = MaxConfigSchema.safeParse({ groupPolicy: policy });
      expect(result.success).toBe(true);
    }
  });

  it("accepts allowFrom with string and number entries", () => {
    const result = MaxConfigSchema.safeParse({
      allowFrom: ["12345", 67890, "*"],
    });
    expect(result.success).toBe(true);
  });

  it("accepts multi-account config", () => {
    const result = MaxConfigSchema.safeParse({
      accounts: {
        bot1: { botToken: "token1" },
        bot2: { botToken: "token2", proxy: "http://proxy" },
      },
    });
    expect(result.success).toBe(true);
  });

  it("validates per-account dmPolicy=open requires allowFrom", () => {
    const result = MaxConfigSchema.safeParse({
      accounts: {
        bot1: { dmPolicy: "open" },
      },
    });
    expect(result.success).toBe(false);
  });

  it("accepts per-account dmPolicy=open with wildcard", () => {
    const result = MaxConfigSchema.safeParse({
      accounts: {
        bot1: { dmPolicy: "open", allowFrom: ["*"] },
      },
    });
    expect(result.success).toBe(true);
  });

  it("accepts format field", () => {
    const result = MaxConfigSchema.safeParse({ format: "markdown" });
    expect(result.success).toBe(true);
    const result2 = MaxConfigSchema.safeParse({ format: "html" });
    expect(result2.success).toBe(true);
  });

  it("rejects invalid format", () => {
    const result = MaxConfigSchema.safeParse({ format: "plaintext" });
    expect(result.success).toBe(false);
  });

  it("accepts positive integer textChunkLimit", () => {
    const result = MaxConfigSchema.safeParse({ textChunkLimit: 4000 });
    expect(result.success).toBe(true);
  });

  it("rejects non-positive textChunkLimit", () => {
    const result = MaxConfigSchema.safeParse({ textChunkLimit: 0 });
    expect(result.success).toBe(false);
    const result2 = MaxConfigSchema.safeParse({ textChunkLimit: -1 });
    expect(result2.success).toBe(false);
  });

  it("rejects non-integer textChunkLimit", () => {
    const result = MaxConfigSchema.safeParse({ textChunkLimit: 1.5 });
    expect(result.success).toBe(false);
  });

  it("accepts blockStreaming boolean", () => {
    const result = MaxConfigSchema.safeParse({ blockStreaming: true });
    expect(result.success).toBe(true);
    const result2 = MaxConfigSchema.safeParse({ blockStreaming: false });
    expect(result2.success).toBe(true);
  });

  it("accepts enabled boolean", () => {
    const result = MaxConfigSchema.safeParse({ enabled: false });
    expect(result.success).toBe(true);
  });
});
