import type { OpenClawConfig } from "openclaw/plugin-sdk";
import { DEFAULT_ACCOUNT_ID, normalizeE164 } from "openclaw/plugin-sdk";
import type { SmsChannelConfig, SmsProvider } from "./config-schema.js";

export type SmsResolvedAccount = {
  accountId: string;
  name?: string;
  enabled: boolean;
  configured: boolean;
  provider: SmsProvider;
  signName?: string;
  templateId?: string;
  textChunkLimit?: number;
  aliyun: {
    accessKeyId?: string;
    accessKeySecret?: string;
    endpoint: string;
    templateParamName: string;
  };
  tencent: {
    secretId?: string;
    secretKey?: string;
    sdkAppId?: string;
    endpoint: string;
    region?: string;
    senderId?: string;
    sessionContext?: string;
  };
};

const DEFAULT_ALIYUN_ENDPOINT = "https://dysmsapi.aliyuncs.com/";
const DEFAULT_TENCENT_ENDPOINT = "sms.tencentcloudapi.com";

function pickAccount(
  config: SmsChannelConfig | undefined,
  accountId: string,
): Record<string, unknown> {
  const base = (config ?? {}) as Record<string, unknown>;
  const accounts = (base.accounts as Record<string, unknown> | undefined) ?? {};
  const nested = (accounts[accountId] as Record<string, unknown> | undefined) ?? {};
  const { accounts: _ignored, ...baseWithoutAccounts } = base;
  return { ...baseWithoutAccounts, ...nested };
}

function firstString(...values: Array<unknown>): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

export function listSmsAccountIds(cfg: OpenClawConfig): string[] {
  const sms = (cfg.channels?.sms ?? {}) as SmsChannelConfig;
  const accountKeys = Object.keys(sms.accounts ?? {});
  if (accountKeys.length === 0) {
    return [DEFAULT_ACCOUNT_ID];
  }
  return Array.from(new Set([DEFAULT_ACCOUNT_ID, ...accountKeys]));
}

export function resolveSmsAccount(params: {
  cfg: OpenClawConfig;
  accountId?: string | null;
}): SmsResolvedAccount {
  const accountId = params.accountId?.trim() ? params.accountId.trim() : DEFAULT_ACCOUNT_ID;
  const sms = (params.cfg.channels?.sms ?? {}) as SmsChannelConfig;
  const merged = pickAccount(sms, accountId);

  const providerRaw = firstString(merged.provider, process.env.SMS_PROVIDER)?.toLowerCase();
  const provider: SmsProvider = providerRaw === "tencent" ? "tencent" : "aliyun";

  const aliyun = (merged.aliyun ?? {}) as Record<string, unknown>;
  const tencent = (merged.tencent ?? {}) as Record<string, unknown>;

  const resolved: SmsResolvedAccount = {
    accountId,
    name: firstString(merged.name),
    enabled: merged.enabled !== false,
    provider,
    signName: firstString(merged.signName),
    templateId: firstString(merged.templateId),
    textChunkLimit:
      typeof merged.textChunkLimit === "number" && Number.isFinite(merged.textChunkLimit)
        ? Math.max(1, Math.floor(merged.textChunkLimit))
        : undefined,
    aliyun: {
      accessKeyId: firstString(aliyun.accessKeyId, process.env.ALIYUN_ACCESS_KEY_ID),
      accessKeySecret: firstString(aliyun.accessKeySecret, process.env.ALIYUN_ACCESS_KEY_SECRET),
      endpoint: firstString(aliyun.endpoint) ?? DEFAULT_ALIYUN_ENDPOINT,
      templateParamName: firstString(aliyun.templateParamName) ?? "content",
    },
    tencent: {
      secretId: firstString(tencent.secretId, process.env.TENCENT_SECRET_ID),
      secretKey: firstString(tencent.secretKey, process.env.TENCENT_SECRET_KEY),
      sdkAppId: firstString(tencent.sdkAppId, process.env.TENCENT_SMS_SDK_APP_ID),
      endpoint: firstString(tencent.endpoint) ?? DEFAULT_TENCENT_ENDPOINT,
      region: firstString(tencent.region),
      senderId: firstString(tencent.senderId),
      sessionContext: firstString(tencent.sessionContext),
    },
    configured: false,
  };

  resolved.configured = isSmsAccountConfigured(resolved);
  return resolved;
}

export function isSmsAccountConfigured(account: SmsResolvedAccount): boolean {
  if (!account.signName || !account.templateId) {
    return false;
  }
  if (account.provider === "aliyun") {
    return Boolean(account.aliyun.accessKeyId && account.aliyun.accessKeySecret);
  }
  return Boolean(account.tencent.secretId && account.tencent.secretKey && account.tencent.sdkAppId);
}

export function normalizeSmsTarget(to: string): string | undefined {
  const normalized = normalizeE164(to);
  if (normalized) {
    return normalized;
  }
  const trimmed = to.trim();
  if (!trimmed) {
    return undefined;
  }
  // Keep raw value as fallback for provider-side validation errors.
  return trimmed;
}
