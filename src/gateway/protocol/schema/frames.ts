import { z } from "zod";
import { GatewayClientIdSchema, GatewayClientModeSchema, NonEmptyString } from "./primitives.js";
import { SnapshotSchema, StateVersionSchema } from "./snapshot.js";

export const TickEventSchema = z
  .object({
    ts: z.number().int().min(0),
  })
  .strict();

export const ShutdownEventSchema = z
  .object({
    reason: NonEmptyString,
    restartExpectedMs: z.number().int().min(0).optional(),
  })
  .strict();

export const ConnectParamsSchema = z
  .object({
    minProtocol: z.number().int().min(1),
    maxProtocol: z.number().int().min(1),
    client: z
      .object({
        id: GatewayClientIdSchema,
        displayName: NonEmptyString.optional(),
        version: NonEmptyString,
        platform: NonEmptyString,
        deviceFamily: NonEmptyString.optional(),
        modelIdentifier: NonEmptyString.optional(),
        mode: GatewayClientModeSchema,
        instanceId: NonEmptyString.optional(),
      })
      .strict(),
    caps: z.array(NonEmptyString).optional(),
    commands: z.array(NonEmptyString).optional(),
    permissions: z.record(NonEmptyString, z.boolean()).optional(),
    pathEnv: z.string().optional(),
    role: NonEmptyString.optional(),
    scopes: z.array(NonEmptyString).optional(),
    device: z
      .object({
        id: NonEmptyString,
        publicKey: NonEmptyString,
        signature: NonEmptyString,
        signedAt: z.number().int().min(0),
        nonce: NonEmptyString.optional(),
      })
      .strict()
      .optional(),
    auth: z
      .object({
        token: z.string().optional(),
        password: z.string().optional(),
      })
      .strict()
      .optional(),
    locale: z.string().optional(),
    userAgent: z.string().optional(),
  })
  .strict();

export const HelloOkSchema = z
  .object({
    type: z.literal("hello-ok"),
    protocol: z.number().int().min(1),
    server: z
      .object({
        version: NonEmptyString,
        commit: NonEmptyString.optional(),
        host: NonEmptyString.optional(),
        connId: NonEmptyString,
      })
      .strict(),
    features: z
      .object({
        methods: z.array(NonEmptyString),
        events: z.array(NonEmptyString),
      })
      .strict(),
    snapshot: SnapshotSchema,
    canvasHostUrl: NonEmptyString.optional(),
    auth: z
      .object({
        deviceToken: NonEmptyString,
        role: NonEmptyString,
        scopes: z.array(NonEmptyString),
        issuedAtMs: z.number().int().min(0).optional(),
      })
      .strict()
      .optional(),
    policy: z
      .object({
        maxPayload: z.number().int().min(1),
        maxBufferedBytes: z.number().int().min(1),
        tickIntervalMs: z.number().int().min(1),
      })
      .strict(),
  })
  .strict();

export const ErrorShapeSchema = z
  .object({
    code: NonEmptyString,
    message: NonEmptyString,
    details: z.unknown().optional(),
    retryable: z.boolean().optional(),
    retryAfterMs: z.number().int().min(0).optional(),
  })
  .strict();

export const RequestFrameSchema = z
  .object({
    type: z.literal("req"),
    id: NonEmptyString,
    method: NonEmptyString,
    params: z.unknown().optional(),
  })
  .strict();

export const ResponseFrameSchema = z
  .object({
    type: z.literal("res"),
    id: NonEmptyString,
    ok: z.boolean(),
    payload: z.unknown().optional(),
    error: ErrorShapeSchema.optional(),
  })
  .strict();

export const EventFrameSchema = z
  .object({
    type: z.literal("event"),
    event: NonEmptyString,
    payload: z.unknown().optional(),
    seq: z.number().int().min(0).optional(),
    stateVersion: StateVersionSchema.optional(),
  })
  .strict();

// Discriminated union of all top-level frames. Using a discriminator makes
// downstream codegen (quicktype) produce tighter types instead of all-optional
// blobs.
export const GatewayFrameSchema = z.discriminatedUnion("type", [
  RequestFrameSchema,
  ResponseFrameSchema,
  EventFrameSchema,
]);
