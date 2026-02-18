/**
 * Performance optimization integration tests
 */

import { describe, expect, it } from "vitest";
import { LRUCache } from "./lru-cache.js";
import { memoize, memoizeAsync } from "./memoize.js";
import { shallowClone } from "./clone.js";

describe("Performance Optimization Modules", () => {
  describe("LRUCache Performance", () => {
    it("should handle high-frequency access patterns", () => {
      const cache = new LRUCache<number>({ maxSize: 1000 });
      const iterations = 10000;

      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        cache.set(`key-${i % 1000}`, i);
        cache.get(`key-${i % 500}`);
      }
      const duration = performance.now() - start;

      console.log(`LRUCache: ${iterations} operations in ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(100);
    });

    it("should efficiently evict old entries under load", () => {
      const cache = new LRUCache<string>({ maxSize: 100 });

      for (let i = 0; i < 10000; i++) {
        cache.set(`key-${i}`, `value-${i}`);
      }

      expect(cache.size()).toBeLessThanOrEqual(100);
    });
  });

  describe("Memoization Performance", () => {
    it("should cache expensive computations", () => {
      let callCount = 0;
      const expensiveFn = (n: number) => {
        callCount++;
        let result = 0;
        for (let i = 0; i < 1000; i++) {
          result += Math.sqrt(i);
        }
        return result + n;
      };

      const memoized = memoize(expensiveFn, { maxSize: 100 });

      memoized(42);
      memoized(42);
      memoized(42);

      expect(callCount).toBe(1);
    });

    it("should handle concurrent async calls efficiently", async () => {
      let callCount = 0;
      const asyncFn = async (n: number) => {
        callCount++;
        await new Promise((r) => setTimeout(r, 10));
        return n * 2;
      };

      const memoized = memoizeAsync(asyncFn);

      const results = await Promise.all([
        memoized(1),
        memoized(1),
        memoized(1),
      ]);

      expect(callCount).toBe(1);
      expect(results).toEqual([2, 2, 2]);
    });
  });

  describe("Shallow Clone Performance", () => {
    it("should be significantly faster than structuredClone", () => {
      const data = {
        session: {
          id: "test-session",
          messages: Array.from({ length: 100 }, (_, i) => ({
            id: `msg-${i}`,
            content: `Message ${i}`,
            timestamp: Date.now(),
          })),
        },
      };

      const iterations = 1000;

      const structuredStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        structuredClone(data);
      }
      const structuredTime = performance.now() - structuredStart;

      const shallowStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        shallowClone(data);
      }
      const shallowTime = performance.now() - shallowStart;

      const speedup = structuredTime / shallowTime;
      console.log(`Speedup: ${speedup.toFixed(0)}x (structured: ${structuredTime.toFixed(2)}ms, shallow: ${shallowTime.toFixed(2)}ms)`);

      expect(speedup).toBeGreaterThan(100);
    });
  });

  describe("Integration: Cache with Session Store Pattern", () => {
    it("should demonstrate real-world session caching pattern", () => {
      type SessionEntry = {
        id: string;
        messages: Array<{ role: string; content: string }>;
        metadata: Record<string, unknown>;
      };

      const sessionCache = new LRUCache<SessionEntry>({
        maxSize: 100,
        ttlMs: 60000,
      });

      const sessions: SessionEntry[] = Array.from({ length: 50 }, (_, i) => ({
        id: `session-${i}`,
        messages: Array.from({ length: 20 }, (_, j) => ({
          role: j % 2 === 0 ? "user" : "assistant",
          content: `Message ${j} in session ${i}`,
        })),
        metadata: { created: Date.now() },
      }));

      const start = performance.now();
      for (const session of sessions) {
        sessionCache.set(session.id, session);
      }
      for (let i = 0; i < 10; i++) {
        for (const session of sessions) {
          sessionCache.get(session.id);
        }
      }
      const duration = performance.now() - start;

      console.log(`Session cache: 500 ops in ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(50);
    });
  });
});
