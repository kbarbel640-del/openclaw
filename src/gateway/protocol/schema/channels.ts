import { z } from "zod";
import { NonEmptyString } from "./primitives.js";

export const TalkModeParamsSchema = z
  .object({
    enabled: z.boolean(),
    phase: z.string().optional(),
  })
  .strict();

export const ChannelsStatusParamsSchema = z
  .object({
    probe: z.boolean().optional(),
    timeoutMs: z.number().int().min(0).optional(),
  })
  .strict();

// Channel docking: channels.status is intentionally schema-light so new
// channels can ship without protocol updates.
export const ChannelAccountSnapshotSchema = z.object({
  accountId: NonEmptyString,
  name: z.string().optional(),
  enabled: z.boolean().optional(),
  configured: z.boolean().optional(),
  linked: z.boolean().optional(),
  running: z.boolean().optional(),
  connected: z.boolean().optional(),
  reconnectAttempts: z.number().int().min(0).optional(),
  lastConnectedAt: z.number().int().min(0).optional(),
  lastError: z.string().optional(),
  lastStartAt: z.number().int().min(0).optional(),
  lastStopAt: z.number().int().min(0).optional(),
  lastInboundAt: z.number().int().min(0).optional(),
  lastOutboundAt: z.number().int().min(0).optional(),
  lastProbeAt: z.number().int().min(0).optional(),
  mode: z.string().optional(),
  dmPolicy: z.string().optional(),
  allowFrom: z.array(z.string()).optional(),
  tokenSource: z.string().optional(),
  botTokenSource: z.string().optional(),
  appTokenSource: z.string().optional(),
  baseUrl: z.string().optional(),
  allowUnmentionedGroups: z.boolean().optional(),
  cliPath: z.string().nullable().optional(),
  dbPath: z.string().nullable().optional(),
  port: z.number().int().min(0).nullable().optional(),
  probe: z.unknown().optional(),
  audit: z.unknown().optional(),
  application: z.unknown().optional(),
});

export const ChannelUiMetaSchema = z
  .object({
    id: NonEmptyString,
    label: NonEmptyString,
    detailLabel: NonEmptyString,
    systemImage: z.string().optional(),
  })
  .strict();

export const ChannelsStatusResultSchema = z
  .object({
    ts: z.number().int().min(0),
    channelOrder: z.array(NonEmptyString),
    channelLabels: z.record(NonEmptyString, NonEmptyString),
    channelDetailLabels: z.record(NonEmptyString, NonEmptyString).optional(),
    channelSystemImages: z.record(NonEmptyString, NonEmptyString).optional(),
    channelMeta: z.array(ChannelUiMetaSchema).optional(),
    channels: z.record(NonEmptyString, z.unknown()),
    channelAccounts: z.record(NonEmptyString, z.array(ChannelAccountSnapshotSchema)),
    channelDefaultAccountId: z.record(NonEmptyString, NonEmptyString),
  })
  .strict();

export const ChannelsLogoutParamsSchema = z
  .object({
    channel: NonEmptyString,
    accountId: z.string().optional(),
  })
  .strict();

export const WebLoginStartParamsSchema = z
  .object({
    force: z.boolean().optional(),
    timeoutMs: z.number().int().min(0).optional(),
    verbose: z.boolean().optional(),
    accountId: z.string().optional(),
  })
  .strict();

export const WebLoginWaitParamsSchema = z
  .object({
    timeoutMs: z.number().int().min(0).optional(),
    accountId: z.string().optional(),
  })
  .strict();
