import { z } from "zod";
import { NonEmptyString } from "./primitives.js";

export const WizardStartParamsSchema = z
  .object({
    mode: z.enum(["local", "remote"]).optional(),
    workspace: z.string().optional(),
  })
  .strict();

export const WizardAnswerSchema = z
  .object({
    stepId: NonEmptyString,
    value: z.unknown().optional(),
  })
  .strict();

export const WizardNextParamsSchema = z
  .object({
    sessionId: NonEmptyString,
    answer: z.lazy(() => WizardAnswerSchema).optional(),
  })
  .strict();

export const WizardCancelParamsSchema = z
  .object({
    sessionId: NonEmptyString,
  })
  .strict();

export const WizardStatusParamsSchema = z
  .object({
    sessionId: NonEmptyString,
  })
  .strict();

export const WizardStepOptionSchema = z
  .object({
    value: z.unknown(),
    label: NonEmptyString,
    hint: z.string().optional(),
  })
  .strict();

export const WizardStepSchema = z
  .object({
    id: NonEmptyString,
    type: z.enum(["note", "select", "text", "confirm", "multiselect", "progress", "action"]),
    title: z.string().optional(),
    message: z.string().optional(),
    options: z.array(WizardStepOptionSchema).optional(),
    initialValue: z.unknown().optional(),
    placeholder: z.string().optional(),
    sensitive: z.boolean().optional(),
    executor: z.enum(["gateway", "client"]).optional(),
  })
  .strict();

export const WizardNextResultSchema = z
  .object({
    done: z.boolean(),
    step: z.lazy(() => WizardStepSchema).optional(),
    status: z.enum(["running", "done", "cancelled", "error"]).optional(),
    error: z.string().optional(),
  })
  .strict();

export const WizardStartResultSchema = z
  .object({
    sessionId: NonEmptyString,
    done: z.boolean(),
    step: z.lazy(() => WizardStepSchema).optional(),
    status: z.enum(["running", "done", "cancelled", "error"]).optional(),
    error: z.string().optional(),
  })
  .strict();

export const WizardStatusResultSchema = z
  .object({
    status: z.enum(["running", "done", "cancelled", "error"]),
    error: z.string().optional(),
  })
  .strict();
