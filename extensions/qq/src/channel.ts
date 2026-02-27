import type {
  ChannelPlugin,
  OpenClawConfig,
} from "openclaw/plugin-sdk";
import {
  DEFAULT_ACCOUNT_ID,
  buildChannelConfigSchema,
} from "openclaw/plugin-sdk";
import type { QQBotConfig, QQInboundMessage } from "./types.js";
import { sendQQText, buildQQSessionKey, buildQQFrom, stripQQMention } from "./dispatch.js";
import { monitorQQProvider } from "./monitor.js";
import { probeQQBot } from "./api.js";
import { getQQRuntime } from "./runtime.js";
import { QQConfigSchema } from "./config-schema.js";

// ── helpers ──────────────────────────────────────────────────────────────────

function listQQAccountIds(cfg: OpenClawConfig): string[] {
  const qq = (cfg as Record<string, unknown>).channels as Record<string, unknown> | undefined;
  const section = qq?.qq as Record<string, unknown> | undefined;
  if (!section) return [];
  const accounts = section.accounts as Record<string, unknown> | undefined;
  const ids = accounts ? Object.keys(accounts) : [];
  // Always include default if top-level config exists
  if (!ids.includes(DEFAULT_ACCOUNT_ID)) {
    ids.unshift(DEFAULT_ACCOUNT_ID);
  }
  return ids;
}

function resolveQQAccount(cfg: OpenClawConfig, accountId: string): QQBotConfig & { accountId: string } {
  const channels = (cfg as Record<string, unknown>).channels as Record<string, unknown> | undefined;
  const section = channels?.qq as Record<string, unknown> | undefined;
  if (!section) {
    return { accountId, appId: "", clientSecret: "" };
  }
  const accounts = section.accounts as Record<string, Record<string, unknown>> | undefined;
  const accountCfg: Record<string, unknown> =
    accountId !== DEFAULT_ACCOUNT_ID && accounts?.[accountId]
      ? { ...section, ...accounts[accountId] }
      : section;

  return {
    accountId,
    appId: String(accountCfg.appId ?? accountCfg.app_id ?? ""),
    clientSecret: String(accountCfg.clientSecret ?? accountCfg.client_secret ?? ""),
    webhookPath: accountCfg.webhookPath as string | undefined,
    webhookPort: accountCfg.webhookPort as number | undefined,
    allowFrom: accountCfg.allowFrom as string[] | undefined,
    dmPolicy: accountCfg.dmPolicy as QQBotConfig["dmPolicy"] | undefined,
    name: accountCfg.name as string | undefined,
    enabled: accountCfg.enabled as boolean | undefined,
  };
}

// ── channel plugin ────────────────────────────────────────────────────────────

