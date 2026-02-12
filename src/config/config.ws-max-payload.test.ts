import { describe, expect, test } from "vitest";
import { OpenClawSchema } from "./zod-schema.js";

describe("gateway.ws config schema", () => {
  test("accepts valid maxPayloadBytes", () => {
    const result = OpenClawSchema.safeParse({
      gateway: { ws: { maxPayloadBytes: 100 * 1024 * 1024 } },
    });
    expect(result.success).toBe(true);
  });

  test("accepts gateway.ws as empty object", () => {
    const result = OpenClawSchema.safeParse({
      gateway: { ws: {} },
    });
    expect(result.success).toBe(true);
  });

  test("accepts gateway without ws key", () => {
    const result = OpenClawSchema.safeParse({
      gateway: { port: 18789 },
    });
    expect(result.success).toBe(true);
  });

  test("rejects non-positive maxPayloadBytes", () => {
    const result = OpenClawSchema.safeParse({
      gateway: { ws: { maxPayloadBytes: 0 } },
    });
    expect(result.success).toBe(false);
  });

  test("rejects negative maxPayloadBytes", () => {
    const result = OpenClawSchema.safeParse({
      gateway: { ws: { maxPayloadBytes: -1 } },
    });
    expect(result.success).toBe(false);
  });

  test("rejects non-integer maxPayloadBytes", () => {
    const result = OpenClawSchema.safeParse({
      gateway: { ws: { maxPayloadBytes: 1.5 } },
    });
    expect(result.success).toBe(false);
  });

  test("rejects unknown keys in ws (strict)", () => {
    const result = OpenClawSchema.safeParse({
      gateway: { ws: { maxPayloadBytes: 1024, bogus: true } },
    });
    expect(result.success).toBe(false);
  });
});
