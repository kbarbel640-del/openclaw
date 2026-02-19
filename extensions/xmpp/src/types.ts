import type {
  BaseProbeResult,
  BlockStreamingCoalesceConfig,
  DmConfig,
  DmPolicy,
  GroupPolicy,
  GroupToolPolicyBySenderConfig,
  GroupToolPolicyConfig,
  MarkdownConfig,
  OpenClawConfig,
} from "openclaw/plugin-sdk";

export type XmppTlsMode = "starttls" | "tls" | "none";

export type XmppGroupConfig = {
  requireMention?: boolean;
  tools: GroupToolPolicyConfig;
  toolsBySender?: GroupToolPolicyBySenderConfig;
  skills?: string[];
  enabled?: boolean;
  allowFrom?: Array<string | number>;
  systemPrompt?: string;
};

export type XmppAccountConfig = {
  name?: string;
  enabled?: boolean;
  jid?: string;
  password?: string;
  passwordFile?: string;
  server?: string;
  domain?: string;
  resource?: string;
  port?: number;
  tls?: boolean;
  tlsMode?: XmppTlsMode;
  allowSelfSignedTls?: boolean;
  dmPolicy?: DmPolicy;
  allowFrom?: Array<string | number>;
  groupPolicy?: GroupPolicy;
  groupAllowFrom?: Array<string | number>;
  groups?: Record<string, XmppGroupConfig | undefined>;
  markdown: MarkdownConfig;
  historyLimit?: number;
  dmHistoryLimit?: number;
  dms?: Record<string, DmConfig | undefined>;
  textChunkLimit?: number;
  chunkMode?: "length" | "newline";
  blockStreaming?: boolean;
  blockStreamingCoalesce?: BlockStreamingCoalesceConfig;
  responsePrefix?: string;
  mediaMaxMb?: number;
  receiptsEnabled?: boolean;
  chatStatesEnabled?: boolean;
  httpUploadEnabled?: boolean;
};

export type XmppConfig = XmppAccountConfig & {
  accounts?: Record<string, XmppAccountConfig | undefined>;
  defaultAccount?: string;
};

export type CoreConfig = OpenClawConfig & {
  channels?: OpenClawConfig["channels"] & {
    xmpp?: XmppConfig;
  };
};

export type XmppChatState = "active" | "composing" | "paused" | "inactive" | "gone";

export type XmppInboundMessage = {
  messageId: string;
  fromJid: string;
  toJid: string;
  body: string;
  isGroup: boolean;
  threadId?: string;
  chatState?: XmppChatState;
  receiptForId?: string;
  timestamp?: number;
  oobUrls?: string[];
};

export type XmppProbe = BaseProbeResult<string> & {
  server: string;
  port: number;
  tls: boolean;
  latencyMs?: number;
};
