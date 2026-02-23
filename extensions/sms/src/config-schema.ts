import { MarkdownConfigSchema } from "openclaw/plugin-sdk";
import { z } from "zod";

const SmsProviderSchema = z.enum(["aliyun", "tencent"]);

const AliyunConfigSchema = z
  .object({
    accessKeyId: z.string().optional(),
    accessKeySecret: z.string().optional(),
    endpoint: z.string().url().optional(),
    templateParamName: z.string().optional(),
  })
  .strict();

const TencentConfigSchema = z
  .object({
    secretId: z.string().optional(),
    secretKey: z.string().optional(),
    sdkAppId: z.string().optional(),
    endpoint: z.string().optional(),
    region: z.string().optional(),
    senderId: z.string().optional(),
    sessionContext: z.string().optional(),
  })
  .strict();

export const SmsAccountSchema = z
  .object({
    name: z.string().optional(),
    enabled: z.boolean().optional(),
    markdown: MarkdownConfigSchema.optional(),
    provider: SmsProviderSchema.optional(),
    signName: z.string().optional(),
    templateId: z.string().optional(),
    textChunkLimit: z.number().int().positive().optional(),
    responsePrefix: z.string().optional(),
    aliyun: AliyunConfigSchema.optional(),
    tencent: TencentConfigSchema.optional(),
  })
  .strict();

export const SmsConfigSchema = SmsAccountSchema.extend({
  accounts: z.record(z.string(), SmsAccountSchema.optional()).optional(),
});

export type SmsProvider = z.infer<typeof SmsProviderSchema>;
export type SmsChannelConfig = z.infer<typeof SmsConfigSchema>;
