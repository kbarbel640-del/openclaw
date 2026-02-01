/**
 * Messenger channel plugin.
 *
 * Integrates Facebook Messenger with OpenClaw gateway.
 */

import {
  applyAccountNameToChannelSection,
  chunkMessengerText,
  DEFAULT_ACCOUNT_ID,
  deleteAccountFromConfigSection,
  formatMessengerTarget,
  formatPairingApproveHint,
  getChatChannelMeta,
  listMessengerAccountIds,
  looksLikeMessengerTarget,
  normalizeAccountId,
  normalizeMessengerTarget,
  PAIRING_APPROVED_MESSAGE,
  probeMessenger,
  resolveDefaultMessengerAccountId,
  resolveMessengerAccount,
  sendMessageMessenger,
  setAccountEnabledInConfigSection,
  startMessengerAccount,
  stopMessengerAccount,
  type ChannelMessageActionAdapter,
  type ChannelPlugin,
  type ResolvedMessengerAccount,
} from "openclaw/plugin-sdk";

const meta = getChatChannelMeta("messenger");

const messengerMessageActions: ChannelMessageActionAdapter = {
  listActions: ({ cfg }) => {
    const accounts = listMessengerAccountIds(cfg)
      .map((id) => resolveMessengerAccount({ cfg, accountId: id }))
      .filter((a) => a.enabled && a.tokenSource !== "none");
    if (accounts.length === 0) {
      return [];
    }
    return ["send"];
  },
  supportsButtons: ({ cfg }) => {
    const accounts = listMessengerAccountIds(cfg)
      .map((id) => resolveMessengerAccount({ cfg, accountId: id }))
      .filter((a) => a.enabled && a.tokenSource !== "none");
    return accounts.length > 0;
  },
  extractToolSend: ({ args }) => {
    const action = typeof args.action === "string" ? args.action.trim() : "";
    if (action !== "sendMessage") {
      return null;
    }
    const to = typeof args.to === "string" ? args.to : undefined;
    if (!to) {
      return null;
    }
    const accountId = typeof args.accountId === "string" ? args.accountId.trim() : undefined;
    return { to, accountId };
  },
  handleAction: async ({ action, params, accountId }) => {
    if (action === "send") {
      const to = typeof params.to === "string" ? params.to.trim() : "";
      const message = typeof params.message === "string" ? params.message : "";
      const mediaUrl = typeof params.media === "string" ? params.media.trim() : undefined;
      const result = await sendMessageMessenger(to, message || "", {
        mediaUrl,
        accountId: accountId ?? undefined,
        verbose: false,
      });
      return {
        type: "tool_result",
        content: JSON.stringify({
          ok: true,
          messageId: result.messageId,
          recipientId: result.recipientId,
        }),
      };
    }
    throw new Error(`Action ${action} is not supported for provider messenger.`);
  },
};

