import { z } from "zod";
import { ChannelHeartbeatVisibilitySchema } from "./zod-schema.channels.js";
import {
  BlockStreamingCoalesceSchema,
  DmConfigSchema,
  DmPolicySchema,
  MarkdownConfigSchema,
  ProviderCommandsSchema,
  ReplyToModeSchema,
  RetryConfigSchema,
  requireOpenAllowFrom,
} from "./zod-schema.core.js";

const MessengerMessageTagSchema = z.enum([
  "CONFIRMED_EVENT_UPDATE",
  "POST_PURCHASE_UPDATE",
  "ACCOUNT_UPDATE",
  "HUMAN_AGENT",
]);

export const MessengerAccountSchemaBase = z
  .object({
    name: z.string().optional(),
    capabilities: z.array(z.string()).optional(),
    markdown: MarkdownConfigSchema,
    commands: ProviderCommandsSchema,
    configWrites: z.boolean().optional(),
    dmPolicy: DmPolicySchema.optional().default("pairing"),
    enabled: z.boolean().optional(),
    pageAccessToken: z.string().optional(),
    tokenFile: z.string().optional(),
    appSecret: z.string().optional(),
    verifyToken: z.string().optional(),
    pageId: z.string().optional(),
    webhookPath: z.string().optional(),
    replyToMode: ReplyToModeSchema.optional(),
    allowFrom: z.array(z.union([z.string(), z.number()])).optional(),
    historyLimit: z.number().int().min(0).optional(),
    dmHistoryLimit: z.number().int().min(0).optional(),
    dms: z.record(z.string(), DmConfigSchema.optional()).optional(),
    textChunkLimit: z.number().int().positive().optional(),
    chunkMode: z.enum(["length", "newline"]).optional(),
    blockStreaming: z.boolean().optional(),
    blockStreamingCoalesce: BlockStreamingCoalesceSchema.optional(),
    mediaMaxMb: z.number().positive().optional(),
    retry: RetryConfigSchema,
    actions: z
      .object({
        reactions: z.boolean().optional(),
        sendMessage: z.boolean().optional(),
      })
      .strict()
      .optional(),
    reactionNotifications: z.enum(["off", "own", "all"]).optional(),
    heartbeat: ChannelHeartbeatVisibilitySchema,
    defaultMessageTag: MessengerMessageTagSchema.optional(),
    apiVersion: z.string().optional(),
  })
  .strict();

export const MessengerAccountSchema = MessengerAccountSchemaBase.superRefine((value, ctx) => {
  requireOpenAllowFrom({
    policy: value.dmPolicy,
    allowFrom: value.allowFrom,
    ctx,
    path: ["allowFrom"],
    message:
      'channels.messenger.dmPolicy="open" requires channels.messenger.allowFrom to include "*"',
  });
});

export const MessengerConfigSchema = MessengerAccountSchemaBase.extend({
  accounts: z.record(z.string(), MessengerAccountSchema.optional()).optional(),
}).superRefine((value, ctx) => {
  requireOpenAllowFrom({
    policy: value.dmPolicy,
    allowFrom: value.allowFrom,
    ctx,
    path: ["allowFrom"],
    message:
      'channels.messenger.dmPolicy="open" requires channels.messenger.allowFrom to include "*"',
  });
});
