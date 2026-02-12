import { describe, expect, it } from "vitest";
import { OpenClawSchema } from "./zod-schema.js";

describe("$schema key in config root", () => {
  it("accepts config with $schema key", () => {
    const res = OpenClawSchema.safeParse({
      $schema: "https://openclaw.ai/config.json",
    });

    expect(res.success).toBe(true);
  });

  it("accepts config without $schema key", () => {
    const res = OpenClawSchema.safeParse({});

    expect(res.success).toBe(true);
  });
});
