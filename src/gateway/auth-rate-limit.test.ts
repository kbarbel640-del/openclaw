import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthRateLimiter } from "./auth-rate-limit.js";

describe("AuthRateLimiter", () => {
  let limiter: AuthRateLimiter;

  beforeEach(() => {
    vi.useFakeTimers();
    limiter = new AuthRateLimiter();
  });

  afterEach(() => {
    limiter.close();
    vi.useRealTimers();
  });

  it("allows requests with no prior failures", () => {
    expect(limiter.check("1.2.3.4")).toBe(false);
  });

  it("allows requests below the failure threshold", () => {
    for (let i = 0; i < 4; i++) {
      limiter.recordFailure("1.2.3.4");
    }
    expect(limiter.check("1.2.3.4")).toBe(false);
  });

  it("blocks after reaching the failure threshold", () => {
    for (let i = 0; i < 5; i++) {
      limiter.recordFailure("1.2.3.4");
    }
    expect(limiter.check("1.2.3.4")).toBe(true);
  });

  it("unblocks after the delay expires", () => {
    for (let i = 0; i < 5; i++) {
      limiter.recordFailure("1.2.3.4");
    }
    expect(limiter.check("1.2.3.4")).toBe(true);
    // First block is 1s (BASE_DELAY_MS * 2^0)
    vi.advanceTimersByTime(1_001);
    expect(limiter.check("1.2.3.4")).toBe(false);
  });

  it("applies exponential backoff on repeated failures", () => {
    // 5 failures = 1s block, 6 = 2s, 7 = 4s
    for (let i = 0; i < 7; i++) {
      limiter.recordFailure("1.2.3.4");
    }
    // Should be blocked for 4s (2^(7-5) = 4)
    vi.advanceTimersByTime(3_999);
    expect(limiter.check("1.2.3.4")).toBe(true);
    vi.advanceTimersByTime(2);
    expect(limiter.check("1.2.3.4")).toBe(false);
  });

  it("caps delay at 60s", () => {
    for (let i = 0; i < 25; i++) {
      limiter.recordFailure("1.2.3.4");
    }
    vi.advanceTimersByTime(60_001);
    expect(limiter.check("1.2.3.4")).toBe(false);
  });

  it("resets on successful auth", () => {
    for (let i = 0; i < 10; i++) {
      limiter.recordFailure("1.2.3.4");
    }
    expect(limiter.check("1.2.3.4")).toBe(true);
    limiter.recordSuccess("1.2.3.4");
    expect(limiter.check("1.2.3.4")).toBe(false);
  });

  it("tracks IPs independently", () => {
    for (let i = 0; i < 5; i++) {
      limiter.recordFailure("1.2.3.4");
    }
    expect(limiter.check("1.2.3.4")).toBe(true);
    expect(limiter.check("5.6.7.8")).toBe(false);
  });

  it("decays entries after 15min inactivity", () => {
    for (let i = 0; i < 5; i++) {
      limiter.recordFailure("1.2.3.4");
    }
    // Advance past decay window (15min)
    vi.advanceTimersByTime(15 * 60 * 1_000 + 1);
    expect(limiter.check("1.2.3.4")).toBe(false);
  });

  it("resets failure count after decay window", () => {
    for (let i = 0; i < 4; i++) {
      limiter.recordFailure("1.2.3.4");
    }
    vi.advanceTimersByTime(15 * 60 * 1_000 + 1);
    // After decay, one more failure should not block (starts fresh)
    limiter.recordFailure("1.2.3.4");
    expect(limiter.check("1.2.3.4")).toBe(false);
  });
});
