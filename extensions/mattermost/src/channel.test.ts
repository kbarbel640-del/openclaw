import type { OpenClawConfig } from "openclaw/plugin-sdk";
import { createReplyPrefixOptions } from "openclaw/plugin-sdk";
import { beforeEach, describe, expect, it } from "vitest";
import { mattermostPlugin } from "./channel.js";
import { resolveMattermostAccount } from "./mattermost/accounts.js";
import { resetMattermostReactionBotUserCacheForTests } from "./mattermost/reactions.js";
import {
  createMattermostReactionFetchMock,
  createMattermostTestConfig,
  withMockedGlobalFetch,
} from "./mattermost/reactions.test-helpers.js";

describe("mattermostPlugin", () => {
  describe("messaging", () => {
    it("keeps @username targets", () => {
      const normalize = mattermostPlugin.messaging?.normalizeTarget;
      if (!normalize) {
        return;
      }

      expect(normalize("@Alice")).toBe("@Alice");
      expect(normalize("@alice")).toBe("@alice");
    });

    it("normalizes mattermost: prefix to user:", () => {
      const normalize = mattermostPlugin.messaging?.normalizeTarget;
      if (!normalize) {
        return;
      }

      expect(normalize("mattermost:USER123")).toBe("user:USER123");
    });
  });

  describe("pairing", () => {
    it("normalizes allowlist entries", () => {
      const normalize = mattermostPlugin.pairing?.normalizeAllowEntry;
      if (!normalize) {
        return;
      }

      expect(normalize("@Alice")).toBe("alice");
      expect(normalize("user:USER123")).toBe("user123");
    });
  });

  describe("capabilities", () => {
    it("declares reactions support", () => {
      expect(mattermostPlugin.capabilities?.reactions).toBe(true);
    });
  });

  describe("messageActions", () => {
    beforeEach(() => {
      resetMattermostReactionBotUserCacheForTests();
    });

    const runReactAction = async (params: Record<string, unknown>, fetchMode: "add" | "remove") => {
      const cfg = createMattermostTestConfig();
      const fetchImpl = createMattermostReactionFetchMock({
        mode: fetchMode,
        postId: "POST1",
        emojiName: "thumbsup",
      });

      return await withMockedGlobalFetch(fetchImpl as unknown as typeof fetch, async () => {
        return await mattermostPlugin.actions?.handleAction?.({
          channel: "mattermost",
          action: "react",
          params,
          cfg,
          accountId: "default",
        } as any);
      });
    };

    it("exposes react when mattermost is configured", () => {
      const cfg: OpenClawConfig = {
        channels: {
          mattermost: {
            enabled: true,
            botToken: "test-token",
            baseUrl: "https://chat.example.com",
          },
        },
      };

      const actions = mattermostPlugin.actions?.listActions?.({ cfg }) ?? [];
      expect(actions).toContain("react");
      expect(actions).not.toContain("send");
      expect(mattermostPlugin.actions?.supportsAction?.({ action: "react" })).toBe(true);
    });

    it("hides react when mattermost is not configured", () => {
      const cfg: OpenClawConfig = {
        channels: {
          mattermost: {
            enabled: true,
          },
        },
      };

      const actions = mattermostPlugin.actions?.listActions?.({ cfg }) ?? [];
      expect(actions).toEqual([]);
    });

    it("hides react when actions.reactions is false", () => {
      const cfg: OpenClawConfig = {
        channels: {
          mattermost: {
            enabled: true,
            botToken: "test-token",
            baseUrl: "https://chat.example.com",
            actions: { reactions: false },
          },
        },
      };

      const actions = mattermostPlugin.actions?.listActions?.({ cfg }) ?? [];
      expect(actions).not.toContain("react");
      expect(actions).not.toContain("send");
    });

    it("respects per-account actions.reactions in listActions", () => {
      const cfg: OpenClawConfig = {
        channels: {
          mattermost: {
            enabled: true,
            actions: { reactions: false },
            accounts: {
              default: {
                enabled: true,
                botToken: "test-token",
                baseUrl: "https://chat.example.com",
                actions: { reactions: true },
              },
            },
          },
        },
      };

      const actions = mattermostPlugin.actions?.listActions?.({ cfg }) ?? [];
      expect(actions).toContain("react");
    });

    it("blocks react when default account disables reactions and accountId is omitted", async () => {
      const cfg: OpenClawConfig = {
        channels: {
          mattermost: {
            enabled: true,
            actions: { reactions: true },
            accounts: {
              default: {
                enabled: true,
                botToken: "test-token",
                baseUrl: "https://chat.example.com",
                actions: { reactions: false },
              },
            },
          },
        },
      };

      await expect(
        mattermostPlugin.actions?.handleAction?.({
          channel: "mattermost",
          action: "react",
          params: { messageId: "POST1", emoji: "thumbsup" },
          cfg,
        } as any),
      ).rejects.toThrow("Mattermost reactions are disabled in config");
    });

    it("handles react by calling Mattermost reactions API", async () => {
      const result = await runReactAction({ messageId: "POST1", emoji: "thumbsup" }, "add");

      expect(result?.content).toEqual([{ type: "text", text: "Reacted with :thumbsup: on POST1" }]);
      expect(result?.details).toEqual({});
    });

    it("only treats boolean remove flag as removal", async () => {
      const result = await runReactAction(
        { messageId: "POST1", emoji: "thumbsup", remove: "true" },
        "add",
      );

      expect(result?.content).toEqual([{ type: "text", text: "Reacted with :thumbsup: on POST1" }]);
    });

    it("removes reaction when remove flag is boolean true", async () => {
      const result = await runReactAction(
        { messageId: "POST1", emoji: "thumbsup", remove: true },
        "remove",
      );

      expect(result?.content).toEqual([
        { type: "text", text: "Removed reaction :thumbsup: from POST1" },
      ]);
      expect(result?.details).toEqual({});
    });
  });

  describe("config", () => {
    it("formats allowFrom entries", () => {
      const formatAllowFrom = mattermostPlugin.config.formatAllowFrom!;

      const formatted = formatAllowFrom({
        cfg: {} as OpenClawConfig,
        allowFrom: ["@Alice", "user:USER123", "mattermost:BOT999"],
      });
      expect(formatted).toEqual(["@alice", "user123", "bot999"]);
    });

    it("uses account responsePrefix overrides", () => {
      const cfg: OpenClawConfig = {
        channels: {
          mattermost: {
            responsePrefix: "[Channel]",
            accounts: {
              default: { responsePrefix: "[Account]" },
            },
          },
        },
      };

      const prefixContext = createReplyPrefixOptions({
        cfg,
        agentId: "main",
        channel: "mattermost",
        accountId: "default",
      });

      expect(prefixContext.responsePrefix).toBe("[Account]");
    });
  });

  describe("chatmode requireMention resolution", () => {
    // Bug: monitor.ts calls core.channel.groups.resolveRequireMention() (the SDK's
    // resolveChannelGroupRequireMention) without passing requireMentionOverride from
    // the account's chatmode-derived requireMention. This means chatmode: "onmessage"
    // (which sets account.requireMention = false) is ignored, and channel messages
    // without @mention are silently dropped.
    //
    // The plugin's resolveMattermostGroupRequireMention correctly checks account.requireMention,
    // but the monitor doesn't call it — it calls the SDK function directly.

    it("resolves requireMention=false when chatmode is 'onmessage'", () => {
      const cfg: OpenClawConfig = {
        channels: {
          mattermost: {
            enabled: true,
            botToken: "test-token",
            baseUrl: "https://chat.example.com",
            chatmode: "onmessage",
          },
        },
      };

      const account = resolveMattermostAccount({ cfg });
      expect(account.requireMention).toBe(false);
    });

    it("resolves requireMention=true when chatmode is 'oncall'", () => {
      const cfg: OpenClawConfig = {
        channels: {
          mattermost: {
            enabled: true,
            botToken: "test-token",
            baseUrl: "https://chat.example.com",
            chatmode: "oncall",
          },
        },
      };

      const account = resolveMattermostAccount({ cfg });
      expect(account.requireMention).toBe(true);
    });

    it("resolves requireMention=undefined when no chatmode is set", () => {
      const cfg: OpenClawConfig = {
        channels: {
          mattermost: {
            enabled: true,
            botToken: "test-token",
            baseUrl: "https://chat.example.com",
          },
        },
      };

      const account = resolveMattermostAccount({ cfg });
      expect(account.requireMention).toBeUndefined();
    });

    it("monitor must pass account.requireMention to disable mention for onmessage", () => {
      // The monitor must pass account.requireMention as requireMentionOverride.
      // Without it, the SDK defaults to true (require mention) and channel messages
      // without @mention are silently dropped even when chatmode is "onmessage".
      const cfg: OpenClawConfig = {
        channels: {
          mattermost: {
            enabled: true,
            botToken: "test-token",
            baseUrl: "https://chat.example.com",
            chatmode: "onmessage",
          },
        },
      };

      const account = resolveMattermostAccount({ cfg });
      expect(account.requireMention).toBe(false);

      // Without the override, SDK defaults to true — this is the bug.
      const withoutOverride = monitorResolveRequireMention({
        cfg,
        accountId: account.accountId,
      });
      expect(withoutOverride).toBe(true); // SDK default, ignores chatmode

      // With the override, chatmode "onmessage" correctly disables mention.
      const withOverride = monitorResolveRequireMention({
        cfg,
        accountId: account.accountId,
        requireMentionOverride: account.requireMention,
      });
      expect(withOverride).toBe(false);
    });
  });
});

// Simulates the monitor's current call to core.channel.groups.resolveRequireMention.
// When no per-group config exists and no requireMentionOverride is passed,
// the SDK defaults to true.
function monitorResolveRequireMention(params: {
  cfg: OpenClawConfig;
  accountId: string;
  requireMentionOverride?: boolean;
}): boolean {
  // Check per-group config (none in our test setup)
  const groups = params.cfg.channels?.mattermost?.groups as
    | Record<string, { requireMention?: boolean }>
    | undefined;
  const defaultConfig = groups?.["*"];
  const configMention = defaultConfig?.requireMention;

  if (typeof configMention === "boolean") {
    return configMention;
  }
  if (typeof params.requireMentionOverride === "boolean") {
    return params.requireMentionOverride;
  }
  // SDK default: require mention
  return true;
}
