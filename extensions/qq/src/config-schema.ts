import { z } from "zod";

export const QQAccountSchema = z
  .object({
    appId: z.string().optional(),
    clientSecret: z.string().optional(),
    name: z.string().optional(),
    enabled: z.boolean().optional(),
    webhookPath: z.string().optional(),
    webhookPort: z.number().optional(),
    allowFrom: z.array(z.string()).optional(),
    dmPolicy: z.enum(["open", "pairing", "allowlist"]).optional(),
  })
  .strict();

export const QQConfigSchema = z
  .object({
    appId: z.string().optional(),
    clientSecret: z.string().optional(),
    name: z.string().optional(),
    enabled: z.boolean().optional(),
    webhookPath: z.string().optional(),
    webhookPort: z.number().optional(),
    allowFrom: z.array(z.string()).optional(),
    dmPolicy: z.enum(["open", "pairing", "allowlist"]).optional(),
    accounts: z.record(z.string(), QQAccountSchema.optional()).optional(),
  })
  .strict();

export type QQConfig = z.infer<typeof QQConfigSchema>;
