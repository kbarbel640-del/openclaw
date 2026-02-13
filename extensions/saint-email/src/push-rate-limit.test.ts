import { describe, expect, it } from "vitest";

/**
 * Tests the rate limiting logic from Fix #13 (push endpoint).
 *
 * The rate limiter in index.ts uses a simple timestamp-based approach:
 *   const now = Date.now();
 *   if (now - lastPushTime < PUSH_MIN_INTERVAL_MS) { return 429; }
 *   lastPushTime = now;
 *
 * Since this is module-level state, we test the algorithm directly.
 * Note: lastPushTime starts at 0 and Date.now() returns a large value,
 * so the first real push always passes. We use realistic timestamps.
 */
describe("push endpoint rate limiter (Fix #13)", () => {
  const PUSH_MIN_INTERVAL_MS = 10_000;

  function createRateLimiter() {
    let lastPushTime = 0;
    return {
      tryPush: (now: number): { allowed: boolean } => {
        if (now - lastPushTime < PUSH_MIN_INTERVAL_MS) {
          return { allowed: false };
        }
        lastPushTime = now;
        return { allowed: true };
      },
    };
  }

  it("allows the first push (realistic timestamp)", () => {
    const limiter = createRateLimiter();
    // Date.now() is always >> 10_000, so first push always passes
    expect(limiter.tryPush(1_700_000_000_000).allowed).toBe(true);
  });

  it("blocks a push within the interval", () => {
    const limiter = createRateLimiter();
    const t0 = 1_700_000_000_000;
    expect(limiter.tryPush(t0).allowed).toBe(true);
    expect(limiter.tryPush(t0 + 5_000).allowed).toBe(false); // 5s < 10s
  });

  it("allows a push after the interval expires", () => {
    const limiter = createRateLimiter();
    const t0 = 1_700_000_000_000;
    expect(limiter.tryPush(t0).allowed).toBe(true);
    expect(limiter.tryPush(t0 + 10_001).allowed).toBe(true); // 10.001s > 10s
  });

  it("blocks rapid successive pushes", () => {
    const limiter = createRateLimiter();
    const t0 = 1_700_000_000_000;
    expect(limiter.tryPush(t0).allowed).toBe(true);
    expect(limiter.tryPush(t0 + 1).allowed).toBe(false);
    expect(limiter.tryPush(t0 + 2).allowed).toBe(false);
    expect(limiter.tryPush(t0 + 3).allowed).toBe(false);
  });

  it("resets the window after each successful push", () => {
    const limiter = createRateLimiter();
    const t0 = 1_700_000_000_000;
    expect(limiter.tryPush(t0).allowed).toBe(true);
    expect(limiter.tryPush(t0 + 10_001).allowed).toBe(true); // reset window
    expect(limiter.tryPush(t0 + 15_000).allowed).toBe(false); // 4.999s since last
    expect(limiter.tryPush(t0 + 20_002).allowed).toBe(true); // 10.001s since last
  });
});
