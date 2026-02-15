import { z } from "zod";
import { NonEmptyString } from "./primitives.js";

export const LogsTailParamsSchema = z
  .object({
    cursor: z.number().int().min(0).optional(),
    limit: z.number().int().min(1).max(5000).optional(),
    maxBytes: z.number().int().min(1).max(1_000_000).optional(),
  })
  .strict();

export const LogsTailResultSchema = z
  .object({
    file: NonEmptyString,
    cursor: z.number().int().min(0),
    size: z.number().int().min(0),
    lines: z.array(z.string()),
    truncated: z.boolean().optional(),
    reset: z.boolean().optional(),
  })
  .strict();

// WebChat/WebSocket-native chat methods
export const ChatHistoryParamsSchema = z
  .object({
    sessionKey: NonEmptyString,
    limit: z.number().int().min(1).max(1000).optional(),
  })
  .strict();

export const ChatSendParamsSchema = z
  .object({
    sessionKey: NonEmptyString,
    message: z.string(),
    thinking: z.string().optional(),
    deliver: z.boolean().optional(),
    attachments: z.array(z.unknown()).optional(),
    timeoutMs: z.number().int().min(0).optional(),
    idempotencyKey: NonEmptyString,
  })
  .strict();

export const ChatAbortParamsSchema = z
  .object({
    sessionKey: NonEmptyString,
    runId: NonEmptyString.optional(),
  })
  .strict();

export const ChatInjectParamsSchema = z
  .object({
    sessionKey: NonEmptyString,
    message: NonEmptyString,
    role: z.enum(["system", "assistant", "user"]).optional(),
    label: z.string().max(100).optional(),
    /** Sender agent ID for direct announce mode */
    senderAgentId: z.string().max(100).optional(),
    /** Sender display name */
    senderName: z.string().max(100).optional(),
    /** Sender emoji avatar */
    senderEmoji: z.string().max(10).optional(),
    /** Sender avatar URL */
    senderAvatar: z.string().max(500).optional(),
  })
  .strict();

export const ChatEventSchema = z
  .object({
    runId: NonEmptyString,
    sessionKey: NonEmptyString,
    seq: z.number().int().min(0),
    state: z.enum(["delta", "final", "aborted", "error"]),
    message: z.unknown().optional(),
    errorMessage: z.string().optional(),
    usage: z.unknown().optional(),
    stopReason: z.string().optional(),
  })
  .strict();
