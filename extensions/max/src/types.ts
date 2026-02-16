import type { BlockStreamingCoalesceConfig, DmPolicy, GroupPolicy } from "openclaw/plugin-sdk";

/**
 * MAX Bot API probe result — returned by GET /me.
 */
export type MaxProbe = {
  ok: boolean;
  bot?: {
    id: number;
    name: string;
    username: string;
  };
  error?: string;
};

/**
 * Per-account MAX configuration stored in openclaw.json.
 */
export type MaxAccountConfig = {
  /** Optional display name for this account. */
  name?: string;
  /** If false, do not start this MAX account. Default: true. */
  enabled?: boolean;
  /** Bot token from dev.max.ru. */
  botToken?: string;
  /** Path to file containing the bot token. */
  tokenFile?: string;
  /** HTTPS URL for webhook delivery (production). */
  webhookUrl?: string;
  /** Shared secret for webhook verification (sent by MAX in X-Max-Bot-Api-Secret header). */
  webhookSecret?: string;
  /** Custom webhook path suffix. */
  webhookPath?: string;
  /** Direct message policy. */
  dmPolicy?: DmPolicy;
  /** Allowlist for direct messages (MAX user IDs). */
  allowFrom?: Array<string | number>;
  /** Allowlist for group messages. */
  groupAllowFrom?: Array<string | number>;
  /** Group message policy. */
  groupPolicy?: GroupPolicy;
  /** HTTP proxy for development. */
  proxy?: string;
  /** Outbound text chunk size (chars). Default: 4000. */
  textChunkLimit?: number;
  /** Default message format. */
  format?: "markdown" | "html";
  /** Disable block streaming. */
  blockStreaming?: boolean;
  /** Merge streamed block replies before sending. */
  blockStreamingCoalesce?: BlockStreamingCoalesceConfig;
};

/**
 * Top-level MAX channel configuration.
 */
export type MaxConfig = {
  /** Per-account MAX configuration (multi-account). */
  accounts?: Record<string, MaxAccountConfig>;
} & MaxAccountConfig;

/**
 * Resolved MAX account with token and metadata.
 */
export type ResolvedMaxAccount = {
  accountId: string;
  enabled: boolean;
  name?: string;
  token: string;
  tokenSource: "env" | "tokenFile" | "config" | "none";
  config: MaxAccountConfig;
};
