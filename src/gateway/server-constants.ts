export const DEFAULT_MAX_PAYLOAD_BYTES = 50 * 1024 * 1024; // default incoming frame size cap (~50 MiB; large enough for typical screenshot uploads)
let maxPayloadBytes = DEFAULT_MAX_PAYLOAD_BYTES;
/** Resolved max incoming WS frame size in bytes. */
export const getMaxPayloadBytes = () => maxPayloadBytes;
/** Set max payload from gateway config (call once at startup). */
export const setMaxPayloadBytes = (value: number | undefined) => {
  if (value !== undefined && Number.isFinite(value) && value > 0) {
    maxPayloadBytes = value;
  } else {
    maxPayloadBytes = DEFAULT_MAX_PAYLOAD_BYTES;
  }
};
export const MAX_BUFFERED_BYTES_FACTOR = 2;
/** Per-connection send buffer limit (2x max payload). */
export const getMaxBufferedBytes = () => maxPayloadBytes * MAX_BUFFERED_BYTES_FACTOR;

const DEFAULT_MAX_CHAT_HISTORY_MESSAGES_BYTES = 6 * 1024 * 1024; // keep history responses comfortably under client WS limits
let maxChatHistoryMessagesBytes = DEFAULT_MAX_CHAT_HISTORY_MESSAGES_BYTES;

export const getMaxChatHistoryMessagesBytes = () => maxChatHistoryMessagesBytes;

export const __setMaxChatHistoryMessagesBytesForTest = (value?: number) => {
  if (!process.env.VITEST && process.env.NODE_ENV !== "test") {
    return;
  }
  if (value === undefined) {
    maxChatHistoryMessagesBytes = DEFAULT_MAX_CHAT_HISTORY_MESSAGES_BYTES;
    return;
  }
  if (Number.isFinite(value) && value > 0) {
    maxChatHistoryMessagesBytes = value;
  }
};
export const DEFAULT_HANDSHAKE_TIMEOUT_MS = 10_000;
export const getHandshakeTimeoutMs = () => {
  if (process.env.VITEST && process.env.OPENCLAW_TEST_HANDSHAKE_TIMEOUT_MS) {
    const parsed = Number(process.env.OPENCLAW_TEST_HANDSHAKE_TIMEOUT_MS);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return DEFAULT_HANDSHAKE_TIMEOUT_MS;
};
export const TICK_INTERVAL_MS = 30_000;
export const HEALTH_REFRESH_INTERVAL_MS = 60_000;
export const DEDUPE_TTL_MS = 5 * 60_000;
export const DEDUPE_MAX = 1000;
