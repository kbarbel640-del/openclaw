/**
 * Feishu channel plugin implementation
 * @module extensions/feishu/channel
 */

import {
  emptyPluginConfigSchema,
  type ChannelPlugin,
  type OpenClawConfig,
  type GroupToolPolicyConfig,
  type ChannelMeta,
} from "../../../src/plugin-sdk/index.js";

import { getFeishuRuntime } from "./runtime.js";

const DEFAULT_ACCOUNT_ID = "default";

const meta: ChannelMeta = {
  id: "feishu",
  label: "Feishu",
  selectionLabel: "Feishu (Lark)",
  docsPath: "/channels/feishu",
  blurb: "Open-source team collaboration platform (fork of Larksuite)",
  aliases: ["lark"],
  quickstartAllowFrom: true,
};

/**
 * Feishu channel plugin - simplified version that delegates to core runtime
 */
export const feishuPlugin: ChannelPlugin = {
  id: "feishu",
  meta,
  capabilities: {
    chatTypes: ["direct", "group"],
    reactions: false,
    threads: false,
    media: true,
    nativeCommands: false,
    blockStreaming: false,
  },
  reload: { configPrefixes: ["channels.feishu"] },
  configSchema: {
    schema: {},
  },

  config: {
    listAccountIds: (cfg: any) => {
      const feishu = cfg.channels?.feishu as any;
      if (!feishu || !feishu.accounts) return [];
      return Object.keys(feishu.accounts);
    },
    resolveAccount: (cfg: any, accountId: any) => {
      const feishu = cfg.channels?.feishu as any;
      const accountConfig = feishu?.accounts?.[accountId] ?? {};
      return {
        accountId: accountId ?? DEFAULT_ACCOUNT_ID,
        name: accountConfig.name ?? accountId,
        enabled: accountConfig.enabled !== false,
        appId: accountConfig.appId ?? "",
        appSecret: accountConfig.appSecret ?? "",
        config: accountConfig,
        tokenSource: accountConfig.appId ? "config" : "none",
      } as any;
    },
    defaultAccountId: () => DEFAULT_ACCOUNT_ID,
    setAccountEnabled: ({ cfg, accountId, enabled }: any) => {
      const nextCfg = { ...cfg } as OpenClawConfig;
      if (!nextCfg.channels) nextCfg.channels = {};
      
      const feishu = nextCfg.channels.feishu as any ?? { enabled: true, accounts: {} };
      const nextFeishu = { ...feishu };
      
      if (accountId === DEFAULT_ACCOUNT_ID) {
        nextFeishu.enabled = enabled;
      } else {
        if (!nextFeishu.accounts) nextFeishu.accounts = {};
        nextFeishu.accounts = { ...nextFeishu.accounts };
        if (nextFeishu.accounts[accountId]) {
          nextFeishu.accounts[accountId] = { ...nextFeishu.accounts[accountId], enabled };
        }
      }
      
      nextCfg.channels.feishu = nextFeishu;
      return nextCfg;
    },
    deleteAccount: ({ cfg, accountId }: any) => {
      const nextCfg = { ...cfg } as OpenClawConfig;
      const feishu = nextCfg.channels?.feishu as any;
      if (!feishu) return nextCfg;
      
      const nextFeishu = { ...feishu };
      
      if (accountId === DEFAULT_ACCOUNT_ID) {
        delete (nextFeishu as any).appId;
        delete (nextFeishu as any).appSecret;
      } else if (nextFeishu.accounts?.[accountId]) {
        nextFeishu.accounts = { ...nextFeishu.accounts };
        delete nextFeishu.accounts[accountId];
      }
      
      nextCfg.channels = { ...nextCfg.channels, feishu: nextFeishu };
      return nextCfg;
    },
    isConfigured: (account: any) => Boolean((account as any).appId?.trim() && (account as any).appSecret?.trim()),
    describeAccount: (account: any) => ({
      accountId: (account as any).accountId,
      name: (account as any).name,
      enabled: (account as any).enabled,
      configured: Boolean((account as any).appId?.trim() && (account as any).appSecret?.trim()),
      tokenSource: (account as any).tokenSource,
    }),
    resolveAllowFrom: ({ cfg, accountId }: any) => {
      const feishu = cfg.channels?.feishu as any;
      const allowFrom = feishu?.accounts?.[accountId]?.allowFrom ?? [];
      return allowFrom.map((e: any) => String(e));
    },
    formatAllowFrom: ({ allowFrom }: any) =>
      allowFrom.map((e: any) => String(e).trim()).filter(Boolean),
  },

  security: {
    resolveDmPolicy: ({ cfg, accountId, account }: any) => {
      const resolvedAccountId = accountId ?? (account as any).accountId ?? DEFAULT_ACCOUNT_ID;
      const useAccountPath = Boolean(cfg.channels?.feishu?.accounts?.[resolvedAccountId]);
      const basePath = useAccountPath
        ? `channels.feishu.accounts.${resolvedAccountId}.`
        : "channels.feishu.";
      return {
        policy: (account as any).config?.dmPolicy ?? "pairing",
        allowFrom: (account as any).config?.allowFrom ?? [],
        policyPath: `${basePath}dmPolicy`,
        allowFromPath: basePath,
        approveHint: "Feishu account pairing approval",
        normalizeEntry: (raw: string) => raw.trim(),
      };
    },
    collectWarnings: () => [],
  },

  groups: {
    resolveRequireMention: ({ account }: any) => (account as any).config?.requireMention ?? true,
    resolveToolPolicy: (): GroupToolPolicyConfig | undefined => undefined,
  },

  messaging: {
    normalizeTarget: (target: string) => target.trim(),
    targetResolver: {
      looksLikeId: (target: string) => /^[a-zA-Z0-9._@-]+$/.test(target.trim()),
      hint: "<open_id|user_id|email|chat_id>",
    },
  },

  directory: {
    self: async () => null,
    listPeers: async () => [],
    listGroups: async () => [],
  },

  setup: {
    resolveAccountId: ({ accountId }: any) => accountId,
    applyAccountName: ({ cfg, accountId, name }: any) => {
      const nextCfg = { ...cfg } as OpenClawConfig;
      if (!nextCfg.channels) nextCfg.channels = {};
      
      const feishu = nextCfg.channels.feishu as any ?? { enabled: true, accounts: {} };
      const nextFeishu = { ...feishu };
      
      if (accountId === DEFAULT_ACCOUNT_ID) {
        nextFeishu.name = name;
      } else {
        if (!nextFeishu.accounts) nextFeishu.accounts = {};
        nextFeishu.accounts = { ...nextFeishu.accounts };
        nextFeishu.accounts[accountId] = { ...(nextFeishu.accounts[accountId] ?? {}), name };
      }
      
      nextCfg.channels.feishu = nextFeishu;
      return nextCfg;
    },
    validateInput: ({ input }: any) => {
      if (!input.appId || !input.appSecret) {
        return "Feishu requires appId and appSecret.";
      }
      return null;
    },
    applyAccountConfig: ({ cfg, accountId, input }: any) => {
      const nextCfg = { ...cfg } as OpenClawConfig;
      if (!nextCfg.channels) nextCfg.channels = {};
      
      const feishu = (nextCfg.channels.feishu as any) ?? { enabled: true, accounts: {} };
      const nextFeishu = { ...feishu };
      
      if (accountId === DEFAULT_ACCOUNT_ID) {
        nextFeishu.enabled = true;
        nextFeishu.appId = input.appId;
        nextFeishu.appSecret = input.appSecret;
      } else {
        if (!nextFeishu.accounts) nextFeishu.accounts = {};
        nextFeishu.accounts = { ...nextFeishu.accounts };
        nextFeishu.accounts[accountId] = {
          ...(nextFeishu.accounts[accountId] ?? {}),
          enabled: true,
          appId: input.appId,
          appSecret: input.appSecret,
          name: input.name,
        };
      }
      
      nextCfg.channels.feishu = nextFeishu;
      return nextCfg;
    },
  },

  outbound: {
    deliveryMode: "direct",
    chunker: (text: any) => {
      const limit = 4000;
      if (text.length <= limit) return [text];
      const chunks: string[] = [];
      for (let i = 0; i < text.length; i += limit) {
        chunks.push(text.slice(i, i + limit));
      }
      return chunks;
    },
    chunkerMode: "text",
    textChunkLimit: 4000,
    sendText: async ({ to, text, accountId }: any) => ({
      channel: "feishu",
      messageId: "mock",
      chatId: to,
    }),
    sendMedia: async ({ to, text, mediaUrl, accountId }: any) => ({
      channel: "feishu",
      messageId: "mock",
      chatId: to,
    }),
  },

  status: {
    defaultRuntime: {
      accountId: DEFAULT_ACCOUNT_ID,
      running: false,
      lastStartAt: null,
      lastStopAt: null,
      lastError: null,
    },
    collectStatusIssues: () => [],
    buildChannelSummary: ({ snapshot }: any) => ({
      configured: snapshot.configured ?? false,
      tokenSource: snapshot.tokenSource ?? "none",
      running: snapshot.running ?? false,
      lastStartAt: snapshot.lastStartAt ?? null,
      lastStopAt: snapshot.lastStopAt ?? null,
      lastError: snapshot.lastError ?? null,
    }),
    probeAccount: async () => ({
      ok: true,
      bot: {},
    }),
    auditAccount: async () => undefined,
    buildAccountSnapshot: ({ account, runtime, probe }: any) => ({
      accountId: (account as any).accountId,
      name: (account as any).name,
      enabled: (account as any).enabled,
      configured: Boolean((account as any).appId?.trim() && (account as any).appSecret?.trim()),
      tokenSource: (account as any).tokenSource,
      running: runtime?.running ?? false,
      lastStartAt: runtime?.lastStartAt ?? null,
      lastStopAt: runtime?.lastStopAt ?? null,
      lastError: runtime?.lastError ?? null,
      probe,
    }),
  },

  gateway: {
    startAccount: async (ctx: any) => {
      ctx.log?.info?.(`[${ctx.account.accountId}] starting Feishu provider (mock)`);
      return { stopped: Promise.resolve() };
    },

    logoutAccount: async ({ accountId, cfg }: any) => {
      const nextCfg = { ...cfg } as OpenClawConfig;
      const nextFeishu = cfg.channels?.feishu ? { ...cfg.channels.feishu } : undefined;
      let cleared = false;
      let changed = false;

      if (nextFeishu) {
        if (accountId === DEFAULT_ACCOUNT_ID && ((nextFeishu as any).appId || (nextFeishu as any).appSecret)) {
          delete (nextFeishu as any).appId;
          delete (nextFeishu as any).appSecret;
          cleared = true;
          changed = true;
        }

        const accounts = (nextFeishu as any).accounts && typeof (nextFeishu as any).accounts === "object"
          ? { ...(nextFeishu as any).accounts }
          : undefined;

        if (accounts && accountId in accounts) {
          const entry = accounts[accountId];
          if (entry && typeof entry === "object") {
            const nextEntry = { ...entry } as Record<string, unknown>;
            if ("appId" in nextEntry || "appSecret" in nextEntry) {
              cleared = true;
            }
            delete nextEntry.appId;
            delete nextEntry.appSecret;
            changed = true;

            if (Object.keys(nextEntry).length === 0) {
              delete accounts[accountId];
              changed = true;
            } else {
              accounts[accountId] = nextEntry as any;
            }
          }
        }

        if (accounts) {
          if (Object.keys(accounts).length === 0) {
            delete (nextFeishu as any).accounts;
            changed = true;
          } else {
            (nextFeishu as any).accounts = accounts;
          }
        }
      }

      if (changed) {
        if (nextFeishu && Object.keys(nextFeishu).length > 0) {
          nextCfg.channels = { ...nextCfg.channels, feishu: nextFeishu };
        } else {
          const nextChannels = { ...nextCfg.channels };
          delete (nextChannels as any).feishu;
          if (Object.keys(nextChannels).length > 0) {
            nextCfg.channels = nextChannels;
          } else {
            delete nextCfg.channels;
          }
        }
      }

      const loggedOut = !(nextCfg.channels?.feishu as any)?.accounts?.[accountId]?.appId;

      if (changed) {
        await getFeishuRuntime().config.writeConfigFile(nextCfg);
      }

      return { cleared, loggedOut };
    },
  },
};
