import { describe, expect, it } from "vitest";
import { WhatsAppAccountSchema, WhatsAppConfigSchema } from "./zod-schema.providers-whatsapp.js";

describe("WhatsAppAccountSchema defaults", () => {
  it("does not inject dmPolicy default when not explicitly set", () => {
    const result = WhatsAppAccountSchema.parse({
      authDir: "/some/path",
    });
    expect(result.dmPolicy).toBeUndefined();
  });

  it("does not inject groupPolicy default when not explicitly set", () => {
    const result = WhatsAppAccountSchema.parse({
      authDir: "/some/path",
    });
    expect(result.groupPolicy).toBeUndefined();
  });

  it("preserves explicitly set account-level dmPolicy", () => {
    const result = WhatsAppAccountSchema.parse({
      authDir: "/some/path",
      dmPolicy: "disabled",
    });
    expect(result.dmPolicy).toBe("disabled");
  });

  it("preserves explicitly set account-level groupPolicy", () => {
    const result = WhatsAppAccountSchema.parse({
      authDir: "/some/path",
      groupPolicy: "disabled",
    });
    expect(result.groupPolicy).toBe("disabled");
  });
});

describe("WhatsAppConfigSchema root-level defaults", () => {
  it("applies dmPolicy default at the root config level", () => {
    const result = WhatsAppConfigSchema.parse({});
    expect(result.dmPolicy).toBe("pairing");
  });

  it("applies groupPolicy default at the root config level", () => {
    const result = WhatsAppConfigSchema.parse({});
    expect(result.groupPolicy).toBe("allowlist");
  });

  it("account-level dmPolicy stays undefined so root-level can serve as fallback", () => {
    const result = WhatsAppConfigSchema.parse({
      dmPolicy: "disabled",
      accounts: {
        default: {
          authDir: "/some/path",
        },
      },
    });
    // Root-level should be "disabled" (explicitly set).
    expect(result.dmPolicy).toBe("disabled");
    // Account-level should be undefined (not injected by Zod), so the
    // resolution function can fall back to the root-level value.
    expect(result.accounts!.default!.dmPolicy).toBeUndefined();
  });
});
