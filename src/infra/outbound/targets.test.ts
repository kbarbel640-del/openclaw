import { beforeEach, describe, expect, it } from "vitest";
import type { MoltbotConfig } from "../../config/config.js";

import { setActivePluginRegistry } from "../../plugins/runtime.js";
import { createTestRegistry } from "../../test-utils/channel-plugins.js";
import { telegramPlugin } from "../../../extensions/telegram/src/channel.js";
import { whatsappPlugin } from "../../../extensions/whatsapp/src/channel.js";
import {
  resolveHeartbeatDeliveryTarget,
  resolveOutboundTarget,
  resolveSessionDeliveryTarget,
} from "./targets.js";

describe("resolveOutboundTarget", () => {
  beforeEach(() => {
    setActivePluginRegistry(
      createTestRegistry([
        { pluginId: "whatsapp", plugin: whatsappPlugin, source: "test" },
        { pluginId: "telegram", plugin: telegramPlugin, source: "test" },
      ]),
    );
  });

  it("falls back to whatsapp allowFrom via config", () => {
    const cfg: MoltbotConfig = {
      channels: { whatsapp: { allowFrom: ["+1555"] } },
    };
    const res = resolveOutboundTarget({
      channel: "whatsapp",
      to: "",
      cfg,
      mode: "explicit",
    });
    expect(res).toEqual({ ok: true, to: "+1555" });
  });

  it.each([
    {
      name: "normalizes whatsapp target when provided",
      input: { channel: "whatsapp" as const, to: " (555) 123-4567 " },
      expected: { ok: true as const, to: "+5551234567" },
    },
    {
      name: "keeps whatsapp group targets",
      input: { channel: "whatsapp" as const, to: "120363401234567890@g.us" },
      expected: { ok: true as const, to: "120363401234567890@g.us" },
    },
    {
      name: "normalizes prefixed/uppercase whatsapp group targets",
      input: {
        channel: "whatsapp" as const,
        to: " WhatsApp:120363401234567890@G.US ",
      },
      expected: { ok: true as const, to: "120363401234567890@g.us" },
    },
    {
      name: "falls back to whatsapp allowFrom",
      input: { channel: "whatsapp" as const, to: "", allowFrom: ["+1555"] },
      expected: { ok: true as const, to: "+1555" },
    },
    {
      name: "normalizes whatsapp allowFrom fallback targets",
      input: {
        channel: "whatsapp" as const,
        to: "",
        allowFrom: ["whatsapp:(555) 123-4567"],
      },
      expected: { ok: true as const, to: "+5551234567" },
    },
    {
      name: "rejects invalid whatsapp target",
      input: { channel: "whatsapp" as const, to: "wat" },
      expectedErrorIncludes: "WhatsApp",
    },
    {
      name: "rejects whatsapp without to when allowFrom missing",
      input: { channel: "whatsapp" as const, to: " " },
      expectedErrorIncludes: "WhatsApp",
    },
    {
      name: "rejects whatsapp allowFrom fallback when invalid",
      input: { channel: "whatsapp" as const, to: "", allowFrom: ["wat"] },
      expectedErrorIncludes: "WhatsApp",
    },
  ])("$name", ({ input, expected, expectedErrorIncludes }) => {
    const res = resolveOutboundTarget(input);
    if (expected) {
      expect(res).toEqual(expected);
      return;
    }
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.message).toContain(expectedErrorIncludes);
    }
  });

  it("rejects telegram with missing target", () => {
    const res = resolveOutboundTarget({ channel: "telegram", to: " " });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.message).toContain("Telegram");
    }
  });

  it("rejects webchat delivery", () => {
    const res = resolveOutboundTarget({ channel: "webchat", to: "x" });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.message).toContain("WebChat");
    }
  });

  describe("whatsapp explicit mode allowlist validation", () => {
    it("rejects explicit target not in allowlist", () => {
      const cfg: ClawdbotConfig = {
        channels: { whatsapp: { allowFrom: ["+1555000001", "+1555000002"] } },
      };
      const res = resolveOutboundTarget({
        channel: "whatsapp",
        to: "+1555999999",
        cfg,
        mode: "explicit",
      });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.message).toContain("not in WhatsApp allowlist");
        expect(res.error.message).toContain("--allow-unlisted");
      }
    });

    it("allows explicit target when in allowlist", () => {
      const cfg: ClawdbotConfig = {
        channels: { whatsapp: { allowFrom: ["+1555000001", "+1555000002"] } },
      };
      const res = resolveOutboundTarget({
        channel: "whatsapp",
        to: "+1555000001",
        cfg,
        mode: "explicit",
      });
      expect(res).toEqual({ ok: true, to: "+1555000001" });
    });

    it("allows explicit target with allowUnlisted override", () => {
      const cfg: ClawdbotConfig = {
        channels: { whatsapp: { allowFrom: ["+1555000001"] } },
      };
      const res = resolveOutboundTarget({
        channel: "whatsapp",
        to: "+1555999999",
        cfg,
        mode: "explicit",
        allowUnlisted: true,
      });
      expect(res).toEqual({ ok: true, to: "+1555999999" });
    });

    it("allows explicit target when allowlist has wildcard", () => {
      const cfg: ClawdbotConfig = {
        channels: { whatsapp: { allowFrom: ["*", "+1555000001"] } },
      };
      const res = resolveOutboundTarget({
        channel: "whatsapp",
        to: "+1555999999",
        cfg,
        mode: "explicit",
      });
      expect(res).toEqual({ ok: true, to: "+1555999999" });
    });

    it("allows explicit target when allowlist is empty", () => {
      const cfg: ClawdbotConfig = {
        channels: { whatsapp: { allowFrom: [] } },
      };
      const res = resolveOutboundTarget({
        channel: "whatsapp",
        to: "+1555999999",
        cfg,
        mode: "explicit",
      });
      expect(res).toEqual({ ok: true, to: "+1555999999" });
    });

    it("allows group targets regardless of allowlist", () => {
      const cfg: ClawdbotConfig = {
        channels: { whatsapp: { allowFrom: ["+1555000001"] } },
      };
      const res = resolveOutboundTarget({
        channel: "whatsapp",
        to: "120363401234567890@g.us",
        cfg,
        mode: "explicit",
      });
      expect(res).toEqual({ ok: true, to: "120363401234567890@g.us" });
    });

    it("implicit mode still allows targets not in allowlist (fallback to first)", () => {
      const cfg: ClawdbotConfig = {
        channels: { whatsapp: { allowFrom: ["+1555000001", "+1555000002"] } },
      };
      const res = resolveOutboundTarget({
        channel: "whatsapp",
        to: "+1555999999",
        cfg,
        mode: "implicit",
      });
      // In implicit mode, unlisted targets fall back to the first allowFrom entry
      expect(res).toEqual({ ok: true, to: "+1555000001" });
    });
  });

  describe("whatsapp automation recipients validation (FIX-1.6)", () => {
    it("blocks heartbeat mode send when target not in automation.recipients", () => {
      const cfg: ClawdbotConfig = {
        channels: {
          whatsapp: {
            allowFrom: ["+1555000001", "+1555999999"],
            automation: { recipients: ["+1555000001"] },
          },
        },
      };
      const res = resolveOutboundTarget({
        channel: "whatsapp",
        to: "+1555999999",
        cfg,
        mode: "heartbeat",
      });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.message).toContain("automation.recipients");
        expect(res.error.message).toContain("Automation send");
      }
    });

    it("allows heartbeat mode send when target is in automation.recipients", () => {
      const cfg: ClawdbotConfig = {
        channels: {
          whatsapp: {
            allowFrom: ["+1555000001", "+1555999999"],
            automation: { recipients: ["+1555000001"] },
          },
        },
      };
      const res = resolveOutboundTarget({
        channel: "whatsapp",
        to: "+1555000001",
        cfg,
        mode: "heartbeat",
      });
      expect(res).toEqual({ ok: true, to: "+1555000001" });
    });

    it("blocks automation mode send when target not in automation.recipients", () => {
      const cfg: ClawdbotConfig = {
        channels: {
          whatsapp: {
            allowFrom: ["+1555000001", "+1555999999"],
            automation: { recipients: ["+1555000001"] },
          },
        },
      };
      const res = resolveOutboundTarget({
        channel: "whatsapp",
        to: "+1555999999",
        cfg,
        mode: "automation",
      });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.message).toContain("automation.recipients");
      }
    });

    it("allows automation mode send when target is in automation.recipients", () => {
      const cfg: ClawdbotConfig = {
        channels: {
          whatsapp: {
            allowFrom: ["+1555000001"],
            automation: { recipients: ["+1555000001"] },
          },
        },
      };
      const res = resolveOutboundTarget({
        channel: "whatsapp",
        to: "+1555000001",
        cfg,
        mode: "automation",
      });
      expect(res).toEqual({ ok: true, to: "+1555000001" });
    });

    it("blocks automation when automation.recipients is explicitly empty", () => {
      const cfg: ClawdbotConfig = {
        channels: {
          whatsapp: {
            allowFrom: ["+1555000001", "+1555000002"],
            automation: { recipients: [] },
          },
        },
      };
      const res = resolveOutboundTarget({
        channel: "whatsapp",
        to: "+1555999999",
        cfg,
        mode: "heartbeat",
      });
      // FIX-2: When automation.recipients is explicitly empty, block ALL automation sends
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.message).toContain("automation.recipients is configured but empty");
      }
    });

    it("falls back to allowlist when automation.recipients is NOT configured (undefined)", () => {
      const cfg: ClawdbotConfig = {
        channels: {
          whatsapp: {
            allowFrom: ["+1555000001", "+1555000002"],
            // automation.recipients is undefined - not configured
          },
        },
      };
      const res = resolveOutboundTarget({
        channel: "whatsapp",
        to: "+1555999999",
        cfg,
        mode: "heartbeat",
      });
      // When automation.recipients is NOT configured (undefined), fall back to allowlist
      expect(res).toEqual({ ok: true, to: "+1555000001" });
    });

    it("allows groups in heartbeat mode regardless of automation.recipients", () => {
      const cfg: ClawdbotConfig = {
        channels: {
          whatsapp: {
            allowFrom: ["+1555000001"],
            automation: { recipients: ["+1555000001"] },
          },
        },
      };
      const res = resolveOutboundTarget({
        channel: "whatsapp",
        to: "120363401234567890@g.us",
        cfg,
        mode: "heartbeat",
      });
      expect(res).toEqual({ ok: true, to: "120363401234567890@g.us" });
    });

    it("uses account-level automation.recipients when configured", () => {
      const cfg: ClawdbotConfig = {
        channels: {
          whatsapp: {
            allowFrom: ["+1555000001"],
            automation: { recipients: ["+1555000001"] },
            accounts: {
              personal: {
                allowFrom: ["+1555000001", "+1555000002"],
                automation: { recipients: ["+1555000002"] },
              },
            },
          },
        },
      };
      // Account-level automation.recipients (+1555000002) should take precedence over global (+1555000001)
      const res = resolveOutboundTarget({
        channel: "whatsapp",
        to: "+1555000002",
        cfg,
        accountId: "personal",
        mode: "heartbeat",
      });
      expect(res).toEqual({ ok: true, to: "+1555000002" });
    });
  });
});

