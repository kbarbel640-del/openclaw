import { describe, expect, it } from "vitest";
import { OpenClawSchema } from "./zod-schema.js";

describe("gateway.bind legacy IPv4 compatibility", () => {
  it("accepts IPv4 bind values and migrates to custom bind mode", () => {
    const res = OpenClawSchema.safeParse({
      gateway: {
        bind: "100.64.0.1",
      },
    });

    expect(res.success).toBe(true);
    if (!res.success) {
      return;
    }

    expect(res.data.gateway?.bind).toBe("custom");
    expect(res.data.gateway?.customBindHost).toBe("100.64.0.1");
  });

  it("rejects non-mode, non-ipv4 bind values", () => {
    const res = OpenClawSchema.safeParse({
      gateway: {
        bind: "tailscale.local",
      },
    });

    expect(res.success).toBe(false);
  });
});
