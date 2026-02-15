import { z } from "zod";
import { NonEmptyString } from "./primitives.js";

export const NodePairRequestParamsSchema = z
  .object({
    nodeId: NonEmptyString,
    displayName: NonEmptyString.optional(),
    platform: NonEmptyString.optional(),
    version: NonEmptyString.optional(),
    coreVersion: NonEmptyString.optional(),
    uiVersion: NonEmptyString.optional(),
    deviceFamily: NonEmptyString.optional(),
    modelIdentifier: NonEmptyString.optional(),
    caps: z.array(NonEmptyString).optional(),
    commands: z.array(NonEmptyString).optional(),
    remoteIp: NonEmptyString.optional(),
    silent: z.boolean().optional(),
  })
  .strict();

export const NodePairListParamsSchema = z.object({}).strict();

export const NodePairApproveParamsSchema = z.object({ requestId: NonEmptyString }).strict();

export const NodePairRejectParamsSchema = z.object({ requestId: NonEmptyString }).strict();

export const NodePairVerifyParamsSchema = z
  .object({ nodeId: NonEmptyString, token: NonEmptyString })
  .strict();

export const NodeRenameParamsSchema = z
  .object({ nodeId: NonEmptyString, displayName: NonEmptyString })
  .strict();

export const NodeListParamsSchema = z.object({}).strict();

export const NodeDescribeParamsSchema = z.object({ nodeId: NonEmptyString }).strict();

export const NodeInvokeParamsSchema = z
  .object({
    nodeId: NonEmptyString,
    command: NonEmptyString,
    params: z.unknown().optional(),
    timeoutMs: z.number().int().min(0).optional(),
    idempotencyKey: NonEmptyString,
  })
  .strict();

export const NodeInvokeResultParamsSchema = z
  .object({
    id: NonEmptyString,
    nodeId: NonEmptyString,
    ok: z.boolean(),
    payload: z.unknown().optional(),
    payloadJSON: z.string().optional(),
    error: z
      .object({
        code: NonEmptyString.optional(),
        message: NonEmptyString.optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const NodeEventParamsSchema = z
  .object({
    event: NonEmptyString,
    payload: z.unknown().optional(),
    payloadJSON: z.string().optional(),
  })
  .strict();

export const NodeInvokeRequestEventSchema = z
  .object({
    id: NonEmptyString,
    nodeId: NonEmptyString,
    command: NonEmptyString,
    paramsJSON: z.string().optional(),
    timeoutMs: z.number().int().min(0).optional(),
    idempotencyKey: NonEmptyString.optional(),
  })
  .strict();
