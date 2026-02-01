import type {
  BlockStreamingCoalesceConfig,
  DmPolicy,
  MarkdownConfig,
  OutboundRetryConfig,
  ReplyToMode,
} from "./types.base.js";
import type { ChannelHeartbeatVisibilityConfig } from "./types.channels.js";
import type { DmConfig, ProviderCommandsConfig } from "./types.messages.js";

/**
 * Messenger action capabilities.
 */
export type MessengerActionConfig = {
  /** Enable reaction actions (default: true). */
  reactions?: boolean;
  /** Enable sending messages (default: true). */
  sendMessage?: boolean;
};

/**
 * Facebook Messenger account configuration.
 */
export type MessengerAccountConfig = {
  /** Optional display name for this account (used in CLI/UI lists). */
  name?: string;
  /** Optional provider capability tags used for agent/runtime guidance. */
  capabilities?: string[];
  /** Markdown formatting overrides. */
  markdown?: MarkdownConfig;
  /** Override native command registration (bool or "auto"). */
  commands?: ProviderCommandsConfig;
  /** Allow channel-initiated config writes (default: true). */
  configWrites?: boolean;
  /**
   * Controls how Messenger DMs are handled:
   * - "pairing" (default): unknown senders get a pairing code; owner must approve
   * - "allowlist": only allow senders in allowFrom (or paired allow store)
   * - "open": allow all inbound DMs (requires allowFrom to include "*")
   * - "disabled": ignore all inbound DMs
   */
  dmPolicy?: DmPolicy;
  /** If false, do not start this Messenger account. Default: true. */
  enabled?: boolean;
  /**
   * Facebook Page Access Token for API calls.
   * Generate from Facebook Developer Console or via Page Settings.
   */
  pageAccessToken?: string;
  /** Path to file containing page access token (for secret managers). */
  tokenFile?: string;
  /**
   * Facebook App Secret for webhook signature verification.
   * Found in Facebook App Dashboard under Settings > Basic.
   */
  appSecret?: string;
  /**
   * Verify Token for webhook verification handshake.
   * You define this value; must match what's configured in Facebook webhook settings.
   */
  verifyToken?: string;
  /** Facebook Page ID this account is linked to. */
  pageId?: string;
  /** Webhook path for receiving Messenger events (default: "/messenger/webhook"). */
  webhookPath?: string;
  /** Control reply threading when reply tags are present (off|first|all). */
  replyToMode?: ReplyToMode;
  /** Allowed PSID list for DM policy. */
  allowFrom?: Array<string | number>;
  /** Max DM turns to keep as history context. */
  historyLimit?: number;
  /** Max DM turns to keep as history context (alias). */
  dmHistoryLimit?: number;
  /** Per-DM config overrides keyed by PSID. */
  dms?: Record<string, DmConfig>;
  /** Outbound text chunk size (chars). Default: 2000. */
  textChunkLimit?: number;
  /** Chunking mode: "length" (default) splits by size; "newline" splits on every newline. */
  chunkMode?: "length" | "newline";
  /** Disable block streaming for this account. */
  blockStreaming?: boolean;
  /** Merge streamed block replies before sending. */
  blockStreamingCoalesce?: BlockStreamingCoalesceConfig;
  /** Max media size in MB (default: 25MB for Messenger). */
  mediaMaxMb?: number;
  /** Retry policy for outbound Messenger API calls. */
  retry?: OutboundRetryConfig;
  /** Per-action tool gating (default: true for all). */
  actions?: MessengerActionConfig;
  /**
   * Controls which user reactions trigger notifications:
   * - "off" (default): ignore all reactions
   * - "own": notify when users react to bot messages
   * - "all": notify agent of all reactions
   */
  reactionNotifications?: "off" | "own" | "all";
  /** Heartbeat visibility settings for this channel. */
  heartbeat?: ChannelHeartbeatVisibilityConfig;
  /**
   * Message tag for sending outside 24-hour messaging window.
   * Only use when you have a legitimate reason per Facebook's policies.
   */
  defaultMessageTag?:
    | "CONFIRMED_EVENT_UPDATE"
    | "POST_PURCHASE_UPDATE"
    | "ACCOUNT_UPDATE"
    | "HUMAN_AGENT";
  /**
   * Graph API version to use (default: "v18.0").
   */
  apiVersion?: string;
};

/**
 * Facebook Messenger channel configuration.
 */
export type MessengerConfig = {
  /** Optional per-account Messenger configuration (multi-account). */
  accounts?: Record<string, MessengerAccountConfig>;
} & MessengerAccountConfig;
