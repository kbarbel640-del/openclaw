// QQ Bot API v2 types

export type QQBotConfig = {
  appId: string;
  clientSecret: string;
  /** Webhook path, default: /qq/webhook */
  webhookPath?: string;
  /** Webhook port, default: 8443 */
  webhookPort?: number;
  /** Allow-from list (openid or group_openid) */
  allowFrom?: string[];
  /** DM policy */
  dmPolicy?: "open" | "pairing" | "allowlist";
  /** Account display name */
  name?: string;
  /** Whether this account is enabled */
  enabled?: boolean;
};

export type QQAccessToken = {
  access_token: string;
  expires_in: number;
};

// Inbound event payload
export type QQPayload = {
  id?: string;
  op: number;
  d?: unknown;
  s?: number;
  t?: string;
};

// C2C (single chat) message event
export type QQC2CMessageEvent = {
  id: string;
  content: string;
  timestamp: string;
  author: {
    id: string;       // user openid
    user_openid: string;
  };
  attachments?: QQAttachment[];
  msg_id?: string;
};

// Group message event
export type QQGroupMessageEvent = {
  id: string;
  content: string;
  timestamp: string;
  group_openid: string;
  author: {
    id: string;
    member_openid: string;
  };
  attachments?: QQAttachment[];
  msg_id?: string;
};

export type QQAttachment = {
  content_type: string;
  filename: string;
  height?: number;
  width?: number;
  size?: number;
  url: string;
};

// Send message request
export type QQSendMessageParams = {
  content?: string;
  msg_type: 0 | 2 | 7; // 0=text, 2=markdown, 7=media
  msg_id?: string;      // for passive reply
  msg_seq?: number;
  event_id?: string;
};

export type QQSendResult = {
  id: string;
  timestamp: number;
};

// Webhook validation payload (op=13)
export type QQValidationPayload = {
  plain_token: string;
  event_ts: string;
};

export type QQValidationResponse = {
  plain_token: string;
  signature: string;
};

// Chat type discriminator
export type QQChatType = "c2c" | "group";

export type QQInboundMessage = {
  chatType: QQChatType;
  openid: string;        // user openid (c2c) or group_openid (group)
  senderOpenid: string;  // user openid
  content: string;
  msgId: string;
  eventId?: string;
  timestamp: string;
  attachments?: QQAttachment[];
};
