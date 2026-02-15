import { z } from "zod";
import { NonEmptyString } from "./primitives.js";

export const DevicePairListParamsSchema = z.object({}).strict();

export const DevicePairApproveParamsSchema = z.object({ requestId: NonEmptyString }).strict();

export const DevicePairRejectParamsSchema = z.object({ requestId: NonEmptyString }).strict();

export const DeviceTokenRotateParamsSchema = z
  .object({
    deviceId: NonEmptyString,
    role: NonEmptyString,
    scopes: z.array(NonEmptyString).optional(),
  })
  .strict();

export const DeviceTokenRevokeParamsSchema = z
  .object({
    deviceId: NonEmptyString,
    role: NonEmptyString,
  })
  .strict();

export const DevicePairRequestedEventSchema = z
  .object({
    requestId: NonEmptyString,
    deviceId: NonEmptyString,
    publicKey: NonEmptyString,
    displayName: NonEmptyString.optional(),
    platform: NonEmptyString.optional(),
    clientId: NonEmptyString.optional(),
    clientMode: NonEmptyString.optional(),
    role: NonEmptyString.optional(),
    roles: z.array(NonEmptyString).optional(),
    scopes: z.array(NonEmptyString).optional(),
    remoteIp: NonEmptyString.optional(),
    silent: z.boolean().optional(),
    isRepair: z.boolean().optional(),
    ts: z.number().int().min(0),
  })
  .strict();

export const DevicePairResolvedEventSchema = z
  .object({
    requestId: NonEmptyString,
    deviceId: NonEmptyString,
    decision: NonEmptyString,
    ts: z.number().int().min(0),
  })
  .strict();
