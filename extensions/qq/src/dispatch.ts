import type { QQBotConfig, QQInboundMessage } from "./types.js";
import { sendQQC2CMessage, sendQQGroupMessage } from "./api.js";

// Seq counter per msgId to avoid duplicate passive replies
const seqMap = new Map<string, number>();

function nextSeq(msgId: string): number {
  const seq = (seqMap.get(msgId) ?? 0) + 1;
  seqMap.set(msgId, seq);
  // Cleanup old entries
  if (seqMap.size > 500) {
    const first = seqMap.keys().next().value;
    if (first) seqMap.delete(first);
  }
  return seq;
}

export type QQSendTextParams = {
  config: QQBotConfig;
  to: string;
  chatType: "c2c" | "group";
  text: string;
  replyToMsgId?: string;
  signal?: AbortSignal;
};

/**
 * Send a text message to QQ (C2C or group).
 * Uses passive reply (msg_id) when replyToMsgId is provided.
 */
export async function sendQQText(params: QQSendTextParams): Promise<{ id: string }> {
  const { config, to, chatType, text, replyToMsgId, signal } = params;
  const msgSeq = replyToMsgId ? nextSeq(replyToMsgId) : undefined;

  if (chatType === "c2c") {
    const result = await sendQQC2CMessage({
      appId: config.appId,
      clientSecret: config.clientSecret,
      openid: to,
      msg: {
        content: text,
        msg_type: 0,
        msg_id: replyToMsgId,
        msg_seq: msgSeq,
      },
      signal,
    });
    return { id: result.id };
  }

  const result = await sendQQGroupMessage({
    appId: config.appId,
    clientSecret: config.clientSecret,
    groupOpenid: to,
    msg: {
      content: text,
      msg_type: 0,
      msg_id: replyToMsgId,
      msg_seq: msgSeq,
    },
    signal,
  });
  return { id: result.id };
}

/**
 * Build the session key for a QQ conversation.
 * Format: qq:<accountId>:<chatType>:<openid>
 */
export function buildQQSessionKey(params: {
  accountId: string;
  chatType: "c2c" | "group";
  openid: string;
}): string {
  return `qq:${params.accountId}:${params.chatType}:${params.openid}`;
}

/**
 * Build the From field for a QQ message context.
 */
export function buildQQFrom(msg: QQInboundMessage): string {
  if (msg.chatType === "c2c") {
    return `qq:${msg.senderOpenid}`;
  }
  // group: use group_openid as the "from" channel, sender as sub-id
  return `qq-group:${msg.openid}:${msg.senderOpenid}`;
}

/**
 * Strip @bot mention from group messages.
 * QQ group messages to bot start with <@!botId> or similar.
 */
export function stripQQMention(content: string): string {
  return content.replace(/^<@!?\w+>\s*/, "").trim();
}