describe("resolveHeartbeatDeliveryTarget", () => {
  beforeEach(() => {
    setActivePluginRegistry(
      createTestRegistry([
        { pluginId: "whatsapp", plugin: whatsappPlugin, source: "test" },
        { pluginId: "telegram", plugin: telegramPlugin, source: "test" },
      ]),
    );
  });

  it("throws error when requireExplicitTarget is true and no to is set", () => {
    const cfg: ClawdbotConfig = {
      agents: {
        defaults: {
          heartbeat: {
            target: "whatsapp",
            requireExplicitTarget: true,
            // no `to` set
          },
        },
      },
      channels: { whatsapp: { allowFrom: ["+1555000001"] } },
    };
    // FIX-1.4: Now throws instead of returning channel: "none" (stricter behavior)
    expect(() =>
      resolveHeartbeatDeliveryTarget({
        cfg,
        entry: { sessionId: "test", updatedAt: 1, lastChannel: "whatsapp", lastTo: "+1555000001" },
      }),
    ).toThrow(/requireExplicitTarget is enabled but no explicit 'to' target was provided/);
  });

  it("allows implicit routing when requireExplicitTarget defaults to false", () => {
    const cfg: ClawdbotConfig = {
      agents: {
        defaults: {
          heartbeat: {
            target: "whatsapp",
            // requireExplicitTarget defaults to false (backwards compatible)
            // no `to` set - should use implicit routing
          },
        },
      },
      channels: { whatsapp: { allowFrom: ["+1555000001"] } },
    };
    // Default is backwards compatible - allows implicit routing
    const result = resolveHeartbeatDeliveryTarget({
      cfg,
      entry: { sessionId: "test", updatedAt: 1, lastChannel: "whatsapp", lastTo: "+1555000001" },
    });
    expect(result.channel).toBe("whatsapp");
    expect(result.to).toBe("+1555000001");
  });

  it("allows heartbeat delivery when requireExplicitTarget is true and to is set", () => {
    const cfg: ClawdbotConfig = {
      agents: {
        defaults: {
          heartbeat: {
            target: "whatsapp",
            requireExplicitTarget: true,
            to: "+1555000001",
          },
        },
      },
      channels: { whatsapp: { allowFrom: ["+1555000001"] } },
    };
    const result = resolveHeartbeatDeliveryTarget({
      cfg,
      entry: { sessionId: "test", updatedAt: 1, lastChannel: "whatsapp", lastTo: "+1555000002" },
    });
    expect(result.channel).toBe("whatsapp");
    expect(result.to).toBe("+1555000001");
  });

  it("allows implicit routing when requireExplicitTarget is explicitly set to false", () => {
    const cfg: ClawdbotConfig = {
      agents: {
        defaults: {
          heartbeat: {
            target: "last",
            // Must explicitly set to false to allow implicit routing
            requireExplicitTarget: false,
          },
        },
      },
      channels: { whatsapp: { allowFrom: ["+1555000001"] } },
    };
    const result = resolveHeartbeatDeliveryTarget({
      cfg,
      entry: { sessionId: "test", updatedAt: 1, lastChannel: "whatsapp", lastTo: "+1555000001" },
    });
    expect(result.channel).toBe("whatsapp");
    expect(result.to).toBe("+1555000001");
  });
});

