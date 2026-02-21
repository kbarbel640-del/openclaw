import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock external dependencies
vi.mock("openclaw/plugin-sdk", () => ({
  DEFAULT_ACCOUNT_ID: "default",
  setAccountEnabledInConfigSection: vi.fn((_opts: any) => ({})),
  registerPluginHttpRoute: vi.fn(() => vi.fn()),
  buildChannelConfigSchema: vi.fn((schema: any) => ({ schema })),
}));

vi.mock("./client.js", () => ({
  sendMessage: vi.fn().mockResolvedValue(true),
  sendFileUrl: vi.fn().mockResolvedValue(true),
}));

vi.mock("./webhook-handler.js", () => ({
  createWebhookHandler: vi.fn(() => vi.fn()),
}));

vi.mock("./runtime.js", () => ({
  getSynologyRuntime: vi.fn(() => ({
    config: { loadConfig: vi.fn().mockResolvedValue({}) },
    channel: {
      reply: {
        dispatchReplyWithBufferedBlockDispatcher: vi.fn().mockResolvedValue({
          counts: {},
          queuedFinal: null,
        }),
      },
    },
  })),
}));

vi.mock("zod", () => ({
  z: {
    object: vi.fn(() => ({
      passthrough: vi.fn(() => ({ _type: "zod-schema" })),
    })),
  },
}));

const { createSynologyChatPlugin } = await import("./channel.js");

describe("createSynologyChatPlugin", () => {
  it("returns a plugin object with all required sections", () => {
    const plugin = createSynologyChatPlugin();
    expect(plugin.id).toBe("synology-chat");
    expect(plugin.meta).toBeDefined();
    expect(plugin.capabilities).toBeDefined();
    expect(plugin.config).toBeDefined();
    expect(plugin.security).toBeDefined();
    expect(plugin.outbound).toBeDefined();
    expect(plugin.gateway).toBeDefined();
  });

  describe("meta", () => {
    it("has correct id and label", () => {
      const plugin = createSynologyChatPlugin();
      expect(plugin.meta.id).toBe("synology-chat");
      expect(plugin.meta.label).toBe("Synology Chat");
    });
  });

  describe("capabilities", () => {
    it("supports direct chat only", () => {
      const plugin = createSynologyChatPlugin();
      expect(plugin.capabilities.chatTypes).toEqual(["direct"]);
      expect(plugin.capabilities.media).toBe(false);
      expect(plugin.capabilities.threads).toBe(false);
    });
  });

  describe("config", () => {
    it("listAccountIds delegates to accounts module", () => {
      const plugin = createSynologyChatPlugin();
      const result = plugin.config.listAccountIds({});
      expect(Array.isArray(result)).toBe(true);
    });

    it("resolveAccount returns account config", () => {
      const cfg = { channels: { "synology-chat": { token: "t1" } } };
      const plugin = createSynologyChatPlugin();
      const account = plugin.config.resolveAccount(cfg, "default");
      expect(account.accountId).toBe("default");
    });

    it("defaultAccountId returns 'default'", () => {
      const plugin = createSynologyChatPlugin();
      expect(plugin.config.defaultAccountId({})).toBe("default");
    });
  });

  describe("security", () => {
    it("resolveDmPolicy returns policy, allowFrom, normalizeEntry", () => {
      const plugin = createSynologyChatPlugin();
      const account = {
        accountId: "default",
        enabled: true,
        token: "t",
        incomingUrl: "u",
        nasHost: "h",
        webhookPath: "/w",
        dmPolicy: "allowlist" as const,
        allowedUserIds: ["user1"],
        rateLimitPerMinute: 30,
        botName: "Bot",
        allowInsecureSsl: true,
      };
      const result = plugin.security.resolveDmPolicy({ cfg: {}, account });
      expect(result!.policy).toBe("allowlist");
      expect(result!.allowFrom).toEqual(["user1"]);
      expect(typeof result!.normalizeEntry).toBe("function");
      expect(result!.normalizeEntry!("  USER1  ")).toBe("user1");
    });
  });

  describe("outbound", () => {
    it("sendText throws when no incomingUrl", async () => {
      const plugin = createSynologyChatPlugin();
      await expect(
        plugin.outbound.sendText({
          account: {
            accountId: "default",
            enabled: true,
            token: "t",
            incomingUrl: "",
            nasHost: "h",
            webhookPath: "/w",
            dmPolicy: "open",
            allowedUserIds: [],
            rateLimitPerMinute: 30,
            botName: "Bot",
            allowInsecureSsl: true,
          },
          text: "hello",
          to: "user1",
        }),
      ).rejects.toThrow("not configured");
    });

    it("sendText returns OutboundDeliveryResult on success", async () => {
      const plugin = createSynologyChatPlugin();
      const result = await plugin.outbound.sendText({
        account: {
          accountId: "default",
          enabled: true,
          token: "t",
          incomingUrl: "https://nas/incoming",
          nasHost: "h",
          webhookPath: "/w",
          dmPolicy: "open",
          allowedUserIds: [],
          rateLimitPerMinute: 30,
          botName: "Bot",
          allowInsecureSsl: true,
        },
        text: "hello",
        to: "user1",
      });
      expect(result.channel).toBe("synology-chat");
      expect(result.messageId).toBeDefined();
      expect(result.chatId).toBe("user1");
    });

    it("sendMedia throws when missing incomingUrl", async () => {
      const plugin = createSynologyChatPlugin();
      await expect(
        plugin.outbound.sendMedia({
          account: {
            accountId: "default",
            enabled: true,
            token: "t",
            incomingUrl: "",
            nasHost: "h",
            webhookPath: "/w",
            dmPolicy: "open",
            allowedUserIds: [],
            rateLimitPerMinute: 30,
            botName: "Bot",
            allowInsecureSsl: true,
          },
          mediaUrl: "https://example.com/img.png",
          to: "user1",
        }),
      ).rejects.toThrow("not configured");
    });
  });

  describe("gateway", () => {
    it("startAccount returns stop function for disabled account", async () => {
      const plugin = createSynologyChatPlugin();
      const ctx = {
        cfg: {
          channels: { "synology-chat": { enabled: false } },
        },
        accountId: "default",
        log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      };
      const result = await plugin.gateway.startAccount(ctx);
      expect(typeof result.stop).toBe("function");
    });

    it("startAccount returns stop function for account without token", async () => {
      const plugin = createSynologyChatPlugin();
      const ctx = {
        cfg: {
          channels: { "synology-chat": { enabled: true } },
        },
        accountId: "default",
        log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      };
      const result = await plugin.gateway.startAccount(ctx);
      expect(typeof result.stop).toBe("function");
    });
  });
});
