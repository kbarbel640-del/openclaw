import type { OpenClawConfig } from "openclaw/plugin-sdk";
import { DEFAULT_ACCOUNT_ID } from "openclaw/plugin-sdk";
import { describe, expect, it } from "vitest";
import { maxPlugin } from "./channel.js";

describe("maxPlugin", () => {
  // -----------------------------------------------------------------------
  // Meta
  // -----------------------------------------------------------------------
  describe("meta", () => {
    it("has id=max", () => {
      expect(maxPlugin.id).toBe("max");
      expect(maxPlugin.meta.id).toBe("max");
    });

    it("has expected labels", () => {
      expect(maxPlugin.meta.label).toBe("MAX");
      expect(maxPlugin.meta.selectionLabel).toBe("MAX (Bot API)");
      expect(maxPlugin.meta.detailLabel).toBe("MAX Bot");
    });

    it("has docs path", () => {
      expect(maxPlugin.meta.docsPath).toBe("/channels/max");
    });
  });

  // -----------------------------------------------------------------------
  // Capabilities
  // -----------------------------------------------------------------------
  describe("capabilities", () => {
    it("supports direct and group chats", () => {
      expect(maxPlugin.capabilities?.chatTypes).toEqual(["direct", "group"]);
    });

    it("supports media", () => {
      expect(maxPlugin.capabilities?.media).toBe(true);
    });

    it("supports native commands", () => {
      expect(maxPlugin.capabilities?.nativeCommands).toBe(true);
    });

    it("supports block streaming", () => {
      expect(maxPlugin.capabilities?.blockStreaming).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Messaging
  // -----------------------------------------------------------------------
  describe("messaging", () => {
    it("normalizes numeric targets", () => {
      const normalize = maxPlugin.messaging?.normalizeTarget;
      expect(normalize).toBeDefined();
      expect(normalize!("12345")).toBe("12345");
      expect(normalize!("-100")).toBe("-100");
    });

    it("strips max: prefix", () => {
      const normalize = maxPlugin.messaging?.normalizeTarget;
      expect(normalize!("max:12345")).toBe("12345");
      expect(normalize!("MAX:99")).toBe("99");
    });

    it("returns undefined for invalid targets", () => {
      const normalize = maxPlugin.messaging?.normalizeTarget;
      expect(normalize!("hello")).toBeUndefined();
      expect(normalize!("")).toBeUndefined();
    });

    it("has target resolver", () => {
      const resolver = maxPlugin.messaging?.targetResolver;
      expect(resolver).toBeDefined();
      expect(resolver!.looksLikeId("12345")).toBe(true);
      expect(resolver!.looksLikeId("@user")).toBe(false);
      expect(resolver!.hint).toContain("chatId");
    });
  });

  // -----------------------------------------------------------------------
  // Pairing
  // -----------------------------------------------------------------------
  describe("pairing", () => {
    it("has idLabel=maxUserId", () => {
      expect(maxPlugin.pairing?.idLabel).toBe("maxUserId");
    });

    it("normalizes allowlist entries", () => {
      const normalize = maxPlugin.pairing?.normalizeAllowEntry;
      expect(normalize).toBeDefined();
      expect(normalize!("max:12345")).toBe("12345");
      expect(normalize!("MAX:67890")).toBe("67890");
      expect(normalize!("  12345  ")).toBe("12345");
    });

    it("strips max: prefix and lowercases", () => {
      const normalize = maxPlugin.pairing?.normalizeAllowEntry;
      expect(normalize!("MAX:ABC")).toBe("abc");
    });
  });

  // -----------------------------------------------------------------------
  // Config
  // -----------------------------------------------------------------------
  describe("config", () => {
    it("lists account IDs", () => {
      const cfg: OpenClawConfig = {
        channels: {
          max: { accounts: { bot1: { botToken: "a" }, bot2: { botToken: "b" } } },
        },
      };
      const ids = maxPlugin.config.listAccountIds(cfg);
      expect(ids).toEqual(["bot1", "bot2"]);
    });

    it("lists [default] when no accounts", () => {
      const cfg: OpenClawConfig = {};
      expect(maxPlugin.config.listAccountIds(cfg)).toEqual([DEFAULT_ACCOUNT_ID]);
    });

    it("resolves account", () => {
      const cfg: OpenClawConfig = {
        channels: { max: { botToken: "tok" } },
      };
      const account = maxPlugin.config.resolveAccount(cfg, DEFAULT_ACCOUNT_ID);
      expect(account.token).toBe("tok");
      expect(account.tokenSource).toBe("config");
    });

    it("returns default account ID", () => {
      const cfg: OpenClawConfig = {};
      expect(maxPlugin.config.defaultAccountId(cfg)).toBe(DEFAULT_ACCOUNT_ID);
    });

    it("isConfigured checks token presence", () => {
      expect(maxPlugin.config.isConfigured({ token: "tok" } as any)).toBe(true);
      expect(maxPlugin.config.isConfigured({ token: "" } as any)).toBe(false);
      expect(maxPlugin.config.isConfigured({ token: "  " } as any)).toBe(false);
    });

    it("describeAccount returns expected shape", () => {
      const account = {
        accountId: "bot1",
        name: "My Bot",
        enabled: true,
        token: "tok",
        tokenSource: "config" as const,
        config: {},
      };
      const desc = maxPlugin.config.describeAccount(account);
      expect(desc).toEqual({
        accountId: "bot1",
        name: "My Bot",
        enabled: true,
        configured: true,
        tokenSource: "config",
      });
    });

    it("describeAccount reports unconfigured", () => {
      const account = {
        accountId: "bot1",
        enabled: true,
        token: "",
        tokenSource: "none" as const,
        config: {},
      };
      const desc = maxPlugin.config.describeAccount(account);
      expect(desc.configured).toBe(false);
    });

    it("formats allowFrom entries", () => {
      const formatted = maxPlugin.config.formatAllowFrom({
        allowFrom: ["max:12345", "MAX:67890", "  abcdef  "],
      });
      expect(formatted).toEqual(["12345", "67890", "abcdef"]);
    });

    it("filters empty allowFrom entries", () => {
      const formatted = maxPlugin.config.formatAllowFrom({
        allowFrom: ["max:", ""],
      });
      expect(formatted).toEqual([]);
    });

    it("resolves allowFrom from account config", () => {
      const cfg: OpenClawConfig = {
        channels: {
          max: { botToken: "tok", allowFrom: ["12345", "67890"] },
        },
      };
      const allowFrom = maxPlugin.config.resolveAllowFrom({
        cfg,
        accountId: DEFAULT_ACCOUNT_ID,
      });
      expect(allowFrom).toEqual(["12345", "67890"]);
    });
  });

  // -----------------------------------------------------------------------
  // Security
  // -----------------------------------------------------------------------
  describe("security", () => {
    it("resolves DM policy defaults to pairing", () => {
      const cfg: OpenClawConfig = {
        channels: { max: { botToken: "tok" } },
      };
      const account = {
        accountId: DEFAULT_ACCOUNT_ID,
        enabled: true,
        token: "tok",
        tokenSource: "config" as const,
        config: {},
      };
      const result = maxPlugin.security!.resolveDmPolicy({
        cfg,
        accountId: DEFAULT_ACCOUNT_ID,
        account,
      });
      expect(result.policy).toBe("pairing");
    });

    it("uses explicit dmPolicy from account config", () => {
      const cfg: OpenClawConfig = {
        channels: { max: { botToken: "tok", dmPolicy: "allowlist" } },
      };
      const account = {
        accountId: DEFAULT_ACCOUNT_ID,
        enabled: true,
        token: "tok",
        tokenSource: "config" as const,
        config: { dmPolicy: "allowlist" as const },
      };
      const result = maxPlugin.security!.resolveDmPolicy({
        cfg,
        accountId: DEFAULT_ACCOUNT_ID,
        account,
      });
      expect(result.policy).toBe("allowlist");
    });

    it("warns when groupPolicy=open", () => {
      const cfg: OpenClawConfig = {
        channels: { max: { botToken: "tok" } },
      };
      const account = {
        accountId: DEFAULT_ACCOUNT_ID,
        enabled: true,
        token: "tok",
        tokenSource: "config" as const,
        config: { groupPolicy: "open" as const },
      };
      const warnings = maxPlugin.security!.collectWarnings!({ account, cfg });
      expect(warnings.length).toBe(1);
      expect(warnings[0]).toContain("groupPolicy");
    });

    it("no warnings when groupPolicy=allowlist", () => {
      const cfg: OpenClawConfig = {
        channels: { max: { botToken: "tok" } },
      };
      const account = {
        accountId: DEFAULT_ACCOUNT_ID,
        enabled: true,
        token: "tok",
        tokenSource: "config" as const,
        config: { groupPolicy: "allowlist" as const },
      };
      const warnings = maxPlugin.security!.collectWarnings!({ account, cfg });
      expect(warnings).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // Groups
  // -----------------------------------------------------------------------
  describe("groups", () => {
    it("requires mention by default", () => {
      const cfg: OpenClawConfig = {
        channels: { max: { botToken: "tok" } },
      };
      const result = maxPlugin.groups?.resolveRequireMention?.({
        cfg,
        accountId: DEFAULT_ACCOUNT_ID,
      });
      expect(result).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Streaming
  // -----------------------------------------------------------------------
  describe("streaming", () => {
    it("has block streaming coalesce defaults", () => {
      const defaults = maxPlugin.streaming?.blockStreamingCoalesceDefaults;
      expect(defaults).toBeDefined();
      expect(defaults!.minChars).toBe(1500);
      expect(defaults!.idleMs).toBe(1000);
    });
  });

  // -----------------------------------------------------------------------
  // Reload
  // -----------------------------------------------------------------------
  describe("reload", () => {
    it("watches channels.max prefix", () => {
      expect(maxPlugin.reload?.configPrefixes).toEqual(["channels.max"]);
    });
  });

  // -----------------------------------------------------------------------
  // Setup
  // -----------------------------------------------------------------------
  describe("setup", () => {
    it("validates input — requires token or tokenFile", () => {
      const result = maxPlugin.setup?.validateInput?.({
        accountId: DEFAULT_ACCOUNT_ID,
        input: { useEnv: false },
      });
      expect(result).toContain("token");
    });

    it("validates input — env only for default account", () => {
      const result = maxPlugin.setup?.validateInput?.({
        accountId: "mybot",
        input: { useEnv: true },
      });
      expect(result).toContain("default");
    });

    it("validates input — accepts useEnv for default", () => {
      const result = maxPlugin.setup?.validateInput?.({
        accountId: DEFAULT_ACCOUNT_ID,
        input: { useEnv: true },
      });
      expect(result).toBeNull();
    });

    it("validates input — accepts token", () => {
      const result = maxPlugin.setup?.validateInput?.({
        accountId: "mybot",
        input: { token: "tok" },
      });
      expect(result).toBeNull();
    });

    it("validates input — accepts tokenFile", () => {
      const result = maxPlugin.setup?.validateInput?.({
        accountId: "mybot",
        input: { tokenFile: "/path/to/token" },
      });
      expect(result).toBeNull();
    });

    it("applyAccountConfig sets token for default account", () => {
      const cfg: OpenClawConfig = {};
      const result = maxPlugin.setup?.applyAccountConfig?.({
        cfg,
        accountId: DEFAULT_ACCOUNT_ID,
        input: { token: "my-token" },
      });
      expect((result as any)?.channels?.max?.botToken).toBe("my-token");
      expect((result as any)?.channels?.max?.enabled).toBe(true);
    });

    it("applyAccountConfig sets token for named account", () => {
      const cfg: OpenClawConfig = {};
      const result = maxPlugin.setup?.applyAccountConfig?.({
        cfg,
        accountId: "mybot",
        input: { token: "my-token" },
      });
      expect((result as any)?.channels?.max?.accounts?.mybot?.botToken).toBe("my-token");
      expect((result as any)?.channels?.max?.accounts?.mybot?.enabled).toBe(true);
    });

    it("applyAccountConfig sets tokenFile", () => {
      const cfg: OpenClawConfig = {};
      const result = maxPlugin.setup?.applyAccountConfig?.({
        cfg,
        accountId: DEFAULT_ACCOUNT_ID,
        input: { tokenFile: "/path/to/token" },
      });
      expect((result as any)?.channels?.max?.tokenFile).toBe("/path/to/token");
    });
  });

  // -----------------------------------------------------------------------
  // Directory
  // -----------------------------------------------------------------------
  describe("directory", () => {
    it("self returns null", async () => {
      const result = await maxPlugin.directory?.self?.({} as any);
      expect(result).toBeNull();
    });

    it("listPeers returns empty array", async () => {
      const result = await maxPlugin.directory?.listPeers?.({} as any);
      expect(result).toEqual([]);
    });

    it("listGroups returns empty array", async () => {
      const result = await maxPlugin.directory?.listGroups?.({} as any);
      expect(result).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // Status
  // -----------------------------------------------------------------------
  describe("status", () => {
    it("has default runtime shape", () => {
      const dr = maxPlugin.status?.defaultRuntime;
      expect(dr).toBeDefined();
      expect(dr!.accountId).toBe(DEFAULT_ACCOUNT_ID);
      expect(dr!.running).toBe(false);
    });

    it("collectStatusIssues returns empty for no errors", () => {
      const issues = maxPlugin.status?.collectStatusIssues?.([
        { accountId: DEFAULT_ACCOUNT_ID, lastError: "" },
      ] as any);
      expect(issues).toEqual([]);
    });

    it("collectStatusIssues reports errors", () => {
      const issues = maxPlugin.status?.collectStatusIssues?.([
        { accountId: "bot1", lastError: "Connection refused" },
      ] as any);
      expect(issues?.length).toBe(1);
      expect(issues![0].channel).toBe("max");
      expect(issues![0].accountId).toBe("bot1");
      expect(issues![0].message).toContain("Connection refused");
    });

    it("buildChannelSummary returns expected shape", () => {
      const summary = maxPlugin.status?.buildChannelSummary?.({
        snapshot: {
          configured: true,
          tokenSource: "config",
          running: true,
          mode: "polling",
          lastStartAt: null,
          lastStopAt: null,
          lastError: null,
          probe: null,
          lastProbeAt: null,
        },
      } as any);
      expect(summary).toMatchObject({
        configured: true,
        tokenSource: "config",
        running: true,
        mode: "polling",
      });
    });
  });

  // -----------------------------------------------------------------------
  // Outbound
  // -----------------------------------------------------------------------
  describe("outbound", () => {
    it("has delivery mode direct", () => {
      expect(maxPlugin.outbound?.deliveryMode).toBe("direct");
    });

    it("has text chunk limit of 4000", () => {
      expect(maxPlugin.outbound?.textChunkLimit).toBe(4000);
    });

    it("has markdown chunker mode", () => {
      expect(maxPlugin.outbound?.chunkerMode).toBe("markdown");
    });
  });
});