export const messengerPlugin: ChannelPlugin<ResolvedMessengerAccount> = {
  id: "messenger",
  meta: {
    ...meta,
  },
  pairing: {
    idLabel: "PSID",
    normalizeAllowEntry: (entry) => {
      const normalized = normalizeMessengerTarget(entry);
      return normalized ?? entry.replace(/^messenger:/i, "").trim();
    },
    notifyApproval: async ({ id }) => {
      await sendMessageMessenger(id, PAIRING_APPROVED_MESSAGE, { verbose: false });
    },
  },
  capabilities: {
    chatTypes: ["direct"],
    media: true,
  },
  reload: { configPrefixes: ["channels.messenger"] },
  config: {
    listAccountIds: (cfg) => listMessengerAccountIds(cfg),
    resolveAccount: (cfg, accountId) => resolveMessengerAccount({ cfg, accountId }),
    defaultAccountId: (cfg) => resolveDefaultMessengerAccountId(cfg),
    setAccountEnabled: ({ cfg, accountId, enabled }) =>
      setAccountEnabledInConfigSection({
        cfg,
        sectionKey: "messenger",
        accountId,
        enabled,
        allowTopLevel: true,
      }),
    deleteAccount: ({ cfg, accountId }) =>
      deleteAccountFromConfigSection({
        cfg,
        sectionKey: "messenger",
        accountId,
        clearBaseFields: ["pageAccessToken", "tokenFile", "name", "appSecret", "verifyToken"],
      }),
    isConfigured: (account) => Boolean(account.pageAccessToken?.trim()),
    describeAccount: (account) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: Boolean(account.pageAccessToken?.trim()),
      tokenSource: account.tokenSource,
      pageId: account.pageId,
    }),
    resolveAllowFrom: ({ cfg, accountId }) =>
      (resolveMessengerAccount({ cfg, accountId }).config.allowFrom ?? []).map((entry) =>
        String(entry),
      ),
    formatAllowFrom: ({ allowFrom }) =>
      allowFrom
        .map((entry) => String(entry).trim())
        .filter(Boolean)
        .map((entry) => normalizeMessengerTarget(entry) ?? entry.replace(/^messenger:/i, ""))
        .map((entry) => entry.toLowerCase()),
  },
  security: {
    resolveDmPolicy: ({ cfg, accountId, account }) => {
      const resolvedAccountId = accountId ?? account.accountId ?? DEFAULT_ACCOUNT_ID;
      const useAccountPath = Boolean(cfg.channels?.messenger?.accounts?.[resolvedAccountId]);
      const basePath = useAccountPath
        ? `channels.messenger.accounts.${resolvedAccountId}.`
        : "channels.messenger.";
      return {
        policy: account.config.dmPolicy ?? "pairing",
        allowFrom: account.config.allowFrom ?? [],
        policyPath: `${basePath}dmPolicy`,
        allowFromPath: basePath,
        approveHint: formatPairingApproveHint("messenger"),
        normalizeEntry: (raw) => normalizeMessengerTarget(raw) ?? raw.replace(/^messenger:/i, ""),
      };
    },
    collectWarnings: ({ account }) => {
      const warnings: string[] = [];
      const dmPolicy = account.config.dmPolicy ?? "pairing";
      if (dmPolicy === "open") {
        warnings.push(
          `Messenger DM policy is "open" - anyone can message. Consider using "pairing" or "allowlist" for production.`,
        );
      }
      if (!account.appSecret) {
        warnings.push(
          `Messenger appSecret is not configured. Webhook signature verification is disabled.`,
        );
      }
      if (!account.verifyToken) {
        warnings.push(
          `Messenger verifyToken is not configured. Webhook subscription verification may fail.`,
        );
      }
      if (account.tokenSource === "env") {
        warnings.push(
          `Messenger pageAccessToken is loaded from environment variable. Consider using config file for better security.`,
        );
      }
      return warnings;
    },
  },
  messaging: {
    normalizeTarget: (target) => {
      const normalized = normalizeMessengerTarget(target);
      return normalized ? formatMessengerTarget(normalized) : null;
    },
    targetResolver: {
      looksLikeId: looksLikeMessengerTarget,
      hint: "<psid>",
    },
  },
  actions: messengerMessageActions,
  setup: {
    resolveAccountId: ({ accountId }) => normalizeAccountId(accountId),
    applyAccountName: ({ cfg, accountId, name }) =>
      applyAccountNameToChannelSection({
        cfg,
        channelKey: "messenger",
        accountId,
        name,
      }),
    validateInput: ({ accountId, input }) => {
      if (input.useEnv && accountId !== DEFAULT_ACCOUNT_ID) {
        return "MESSENGER_PAGE_ACCESS_TOKEN can only be used for the default account.";
      }
      if (!input.useEnv && !input.token && !input.tokenFile) {
        return "Messenger requires pageAccessToken or --token-file (or --use-env).";
      }
      return null;
    },
    applyAccountConfig: ({ cfg, accountId, input }) => {
      const namedConfig = applyAccountNameToChannelSection({
        cfg,
        channelKey: "messenger",
        accountId,
        name: input.name,
      });
      if (accountId === DEFAULT_ACCOUNT_ID) {
        return {
          ...namedConfig,
          channels: {
            ...namedConfig.channels,
            messenger: {
              ...namedConfig.channels?.messenger,
              enabled: true,
              ...(input.useEnv
                ? {}
                : input.tokenFile
                  ? { tokenFile: input.tokenFile }
                  : input.token
                    ? { pageAccessToken: input.token }
                    : {}),
            },
          },
        };
      }
      return {
        ...namedConfig,
        channels: {
          ...namedConfig.channels,
          messenger: {
            ...namedConfig.channels?.messenger,
            enabled: true,
            accounts: {
              ...namedConfig.channels?.messenger?.accounts,
              [accountId]: {
                ...namedConfig.channels?.messenger?.accounts?.[accountId],
                enabled: true,
                ...(input.tokenFile
                  ? { tokenFile: input.tokenFile }
                  : input.token
                    ? { pageAccessToken: input.token }
                    : {}),
              },
            },
          },
        },
      };
    },
  },
  outbound: {
    deliveryMode: "direct",
    chunker: chunkMessengerText,
    chunkerMode: "text",
    textChunkLimit: 2000,
    sendText: async ({ to, text, accountId }) => {
      const result = await sendMessageMessenger(to, text, {
        accountId: accountId ?? undefined,
        verbose: false,
      });
      return {
        channel: "messenger",
        messageId: result.messageId,
        recipientId: result.recipientId,
      };
    },
    sendMedia: async ({ to, text, mediaUrl, accountId }) => {
      const result = await sendMessageMessenger(to, text, {
        mediaUrl,
        accountId: accountId ?? undefined,
        verbose: false,
      });
      return {
        channel: "messenger",
        messageId: result.messageId,
        recipientId: result.recipientId,
      };
    },
  },
  status: {
    defaultRuntime: {
      accountId: DEFAULT_ACCOUNT_ID,
      running: false,
      lastStartAt: null,
      lastStopAt: null,
      lastError: null,
    },
    buildChannelSummary: ({ snapshot }) => ({
      configured: snapshot.configured ?? false,
      tokenSource: snapshot.tokenSource ?? "none",
      running: snapshot.running ?? false,
      lastStartAt: snapshot.lastStartAt ?? null,
      lastStopAt: snapshot.lastStopAt ?? null,
      lastError: snapshot.lastError ?? null,
      probe: snapshot.probe,
      lastProbeAt: snapshot.lastProbeAt ?? null,
    }),
    probeAccount: async ({ account, timeoutMs }) =>
      probeMessenger(account.pageAccessToken, timeoutMs),
    buildAccountSnapshot: ({ account, runtime, probe }) => {
      const configured = Boolean(account.pageAccessToken?.trim());
      const probeResult = probe as { ok?: boolean; page?: { id?: string; name?: string } };
      return {
        accountId: account.accountId,
        name: account.name,
        enabled: account.enabled,
        configured,
        tokenSource: account.tokenSource,
        pageId: probeResult?.ok ? probeResult.page?.id : account.pageId,
        pageName: probeResult?.ok ? probeResult.page?.name : undefined,
        running: runtime?.running ?? false,
        lastStartAt: runtime?.lastStartAt ?? null,
        lastStopAt: runtime?.lastStopAt ?? null,
        lastError: runtime?.lastError ?? null,
        probe,
        lastInboundAt: runtime?.lastInboundAt ?? null,
        lastOutboundAt: runtime?.lastOutboundAt ?? null,
      };
    },
  },
  gateway: {
    startAccount: async (ctx) => startMessengerAccount(ctx),
    stopAccount: async (ctx) => stopMessengerAccount(ctx),
  },
};
