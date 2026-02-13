/**
 * In-memory sliding-window rate limiter for gateway connections.
 * Tracks requests per connection ID with configurable limits and automatic cleanup.
 */

export type RateLimitConfig = {
  /** Max requests per window. Default: 60. */
  requestsPerMinute?: number;
  /** Burst allowance above the per-minute rate. Default: 10. */
  burstSize?: number;
};

type WindowEntry = {
  timestamps: number[];
};

const DEFAULT_REQUESTS_PER_MINUTE = 60;
const DEFAULT_BURST_SIZE = 10;
const WINDOW_MS = 60_000;
const CLEANUP_INTERVAL_MS = 120_000; // prune stale entries every 2 minutes

const windows = new Map<string, WindowEntry>();

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

/** Start the periodic cleanup timer (idempotent). */
function ensureCleanup(): void {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const cutoff = Date.now() - WINDOW_MS * 2;
    for (const [key, entry] of windows) {
      // Remove entries with no recent activity.
      if (entry.timestamps.length === 0 || entry.timestamps[entry.timestamps.length - 1] < cutoff) {
        windows.delete(key);
      }
    }
  }, CLEANUP_INTERVAL_MS);
  // Don't keep the process alive just for cleanup.
  if (cleanupTimer && typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
    cleanupTimer.unref();
  }
}

/**
 * Check whether a request from `connectionId` should be allowed.
 * Returns `{ allowed: true }` or `{ allowed: false, retryAfterMs }`.
 */
export function checkRateLimit(
  connectionId: string,
  config?: RateLimitConfig,
): { allowed: true } | { allowed: false; retryAfterMs: number } {
  ensureCleanup();

  const maxPerMinute = config?.requestsPerMinute ?? DEFAULT_REQUESTS_PER_MINUTE;
  const burst = config?.burstSize ?? DEFAULT_BURST_SIZE;
  const limit = maxPerMinute + burst;
  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  let entry = windows.get(connectionId);
  if (!entry) {
    entry = { timestamps: [] };
    windows.set(connectionId, entry);
  }

  // Prune timestamps outside the window.
  entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

  if (entry.timestamps.length >= limit) {
    // Calculate when the oldest request in the window expires.
    const oldestInWindow = entry.timestamps[0];
    const retryAfterMs = oldestInWindow + WINDOW_MS - now;
    return { allowed: false, retryAfterMs: Math.max(retryAfterMs, 1000) };
  }

  entry.timestamps.push(now);
  return { allowed: true };
}

/** Remove all tracking for a connection (call on disconnect). */
export function clearRateLimit(connectionId: string): void {
  windows.delete(connectionId);
}

/** Stop the cleanup timer (call on gateway shutdown). */
export function stopRateLimitCleanup(): void {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
  windows.clear();
}
