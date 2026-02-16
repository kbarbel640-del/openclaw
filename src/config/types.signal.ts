import type { CommonChannelMessagingConfig } from "./types.channel-messaging-common.js";
import type { ReactionDelivery } from "./types.reactions.js";

export type SignalReactionNotificationMode = "off" | "own" | "all" | "allowlist";
export type SignalReactionLevel = "off" | "ack" | "minimal" | "extensive";

export type SignalAccountConfig = CommonChannelMessagingConfig & {
  /** Optional explicit E.164 account for signal-cli. */
  account?: string;
  /** Optional full base URL for signal-cli HTTP daemon. */
  httpUrl?: string;
  /** HTTP host for signal-cli daemon (default 127.0.0.1). */
  httpHost?: string;
  /** HTTP port for signal-cli daemon (default 8080). */
  httpPort?: number;
  /** signal-cli binary path (default: signal-cli). */
  cliPath?: string;
  /** Auto-start signal-cli daemon (default: true if httpUrl not set). */
  autoStart?: boolean;
  /** Max time to wait for signal-cli daemon startup (ms, cap 120000). */
  startupTimeoutMs?: number;
  receiveMode?: "on-start" | "manual";
  ignoreAttachments?: boolean;
  ignoreStories?: boolean;
  sendReadReceipts?: boolean;
  /** Outbound text chunk size (chars). Default: 4000. */
  textChunkLimit?: number;
  /** Reaction notification mode (off|own|all|allowlist). Default: own. */
  reactionNotifications?: SignalReactionNotificationMode;
  /** Allowlist for reaction notifications when mode is allowlist. */
  reactionAllowlist?: Array<string | number>;
  /** Reaction delivery mode: "deferred" queues for next message; "immediate" triggers own agent turn. Default: deferred. */
  reactionDelivery?: ReactionDelivery;
  /** Debounce window (ms) for bundling multiple reactions to the same message (0–60000). Default: 2000. */
  reactionBundleWindowMs?: number;
  /** When true, include the reacted-to message content in the agent context (not available on Signal). */
  reactionIncludeMessage?: boolean;
  /** Action toggles for message tool capabilities. */
  actions?: {
    /** Enable/disable sending reactions via message tool (default: true). */
    reactions?: boolean;
  };
  /**
   * Controls agent reaction behavior:
   * - "off": No reactions
   * - "ack": Only automatic ack reactions (👀 when processing)
   * - "minimal": Agent can react sparingly (default)
   * - "extensive": Agent can react liberally
   */
  reactionLevel?: SignalReactionLevel;
};

export type SignalConfig = {
  /** Optional per-account Signal configuration (multi-account). */
  accounts?: Record<string, SignalAccountConfig>;
} & SignalAccountConfig;
