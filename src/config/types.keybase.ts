import type {
  BlockStreamingCoalesceConfig,
  DmPolicy,
  GroupPolicy,
  MarkdownConfig,
} from "./types.base.js";
import type { ChannelHeartbeatVisibilityConfig } from "./types.channels.js";
import type { DmConfig } from "./types.messages.js";

export type KeybaseAccountConfig = {
  /** Optional display name for this account (used in CLI/UI lists). */
  name?: string;
  /** Optional provider capability tags used for agent/runtime guidance. */
  capabilities?: string[];
  /** Markdown formatting overrides. */
  markdown?: MarkdownConfig;
  /** Allow channel-initiated config writes (default: true). */
  configWrites?: boolean;
  /** If false, do not start this Keybase account. Default: true. */
  enabled?: boolean;
  /** Direct message access policy (default: pairing). */
  dmPolicy?: DmPolicy;
  /** Allowlist of Keybase usernames that can DM the bot. */
  allowFrom?: Array<string | number>;
  /** Allowlist for team channel senders. */
  groupAllowFrom?: Array<string | number>;
  /** Controls how team channel messages are handled. */
  groupPolicy?: GroupPolicy;
  /** Max team channel messages to keep as history context (0 disables). */
  historyLimit?: number;
  /** Max DM turns to keep as history context. */
  dmHistoryLimit?: number;
  /** Per-DM config overrides keyed by username. */
  dms?: Record<string, DmConfig>;
  /** Outbound text chunk size (chars). Default: 4000. */
  textChunkLimit?: number;
  /** Chunking mode: "length" (default) or "newline". */
  chunkMode?: "length" | "newline";
  /** Block streaming mode. */
  blockStreaming?: boolean;
  /** Merge streamed block replies before sending. */
  blockStreamingCoalesce?: BlockStreamingCoalesceConfig;
  /** Heartbeat visibility settings. */
  heartbeat?: ChannelHeartbeatVisibilityConfig;
  /** Outbound response prefix override. */
  responsePrefix?: string;
};

export type KeybaseConfig = {
  /** Optional per-account Keybase configuration (multi-account). */
  accounts?: Record<string, KeybaseAccountConfig>;
} & KeybaseAccountConfig;
