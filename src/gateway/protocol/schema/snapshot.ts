import { z } from "zod";
import { NonEmptyString } from "./primitives.js";

export const PresenceEntrySchema = z
  .object({
    host: NonEmptyString.optional(),
    ip: NonEmptyString.optional(),
    version: NonEmptyString.optional(),
    platform: NonEmptyString.optional(),
    deviceFamily: NonEmptyString.optional(),
    modelIdentifier: NonEmptyString.optional(),
    mode: NonEmptyString.optional(),
    lastInputSeconds: z.number().int().min(0).optional(),
    reason: NonEmptyString.optional(),
    tags: z.array(NonEmptyString).optional(),
    text: z.string().optional(),
    ts: z.number().int().min(0),
    deviceId: NonEmptyString.optional(),
    roles: z.array(NonEmptyString).optional(),
    scopes: z.array(NonEmptyString).optional(),
    instanceId: NonEmptyString.optional(),
  })
  .strict();

export const HealthSnapshotSchema = z.any();

export const SessionDefaultsSchema = z
  .object({
    defaultAgentId: NonEmptyString,
    mainKey: NonEmptyString,
    mainSessionKey: NonEmptyString,
    scope: NonEmptyString.optional(),
  })
  .strict();

export const StateVersionSchema = z
  .object({
    presence: z.number().int().min(0),
    health: z.number().int().min(0),
  })
  .strict();

export const SnapshotSchema = z
  .object({
    presence: z.array(PresenceEntrySchema),
    health: HealthSnapshotSchema,
    stateVersion: StateVersionSchema,
    uptimeMs: z.number().int().min(0),
    configPath: NonEmptyString.optional(),
    stateDir: NonEmptyString.optional(),
    sessionDefaults: SessionDefaultsSchema.optional(),
  })
  .strict();
