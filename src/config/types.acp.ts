export type AcpDispatchConfig = {
  /** Master switch for ACP turn dispatch in the reply pipeline. */
  enabled?: boolean;
};

export type AcpStreamConfig = {
  /** Coalescer idle flush window in milliseconds for ACP streamed text. */
  coalesceIdleMs?: number;
  /** Maximum text size per streamed chunk. */
  maxChunkChars?: number;
};

export type AcpRuntimeConfig = {
  /** Idle runtime TTL in minutes for ACP session workers. */
  ttlMinutes?: number;
  /** Optional operator install/setup command shown by `/acp install` and `/acp doctor`. */
  installCommand?: string;
  /**
   * Default permission profile for ACP sessions (e.g., "trusted", "strict").
   * This is passed to the ACP backend (Codex) to control auto-approval behavior.
   * Useful for thread-bound ACP sessions where interactive approval is not possible.
   */
  permissionProfile?: string;
};

export type AcpConfig = {
  /** Global ACP runtime gate. */
  enabled?: boolean;
  dispatch?: AcpDispatchConfig;
  /** Backend id registered by ACP runtime plugin (for example: acpx). */
  backend?: string;
  defaultAgent?: string;
  allowedAgents?: string[];
  maxConcurrentSessions?: number;
  stream?: AcpStreamConfig;
  runtime?: AcpRuntimeConfig;
};
