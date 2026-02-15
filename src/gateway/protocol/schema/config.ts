import { z } from "zod";
import { NonEmptyString } from "./primitives.js";

export const ConfigGetParamsSchema = z.object({}).strict();

export const ConfigSetParamsSchema = z
  .object({
    raw: NonEmptyString,
    baseHash: NonEmptyString.optional(),
  })
  .strict();

export const ConfigApplyParamsSchema = z
  .object({
    raw: NonEmptyString,
    baseHash: NonEmptyString.optional(),
    sessionKey: z.string().optional(),
    note: z.string().optional(),
    restartDelayMs: z.number().int().min(0).optional(),
  })
  .strict();

export const ConfigPatchParamsSchema = z
  .object({
    raw: NonEmptyString,
    baseHash: NonEmptyString.optional(),
    sessionKey: z.string().optional(),
    note: z.string().optional(),
    restartDelayMs: z.number().int().min(0).optional(),
  })
  .strict();

export const ConfigSchemaParamsSchema = z.object({}).strict();

export const UpdateRunParamsSchema = z
  .object({
    sessionKey: z.string().optional(),
    note: z.string().optional(),
    restartDelayMs: z.number().int().min(0).optional(),
    timeoutMs: z.number().int().min(1).optional(),
  })
  .strict();

export const ConfigUiHintSchema = z
  .object({
    label: z.string().optional(),
    help: z.string().optional(),
    group: z.string().optional(),
    order: z.number().int().optional(),
    advanced: z.boolean().optional(),
    sensitive: z.boolean().optional(),
    placeholder: z.string().optional(),
    itemTemplate: z.unknown().optional(),
  })
  .strict();

export const ConfigSchemaResponseSchema = z
  .object({
    schema: z.unknown(),
    uiHints: z.record(z.string(), ConfigUiHintSchema),
    version: NonEmptyString,
    generatedAt: NonEmptyString,
  })
  .strict();
