import { z } from "zod";
import { NonEmptyString, SessionLabelString } from "./primitives.js";

export const SessionsListParamsSchema = z
  .object({
    limit: z.number().int().min(1).optional(),
    activeMinutes: z.number().int().min(1).optional(),
    includeGlobal: z.boolean().optional(),
    includeUnknown: z.boolean().optional(),
    /**
     * Read first 8KB of each session transcript to derive title from first user message.
     * Performs a file read per session - use `limit` to bound result set on large stores.
     */
    includeDerivedTitles: z.boolean().optional(),
    /**
     * Read last 16KB of each session transcript to extract most recent message preview.
     * Performs a file read per session - use `limit` to bound result set on large stores.
     */
    includeLastMessage: z.boolean().optional(),
    label: SessionLabelString.optional(),
    spawnedBy: NonEmptyString.optional(),
    agentId: NonEmptyString.optional(),
    search: z.string().optional(),
  })
  .strict();

export const SessionsPreviewParamsSchema = z
  .object({
    keys: z.array(NonEmptyString).min(1),
    limit: z.number().int().min(1).optional(),
    maxChars: z.number().int().min(20).optional(),
  })
  .strict();

export const SessionsResolveParamsSchema = z
  .object({
    key: NonEmptyString.optional(),
    sessionId: NonEmptyString.optional(),
    label: SessionLabelString.optional(),
    agentId: NonEmptyString.optional(),
    spawnedBy: NonEmptyString.optional(),
    includeGlobal: z.boolean().optional(),
    includeUnknown: z.boolean().optional(),
  })
  .strict();

export const SessionsPatchParamsSchema = z
  .object({
    key: NonEmptyString,
    label: SessionLabelString.nullable().optional(),
    thinkingLevel: NonEmptyString.nullable().optional(),
    verboseLevel: NonEmptyString.nullable().optional(),
    reasoningLevel: NonEmptyString.nullable().optional(),
    projectDir: NonEmptyString.nullable().optional(),
    workspaceDir: NonEmptyString.nullable().optional(),
    thinkingModel: NonEmptyString.nullable().optional(),
    codingModel: NonEmptyString.nullable().optional(),
    responseUsage: z
      .enum([
        "off",
        "tokens",
        "full",
        // Backward compat with older clients/stores.
        "on",
      ])
      .nullable()
      .optional(),
    elevatedLevel: NonEmptyString.nullable().optional(),
    execHost: NonEmptyString.nullable().optional(),
    execSecurity: NonEmptyString.nullable().optional(),
    execAsk: NonEmptyString.nullable().optional(),
    execNode: NonEmptyString.nullable().optional(),
    model: NonEmptyString.nullable().optional(),
    spawnedBy: NonEmptyString.nullable().optional(),
    sendPolicy: z.enum(["allow", "deny"]).nullable().optional(),
    groupActivation: z.enum(["mention", "always"]).nullable().optional(),
  })
  .strict();

export const SessionsResetParamsSchema = z
  .object({
    key: NonEmptyString,
  })
  .strict();

export const SessionsDeleteParamsSchema = z
  .object({
    key: NonEmptyString,
    deleteTranscript: z.boolean().optional(),
  })
  .strict();

export const SessionsCompactParamsSchema = z
  .object({
    key: NonEmptyString,
    maxLines: z.number().int().min(1).optional(),
  })
  .strict();
