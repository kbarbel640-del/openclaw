import { describe, expect, it } from "vitest";
import { resolveSaintEmailAccount } from "./accounts.js";

describe("saint-email accounts: case-insensitive lookup", () => {
  it("resolves account by case-insensitive key", () => {
    const cfg = {
      channels: {
        email: {
          accounts: {
            Sales: { address: "sales@example.com", accessToken: "tok" },
          },
        },
      },
    } as const;

    // Request with lowercase, config has uppercase
    const account = resolveSaintEmailAccount({ cfg, accountId: "sales" });
    expect(account.address).toBe("sales@example.com");
  });

  it("resolves account with exact match first", () => {
    const cfg = {
      channels: {
        email: {
          accounts: {
            sales: { address: "exact@example.com", accessToken: "tok1" },
            Sales: { address: "upper@example.com", accessToken: "tok2" },
          },
        },
      },
    } as const;

    // Exact match should win over case-insensitive
    const account = resolveSaintEmailAccount({ cfg, accountId: "sales" });
    expect(account.address).toBe("exact@example.com");
  });

  it("normalizes allowFrom entries to lowercase", () => {
    const cfg = {
      channels: {
        email: {
          address: "bot@example.com",
          accessToken: "tok",
          allowFrom: ["Owner@EXAMPLE.com", "Admin@Example.Com"],
        },
      },
    } as const;

    const account = resolveSaintEmailAccount({ cfg });
    expect(account.allowFrom).toEqual(["owner@example.com", "admin@example.com"]);
  });
});
