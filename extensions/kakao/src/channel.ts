import type { ChannelAccountSnapshot, ChannelDock, ChannelPlugin } from "openclaw/plugin-sdk";
import {
  applyAccountNameToChannelSection,
  buildChannelConfigSchema,
  DEFAULT_ACCOUNT_ID,
  deleteAccountFromConfigSection,
  formatPairingApproveHint,
  normalizeAccountId,
  setAccountEnabledInConfigSection,
} from "openclaw/plugin-sdk";
import {
  listKakaoAccountIds,
  resolveDefaultKakaoAccountId,
  resolveKakaoAccount,
  type ResolvedKakaoAccount,
} from "./accounts.js";
import { KakaoConfigSchema } from "./config-schema.js";

const meta = {
  id: "kakao",
  label: "Kakao",
  selectionLabel: "Kakao (Skill Webhook)",
  docsPath: "/channels/kakao",
  docsLabel: "kakao",
  blurb: "KakaoTalk bot webhook for routing chats to OpenClaw.",
  aliases: ["kakaotalk"],
  order: 85,
  quickstartAllowFrom: true,
};

function formatAllowFromEntry(entry: string): string {
  return entry
    .trim()
    .replace(/^kakao:/i, "")
    .replace(/^user:/i, "")
    .toLowerCase();
}

export const kakaoDock: ChannelDock = {
  id: "kakao",
  capabilities: {
    chatTypes: ["direct"],
    blockStreaming: true,
  },
  outbound: { textChunkLimit: 2000 },
  config: {
    resolveAllowFrom: ({ cfg, accountId }) =>
      (resolveKakaoAccount({ cfg: cfg, accountId }).config.allowFrom ?? []).map((entry) =>
        String(entry),
      ),
    formatAllowFrom: ({ allowFrom }) =>
      allowFrom
        .map((entry) => String(entry))
        .filter(Boolean)
        .map(formatAllowFromEntry),
  },
  groups: {
    resolveRequireMention: () => true,
  },
  threading: {
    resolveReplyToMode: () => "off",
  },
};

export const kakaoPlugin: ChannelPlugin<ResolvedKakaoAccount> = {
  id: "kakao",
  meta,
  capabilities: {
    chatTypes: ["direct"],
    reactions: false,
    threads: false,
    media: false,
    nativeCommands: false,
    blockStreaming: true,
  },
  reload: { configPrefixes: ["channels.kakao"] },
  configSchema: buildChannelConfigSchema(KakaoConfigSchema),
  config: {
    listAccountIds: (cfg) => listKakaoAccountIds(cfg),
    resolveAccount: (cfg, accountId) => resolveKakaoAccount({ cfg: cfg, accountId }),
    defaultAccountId: (cfg) => resolveDefaultKakaoAccountId(cfg),
    setAccountEnabled: ({ cfg, accountId, enabled }) =>
      setAccountEnabledInConfigSection({
        cfg: cfg,
        sectionKey: "kakao",
        accountId,
        enabled,
        allowTopLevel: true,
      }),
    deleteAccount: ({ cfg, accountId }) =>
      deleteAccountFromConfigSection({
        cfg: cfg,
        sectionKey: "kakao",
        accountId,
        clearBaseFields: ["webhookPath", "webhookUrl", "botId", "name"],
      }),
    isConfigured: () => true,
    describeAccount: (account): ChannelAccountSnapshot => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: true,
      webhookPath: account.config.webhookPath,
      webhookUrl: account.config.webhookUrl,
      bot: account.botId ? { id: account.botId } : undefined,
      dmPolicy: account.config.dmPolicy ?? "pairing",
    }),
    resolveAllowFrom: ({ cfg, accountId }) =>
      (resolveKakaoAccount({ cfg: cfg, accountId }).config.allowFrom ?? []).map((entry) =>
        String(entry),
      ),
    formatAllowFrom: ({ allowFrom }) =>
      allowFrom
        .map((entry) => String(entry))
        .filter(Boolean)
        .map(formatAllowFromEntry),
  },
  security: {
    resolveDmPolicy: ({ cfg, accountId, account }) => {
      const resolvedAccountId = accountId ?? account.accountId ?? DEFAULT_ACCOUNT_ID;
      const useAccountPath = Boolean(cfg.channels?.kakao?.accounts?.[resolvedAccountId]);
      const basePath = useAccountPath
        ? `channels.kakao.accounts.${resolvedAccountId}.`
        : "channels.kakao.";
      return {
        policy: account.config.dmPolicy ?? "pairing",
        allowFrom: account.config.allowFrom ?? [],
        policyPath: `${basePath}dmPolicy`,
        allowFromPath: basePath,
        approveHint: formatPairingApproveHint("kakao"),
        normalizeEntry: (raw) => raw.replace(/^kakao:/i, ""),
      };
    },
  },
  setup: {
    resolveAccountId: ({ accountId }) => normalizeAccountId(accountId),
    applyAccountName: ({ cfg, accountId, name }) =>
      applyAccountNameToChannelSection({
        cfg: cfg,
        channelKey: "kakao",
        accountId,
        name,
      }),
  },
  gateway: {
    startAccount: async (ctx) => {
      ctx.log?.info(`[${ctx.accountId}] starting provider`);
      const { monitorKakaoProvider } = await import("./monitor.js");
      return monitorKakaoProvider({
        account: ctx.account,
        config: ctx.cfg,
        runtime: ctx.runtime,
        abortSignal: ctx.abortSignal,
        webhookPath: ctx.account.config.webhookPath,
        webhookUrl: ctx.account.config.webhookUrl,
        statusSink: (patch) => ctx.setStatus({ accountId: ctx.accountId, ...patch }),
      });
    },
  },
};
