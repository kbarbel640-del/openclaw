import { err, ok, type Result } from '../../core/types/result.js';
import { RateLimitExceededError } from '../domain/errors.js';
import type { RateLimit } from '../domain/types.js';

interface UsageWindow {
  requests: Array<{ timestamp: number }>;
  tokens: Array<{ timestamp: number; count: number }>;
  concurrentRequests: number;
}

export class RateLimiter {
  private readonly limits = new Map<string, RateLimit>();
  private readonly usage = new Map<string, UsageWindow>();
  private readonly windowMs = 60_000; // 1 minute

  setLimit(providerId: string, limit: RateLimit): void {
    this.limits.set(providerId, limit);
    if (!this.usage.has(providerId)) {
      this.usage.set(providerId, { requests: [], tokens: [], concurrentRequests: 0 });
    }
  }

  checkLimit(providerId: string): Result<void, RateLimitExceededError> {
    const limit = this.limits.get(providerId);
    if (!limit) return ok(undefined);

    const window = this.getOrCreateWindow(providerId);
    this.cleanupOldEntries(window);

    const recentRequests = window.requests.length;
    const recentTokens = window.tokens.reduce((sum, t) => sum + t.count, 0);

    if (recentRequests >= limit.requestsPerMinute) {
      return err(new RateLimitExceededError(providerId, this.getRetryAfterMs(window)));
    }

    if (recentTokens >= limit.tokensPerMinute) {
      return err(new RateLimitExceededError(providerId, this.getRetryAfterMs(window)));
    }

    if (window.concurrentRequests >= limit.concurrentRequests) {
      return err(new RateLimitExceededError(providerId));
    }

    return ok(undefined);
  }

  recordUsage(providerId: string, tokens: number): void {
    const window = this.getOrCreateWindow(providerId);
    const now = Date.now();

    window.requests.push({ timestamp: now });
    window.tokens.push({ timestamp: now, count: tokens });
  }

  getRemainingQuota(providerId: string): { requests: number; tokens: number } {
    const limit = this.limits.get(providerId);
    if (!limit) return { requests: Infinity, tokens: Infinity };

    const window = this.getOrCreateWindow(providerId);
    this.cleanupOldEntries(window);

    const usedRequests = window.requests.length;
    const usedTokens = window.tokens.reduce((sum, t) => sum + t.count, 0);

    return {
      requests: Math.max(0, limit.requestsPerMinute - usedRequests),
      tokens: Math.max(0, limit.tokensPerMinute - usedTokens)
    };
  }

  private getOrCreateWindow(providerId: string): UsageWindow {
    let window = this.usage.get(providerId);
    if (!window) {
      window = { requests: [], tokens: [], concurrentRequests: 0 };
      this.usage.set(providerId, window);
    }
    return window;
  }

  private cleanupOldEntries(window: UsageWindow): void {
    const cutoff = Date.now() - this.windowMs;
    window.requests = window.requests.filter(r => r.timestamp > cutoff);
    window.tokens = window.tokens.filter(t => t.timestamp > cutoff);
  }

  private getRetryAfterMs(window: UsageWindow): number {
    const oldestTimestamp = Math.min(
      window.requests[0]?.timestamp ?? Infinity,
      window.tokens[0]?.timestamp ?? Infinity
    );
    return Math.max(0, this.windowMs - (Date.now() - oldestTimestamp));
  }
}