export const qqPlugin: ChannelPlugin = {
  id: "qq",
  meta: {
    id: "qq",
    label: "QQ",
    selectionLabel: "QQ (Bot API v2)",
    detailLabel: "QQ Bot",
    docsPath: "/channels/qq",
    docsLabel: "qq",
    blurb: "QQ official bot API v2 with webhook support.",
    systemImage: "message",
  },
  capabilities: {
    chatTypes: ["direct", "group"],
    reactions: false,
    threads: false,
    media: false,
    polls: false,
    nativeCommands: false,
    blockStreaming: false,
  },
  reload: { configPrefixes: ["channels.qq"] },
  configSchema: buildChannelConfigSchema(QQConfigSchema),
  config: {
    listAccountIds: (cfg) => listQQAccountIds(cfg),
    resolveAccount: (cfg, accountId) => resolveQQAccount(cfg, accountId),
    defaultAccountId: (cfg) => {
      const ids = listQQAccountIds(cfg);
      return ids[0] ?? DEFAULT_ACCOUNT_ID;
    },
    isConfigured: (account) => {
      const a = account as QQBotConfig;
      return Boolean(a.appId?.trim()) && Boolean(a.clientSecret?.trim());
    },
    unconfiguredReason: (account) => {
      const a = account as QQBotConfig;
      if (!a.appId?.trim()) return "channels.qq.appId is required";
      if (!a.clientSecret?.trim()) return "channels.qq.clientSecret is required";
      return "not configured";
    },
    describeAccount: (account) => {
      const a = account as QQBotConfig & { accountId: string };
      return {
        accountId: a.accountId,
        name: a.name,
        enabled: a.enabled,
        configured: Boolean(a.appId?.trim()) && Boolean(a.clientSecret?.trim()),
      };
    },
    resolveAllowFrom: ({ cfg, accountId }) => {
      const account = resolveQQAccount(cfg, accountId);
      return (account.allowFrom ?? []).map(String);
    },
    formatAllowFrom: ({ allowFrom }) =>
      allowFrom.map((e) => String(e).trim()).filter(Boolean),
  },
  security: {
    resolveDmPolicy: ({ account }) => {
      const a = account as QQBotConfig;
      return {
        policy: a.dmPolicy ?? "open",
        allowFrom: a.allowFrom ?? [],
        policyPath: "channels.qq.dmPolicy",
        allowFromPath: "channels.qq.",
        approveHint: "Add the user openid to channels.qq.allowFrom",
        normalizeEntry: (raw: string) => raw,
      };
    },
    collectWarnings: () => [],
  },
  messaging: {
    normalizeTarget: (target) => ({ target: String(target).trim() }),
    targetResolver: {
      looksLikeId: (raw) => /^[a-zA-Z0-9_-]{10,}$/.test(raw),
      hint: "<openid or group_openid>",
    },
  },
  outbound: {
    deliveryMode: "direct",
    chunker: (text, limit) => {
      const chunks: string[] = [];
      let current = "";
      for (const line of text.split("\n")) {
        // If a single line exceeds limit, split it by character
        if (line.length > limit) {
          if (current) { chunks.push(current); current = ""; }
          for (let i = 0; i < line.length; i += limit) {
            chunks.push(line.slice(i, i + limit));
          }
          continue;
        }
        if (current.length + line.length + 1 > limit && current) {
          chunks.push(current);
          current = line;
        } else {
          current = current ? `${current}\n${line}` : line;
        }
      }
      if (current) chunks.push(current);
      return chunks;
    },
    chunkerMode: "plain",
    textChunkLimit: 4000,
    sendText: async ({ to, text, accountId, replyToId }) => {
      const runtime = getQQRuntime();
      const cfg = runtime.config.loadConfig();
      const account = resolveQQAccount(cfg, accountId ?? DEFAULT_ACCOUNT_ID);
      // Determine chat type from target format: "group:<openid>" or plain openid for c2c
      const chatType = to.startsWith("group:") ? "group" : "c2c";
      const openid = to.startsWith("group:") ? to.slice(6) : to;
      const result = await sendQQText({
        config: account,
        to: openid,
        chatType,
        text,
        replyToMsgId: replyToId ?? undefined,
      });
      return { channel: "qq", id: result.id };
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
    buildChannelSummary: ({ snapshot }) => {
      if (!snapshot) return "QQ: not configured";
      if (snapshot.running) return `QQ: running (${snapshot.accountId})`;
      if (snapshot.lastError) return `QQ: error — ${snapshot.lastError}`;
      return "QQ: stopped";
    },
    probeAccount: async ({ account, timeoutMs }) => {
      const a = account as QQBotConfig;
      return probeQQBot({ appId: a.appId, clientSecret: a.clientSecret, timeoutMs });
    },
    buildAccountSnapshot: ({ account, runtime }) => {
      const a = account as QQBotConfig & { accountId: string };
      return {
        accountId: a.accountId,
        name: a.name,
        enabled: a.enabled,
        configured: Boolean(a.appId?.trim()) && Boolean(a.clientSecret?.trim()),
        running: runtime?.running ?? false,
        lastStartAt: runtime?.lastStartAt ?? null,
        lastStopAt: runtime?.lastStopAt ?? null,
        lastError: runtime?.lastError ?? null,
      };
    },
  },
  gateway: {
    startAccount: async (ctx) => {
      const account = ctx.account as QQBotConfig & { accountId: string };
      ctx.log?.info?.(`[${account.accountId}] starting QQ webhook provider`);

      const onMessage = async (msg: QQInboundMessage) => {
        await handleInboundQQMessage({
          msg,
          account,
          cfg: ctx.cfg,
          log: ctx.log,
        });
      };

      return monitorQQProvider({
        config: account,
        accountId: account.accountId,
        onMessage,
        abortSignal: ctx.abortSignal,
        log: ctx.log,
      });
    },
  },
};

// ── inbound message handler ───────────────────────────────────────────────────

async function handleInboundQQMessage(params: {
  msg: QQInboundMessage;
  account: QQBotConfig & { accountId: string };
  cfg: OpenClawConfig;
  log?: { info?: (s: string) => void; error?: (s: string) => void };
}): Promise<void> {
  const { msg, account, cfg, log } = params;

  const content = stripQQMention(msg.content);
  if (!content) return;

  const from = buildQQFrom(msg);
  const sessionKey = buildQQSessionKey({
    accountId: account.accountId,
    chatType: msg.chatType,
    openid: msg.openid,
  });

  log?.info?.(`[${account.accountId}] inbound ${msg.chatType} from ${msg.senderOpenid}: ${content.slice(0, 80)}`);

  try {
    const runtime = getQQRuntime();

    // Build MsgContext (same pattern as Telegram/Discord channel plugins)
    const ctx = {
      Body: content,
      CommandBody: content,
      BodyForCommands: content,
      From: from,
      To: msg.chatType === "group" ? `group:${msg.openid}` : msg.senderOpenid,
      SessionKey: sessionKey,
      MessageSid: msg.msgId,
      AccountId: account.accountId,
      // Surface/Provider are used by dispatchReplyFromConfig to resolve the channel
      Surface: "qq",
      Provider: "qq",
      Channel: "qq" as const,
      ChatType: msg.chatType === "group" ? ("group" as const) : ("direct" as const),
    };

    // Build a reply dispatcher that sends back to QQ.
    // dispatcherOptions must have a `deliver(payload, info)` function —
    // payload.text contains the reply text.
    const dispatcherOptions = {
      deliver: async (payload: { text?: string }, _info: unknown) => {
        const text = payload?.text;
        if (!text) return;
        await sendQQText({
          config: account,
          to: msg.chatType === "group" ? msg.openid : msg.senderOpenid,
          chatType: msg.chatType,
          text,
          replyToMsgId: msg.msgId,
        });
      },
    };

    await runtime.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
      ctx,
      cfg,
      dispatcherOptions,
    });
  } catch (err) {
    log?.error?.(`[${account.accountId}] dispatch error: ${String(err)}`);
  }
}
