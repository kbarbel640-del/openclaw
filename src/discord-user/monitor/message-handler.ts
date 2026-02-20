import { dispatchInboundMessage } from "../../auto-reply/dispatch.js";
import { formatInboundEnvelope, resolveEnvelopeFormatOptions } from "../../auto-reply/envelope.js";
import { finalizeInboundContext } from "../../auto-reply/reply/inbound-context.js";
import { createReplyDispatcherWithTyping } from "../../auto-reply/reply/reply-dispatcher.js";
import type { ReplyPayload } from "../../auto-reply/types.js";
import { createReplyPrefixOptions } from "../../channels/reply-prefix.js";
import { recordInboundSession } from "../../channels/session.js";
import { createTypingCallbacks } from "../../channels/typing.js";
import type { OpenClawConfig } from "../../config/config.js";
import { resolveStorePath } from "../../config/sessions.js";
import { logVerbose } from "../../globals.js";
import { resolveAgentRoute } from "../../routing/resolve-route.js";
import type { RuntimeEnv } from "../../runtime.js";
import { truncateUtf16Safe } from "../../utils.js";
import type { DiscordUserRestClient } from "../rest.js";
import { sendDiscordUserMessage } from "../send.js";
import { shouldSkipCrossChannelDuplicate } from "./cross-channel-dedupe.js";

export type DiscordUserRawMessage = {
  id: string;
  channel_id: string;
  guild_id?: string;
  author: {
    id: string;
    username: string;
    discriminator?: string;
    bot?: boolean;
    global_name?: string | null;
  };
  content: string;
  timestamp: string;
  message_reference?: {
    message_id?: string;
    channel_id?: string;
    guild_id?: string;
  };
  member?: {
    nick?: string | null;
    roles?: string[];
  };
  type?: number;
};

export type DiscordUserMessageHandlerParams = {
  cfg: OpenClawConfig;
  accountId: string;
  selfUserId: string;
  rest: DiscordUserRestClient;
  runtime: RuntimeEnv;
};

export async function handleDiscordUserMessage(
  message: DiscordUserRawMessage,
  params: DiscordUserMessageHandlerParams,
): Promise<void> {
  const { cfg, accountId, selfUserId, rest, runtime } = params;

  // Drop own messages
  if (message.author.id === selfUserId) {
    return;
  }

  // Drop bot messages
  if (message.author.bot) {
    return;
  }

  // Cross-channel dedup: if bot plugin already claimed this message, skip it.
  if (shouldSkipCrossChannelDuplicate(message.id)) {
    logVerbose(`discord-user: drop message ${message.id} (cross-channel dedupe)`);
    return;
  }

  const text = message.content?.trim();
  if (!text) {
    logVerbose(`discord-user: drop message ${message.id} (empty content)`);
    return;
  }

  const isGuildMessage = Boolean(message.guild_id);
  const isDirectMessage = !isGuildMessage;
  const channelId = message.channel_id;

  // Resolve agent route
  const route = resolveAgentRoute({
    cfg,
    channel: "discord-user",
    accountId,
    peer: isDirectMessage
      ? { kind: "direct", id: message.author.id }
      : { kind: "channel", id: channelId },
    guildId: message.guild_id,
  });

  const storePath = resolveStorePath(cfg.session?.store, { agentId: route.agentId });
  const envelopeOptions = resolveEnvelopeFormatOptions(cfg);
  const senderName = message.member?.nick ?? message.author.global_name ?? message.author.username;
  const senderTag = message.author.username;
  const fromLabel = isDirectMessage ? `DM with ${senderName}` : `Discord-User #${channelId}`;

  const timestamp = message.timestamp ? Date.parse(message.timestamp) : undefined;
  const combinedBody = formatInboundEnvelope({
    channel: "Discord",
    from: fromLabel,
    timestamp: Number.isNaN(timestamp) ? undefined : timestamp,
    body: text,
    chatType: isDirectMessage ? "direct" : "channel",
    senderLabel: senderName,
    envelope: envelopeOptions,
  });

  const effectiveFrom = isDirectMessage
    ? `discord-user:${message.author.id}`
    : `discord-user:channel:${channelId}`;
  const effectiveTo = isDirectMessage ? `user:${message.author.id}` : `channel:${channelId}`;

  const replyToId = message.message_reference?.message_id;

  const ctxPayload = finalizeInboundContext({
    Body: combinedBody,
    BodyForAgent: text,
    RawBody: text,
    CommandBody: text,
    From: effectiveFrom,
    To: effectiveTo,
    SessionKey: route.sessionKey,
    AccountId: route.accountId,
    ChatType: isDirectMessage ? "direct" : "channel",
    ConversationLabel: fromLabel,
    SenderName: senderName,
    SenderId: message.author.id,
    SenderUsername: message.author.username,
    SenderTag: senderTag,
    Provider: "discord-user" as const,
    Surface: "discord" as const,
    WasMentioned: false,
    MessageSid: message.id,
    ReplyToId: replyToId,
    Timestamp: Number.isNaN(timestamp) ? undefined : timestamp,
    CommandAuthorized: false,
    CommandSource: "text" as const,
    OriginatingChannel: "discord-user" as const,
    OriginatingTo: effectiveTo,
  });
  const persistedSessionKey = ctxPayload.SessionKey ?? route.sessionKey;

  await recordInboundSession({
    storePath,
    sessionKey: persistedSessionKey,
    ctx: ctxPayload,
    updateLastRoute: {
      sessionKey: persistedSessionKey,
      channel: "discord-user",
      to: isDirectMessage ? `user:${message.author.id}` : effectiveTo,
      accountId: route.accountId,
    },
    onRecordError: (err) => {
      logVerbose(`discord-user: failed updating session meta: ${String(err)}`);
    },
  });

  logVerbose(
    `discord-user inbound: channel=${channelId} from=${ctxPayload.From} preview="${truncateUtf16Safe(text, 200).replace(/\n/g, "\\n")}"`,
  );

  const typingCallbacks = createTypingCallbacks({
    start: () => rest.post(`/channels/${channelId}/typing`).then(() => undefined),
    onStartError: (err) => {
      logVerbose(`discord-user: typing failed for ${channelId}: ${String(err)}`);
    },
  });

  const { onModelSelected, ...prefixOptions } = createReplyPrefixOptions({
    cfg,
    agentId: route.agentId,
    channel: "discord-user",
    accountId: route.accountId,
  });

  const { dispatcher, replyOptions, markDispatchIdle } = createReplyDispatcherWithTyping({
    ...prefixOptions,
    deliver: async (payload: ReplyPayload) => {
      if (payload.text) {
        await sendDiscordUserMessage(effectiveTo, payload.text, {
          rest,
          replyTo: replyToId,
        });
      }
    },
    onError: (err, info) => {
      runtime.error(`discord-user ${info.kind} reply failed: ${String(err)}`);
    },
    onReplyStart: async () => {
      await typingCallbacks.onReplyStart();
    },
  });

  try {
    await dispatchInboundMessage({
      ctx: ctxPayload,
      cfg,
      dispatcher,
      replyOptions: {
        ...replyOptions,
        onModelSelected,
      },
    });
  } catch (err) {
    runtime.error(`discord-user dispatch failed: ${String(err)}`);
  } finally {
    markDispatchIdle();
  }
}
