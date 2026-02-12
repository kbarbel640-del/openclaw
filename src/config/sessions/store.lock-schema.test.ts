import { describe, expect, it } from "vitest";
import { SessionSchema } from "../zod-schema.session.js";

describe("SessionSchema lock config validation", () => {
  it("accepts valid lock config with both fields", () => {
    const result = SessionSchema.safeParse({
      lock: { timeoutMs: 60_000, staleMs: 120_000 },
    });
    expect(result.success).toBe(true);
  });

  it("accepts lock config with only timeoutMs", () => {
    const result = SessionSchema.safeParse({
      lock: { timeoutMs: 30_000 },
    });
    expect(result.success).toBe(true);
  });

  it("accepts lock config with only staleMs", () => {
    const result = SessionSchema.safeParse({
      lock: { staleMs: 90_000 },
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty lock config", () => {
    const result = SessionSchema.safeParse({
      lock: {},
    });
    expect(result.success).toBe(true);
  });

  it("accepts session config without lock field", () => {
    const result = SessionSchema.safeParse({
      scope: "per-sender",
    });
    expect(result.success).toBe(true);
  });

  it("rejects timeoutMs below minimum (1000)", () => {
    const result = SessionSchema.safeParse({
      lock: { timeoutMs: 500 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects timeoutMs above maximum (600000)", () => {
    const result = SessionSchema.safeParse({
      lock: { timeoutMs: 700_000 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects staleMs below minimum (5000)", () => {
    const result = SessionSchema.safeParse({
      lock: { staleMs: 1_000 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects staleMs above maximum (3600000)", () => {
    const result = SessionSchema.safeParse({
      lock: { staleMs: 4_000_000 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown fields in lock config (strict mode)", () => {
    const result = SessionSchema.safeParse({
      lock: { timeoutMs: 10_000, unknownField: true },
    });
    expect(result.success).toBe(false);
  });

  it("accepts boundary values", () => {
    const minResult = SessionSchema.safeParse({
      lock: { timeoutMs: 1_000, staleMs: 5_000 },
    });
    expect(minResult.success).toBe(true);

    const maxResult = SessionSchema.safeParse({
      lock: { timeoutMs: 600_000, staleMs: 3_600_000 },
    });
    expect(maxResult.success).toBe(true);
  });
});
