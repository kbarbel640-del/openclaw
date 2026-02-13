/**
 * Tests for RateLimiter.
 *
 * Verifies token bucket rate limiting enforcement, window reset/refill,
 * per-tenant (platform:chatId) isolation, and platform-specific limits.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { RateLimiter } from '../../src/messenger/application/rate-limiter.js';
import { PLATFORM_RATE_LIMITS } from '../../src/messenger/domain/types.js';
import { RateLimitError } from '../../src/messenger/domain/errors.js';

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('checkLimit', () => {
    it('should allow the first request for any platform/chatId', () => {
      const result = limiter.checkLimit('telegram', 'chat-1');

      expect(result.ok).toBe(true);
    });

    it('should allow requests up to the burst size for telegram', () => {
      const burstSize = PLATFORM_RATE_LIMITS.telegram.burstSize; // 30

      // Check limit (does NOT consume a token) and then record each request
      for (let i = 0; i < burstSize; i++) {
        const result = limiter.checkLimit('telegram', 'chat-1');
        expect(result.ok).toBe(true);
        limiter.recordRequest('telegram', 'chat-1');
      }
    });

    it('should deny requests beyond the burst size for telegram', () => {
      const burstSize = PLATFORM_RATE_LIMITS.telegram.burstSize; // 30

      // Exhaust all tokens
      for (let i = 0; i < burstSize; i++) {
        limiter.checkLimit('telegram', 'chat-1');
        limiter.recordRequest('telegram', 'chat-1');
      }

      // Next check should fail
      const result = limiter.checkLimit('telegram', 'chat-1');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(RateLimitError);
        expect(result.error.message).toContain('Rate limit exceeded');
        expect(result.error.message).toContain('telegram');
        expect(result.error.message).toContain('chat-1');
      }
    });

    it('should return a RateLimitError with user-friendly message', () => {
      const error = new RateLimitError('Rate limit exceeded');
      expect(error.toUserMessage()).toBe('Too many requests. Please wait a moment and try again.');
    });

    it('should allow requests for web platform up to its burst size', () => {
      const burstSize = PLATFORM_RATE_LIMITS.web.burstSize; // 100

      for (let i = 0; i < burstSize; i++) {
        const result = limiter.checkLimit('web', 'chat-1');
        expect(result.ok).toBe(true);
        limiter.recordRequest('web', 'chat-1');
      }

      // One more should fail
      const result = limiter.checkLimit('web', 'chat-1');
      expect(result.ok).toBe(false);
    });
  });

  describe('recordRequest', () => {
    it('should consume a token when recording a request', () => {
      const burstSize = PLATFORM_RATE_LIMITS.telegram.burstSize; // 30

      // Check and record until just 1 token left
      for (let i = 0; i < burstSize - 1; i++) {
        limiter.checkLimit('telegram', 'chat-1');
        limiter.recordRequest('telegram', 'chat-1');
      }

      // Should still be allowed (1 token left)
      const result = limiter.checkLimit('telegram', 'chat-1');
      expect(result.ok).toBe(true);

      // Consume the last token
      limiter.recordRequest('telegram', 'chat-1');

      // Now should be denied
      const denied = limiter.checkLimit('telegram', 'chat-1');
      expect(denied.ok).toBe(false);
    });

    it('should not throw when recording on a non-existent bucket', () => {
      // recordRequest before checkLimit creates the bucket
      expect(() => {
        limiter.recordRequest('telegram', 'nonexistent');
      }).not.toThrow();
    });

    it('should not reduce tokens below zero', () => {
      const burstSize = PLATFORM_RATE_LIMITS.telegram.burstSize;

      // Exhaust all tokens
      for (let i = 0; i < burstSize; i++) {
        limiter.checkLimit('telegram', 'chat-1');
        limiter.recordRequest('telegram', 'chat-1');
      }

      // Try to record more - should not throw
      expect(() => {
        limiter.recordRequest('telegram', 'chat-1');
        limiter.recordRequest('telegram', 'chat-1');
      }).not.toThrow();
    });
  });

  describe('token refill (window reset)', () => {
    it('should refill tokens after time passes', () => {
      const burstSize = PLATFORM_RATE_LIMITS.telegram.burstSize; // 30

      // Exhaust all tokens
      for (let i = 0; i < burstSize; i++) {
        limiter.checkLimit('telegram', 'chat-1');
        limiter.recordRequest('telegram', 'chat-1');
      }

      // Verify denied
      expect(limiter.checkLimit('telegram', 'chat-1').ok).toBe(false);

      // Advance time by 1 second -- should refill 30 tokens (requestsPerSecond = 30)
      vi.advanceTimersByTime(1000);

      // Should be allowed again
      const result = limiter.checkLimit('telegram', 'chat-1');
      expect(result.ok).toBe(true);
    });

    it('should refill proportionally based on elapsed time', () => {
      const burstSize = PLATFORM_RATE_LIMITS.telegram.burstSize; // 30
      // requestsPerSecond = 30 (same as burstSize for telegram)

      // Exhaust all tokens
      for (let i = 0; i < burstSize; i++) {
        limiter.checkLimit('telegram', 'chat-1');
        limiter.recordRequest('telegram', 'chat-1');
      }

      // Advance by 500ms = half a second = should refill ~15 tokens
      vi.advanceTimersByTime(500);

      // Should be allowed - refilled ~15 tokens
      const result = limiter.checkLimit('telegram', 'chat-1');
      expect(result.ok).toBe(true);

      // Can use up to ~15 tokens
      let allowed = 0;
      // Consume the refilled tokens. Note: checkLimit also triggers refill,
      // so the first checkLimit already triggered refill.
      // We need to record the first check and then keep going.
      limiter.recordRequest('telegram', 'chat-1');
      allowed++;

      for (let i = 0; i < 20; i++) {
        const check = limiter.checkLimit('telegram', 'chat-1');
        if (!check.ok) break;
        limiter.recordRequest('telegram', 'chat-1');
        allowed++;
      }

      // Should have allowed approximately 15 tokens (15 refilled from 500ms)
      // Exact count depends on timing within fake timers
      expect(allowed).toBeGreaterThanOrEqual(14);
      expect(allowed).toBeLessThanOrEqual(16);
    });

    it('should not refill beyond burst size', () => {
      // Let a lot of time pass without consuming tokens
      vi.advanceTimersByTime(10000);

      const burstSize = PLATFORM_RATE_LIMITS.telegram.burstSize; // 30

      // Check and consume tokens -- should only be able to use burstSize
      let allowed = 0;
      for (let i = 0; i < burstSize + 10; i++) {
        const result = limiter.checkLimit('telegram', 'chat-1');
        if (!result.ok) break;
        limiter.recordRequest('telegram', 'chat-1');
        allowed++;
      }

      expect(allowed).toBe(burstSize);
    });

    it('should refill web platform tokens at 100 per second', () => {
      const burstSize = PLATFORM_RATE_LIMITS.web.burstSize; // 100

      // Exhaust all tokens
      for (let i = 0; i < burstSize; i++) {
        limiter.checkLimit('web', 'chat-1');
        limiter.recordRequest('web', 'chat-1');
      }

      // Verify denied
      expect(limiter.checkLimit('web', 'chat-1').ok).toBe(false);

      // Advance by 1 second
      vi.advanceTimersByTime(1000);

      // Should be fully refilled
      const result = limiter.checkLimit('web', 'chat-1');
      expect(result.ok).toBe(true);
    });
  });

  describe('per-tenant isolation', () => {
    it('should track limits independently per chatId for same platform', () => {
      const burstSize = PLATFORM_RATE_LIMITS.telegram.burstSize; // 30

      // Exhaust tokens for chat-1
      for (let i = 0; i < burstSize; i++) {
        limiter.checkLimit('telegram', 'chat-1');
        limiter.recordRequest('telegram', 'chat-1');
      }

      // chat-1 should be denied
      expect(limiter.checkLimit('telegram', 'chat-1').ok).toBe(false);

      // chat-2 should still be allowed
      const result = limiter.checkLimit('telegram', 'chat-2');
      expect(result.ok).toBe(true);
    });

    it('should track limits independently per platform for same chatId', () => {
      const telegramBurst = PLATFORM_RATE_LIMITS.telegram.burstSize; // 30

      // Exhaust tokens for telegram:chat-1
      for (let i = 0; i < telegramBurst; i++) {
        limiter.checkLimit('telegram', 'chat-1');
        limiter.recordRequest('telegram', 'chat-1');
      }

      // telegram:chat-1 should be denied
      expect(limiter.checkLimit('telegram', 'chat-1').ok).toBe(false);

      // web:chat-1 should still be allowed (different platform)
      const result = limiter.checkLimit('web', 'chat-1');
      expect(result.ok).toBe(true);
    });

    it('should apply different burst sizes per platform', () => {
      // Telegram burst = 30, web burst = 100
      // Consume 50 tokens for both
      for (let i = 0; i < 50; i++) {
        limiter.checkLimit('telegram', 'chat-1');
        limiter.recordRequest('telegram', 'chat-1');

        limiter.checkLimit('web', 'chat-1');
        limiter.recordRequest('web', 'chat-1');
      }

      // Telegram should be denied (burst = 30, consumed 30 then was denied for remaining)
      // Actually let's re-check: checkLimit doesn't consume tokens, recordRequest does.
      // After 30 iterations, telegram will be denied for checkLimit, so recordRequest won't consume.
      // Let's verify the actual state:
      expect(limiter.checkLimit('telegram', 'chat-1').ok).toBe(false);

      // Web should still be allowed (burst = 100, consumed 50)
      expect(limiter.checkLimit('web', 'chat-1').ok).toBe(true);
    });
  });

  describe('platform rate limit configuration', () => {
    it('should use correct rate limits for telegram', () => {
      expect(PLATFORM_RATE_LIMITS.telegram).toEqual({
        requestsPerSecond: 30,
        burstSize: 30,
      });
    });

    it('should use correct rate limits for max', () => {
      expect(PLATFORM_RATE_LIMITS.max).toEqual({
        requestsPerSecond: 20,
        burstSize: 20,
      });
    });

    it('should use correct rate limits for web', () => {
      expect(PLATFORM_RATE_LIMITS.web).toEqual({
        requestsPerSecond: 100,
        burstSize: 100,
      });
    });

    it('should use correct rate limits for api', () => {
      expect(PLATFORM_RATE_LIMITS.api).toEqual({
        requestsPerSecond: 100,
        burstSize: 100,
      });
    });
  });

  describe('edge cases', () => {
    it('should handle rapid sequential checkLimit calls without recordRequest', () => {
      // checkLimit alone should not consume tokens
      for (let i = 0; i < 100; i++) {
        const result = limiter.checkLimit('telegram', 'chat-1');
        expect(result.ok).toBe(true);
      }
    });

    it('should handle max platform with burst size of 20', () => {
      const burstSize = PLATFORM_RATE_LIMITS.max.burstSize; // 20

      for (let i = 0; i < burstSize; i++) {
        const result = limiter.checkLimit('max', 'chat-1');
        expect(result.ok).toBe(true);
        limiter.recordRequest('max', 'chat-1');
      }

      // Should be denied now
      expect(limiter.checkLimit('max', 'chat-1').ok).toBe(false);
    });

    it('should handle time advancing in very small increments', () => {
      const burstSize = PLATFORM_RATE_LIMITS.telegram.burstSize;

      // Exhaust all tokens
      for (let i = 0; i < burstSize; i++) {
        limiter.checkLimit('telegram', 'chat-1');
        limiter.recordRequest('telegram', 'chat-1');
      }

      // Advance by 10ms = 0.01s * 30 rps = 0.3 tokens (not enough for 1)
      vi.advanceTimersByTime(10);

      // Should still be denied (less than 1 token refilled)
      expect(limiter.checkLimit('telegram', 'chat-1').ok).toBe(false);

      // Advance by another 25ms = total 35ms = 0.035s * 30 = 1.05 tokens
      vi.advanceTimersByTime(25);

      // Should now be allowed (just over 1 token)
      expect(limiter.checkLimit('telegram', 'chat-1').ok).toBe(true);
    });
  });
});
