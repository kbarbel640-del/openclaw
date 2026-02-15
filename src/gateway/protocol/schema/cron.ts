import { z } from "zod";
import { NonEmptyString } from "./primitives.js";

export const CronScheduleSchema = z.union([
  z
    .object({
      kind: z.literal("at"),
      atMs: z.number().int().min(0),
    })
    .strict(),
  z
    .object({
      kind: z.literal("every"),
      everyMs: z.number().int().min(1),
      anchorMs: z.number().int().min(0).optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("cron"),
      expr: NonEmptyString,
      tz: z.string().optional(),
    })
    .strict(),
]);

export const CronPayloadSchema = z.union([
  z
    .object({
      kind: z.literal("systemEvent"),
      text: NonEmptyString,
    })
    .strict(),
  z
    .object({
      kind: z.literal("agentTurn"),
      message: NonEmptyString,
      model: z.string().optional(),
      thinking: z.string().optional(),
      timeoutSeconds: z.number().int().min(1).optional(),
      deliver: z.boolean().optional(),
      channel: z.union([z.literal("last"), NonEmptyString]).optional(),
      to: z.string().optional(),
      bestEffortDeliver: z.boolean().optional(),
    })
    .strict(),
]);

export const CronPayloadPatchSchema = z.union([
  z
    .object({
      kind: z.literal("systemEvent"),
      text: NonEmptyString.optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("agentTurn"),
      message: NonEmptyString.optional(),
      model: z.string().optional(),
      thinking: z.string().optional(),
      timeoutSeconds: z.number().int().min(1).optional(),
      deliver: z.boolean().optional(),
      channel: z.union([z.literal("last"), NonEmptyString]).optional(),
      to: z.string().optional(),
      bestEffortDeliver: z.boolean().optional(),
    })
    .strict(),
]);

export const CronIsolationSchema = z
  .object({
    postToMainPrefix: z.string().optional(),
    postToMainMode: z.enum(["summary", "full"]).optional(),
    postToMainMaxChars: z.number().int().min(0).optional(),
  })
  .strict();

export const CronJobStateSchema = z
  .object({
    nextRunAtMs: z.number().int().min(0).optional(),
    runningAtMs: z.number().int().min(0).optional(),
    lastRunAtMs: z.number().int().min(0).optional(),
    lastStatus: z.enum(["ok", "error", "skipped"]).optional(),
    lastError: z.string().optional(),
    lastDurationMs: z.number().int().min(0).optional(),
  })
  .strict();

export const CronJobSchema = z
  .object({
    id: NonEmptyString,
    agentId: NonEmptyString.optional(),
    name: NonEmptyString,
    description: z.string().optional(),
    enabled: z.boolean(),
    deleteAfterRun: z.boolean().optional(),
    createdAtMs: z.number().int().min(0),
    updatedAtMs: z.number().int().min(0),
    schedule: CronScheduleSchema,
    sessionTarget: z.enum(["main", "isolated"]),
    wakeMode: z.enum(["next-heartbeat", "now"]),
    payload: CronPayloadSchema,
    isolation: CronIsolationSchema.optional(),
    state: CronJobStateSchema,
  })
  .strict();

export const CronListParamsSchema = z
  .object({
    includeDisabled: z.boolean().optional(),
  })
  .strict();

export const CronStatusParamsSchema = z.object({}).strict();

export const CronAddParamsSchema = z
  .object({
    name: NonEmptyString,
    agentId: NonEmptyString.nullable().optional(),
    description: z.string().optional(),
    enabled: z.boolean().optional(),
    deleteAfterRun: z.boolean().optional(),
    schedule: CronScheduleSchema,
    sessionTarget: z.enum(["main", "isolated"]),
    wakeMode: z.enum(["next-heartbeat", "now"]),
    payload: CronPayloadSchema,
    isolation: CronIsolationSchema.optional(),
  })
  .strict();

export const CronJobPatchSchema = z
  .object({
    name: NonEmptyString.optional(),
    agentId: NonEmptyString.nullable().optional(),
    description: z.string().optional(),
    enabled: z.boolean().optional(),
    deleteAfterRun: z.boolean().optional(),
    schedule: CronScheduleSchema.optional(),
    sessionTarget: z.enum(["main", "isolated"]).optional(),
    wakeMode: z.enum(["next-heartbeat", "now"]).optional(),
    payload: CronPayloadPatchSchema.optional(),
    isolation: CronIsolationSchema.optional(),
    state: CronJobStateSchema.partial().optional(),
  })
  .strict();

export const CronUpdateParamsSchema = z.union([
  z
    .object({
      id: NonEmptyString,
      patch: CronJobPatchSchema,
    })
    .strict(),
  z
    .object({
      jobId: NonEmptyString,
      patch: CronJobPatchSchema,
    })
    .strict(),
]);

export const CronRemoveParamsSchema = z.union([
  z
    .object({
      id: NonEmptyString,
    })
    .strict(),
  z
    .object({
      jobId: NonEmptyString,
    })
    .strict(),
]);

export const CronRunParamsSchema = z.union([
  z
    .object({
      id: NonEmptyString,
      mode: z.enum(["due", "force"]).optional(),
    })
    .strict(),
  z
    .object({
      jobId: NonEmptyString,
      mode: z.enum(["due", "force"]).optional(),
    })
    .strict(),
]);

export const CronRunsParamsSchema = z.union([
  z
    .object({
      id: NonEmptyString,
      limit: z.number().int().min(1).max(5000).optional(),
    })
    .strict(),
  z
    .object({
      jobId: NonEmptyString,
      limit: z.number().int().min(1).max(5000).optional(),
    })
    .strict(),
]);

export const CronRunLogEntrySchema = z
  .object({
    ts: z.number().int().min(0),
    jobId: NonEmptyString,
    action: z.literal("finished"),
    status: z.enum(["ok", "error", "skipped"]).optional(),
    error: z.string().optional(),
    summary: z.string().optional(),
    runAtMs: z.number().int().min(0).optional(),
    durationMs: z.number().int().min(0).optional(),
    nextRunAtMs: z.number().int().min(0).optional(),
  })
  .strict();
