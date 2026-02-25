import {
  applyAccountNameToChannelSection,
  buildChannelConfigSchema,
  DEFAULT_ACCOUNT_ID,
  deleteAccountFromConfigSection,
  normalizeAccountId,
  setAccountEnabledInConfigSection,
  type ChannelPlugin,
  type OpenClawConfig,
} from "openclaw/plugin-sdk";
import {
  listWhatsAppCallAccountIds,
  resolveWhatsAppCallAccount,
  WhatsAppCallConfigSchema,
  type ResolvedWhatsAppCallAccount,
} from "./config.js";
import { whatsAppCallOnboardingAdapter } from "./onboarding.js";

const CHANNEL_KEY = "whatsappcall";

const meta = {
  id: CHANNEL_KEY,
  label: "WhatsApp Call",
  selectionLabel: "WhatsApp Call (Voice)",
  detailLabel: "WhatsApp Voice Call",
  docsPath: "/channels/whatsapp-call",
  docsLabel: "whatsapp-call",
  blurb: "outbound AI voice calls via WhatsApp (WATI or Meta Graph API).",
  systemImage: "phone.arrow.up.right",
  aliases: ["whatsapp-call", "wa-call", "wacall"],
};

export const whatsappCallPlugin: ChannelPlugin<ResolvedWhatsAppCallAccount> = {
  id: CHANNEL_KEY,
  meta,
  onboarding: whatsAppCallOnboardingAdapter,
  capabilities: {
    chatTypes: ["direct"],
  },
  reload: { configPrefixes: [`channels.${CHANNEL_KEY}`] },
  configSchema: buildChannelConfigSchema(WhatsAppCallConfigSchema),
  config: {
    listAccountIds: (cfg) => listWhatsAppCallAccountIds(cfg),
    resolveAccount: (cfg, accountId) => resolveWhatsAppCallAccount(cfg, accountId),
    defaultAccountId: () => DEFAULT_ACCOUNT_ID,
    setAccountEnabled: ({ cfg, accountId, enabled }) =>
      setAccountEnabledInConfigSection({
        cfg,
        sectionKey: CHANNEL_KEY,
        accountId,
        enabled,
        allowTopLevel: true,
      }),
    deleteAccount: ({ cfg, accountId }) =>
      deleteAccountFromConfigSection({
        cfg,
        sectionKey: CHANNEL_KEY,
        accountId,
        clearBaseFields: [
          "provider",
          "watiBaseUrl",
          "watiOutboundUrl",
          "watiTenantId",
          "watiApiToken",
          "metaPhoneNumberId",
          "metaAccessToken",
          "metaGraphBaseUrl",
          "openaiApiKey",
          "openaiModel",
          "voice",
          "voiceSpeed",
          "voiceLanguage",
          "voiceGreeting",
          "voiceInstructions",
          "twilioAccountSid",
          "twilioAuthToken",
          "webhookUrl",
          "appSecret",
          "verifyToken",
          "serviceUrl",
          "name",
        ],
      }),
    isConfigured: (account) => account.configured,
    describeAccount: (account) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: account.configured,
      credentialSource: account.provider ?? "none",
    }),
  },
  setup: {
    resolveAccountId: ({ accountId }) => normalizeAccountId(accountId),
    applyAccountName: ({ cfg, accountId, name }) =>
      applyAccountNameToChannelSection({
        cfg,
        channelKey: CHANNEL_KEY,
        accountId,
        name,
      }),
    validateInput: () => null,
    applyAccountConfig: ({ cfg, accountId, input }) => {
      const named = applyAccountNameToChannelSection({
        cfg,
        channelKey: CHANNEL_KEY,
        accountId,
        name: input.name,
      });

      const channels = (named.channels ?? {}) as Record<string, unknown>;
      const section = (channels[CHANNEL_KEY] ?? {}) as Record<string, unknown>;
      const extra: Record<string, string> = {};
      if (input.token) extra.watiApiToken = input.token;
      if (input.accessToken) extra.metaAccessToken = input.accessToken;
      if (input.url) extra.watiBaseUrl = input.url;

      if (accountId === DEFAULT_ACCOUNT_ID) {
        return {
          ...named,
          channels: {
            ...channels,
            [CHANNEL_KEY]: { ...section, enabled: true, ...extra },
          },
        } as OpenClawConfig;
      }

      const accounts = (section.accounts as Record<string, unknown>) ?? {};
      const acct = (accounts[accountId] as Record<string, unknown>) ?? {};
      return {
        ...named,
        channels: {
          ...channels,
          [CHANNEL_KEY]: {
            ...section,
            enabled: true,
            accounts: { ...accounts, [accountId]: { ...acct, enabled: true, ...extra } },
          },
        },
      } as OpenClawConfig;
    },
  },
};
