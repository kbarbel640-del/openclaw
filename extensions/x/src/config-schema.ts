import { z } from "zod";

/**
 * X account configuration schema
 */
const XAccountSchema = z.object({
  /** Twitter/X Consumer Key (API Key) */
  consumerKey: z.string().min(1),
  /** Twitter/X Consumer Secret (API Secret) */
  consumerSecret: z.string().min(1),
  /** Twitter/X Access Token */
  accessToken: z.string().min(1),
  /** Twitter/X Access Token Secret */
  accessTokenSecret: z.string().min(1),
  /** Enable this account */
  enabled: z.boolean().optional(),
  /** Polling interval in seconds (default: 60, min: 15) */
  pollIntervalSeconds: z.number().min(15).optional(),
  /**
   * Allowlist of X user IDs who can mention the bot (mention → reply). When set, only these users can trigger.
   * Server config only; cannot be changed via conversation.
   */
  allowFrom: z.array(z.string()).optional(),
  /**
   * Allowlist of X user IDs who can trigger proactive X actions (follow, like, reply, dm).
   * Do not reuse allowFrom: this is for auto-operations. When request is from X, the mentioner must be in this list.
   * Server config only.
   */
  actionsAllowFrom: z.array(z.string()).optional(),
  /** Account display name */
  name: z.string().optional(),
  /** HTTP proxy URL for API requests (e.g., http://127.0.0.1:7890) */
  proxy: z.string().optional(),
});

/**
 * X plugin configuration schema.
 *
 * Supports two patterns (determined at runtime by which fields are present):
 * 1. Single-account: credential fields at the top level (implicit "default" account)
 * 2. Multi-account: credentials nested under `accounts.<id>`
 *
 * Flattened into a single z.object so the web UI form renderer can handle it
 * (z.union / z.intersection produce "Unsupported schema node" in the form view).
 */
export const XConfigSchema = z.object({
  /** Account display name */
  name: z.string().optional(),
  /** Enable the X channel */
  enabled: z.boolean().optional(),

  // ── Single-account fields (top-level credentials) ──
  /** Twitter/X Consumer Key (API Key) */
  consumerKey: z.string().optional(),
  /** Twitter/X Consumer Secret (API Secret) */
  consumerSecret: z.string().optional(),
  /** Twitter/X Access Token */
  accessToken: z.string().optional(),
  /** Twitter/X Access Token Secret */
  accessTokenSecret: z.string().optional(),
  /** Polling interval in seconds (default: 60, min: 15) */
  pollIntervalSeconds: z.number().min(15).optional(),
  /** Allowlist of X user IDs who can mention the bot (mention → reply). */
  allowFrom: z.array(z.string()).optional(),
  /** Allowlist of X user IDs who can trigger proactive X actions. */
  actionsAllowFrom: z.array(z.string()).optional(),
  /** HTTP proxy URL for API requests (e.g., http://127.0.0.1:7890) */
  proxy: z.string().optional(),

  // ── Multi-account field ──
  /** Per-account configuration (for multi-account setups) */
  accounts: z.record(z.string(), XAccountSchema).optional(),
});

export type XConfig = z.infer<typeof XConfigSchema>;
