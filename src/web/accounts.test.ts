import path from "node:path";
import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import { WhatsAppConfigSchema } from "../config/zod-schema.providers-whatsapp.js";
import { resolveWhatsAppAccount, resolveWhatsAppAuthDir } from "./accounts.js";

describe("resolveWhatsAppAuthDir", () => {
  const stubCfg = { channels: { whatsapp: { accounts: {} } } } as Parameters<
    typeof resolveWhatsAppAuthDir
  >[0]["cfg"];

  it("sanitizes path traversal sequences in accountId", () => {
    const { authDir } = resolveWhatsAppAuthDir({
      cfg: stubCfg,
      accountId: "../../../etc/passwd",
    });
    // Sanitized accountId must not escape the whatsapp auth directory.
    expect(authDir).not.toContain("..");
    expect(path.basename(authDir)).not.toContain("/");
  });

  it("sanitizes special characters in accountId", () => {
    const { authDir } = resolveWhatsAppAuthDir({
      cfg: stubCfg,
      accountId: "foo/bar\\baz",
    });
    // Sprawdzaj sanityzacje na segmencie accountId, nie na calej sciezce
    // (Windows uzywa backslash jako separator katalogow).
    const segment = path.basename(authDir);
    expect(segment).not.toContain("/");
    expect(segment).not.toContain("\\");
  });

  it("returns default directory for empty accountId", () => {
    const { authDir } = resolveWhatsAppAuthDir({
      cfg: stubCfg,
      accountId: "",
    });
    expect(authDir).toMatch(/whatsapp[/\\]default$/);
  });

  it("preserves valid accountId unchanged", () => {
    const { authDir } = resolveWhatsAppAuthDir({
      cfg: stubCfg,
      accountId: "my-account-1",
    });
    expect(authDir).toMatch(/whatsapp[/\\]my-account-1$/);
  });
});

describe("resolveWhatsAppAccount channel-level policy fallback", () => {
  it("inherits root-level dmPolicy when account has no explicit override (Zod-validated)", () => {
    // Validate through Zod exactly as loadConfig() does in production, to
    // ensure account-level defaults do not shadow root-level overrides.
    const validated = WhatsAppConfigSchema.parse({
      dmPolicy: "disabled",
      accounts: {
        default: {
          authDir: "/tmp/test-auth",
        },
      },
    });
    const cfg = { channels: { whatsapp: validated } } as unknown as OpenClawConfig;
    const account = resolveWhatsAppAccount({ cfg, accountId: "default" });
    expect(account.dmPolicy).toBe("disabled");
  });

  it("inherits root-level groupPolicy when account has no explicit override (Zod-validated)", () => {
    const validated = WhatsAppConfigSchema.parse({
      groupPolicy: "disabled",
      accounts: {
        default: {
          authDir: "/tmp/test-auth",
        },
      },
    });
    const cfg = { channels: { whatsapp: validated } } as unknown as OpenClawConfig;
    const account = resolveWhatsAppAccount({ cfg, accountId: "default" });
    expect(account.groupPolicy).toBe("disabled");
  });

  it("respects explicit account-level dmPolicy over root-level", () => {
    const validated = WhatsAppConfigSchema.parse({
      dmPolicy: "pairing",
      accounts: {
        default: {
          authDir: "/tmp/test-auth",
          dmPolicy: "disabled",
        },
      },
    });
    const cfg = { channels: { whatsapp: validated } } as unknown as OpenClawConfig;
    const account = resolveWhatsAppAccount({ cfg, accountId: "default" });
    expect(account.dmPolicy).toBe("disabled");
  });
});
