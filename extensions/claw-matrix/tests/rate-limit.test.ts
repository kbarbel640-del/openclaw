/**
 * Tests for TokenBucket rate limiter.
 */
import { describe, it, expect } from "vitest";
import { TokenBucket } from "../src/util/rate-limit.js";

describe("TokenBucket", () => {
  describe("constructor defaults", () => {
    it("should start with full tokens", async () => {
      const bucket = new TokenBucket(3, 1);
      // Should be able to acquire 3 tokens immediately without waiting
      const start = Date.now();
      await bucket.acquire();
      await bucket.acquire();
      await bucket.acquire();
      const elapsed = Date.now() - start;
      // All 3 should be near-instant (well under 100ms)
      expect(elapsed < 100).toBeTruthy();
    });
  });

  describe("token acquisition", () => {
    it("should allow immediate acquire when tokens available", async () => {
      const bucket = new TokenBucket(5, 1);
      const start = Date.now();
      await bucket.acquire();
      const elapsed = Date.now() - start;
      expect(elapsed < 50).toBeTruthy();
    });

    it("should wait when no tokens available", async () => {
      // 1 token, 10 tokens/sec refill so wait is ~100ms
      const bucket = new TokenBucket(1, 10);
      await bucket.acquire(); // use the one token
      const start = Date.now();
      await bucket.acquire(); // should wait ~100ms for refill
      const elapsed = Date.now() - start;
      expect(elapsed >= 50).toBeTruthy();
      expect(elapsed < 500).toBeTruthy();
    });
  });

  describe("burst capacity", () => {
    it("should allow burst up to maxTokens", async () => {
      const bucket = new TokenBucket(5, 1);
      const start = Date.now();
      for (let i = 0; i < 5; i++) {
        await bucket.acquire();
      }
      const elapsed = Date.now() - start;
      expect(elapsed < 100).toBeTruthy();
    });

    it("should block after burst exhausted", async () => {
      const bucket = new TokenBucket(2, 10);
      await bucket.acquire();
      await bucket.acquire();
      // Now empty — next acquire should wait
      const start = Date.now();
      await bucket.acquire();
      const elapsed = Date.now() - start;
      expect(elapsed >= 50).toBeTruthy();
    });
  });

  describe("refill timing", () => {
    it("should refill tokens over time", async () => {
      const bucket = new TokenBucket(2, 20); // 20 tokens/sec = 1 token per 50ms
      await bucket.acquire();
      await bucket.acquire();
      // Wait for refill
      await new Promise((r) => setTimeout(r, 120));
      // Should have refilled ~2 tokens
      const start = Date.now();
      await bucket.acquire();
      const elapsed = Date.now() - start;
      expect(elapsed < 50).toBeTruthy();
    });

    it("should not exceed maxTokens on refill", async () => {
      const bucket = new TokenBucket(2, 100); // Fast refill
      // Wait a long time relative to refill rate
      await new Promise((r) => setTimeout(r, 200));
      // Should still only have 2 tokens (maxTokens = 2)
      const start = Date.now();
      await bucket.acquire();
      await bucket.acquire();
      const burst2 = Date.now() - start;
      expect(burst2 < 50).toBeTruthy();

      // Third should require waiting (only 2 max)
      const start2 = Date.now();
      await bucket.acquire();
      const wait = Date.now() - start2;
      expect(wait >= 5).toBeTruthy();
    });
  });

  describe("concurrent acquire", () => {
    it("should handle multiple concurrent acquires", async () => {
      const bucket = new TokenBucket(3, 10);
      // Fire 3 concurrent acquires — all should succeed from burst
      const results = await Promise.all([bucket.acquire(), bucket.acquire(), bucket.acquire()]);
      expect(results.length).toBe(3);
    });

    it("should serialize waiting for concurrent acquires beyond burst", async () => {
      const bucket = new TokenBucket(2, 10);
      // Fire 4 concurrent: 2 burst + 2 waiting
      const start = Date.now();
      await Promise.all([bucket.acquire(), bucket.acquire(), bucket.acquire(), bucket.acquire()]);
      const elapsed = Date.now() - start;
      // At least some waiting should have occurred
      expect(elapsed >= 50).toBeTruthy();
    });
  });
});