describe("resolveSessionDeliveryTarget", () => {
  it("derives implicit delivery from the last route", () => {
    const resolved = resolveSessionDeliveryTarget({
      entry: {
        sessionId: "sess-1",
        updatedAt: 1,
        lastChannel: " whatsapp ",
        lastTo: " +1555 ",
        lastAccountId: " acct-1 ",
      },
      requestedChannel: "last",
    });

    expect(resolved).toEqual({
      channel: "whatsapp",
      to: "+1555",
      accountId: "acct-1",
      threadId: undefined,
      mode: "implicit",
      lastChannel: "whatsapp",
      lastTo: "+1555",
      lastAccountId: "acct-1",
      lastThreadId: undefined,
    });
  });

  it("prefers explicit targets without reusing lastTo", () => {
    const resolved = resolveSessionDeliveryTarget({
      entry: {
        sessionId: "sess-2",
        updatedAt: 1,
        lastChannel: "whatsapp",
        lastTo: "+1555",
      },
      requestedChannel: "telegram",
    });

    expect(resolved).toEqual({
      channel: "telegram",
      to: undefined,
      accountId: undefined,
      threadId: undefined,
      mode: "implicit",
      lastChannel: "whatsapp",
      lastTo: "+1555",
      lastAccountId: undefined,
      lastThreadId: undefined,
    });
  });

  it("allows mismatched lastTo when configured", () => {
    const resolved = resolveSessionDeliveryTarget({
      entry: {
        sessionId: "sess-3",
        updatedAt: 1,
        lastChannel: "whatsapp",
        lastTo: "+1555",
      },
      requestedChannel: "telegram",
      allowMismatchedLastTo: true,
    });

    expect(resolved).toEqual({
      channel: "telegram",
      to: "+1555",
      accountId: undefined,
      threadId: undefined,
      mode: "implicit",
      lastChannel: "whatsapp",
      lastTo: "+1555",
      lastAccountId: undefined,
      lastThreadId: undefined,
    });
  });

  it("falls back to a provided channel when requested is unsupported", () => {
    const resolved = resolveSessionDeliveryTarget({
      entry: {
        sessionId: "sess-4",
        updatedAt: 1,
        lastChannel: "whatsapp",
        lastTo: "+1555",
      },
      requestedChannel: "webchat",
      fallbackChannel: "slack",
    });

    expect(resolved).toEqual({
      channel: "slack",
      to: undefined,
      accountId: undefined,
      threadId: undefined,
      mode: "implicit",
      lastChannel: "whatsapp",
      lastTo: "+1555",
      lastAccountId: undefined,
      lastThreadId: undefined,
    });
  });
});
