/**
 * Simple sliding-window rate limiter for connection/request limiting.
 * Uses in-memory Map with automatic cleanup.
 */

export type RateLimitConfig = {
  /** Maximum requests allowed in the window */
  maxRequests: number;
  /** Window duration in milliseconds */
  windowMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetMs: number;
};

type WindowEntry = {
  count: number;
  windowStart: number;
};

/**
 * Creates a rate limiter that tracks requests per key (e.g., IP address).
 * Automatically cleans up stale entries every cleanupIntervalMs.
 */
export function createRateLimiter(config: RateLimitConfig) {
  const { maxRequests, windowMs } = config;
  const windows = new Map<string, WindowEntry>();
  const cleanupIntervalMs = Math.max(windowMs * 2, 60_000);

  // Cleanup stale entries periodically
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of windows) {
      if (now - entry.windowStart > windowMs) {
        windows.delete(key);
      }
    }
  }, cleanupIntervalMs);

  // Don't prevent process exit
  cleanup.unref();

  return {
    /**
     * Check if a request should be allowed for the given key.
     * Returns allowed status, remaining requests, and reset time.
     */
    check(key: string): RateLimitResult {
      const now = Date.now();
      const entry = windows.get(key);

      // New window or expired window
      if (!entry || now - entry.windowStart > windowMs) {
        windows.set(key, { count: 1, windowStart: now });
        return {
          allowed: true,
          remaining: maxRequests - 1,
          resetMs: windowMs,
        };
      }

      // Within window
      const resetMs = windowMs - (now - entry.windowStart);
      if (entry.count >= maxRequests) {
        return {
          allowed: false,
          remaining: 0,
          resetMs,
        };
      }

      entry.count++;
      return {
        allowed: true,
        remaining: maxRequests - entry.count,
        resetMs,
      };
    },

    /**
     * Reset the rate limit for a specific key (e.g., after successful auth).
     */
    reset(key: string): void {
      windows.delete(key);
    },

    /**
     * Stop the cleanup interval (for graceful shutdown).
     */
    stop(): void {
      clearInterval(cleanup);
      windows.clear();
    },
  };
}

/** Default rate limit for WebSocket connections: 30 per minute per IP */
export const WS_CONNECTION_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 30,
  windowMs: 60_000,
};

/** Default rate limit for HTTP endpoints: 100 per minute per IP */
export const HTTP_REQUEST_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 100,
  windowMs: 60_000,
};
