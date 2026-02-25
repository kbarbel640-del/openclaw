import type { ServerResponse } from "node:http";

import { isLoopbackAddress } from "./net.js";

export type RateLimitConfig = {
  /** Max requests per window per IP. Default: 120. */
  maxRequests?: number;
  /** Time window in ms. Default: 60000. */
  windowMs?: number;
  /** Max tracked IPs (LRU eviction beyond this). Default: 10000. */
  maxTrackedIps?: number;
};

type Entry = { count: number; resetAt: number };

export class RateLimiter {
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly maxTrackedIps: number;
  private readonly entries = new Map<string, Entry>();
  private readonly pruneInterval: ReturnType<typeof setInterval>;

  constructor(config?: RateLimitConfig) {
    this.maxRequests = config?.maxRequests ?? 120;
    this.windowMs = config?.windowMs ?? 60_000;
    this.maxTrackedIps = config?.maxTrackedIps ?? 10_000;

    // Prune expired entries every 60s
    this.pruneInterval = setInterval(() => this.prune(), 60_000);
    if (typeof this.pruneInterval.unref === "function") {
      this.pruneInterval.unref();
    }
  }

  /** Returns true if the request is allowed, false if rate-limited. Loopback IPs are exempt. */
  check(ip: string): boolean {
    if (isLoopbackAddress(ip)) return true;

    const now = Date.now();
    const existing = this.entries.get(ip);

    if (existing) {
      if (now >= existing.resetAt) {
        // Window expired — reset
        existing.count = 1;
        existing.resetAt = now + this.windowMs;
        return true;
      }
      existing.count++;
      return existing.count <= this.maxRequests;
    }

    // LRU eviction: if at capacity, remove the oldest entry
    if (this.entries.size >= this.maxTrackedIps) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }

    this.entries.set(ip, { count: 1, resetAt: now + this.windowMs });
    return true;
  }

  /** Send a 429 Too Many Requests response with Retry-After header. */
  sendRateLimited(res: ServerResponse) {
    const retryAfterSec = Math.ceil(this.windowMs / 1000);
    res.setHeader("Retry-After", String(retryAfterSec));
    res.statusCode = 429;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Too Many Requests");
  }

  /** Remove expired entries. */
  private prune() {
    const now = Date.now();
    for (const [ip, entry] of this.entries) {
      if (now >= entry.resetAt) {
        this.entries.delete(ip);
      }
    }
  }

  /** Stop the prune timer (for clean shutdown / tests). */
  destroy() {
    clearInterval(this.pruneInterval);
  }

  /** Visible for testing. */
  get size() {
    return this.entries.size;
  }
}
