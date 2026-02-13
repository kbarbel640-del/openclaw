import { z } from "zod";

export const HookMappingSchema = z
  .object({
    id: z.string().optional(),
    match: z
      .object({
        path: z.string().optional(),
        source: z.string().optional(),
      })
      .optional(),
    action: z.union([z.literal("wake"), z.literal("agent")]).optional(),
    wakeMode: z.union([z.literal("now"), z.literal("next-heartbeat")]).optional(),
    name: z.string().optional(),
    agentId: z.string().optional(),
    sessionKey: z.string().optional(),
    messageTemplate: z.string().optional(),
    textTemplate: z.string().optional(),
    deliver: z.boolean().optional(),
    allowUnsafeExternalContent: z.boolean().optional(),
    channel: z
      .union([
        z.literal("last"),
        z.literal("whatsapp"),
        z.literal("telegram"),
        z.literal("discord"),
        z.literal("irc"),
        z.literal("slack"),
        z.literal("signal"),
        z.literal("imessage"),
        z.literal("msteams"),
      ])
      .optional(),
    to: z.string().optional(),
    model: z.string().optional(),
    thinking: z.string().optional(),
    timeoutSeconds: z.number().int().positive().optional(),
    transform: z
      .object({
        module: z.string(),
        export: z.string().optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .optional();

export const InternalHookHandlerSchema = z
  .object({
    event: z.string(),
    module: z.string(),
    export: z.string().optional(),
  })
  .strict();

const HookConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    env: z.record(z.string(), z.string()).optional(),
  })
  // Hook configs are intentionally open-ended (handlers can define their own keys).
  // Keep enabled/env typed, but allow additional per-hook keys without marking the
  // whole config invalid (which triggers doctor/best-effort loads).
  .passthrough();

const HookInstallRecordSchema = z
  .object({
    source: z.union([z.literal("npm"), z.literal("archive"), z.literal("path")]),
    spec: z.string().optional(),
    sourcePath: z.string().optional(),
    installPath: z.string().optional(),
    version: z.string().optional(),
    installedAt: z.string().optional(),
    hooks: z.array(z.string()).optional(),
  })
  .strict();

export const InternalHooksSchema = z
  .object({
    enabled: z.boolean().optional(),
    handlers: z.array(InternalHookHandlerSchema).optional(),
    entries: z.record(z.string(), HookConfigSchema).optional(),
    load: z
      .object({
        extraDirs: z.array(z.string()).optional(),
      })
      .strict()
      .optional(),
    installs: z.record(z.string(), HookInstallRecordSchema).optional(),
  })
  .strict()
  .optional();

export const HooksGmailSchema = z
  .object({
    account: z.string().optional(),
    label: z.string().optional(),
    topic: z.string().optional(),
    subscription: z.string().optional(),
    pushToken: z.string().optional(),
    hookUrl: z.string().optional(),
    includeBody: z.boolean().optional(),
    maxBytes: z.number().int().positive().optional(),
    renewEveryMinutes: z.number().int().positive().optional(),
    allowUnsafeExternalContent: z.boolean().optional(),
    serve: z
      .object({
        bind: z.string().optional(),
        port: z.number().int().positive().optional(),
        path: z.string().optional(),
      })
      .strict()
      .optional(),
    tailscale: z
      .object({
        mode: z.union([z.literal("off"), z.literal("serve"), z.literal("funnel")]).optional(),
        path: z.string().optional(),
        target: z.string().optional(),
      })
      .strict()
      .optional(),
    model: z.string().optional(),
    thinking: z
      .union([
        z.literal("off"),
        z.literal("minimal"),
        z.literal("low"),
        z.literal("medium"),
        z.literal("high"),
      ])
      .optional(),
  })
  .strict()
  .optional();

// ============================================================================
// Message Hooks (pre/post message processing)
// ============================================================================

/**
 * Schema for a single message hook command.
 * SECURITY: Commands execute with OpenClaw's privileges.
 */
export const MessageHookSchema = z
  .object({
    /** Shell command to execute. SECURITY: Only use trusted commands. */
    command: z.string().min(1),
    /** Timeout in milliseconds (default: 5000, max: 30000) */
    timeout: z.number().int().positive().max(30000).optional(),
    /** For preMessage: inject stdout into system prompt */
    inject: z.boolean().optional(),
    /** Pass message context as JSON via stdin */
    passContext: z.boolean().optional(),
    /** Additional environment variables */
    env: z.record(z.string(), z.string()).optional(),
    /** Only run for specific session key prefixes (case-insensitive) */
    sessionKeyPrefixes: z.array(z.string()).optional(),
    /** Only run for specific channels (case-insensitive) */
    channels: z.array(z.string()).optional(),
  })
  .strict();

/**
 * Schema for message hooks configuration (top-level messageHooks key).
 */
export const MessageHooksSchema = z
  .object({
    /** Enable message hooks */
    enabled: z.boolean().optional(),
    /** Maximum number of hooks to run (default: 10) */
    maxHooks: z.number().int().positive().max(10).optional(),
    /** Aggregate timeout for all hooks in ms (default: 15000) */
    aggregateTimeoutMs: z.number().int().min(100).max(60000).optional(),
    /** Optional allowlist of command prefixes (security hardening) */
    allowedCommandPrefixes: z.array(z.string()).optional(),
    /** Hooks to run before agent processing */
    preMessage: z.array(MessageHookSchema).optional(),
    /** Hooks to run after agent processing */
    postMessage: z.array(MessageHookSchema).optional(),
  })
  .strict()
  .optional();
