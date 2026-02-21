/**
 * Synology Chat Channel Plugin for OpenClaw.
 *
 * Implements the ChannelPlugin interface following the LINE pattern.
 */

import {
  DEFAULT_ACCOUNT_ID,
  setAccountEnabledInConfigSection,
  registerPluginHttpRoute,
  buildChannelConfigSchema,
} from "openclaw/plugin-sdk";
import { z } from "zod";
import { listAccountIds, resolveAccount } from "./accounts.js";
import { sendMessage, sendFileUrl } from "./client.js";
import { getSynologyRuntime } from "./runtime.js";
import type { ResolvedSynologyChatAccount } from "./types.js";
import { createWebhookHandler } from "./webhook-handler.js";

const CHANNEL_ID = "synology-chat";
const SynologyChatConfigSchema = buildChannelConfigSchema(z.object({}).passthrough());

export function createSynologyChatPlugin() {
  return {
    id: CHANNEL_ID,

    meta: {
      id: CHANNEL_ID,
      label: "Synology Chat",
      selectionLabel: "Synology Chat (Webhook)",
      detailLabel: "Synology Chat (Webhook)",
      docsPath: "synology-chat",
      blurb: "Connect your Synology NAS Chat to OpenClaw",
      order: 90,
    },

    capabilities: {
      chatTypes: ["direct" as const],
      media: false,
      threads: false,
      reactions: false,
      edit: false,
      unsend: false,
      reply: false,
      effects: false,
      blockStreaming: false,
    },

    reload: { configPrefixes: [`channels.${CHANNEL_ID}`] },

    configSchema: SynologyChatConfigSchema,

    config: {
      listAccountIds: (cfg: any) => listAccountIds(cfg),

      resolveAccount: (cfg: any, accountId?: string | null) => resolveAccount(cfg, accountId),

      defaultAccountId: (_cfg: any) => DEFAULT_ACCOUNT_ID,

      setAccountEnabled: ({ cfg, accountId, enabled }: any) => {
        const channelConfig = cfg?.channels?.[CHANNEL_ID] ?? {};
        if (accountId === DEFAULT_ACCOUNT_ID) {
          return {
            ...cfg,
            channels: {
              ...cfg.channels,
              [CHANNEL_ID]: { ...channelConfig, enabled },
            },
          };
        }
        return setAccountEnabledInConfigSection({
          cfg,
          sectionKey: `channels.${CHANNEL_ID}`,
          accountId,
          enabled,
        });
      },
    },

    security: {
      resolveDmPolicy: ({
        cfg,
        accountId,
        account,
      }: {
        cfg: any;
        accountId?: string | null;
        account: ResolvedSynologyChatAccount;
      }) => {
        const resolvedAccountId = accountId ?? account.accountId ?? DEFAULT_ACCOUNT_ID;
        const channelCfg = (cfg as any).channels?.["synology-chat"];
        const useAccountPath = Boolean(channelCfg?.accounts?.[resolvedAccountId]);
        const basePath = useAccountPath
          ? `channels.synology-chat.accounts.${resolvedAccountId}.`
          : "channels.synology-chat.";
        return {
          policy: account.dmPolicy ?? "allowlist",
          allowFrom: account.allowedUserIds ?? [],
          policyPath: `${basePath}dmPolicy`,
          allowFromPath: basePath,
          approveHint: "openclaw pairing approve synology-chat <code>",
          normalizeEntry: (raw: string) => raw.toLowerCase().trim(),
        };
      },
    },

    outbound: {
      deliveryMode: "gateway" as const,
      textChunkLimit: 2000,

      sendText: async ({ to, text, accountId, account: ctxAccount }: any) => {
        const account: ResolvedSynologyChatAccount = ctxAccount ?? resolveAccount({}, accountId);

        if (!account.incomingUrl) {
          throw new Error("Synology Chat incoming URL not configured");
        }

        const ok = await sendMessage(account.incomingUrl, text, to, account.allowInsecureSsl);
        if (!ok) {
          throw new Error("Failed to send message to Synology Chat");
        }
        return { channel: CHANNEL_ID, messageId: `sc-${Date.now()}`, chatId: to };
      },

      sendMedia: async ({ to, mediaUrl, accountId, account: ctxAccount }: any) => {
        const account: ResolvedSynologyChatAccount = ctxAccount ?? resolveAccount({}, accountId);

        if (!account.incomingUrl) {
          throw new Error("Synology Chat incoming URL not configured");
        }
        if (!mediaUrl) {
          throw new Error("No media URL provided");
        }

        const ok = await sendFileUrl(account.incomingUrl, mediaUrl, to, account.allowInsecureSsl);
        if (!ok) {
          throw new Error("Failed to send media to Synology Chat");
        }
        return { channel: CHANNEL_ID, messageId: `sc-${Date.now()}`, chatId: to };
      },
    },

    gateway: {
      startAccount: async (ctx: any) => {
        const { cfg, accountId, log } = ctx;
        const account = resolveAccount(cfg, accountId);

        if (!account.enabled) {
          log?.info?.(`Synology Chat account ${accountId} is disabled, skipping`);
          return { stop: () => {} };
        }

        if (!account.token || !account.incomingUrl) {
          log?.warn?.(
            `Synology Chat account ${accountId} not fully configured (missing token or incomingUrl)`,
          );
          return { stop: () => {} };
        }

        log?.info?.(
          `Starting Synology Chat channel (account: ${accountId}, path: ${account.webhookPath})`,
        );

        const handler = createWebhookHandler({
          account,
          deliver: async (msg) => {
            const rt = getSynologyRuntime();
            const currentCfg = await rt.config.loadConfig();

            // Build MsgContext (same format as LINE/Signal/etc.)
            const msgCtx = {
              Body: msg.body,
              From: msg.from,
              To: account.botName,
              SessionKey: msg.sessionKey,
              AccountId: account.accountId,
              OriginatingChannel: CHANNEL_ID as any,
              OriginatingTo: msg.from,
              ChatType: msg.chatType,
              SenderName: msg.senderName,
            };

            // Dispatch via the SDK's buffered block dispatcher
            const result = await rt.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
              ctx: msgCtx,
              cfg: currentCfg,
              dispatcherOptions: {
                deliver: async (payload: { text?: string; body?: string }) => {
                  const text = payload?.text ?? payload?.body;
                  if (text) {
                    await sendMessage(
                      account.incomingUrl,
                      text,
                      msg.from,
                      account.allowInsecureSsl,
                    );
                  }
                },
                onReplyStart: () => {
                  log?.info?.(`Agent reply started for ${msg.from}`);
                },
              },
            });

            return null;
          },
          log,
        });

        // Register HTTP route via the SDK
        const unregister = registerPluginHttpRoute({
          path: account.webhookPath,
          pluginId: CHANNEL_ID,
          accountId: account.accountId,
          log: (msg: string) => log?.info?.(msg),
          handler,
        });

        log?.info?.(`Registered HTTP route: ${account.webhookPath} for Synology Chat`);

        return {
          stop: () => {
            log?.info?.(`Stopping Synology Chat channel (account: ${accountId})`);
            if (typeof unregister === "function") unregister();
          },
        };
      },

      stopAccount: async (ctx: any) => {
        ctx.log?.info?.(`Synology Chat account ${ctx.accountId} stopped`);
      },
    },
  };
}
