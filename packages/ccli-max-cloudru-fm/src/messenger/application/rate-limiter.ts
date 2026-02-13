import type { Result } from '../../core/types/result.js';
import type { MessengerPlatform } from '../../core/types/messenger-platform.js';
import { ok, err } from '../../core/types/result.js';
import { RateLimitError } from '../domain/errors.js';
import { PLATFORM_RATE_LIMITS } from '../domain/types.js';

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

/**
 * Per-platform rate limiter using token bucket algorithm
 */
export class RateLimiter {
  private buckets = new Map<string, TokenBucket>();

  /**
   * Check if request is within rate limit
   */
  checkLimit(platform: MessengerPlatform, chatId: string): Result<void, RateLimitError> {
    const key = `${platform}:${chatId}`;
    const config = PLATFORM_RATE_LIMITS[platform];

    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = {
        tokens: config.burstSize,
        lastRefill: Date.now(),
      };
      this.buckets.set(key, bucket);
    }

    this.refillBucket(bucket, config.requestsPerSecond, config.burstSize);

    if (bucket.tokens < 1) {
      return err(new RateLimitError(`Rate limit exceeded for ${platform} chat ${chatId}`));
    }

    return ok(undefined);
  }

  /**
   * Record a request (consumes a token)
   */
  recordRequest(platform: MessengerPlatform, chatId: string): void {
    const key = `${platform}:${chatId}`;
    const bucket = this.buckets.get(key);

    if (bucket && bucket.tokens >= 1) {
      bucket.tokens -= 1;
    }
  }

  /**
   * Refill tokens based on elapsed time
   */
  private refillBucket(bucket: TokenBucket, tokensPerSecond: number, maxTokens: number): void {
    const now = Date.now();
    const elapsedSeconds = (now - bucket.lastRefill) / 1000;
    const tokensToAdd = elapsedSeconds * tokensPerSecond;

    bucket.tokens = Math.min(maxTokens, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
  }
}
