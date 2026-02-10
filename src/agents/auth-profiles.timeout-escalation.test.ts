import { describe, expect, it } from "vitest";
import type { ProfileUsageStats } from "./auth-profiles.js";
import { computeNextProfileUsageStats } from "./auth-profiles.js";

const DEFAULT_CFG = {
  billingBackoffMs: 5 * 60 * 60 * 1000,
  billingMaxMs: 24 * 60 * 60 * 1000,
  failureWindowMs: 24 * 60 * 60 * 1000,
  timeoutEscalationThreshold: 2,
  timeoutEscalationMs: 15 * 60 * 1000, // 15 min
  timeoutEscalationMaxMs: 30 * 60 * 1000, // 30 min
};

function makeEmpty(): ProfileUsageStats {
  return {};
}

function applyTimeouts(count: number, cfg = DEFAULT_CFG): ProfileUsageStats {
  let stats = makeEmpty();
  let now = 1_000_000;
  for (let i = 0; i < count; i++) {
    stats = computeNextProfileUsageStats({
      existing: stats,
      now,
      reason: "timeout",
      cfgResolved: cfg,
    });
    now += 100_000; // advance 100s between attempts
  }
  return stats;
}

describe("timeout escalation", () => {
  it("tracks consecutiveTimeouts on repeated timeouts", () => {
    const after1 = applyTimeouts(1);
    expect(after1.consecutiveTimeouts).toBe(1);

    const after2 = applyTimeouts(2);
    expect(after2.consecutiveTimeouts).toBe(2);

    const after3 = applyTimeouts(3);
    expect(after3.consecutiveTimeouts).toBe(3);
  });

  it("uses normal cooldown before reaching escalation threshold", () => {
    const stats = applyTimeouts(1);
    // First timeout: normal backoff = 60s * 5^0 = 60s (1 min)
    expect(stats.cooldownUntil).toBeDefined();
    // With errorCount=1, normal cooldown is 60_000ms
    const cooldownDuration = stats.cooldownUntil! - stats.lastFailureAt!;
    expect(cooldownDuration).toBe(60_000);
  });

  it("applies escalated cooldown at threshold (2 consecutive timeouts)", () => {
    const stats = applyTimeouts(2);
    expect(stats.consecutiveTimeouts).toBe(2);
    const cooldownDuration = stats.cooldownUntil! - stats.lastFailureAt!;
    // At threshold: escalation kicks in → 15 min
    expect(cooldownDuration).toBe(15 * 60 * 1000);
  });

  it("applies max escalated cooldown beyond threshold", () => {
    const stats = applyTimeouts(3);
    expect(stats.consecutiveTimeouts).toBe(3);
    const cooldownDuration = stats.cooldownUntil! - stats.lastFailureAt!;
    // 1 over threshold → max escalation → 30 min
    expect(cooldownDuration).toBe(30 * 60 * 1000);
  });

  it("caps at max escalation for many consecutive timeouts", () => {
    const stats = applyTimeouts(10);
    expect(stats.consecutiveTimeouts).toBe(10);
    const cooldownDuration = stats.cooldownUntil! - stats.lastFailureAt!;
    expect(cooldownDuration).toBe(30 * 60 * 1000);
  });

  it("resets consecutiveTimeouts on non-timeout failure", () => {
    let stats = applyTimeouts(3);
    expect(stats.consecutiveTimeouts).toBe(3);

    // Now a rate_limit failure occurs
    stats = computeNextProfileUsageStats({
      existing: stats,
      now: Date.now(),
      reason: "rate_limit",
      cfgResolved: DEFAULT_CFG,
    });
    expect(stats.consecutiveTimeouts).toBe(0);
  });

  it("resets consecutiveTimeouts when failure window expires", () => {
    let stats: ProfileUsageStats = {};
    let now = 1_000_000;

    // Two timeouts
    for (let i = 0; i < 2; i++) {
      stats = computeNextProfileUsageStats({
        existing: stats,
        now,
        reason: "timeout",
        cfgResolved: DEFAULT_CFG,
      });
      now += 100_000;
    }
    expect(stats.consecutiveTimeouts).toBe(2);

    // Jump past the failure window (24h + 1ms)
    now = stats.lastFailureAt! + DEFAULT_CFG.failureWindowMs + 1;
    stats = computeNextProfileUsageStats({
      existing: stats,
      now,
      reason: "timeout",
      cfgResolved: DEFAULT_CFG,
    });
    // Window expired → consecutiveTimeouts starts fresh from 0+1=1
    expect(stats.consecutiveTimeouts).toBe(1);
    // errorCount also resets
    expect(stats.errorCount).toBe(1);
  });

  it("respects custom escalation config", () => {
    const customCfg = {
      ...DEFAULT_CFG,
      timeoutEscalationThreshold: 3,
      timeoutEscalationMs: 10 * 60 * 1000, // 10 min
      timeoutEscalationMaxMs: 60 * 60 * 1000, // 60 min
    };

    // 2 timeouts → below threshold (3), use normal cooldown
    const stats2 = applyTimeouts(2, customCfg);
    expect(stats2.consecutiveTimeouts).toBe(2);
    const duration2 = stats2.cooldownUntil! - stats2.lastFailureAt!;
    // Normal cooldown for errorCount=2: 60_000 * 5^1 = 300_000 (5 min)
    expect(duration2).toBe(5 * 60_000);

    // 3 timeouts → at threshold → escalated (10 min)
    const stats3 = applyTimeouts(3, customCfg);
    const duration3 = stats3.cooldownUntil! - stats3.lastFailureAt!;
    expect(duration3).toBe(10 * 60 * 1000);

    // 4 timeouts → above threshold → max (60 min)
    const stats4 = applyTimeouts(4, customCfg);
    const duration4 = stats4.cooldownUntil! - stats4.lastFailureAt!;
    expect(duration4).toBe(60 * 60 * 1000);
  });

  it("does not affect billing failures", () => {
    let stats = applyTimeouts(5); // 5 consecutive timeouts
    // Now a billing failure
    stats = computeNextProfileUsageStats({
      existing: stats,
      now: Date.now(),
      reason: "billing",
      cfgResolved: DEFAULT_CFG,
    });
    // Billing uses disabledUntil, not cooldownUntil escalation
    expect(stats.disabledUntil).toBeDefined();
    expect(stats.disabledReason).toBe("billing");
    // consecutiveTimeouts resets on non-timeout
    expect(stats.consecutiveTimeouts).toBe(0);
  });
});
