import { MarkdownConfigSchema } from "openclaw/plugin-sdk";
import { z } from "zod";

const allowFromEntry = z.union([z.string(), z.number()]);

const kakaoAccountSchema = z.object({
  name: z.string().optional(),
  enabled: z.boolean().optional(),
  markdown: MarkdownConfigSchema,
  webhookPath: z.string().optional(),
  webhookUrl: z.string().optional(),
  botId: z.string().optional(),
  dmPolicy: z.enum(["pairing", "allowlist", "open", "disabled"]).optional(),
  allowFrom: z.array(allowFromEntry).optional(),
  responsePrefix: z.string().optional(),
});

export const KakaoConfigSchema = kakaoAccountSchema.extend({
  accounts: z.object({}).catchall(kakaoAccountSchema).optional(),
  defaultAccount: z.string().optional(),
});
