import {
  buildChannelConfigSchema,
  DEFAULT_ACCOUNT_ID,
  formatPairingApproveHint,
  type ChannelPlugin,
  type OpenClawConfig,
} from "openclaw/plugin-sdk";
import { SmsConfigSchema } from "./config-schema.js";
import { sendSmsViaAliyun } from "./providers/aliyun.js";
import { sendSmsViaTencent } from "./providers/tencent.js";
import {
  isSmsAccountConfigured,
  listSmsAccountIds,
  normalizeSmsTarget,
  resolveSmsAccount,
  type SmsResolvedAccount,
} from "./types.js";

async function sendByProvider(params: {
  account: SmsResolvedAccount;
  to: string;
  text: string;
}): Promise<{ messageId: string; provider: "aliyun" | "tencent" }> {
  if (params.account.provider === "aliyun") {
    return sendSmsViaAliyun(params);
  }
  return sendSmsViaTencent(params);
}

export const smsPlugin: ChannelPlugin<SmsResolvedAccount> = {
  id: "sms",
  meta: {
    id: "sms",
    label: "SMS",
    selectionLabel: "SMS (Aliyun/Tencent)",
    docsPath: "/channels/sms",
    docsLabel: "sms",
    blurb: "Send SMS via Aliyun or Tencent Cloud templates.",
    order: 110,
  },
  capabilities: {
    chatTypes: ["direct"],
    media: false,
    reactions: false,
    threads: false,
  },
  reload: { configPrefixes: ["channels.sms"] },
  configSchema: buildChannelConfigSchema(SmsConfigSchema),
  config: {
    listAccountIds: (cfg: OpenClawConfig) => listSmsAccountIds(cfg),
    resolveAccount: (cfg: OpenClawConfig, accountId?: string | null) =>
      resolveSmsAccount({ cfg, accountId }),
    defaultAccountId: () => DEFAULT_ACCOUNT_ID,
    isEnabled: (account) => account.enabled,
    isConfigured: (account) => isSmsAccountConfigured(account),
    describeAccount: (account) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: account.configured,
      mode: account.provider,
    }),
  },
  security: {
    resolveDmPolicy: ({ account }) => ({
      policy: "disabled",
      allowFrom: [],
      policyPath: "channels.sms.dmPolicy",
      allowFromPath: "channels.sms.allowFrom",
      approveHint: formatPairingApproveHint("sms"),
    }),
  },
  messaging: {
    normalizeTarget: (target) => normalizeSmsTarget(target),
    targetResolver: {
      looksLikeId: (value) => /^\+\d{8,15}$/.test(value.trim()),
      hint: "<+E164 phone>",
    },
  },
  outbound: {
    deliveryMode: "direct",
    textChunkLimit: 280,
    sendText: async ({ cfg, to, text, accountId }) => {
      const account = resolveSmsAccount({ cfg, accountId });
      if (!account.enabled) {
        throw new Error(`SMS account '${account.accountId}' is disabled`);
      }
      if (!account.configured) {
        throw new Error(
          `SMS account '${account.accountId}' is not configured. Check channels.sms provider credentials/signName/templateId.`,
        );
      }
      const target = normalizeSmsTarget(to);
      if (!target) {
        throw new Error(`Invalid SMS target: ${to}`);
      }
      const payloadText = text.trim();
      if (!payloadText) {
        throw new Error("SMS text is empty");
      }

      const result = await sendByProvider({
        account,
        to: target,
        text: payloadText,
      });

      return {
        channel: "sms",
        messageId: result.messageId,
        meta: {
          provider: result.provider,
          to: target,
          accountId: account.accountId,
        },
      };
    },
    sendMedia: async ({ cfg, to, text, mediaUrl, accountId }) => {
      const combined = [text?.trim(), mediaUrl?.trim()].filter(Boolean).join("\n");
      return smsPlugin.outbound!.sendText!({
        cfg,
        to,
        text: combined,
        accountId,
      });
    },
  },
};
