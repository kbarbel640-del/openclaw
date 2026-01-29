import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { createRateLimiter } from "./rate-limit.js";

describe("createRateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests within limit", () => {
    const limiter = createRateLimiter({ maxRequests: 3, windowMs: 1000 });

    const r1 = limiter.check("ip1");
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);

    const r2 = limiter.check("ip1");
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(1);

    const r3 = limiter.check("ip1");
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);

    limiter.stop();
  });

  it("blocks requests over limit", () => {
    const limiter = createRateLimiter({ maxRequests: 2, windowMs: 1000 });

    limiter.check("ip1");
    limiter.check("ip1");

    const r3 = limiter.check("ip1");
    expect(r3.allowed).toBe(false);
    expect(r3.remaining).toBe(0);
    expect(r3.resetMs).toBeLessThanOrEqual(1000);

    limiter.stop();
  });

  it("tracks different keys separately", () => {
    const limiter = createRateLimiter({ maxRequests: 1, windowMs: 1000 });

    const r1 = limiter.check("ip1");
    expect(r1.allowed).toBe(true);

    const r2 = limiter.check("ip2");
    expect(r2.allowed).toBe(true);

    const r3 = limiter.check("ip1");
    expect(r3.allowed).toBe(false);

    limiter.stop();
  });

  it("resets window after windowMs", () => {
    const limiter = createRateLimiter({ maxRequests: 1, windowMs: 1000 });

    const r1 = limiter.check("ip1");
    expect(r1.allowed).toBe(true);

    const r2 = limiter.check("ip1");
    expect(r2.allowed).toBe(false);

    // Advance time past window
    vi.advanceTimersByTime(1001);

    const r3 = limiter.check("ip1");
    expect(r3.allowed).toBe(true);

    limiter.stop();
  });

  it("reset() clears limit for key", () => {
    const limiter = createRateLimiter({ maxRequests: 1, windowMs: 1000 });

    limiter.check("ip1");
    const blocked = limiter.check("ip1");
    expect(blocked.allowed).toBe(false);

    limiter.reset("ip1");

    const afterReset = limiter.check("ip1");
    expect(afterReset.allowed).toBe(true);

    limiter.stop();
  });
});
