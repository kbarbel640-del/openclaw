import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RateLimiter } from "./rate-limit.js";

describe("RateLimiter", () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    limiter?.destroy();
    vi.useRealTimers();
  });

  it("allows requests within the limit", () => {
    limiter = new RateLimiter({ maxRequests: 3, windowMs: 1000 });
    expect(limiter.check("1.2.3.4")).toBe(true);
    expect(limiter.check("1.2.3.4")).toBe(true);
    expect(limiter.check("1.2.3.4")).toBe(true);
  });

  it("blocks requests over the limit", () => {
    limiter = new RateLimiter({ maxRequests: 2, windowMs: 1000 });
    expect(limiter.check("1.2.3.4")).toBe(true);
    expect(limiter.check("1.2.3.4")).toBe(true);
    expect(limiter.check("1.2.3.4")).toBe(false);
  });

  it("resets after the window expires", () => {
    limiter = new RateLimiter({ maxRequests: 1, windowMs: 1000 });
    expect(limiter.check("1.2.3.4")).toBe(true);
    expect(limiter.check("1.2.3.4")).toBe(false);

    vi.advanceTimersByTime(1001);

    expect(limiter.check("1.2.3.4")).toBe(true);
  });

  it("exempts loopback IPs", () => {
    limiter = new RateLimiter({ maxRequests: 1, windowMs: 1000 });
    expect(limiter.check("127.0.0.1")).toBe(true);
    expect(limiter.check("127.0.0.1")).toBe(true);
    expect(limiter.check("127.0.0.1")).toBe(true);

    expect(limiter.check("::1")).toBe(true);
    expect(limiter.check("::1")).toBe(true);

    expect(limiter.check("::ffff:127.0.0.1")).toBe(true);
    expect(limiter.check("::ffff:127.0.0.1")).toBe(true);
  });

  it("tracks IPs independently", () => {
    limiter = new RateLimiter({ maxRequests: 1, windowMs: 1000 });
    expect(limiter.check("1.2.3.4")).toBe(true);
    expect(limiter.check("5.6.7.8")).toBe(true);
    expect(limiter.check("1.2.3.4")).toBe(false);
    expect(limiter.check("5.6.7.8")).toBe(false);
  });

  it("evicts oldest entry when maxTrackedIps is exceeded", () => {
    limiter = new RateLimiter({ maxRequests: 10, windowMs: 60000, maxTrackedIps: 2 });
    limiter.check("1.1.1.1");
    limiter.check("2.2.2.2");
    expect(limiter.size).toBe(2);

    limiter.check("3.3.3.3");
    expect(limiter.size).toBe(2);
  });

  it("sendRateLimited sends 429 with Retry-After", () => {
    limiter = new RateLimiter({ windowMs: 30000 });
    const headers: Record<string, string> = {};
    const endFn = vi.fn();
    const res = {
      setHeader: (k: string, v: string) => {
        headers[k] = v;
      },
      statusCode: 0,
      end: endFn,
    } as unknown as import("node:http").ServerResponse;

    limiter.sendRateLimited(res);

    expect(res.statusCode).toBe(429);
    expect(headers["Retry-After"]).toBe("30");
    expect(endFn).toHaveBeenCalledWith("Too Many Requests");
  });

  it("prunes expired entries", () => {
    limiter = new RateLimiter({ maxRequests: 10, windowMs: 1000 });
    limiter.check("1.1.1.1");
    limiter.check("2.2.2.2");
    expect(limiter.size).toBe(2);

    vi.advanceTimersByTime(61_000);

    // After prune interval fires, expired entries are removed
    expect(limiter.size).toBe(0);
  });
});
