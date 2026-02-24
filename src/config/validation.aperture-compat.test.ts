import { describe, expect, it } from "vitest";
import { z } from "zod";
import { validateConfigObjectRawWithSchema } from "./validation.js";

const LegacyGatewaySchema = z
  .object({
    gateway: z
      .object({
        mode: z.union([z.literal("local"), z.literal("remote")]).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

describe("gateway aperture compatibility", () => {
  it("accepts config when schema does not recognize gateway.aperture", () => {
    const res = validateConfigObjectRawWithSchema(
      {
        gateway: {
          mode: "local",
          aperture: {
            enabled: true,
            hostname: "ai",
          },
        },
      },
      LegacyGatewaySchema,
    );

    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }
    expect(res.config.gateway?.mode).toBe("local");
  });

  it("still rejects other unknown gateway keys", () => {
    const res = validateConfigObjectRawWithSchema(
      {
        gateway: {
          mode: "local",
          aperture: {
            enabled: true,
          },
          unknownGatewayField: true,
        },
      },
      LegacyGatewaySchema,
    );

    expect(res.ok).toBe(false);
    if (res.ok) {
      return;
    }
    expect(res.issues.some((issue) => issue.path === "gateway")).toBe(true);
    expect(res.issues.some((issue) => issue.message.includes("unknownGatewayField"))).toBe(true);
  });
});
