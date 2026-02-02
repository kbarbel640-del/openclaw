/**
 * Lark/Feishu 配置类型定义
 */

export interface LarkAccountConfig {
  /** 应用 ID */
  appId: string;
  /** 应用密钥 */
  appSecret: string;
  /** 加密密钥（用于事件订阅） */
  encryptKey?: string;
  /** 验证 Token */
  verificationToken?: string;
  /** 是否启用 */
  enabled?: boolean;
  /** 账号名称 */
  name?: string;
  /** 用户白名单 */
  allowFrom?: string[];
  /** 群组白名单 */
  groupAllowFrom?: string[];
  /** 私聊策略: pairing(配对) | open(开放) | allowlist(白名单) */
  dmPolicy?: "pairing" | "open" | "allowlist";
  /** 群组策略 */
  groupPolicy?: "open" | "allowlist";
  /** Webhook 路径 */
  webhookPath?: string;
  /** 群组配置 */
  groups?: Record<string, { requireMention?: boolean }>;
}

export interface LarkConfig {
  /** 默认账号配置 */
  appId?: string;
  appSecret?: string;
  encryptKey?: string;
  verificationToken?: string;
  enabled?: boolean;
  name?: string;
  allowFrom?: string[];
  groupAllowFrom?: string[];
  dmPolicy?: "pairing" | "open" | "allowlist";
  groupPolicy?: "open" | "allowlist";
  webhookPath?: string;
  groups?: Record<string, { requireMention?: boolean }>;
  /** 多账号配置 */
  accounts?: Record<string, LarkAccountConfig>;
}

export interface ResolvedLarkAccount {
  accountId: string;
  name: string | null;
  enabled: boolean;
  appId: string;
  appSecret: string;
  encryptKey: string | null;
  verificationToken: string | null;
  tokenSource: "env" | "config" | "none";
  config: LarkAccountConfig;
}

/** 飞书消息类型 */
export type LarkMessageType =
  | "text"
  | "image"
  | "file"
  | "audio"
  | "video"
  | "sticker"
  | "location"
  | "card"
  | "post";

/** 飞书用户 */
export interface LarkUser {
  userId: string;
  openId: string;
  unionId?: string;
  name?: string;
  email?: string;
}

/** 飞书群组 */
export interface LarkChat {
  chatId: string;
  chatType: "p2p" | "group";
  name?: string;
}

/** 飞书消息事件 */
export interface LarkMessageEvent {
  sender: {
    senderId: { openId: string; userId?: string };
    senderType: "user";
  };
  message: {
    messageId: string;
    rootId?: string;
    parentId?: string;
    createTime: string;
    chatId: string;
    chatType: "p2p" | "group";
    messageType: LarkMessageType;
    content: string;
    mentions?: Array<{
      key: string;
      id: { openId: string };
      name: string;
      tenantKey: string;
    }>;
  };
}

/** 飞书事件包装 */
export interface LarkEventWrapper {
  uuid: string;
  event: LarkMessageEvent;
}

/** 飞书 API 响应 */
export interface LarkApiResponse<T = unknown> {
  code: number;
  msg: string;
  data?: T;
}

/** 飞书 Access Token 响应 */
export interface LarkTenantAccessToken {
  tenant_access_token: string;
  expire: number;
}

/** 飞书发送消息请求 */
export interface LarkSendMessageRequest {
  receive_id: string;
  msg_type: LarkMessageType;
  content: string;
  uuid?: string;
}

/** 飞书频道数据 */
export interface LarkChannelData {
  card?: Record<string, unknown>;
  quickReplies?: string[];
}
