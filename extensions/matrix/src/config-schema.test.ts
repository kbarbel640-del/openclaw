import { describe, expect, it } from "vitest";
import { MatrixConfigSchema } from "./config-schema.js";

describe("MatrixConfigSchema", () => {
  it("parses legacy config without accounts", () => {
    const result = MatrixConfigSchema.safeParse({
      markdown: {},
      homeserver: "https://matrix.example.org",
      userId: "@bot:example.org",
      accessToken: "token",
      dm: {
        enabled: true,
      },
    });

    expect(result.success).toBe(true);
  });

  it("parses multi-account config with accounts", () => {
    const result = MatrixConfigSchema.safeParse({
      markdown: {},
      accounts: {
        primary: {
          homeserver: "https://matrix.example.org",
          userId: "@bot:example.org",
          accessToken: "token",
        },
        secondary: {
          homeserver: "https://matrix2.example.org",
          userId: "@bot2:example.org",
          accessToken: "token2",
          dm: {
            policy: "allowlist",
            allowFrom: ["@alice:example.org"],
          },
        },
      },
    });

    expect(result.success).toBe(true);
  });

  it("rejects invalid config", () => {
    const result = MatrixConfigSchema.safeParse({
      markdown: {},
      dm: {
        policy: "not-a-policy",
      },
    });

    expect(result.success).toBe(false);
  });
});
