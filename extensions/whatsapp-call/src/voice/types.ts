export type ICEServer = {
  urls: string[];
  username?: string;
  credential?: string;
};

export type CallEvent = {
  connectionId: string;
  callId?: string;
  phase: string;
  status: string;
  reason?: string;
  metadata?: Record<string, string>;
};

export type ConnectionRecord = {
  connectionId: string;
  callId: string;
  contactWaid: string;
  channelPhone: string;
  agentId: string;
  callbackUrl: string;
  status: string;
  requestId: string;
  context: Record<string, string>;
  awaitingPermission: boolean;
  createdAt: Date;
};

export type OutboundRequest = {
  whatsappNumber: string;
  channelPhone?: string;
  callbackUrl?: string;
  agentId?: string;
  context?: Record<string, string>;
};

export type OutboundResult = {
  connectionId: string;
  requestId: string;
  status: string;
};

export type WhatsAppCallVoiceConfig = {
  provider?: "wati" | "meta";

  watiBaseUrl?: string;
  watiOutboundUrl?: string;
  watiTenantId?: string;
  watiApiToken?: string;

  metaPhoneNumberId?: string;
  metaAccessToken?: string;
  metaGraphBaseUrl?: string;

  openaiApiKey?: string;
  openaiModel?: string;
  voice?: string;
  voiceSpeed?: number;
  voiceLanguage?: string;
  voiceGreeting?: string;
  voiceInstructions?: string;

  twilioAccountSid?: string;
  twilioAuthToken?: string;

  webhookUrl?: string;
  appSecret?: string;
  verifyToken?: string;
};
