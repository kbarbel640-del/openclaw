import type { OpenClawConfig } from "openclaw/plugin-sdk";
import { z } from "zod";

export type WhatsAppCallProvider = "wati" | "meta";

export type WhatsAppCallAccountConfig = {
  enabled?: boolean;
  name?: string;
  provider?: WhatsAppCallProvider;

  // WATI credentials
  watiBaseUrl?: string;
  watiOutboundUrl?: string;
  watiTenantId?: string;
  watiApiToken?: string;

  // Meta Graph API credentials
  metaPhoneNumberId?: string;
  metaAccessToken?: string;
  metaGraphBaseUrl?: string;

  // OpenAI Realtime
  openaiApiKey?: string;
  openaiModel?: string;
  voice?: string;
  voiceSpeed?: number;
  voiceLanguage?: string;
  voiceGreeting?: string;
  voiceInstructions?: string;

  // Twilio TURN
  twilioAccountSid?: string;
  twilioAuthToken?: string;

  // Webhook
  webhookUrl?: string;
  appSecret?: string;
  verifyToken?: string;

  // Voice service
  serviceUrl?: string;
};

export type WhatsAppCallConfig = {
  enabled?: boolean;
  accounts?: Record<string, WhatsAppCallAccountConfig>;
} & WhatsAppCallAccountConfig;

export const WhatsAppCallConfigSchema = z.object({
  enabled: z.boolean().optional(),
  provider: z.enum(["wati", "meta"]).optional(),

  watiBaseUrl: z.string().optional(),
  watiOutboundUrl: z.string().optional(),
  watiTenantId: z.string().optional(),
  watiApiToken: z.string().optional(),

  metaPhoneNumberId: z.string().optional(),
  metaAccessToken: z.string().optional(),
  metaGraphBaseUrl: z.string().optional(),

  openaiApiKey: z.string().optional(),
  openaiModel: z.string().optional(),
  voice: z.string().optional(),
  voiceSpeed: z.number().optional(),
  voiceLanguage: z.string().optional(),
  voiceGreeting: z.string().optional(),
  voiceInstructions: z.string().optional(),

  twilioAccountSid: z.string().optional(),
  twilioAuthToken: z.string().optional(),

  webhookUrl: z.string().optional(),
  appSecret: z.string().optional(),
  verifyToken: z.string().optional(),

  serviceUrl: z.string().optional(),
});

const CHANNEL_KEY = "whatsappcall";

function getChannelConfig(cfg: OpenClawConfig): WhatsAppCallConfig | undefined {
  return (cfg.channels as Record<string, unknown>)?.[CHANNEL_KEY] as WhatsAppCallConfig | undefined;
}

export type ResolvedWhatsAppCallAccount = {
  accountId: string;
  name?: string;
  enabled: boolean;
  config: WhatsAppCallAccountConfig;
  provider: WhatsAppCallProvider | null;
  configured: boolean;
};

export function resolveWhatsAppCallAccount(
  cfg: OpenClawConfig,
  accountId?: string | null,
): ResolvedWhatsAppCallAccount {
  const base = getChannelConfig(cfg);
  const id = accountId ?? "default";

  const accountCfg: WhatsAppCallAccountConfig =
    id !== "default" && base?.accounts?.[id] ? { ...base, ...base.accounts[id] } : (base ?? {});

  const provider = accountCfg.provider ?? detectProvider(accountCfg);
  const configured = isProviderConfigured(accountCfg, provider);

  return {
    accountId: id,
    name: accountCfg.name,
    enabled: accountCfg.enabled ?? false,
    config: accountCfg,
    provider,
    configured,
  };
}

function detectProvider(cfg: WhatsAppCallAccountConfig): WhatsAppCallProvider | null {
  if (cfg.metaPhoneNumberId && cfg.metaAccessToken) return "meta";
  if (cfg.watiTenantId && cfg.watiApiToken) return "wati";
  return null;
}

function isProviderConfigured(
  cfg: WhatsAppCallAccountConfig,
  provider: WhatsAppCallProvider | null,
): boolean {
  if (!provider) return false;
  if (!cfg.openaiApiKey && !process.env.OPENAI_API_KEY) return false;
  if (provider === "wati") {
    return Boolean(cfg.watiTenantId && cfg.watiApiToken);
  }
  return Boolean(cfg.metaPhoneNumberId && cfg.metaAccessToken);
}

export function listWhatsAppCallAccountIds(cfg: OpenClawConfig): string[] {
  const base = getChannelConfig(cfg);
  if (!base) return [];
  const ids = new Set<string>();
  if (base.provider || base.watiTenantId || base.metaPhoneNumberId) {
    ids.add("default");
  }
  if (base.accounts) {
    for (const key of Object.keys(base.accounts)) {
      ids.add(key);
    }
  }
  return [...ids];
}
