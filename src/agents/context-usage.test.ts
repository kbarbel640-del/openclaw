import { describe, expect, it } from "vitest";
import type { SessionEntry } from "../config/sessions/types.js";
import {
  calculateContextUsage,
  DEFAULT_CRITICAL_THRESHOLD,
  DEFAULT_WARNING_THRESHOLD,
  getSessionContextUsage,
} from "./context-usage.js";

describe("calculateContextUsage", () => {
  it("calculates ratio and thresholds correctly", () => {
    const result = calculateContextUsage({
      totalTokens: 50_000,
      contextTokens: 100_000,
    });
    expect(result).not.toBeNull();
    expect(result!.usageRatio).toBe(0.5);
    expect(result!.usagePercent).toBe(50);
    expect(result!.isHealthy).toBe(true);
    expect(result!.isWarning).toBe(false);
    expect(result!.isCritical).toBe(false);
  });

  it("detects warning threshold (75%)", () => {
    const result = calculateContextUsage({
      totalTokens: 75_000,
      contextTokens: 100_000,
    });
    expect(result).not.toBeNull();
    expect(result!.usageRatio).toBe(0.75);
    expect(result!.usagePercent).toBe(75);
    expect(result!.isHealthy).toBe(false);
    expect(result!.isWarning).toBe(true);
    expect(result!.isCritical).toBe(false);
  });

  it("detects critical threshold (90%)", () => {
    const result = calculateContextUsage({
      totalTokens: 90_000,
      contextTokens: 100_000,
    });
    expect(result).not.toBeNull();
    expect(result!.usageRatio).toBe(0.9);
    expect(result!.usagePercent).toBe(90);
    expect(result!.isHealthy).toBe(false);
    expect(result!.isWarning).toBe(false);
    expect(result!.isCritical).toBe(true);
  });

  it("caps ratio at 1.0 when totalTokens exceeds contextTokens", () => {
    const result = calculateContextUsage({
      totalTokens: 150_000,
      contextTokens: 100_000,
    });
    expect(result).not.toBeNull();
    expect(result!.usageRatio).toBe(1.0);
    expect(result!.usagePercent).toBe(100);
    expect(result!.isCritical).toBe(true);
  });

  it("returns null when totalTokens is missing", () => {
    const result = calculateContextUsage({
      totalTokens: undefined,
      contextTokens: 100_000,
    });
    expect(result).toBeNull();
  });

  it("returns null when contextTokens is missing", () => {
    const result = calculateContextUsage({
      totalTokens: 50_000,
      contextTokens: undefined,
    });
    expect(result).toBeNull();
  });

  it("returns null when contextTokens is zero", () => {
    const result = calculateContextUsage({
      totalTokens: 50_000,
      contextTokens: 0,
    });
    expect(result).toBeNull();
  });

  it("returns null when contextTokens is negative", () => {
    const result = calculateContextUsage({
      totalTokens: 50_000,
      contextTokens: -1000,
    });
    expect(result).toBeNull();
  });

  it("returns null when totalTokens is NaN", () => {
    const result = calculateContextUsage({
      totalTokens: Number.NaN,
      contextTokens: 100_000,
    });
    expect(result).toBeNull();
  });

  it("handles zero totalTokens", () => {
    const result = calculateContextUsage({
      totalTokens: 0,
      contextTokens: 100_000,
    });
    expect(result).not.toBeNull();
    expect(result!.usageRatio).toBe(0);
    expect(result!.usagePercent).toBe(0);
    expect(result!.isHealthy).toBe(true);
  });

  it("respects custom warning threshold", () => {
    const result = calculateContextUsage({
      totalTokens: 60_000,
      contextTokens: 100_000,
      warningThreshold: 0.5,
    });
    expect(result).not.toBeNull();
    expect(result!.isHealthy).toBe(false);
    expect(result!.isWarning).toBe(true);
    expect(result!.isCritical).toBe(false);
  });

  it("respects custom critical threshold", () => {
    const result = calculateContextUsage({
      totalTokens: 80_000,
      contextTokens: 100_000,
      criticalThreshold: 0.8,
    });
    expect(result).not.toBeNull();
    expect(result!.isCritical).toBe(true);
  });

  it("exports default thresholds", () => {
    expect(DEFAULT_WARNING_THRESHOLD).toBe(0.75);
    expect(DEFAULT_CRITICAL_THRESHOLD).toBe(0.9);
  });
});

describe("getSessionContextUsage", () => {
  const makeSessionEntry = (overrides?: Partial<SessionEntry>): SessionEntry => ({
    sessionId: "test-session",
    updatedAt: Date.now(),
    ...overrides,
  });

  it("extracts usage from session entry", () => {
    const entry = makeSessionEntry({
      totalTokens: 60_000,
      contextTokens: 100_000,
    });
    const result = getSessionContextUsage({ sessionEntry: entry });
    expect(result).not.toBeNull();
    expect(result!.usageRatio).toBe(0.6);
    expect(result!.usagePercent).toBe(60);
    expect(result!.isHealthy).toBe(true);
  });

  it("returns null when sessionEntry is undefined", () => {
    const result = getSessionContextUsage({ sessionEntry: undefined });
    expect(result).toBeNull();
  });

  it("returns null when totalTokens is missing from session", () => {
    const entry = makeSessionEntry({
      totalTokens: undefined,
      contextTokens: 100_000,
    });
    const result = getSessionContextUsage({ sessionEntry: entry });
    expect(result).toBeNull();
  });

  it("falls back to config contextTokens when session lacks it", () => {
    const entry = makeSessionEntry({
      totalTokens: 60_000,
      contextTokens: undefined,
    });
    const result = getSessionContextUsage({
      sessionEntry: entry,
      config: {
        agents: { defaults: { contextTokens: 200_000 } },
      },
    });
    expect(result).not.toBeNull();
    expect(result!.contextTokens).toBe(200_000);
    expect(result!.usageRatio).toBe(0.3);
  });

  it("returns null when both session and config lack contextTokens", () => {
    const entry = makeSessionEntry({
      totalTokens: 60_000,
      contextTokens: undefined,
    });
    const result = getSessionContextUsage({
      sessionEntry: entry,
      config: undefined,
    });
    expect(result).toBeNull();
  });

  it("prefers session contextTokens over config", () => {
    const entry = makeSessionEntry({
      totalTokens: 80_000,
      contextTokens: 100_000,
    });
    const result = getSessionContextUsage({
      sessionEntry: entry,
      config: {
        agents: { defaults: { contextTokens: 200_000 } },
      },
    });
    expect(result).not.toBeNull();
    expect(result!.contextTokens).toBe(100_000);
    expect(result!.usageRatio).toBe(0.8);
  });

  it("passes through custom thresholds", () => {
    const entry = makeSessionEntry({
      totalTokens: 60_000,
      contextTokens: 100_000,
    });
    const result = getSessionContextUsage({
      sessionEntry: entry,
      warningThreshold: 0.5,
      criticalThreshold: 0.65,
    });
    expect(result).not.toBeNull();
    expect(result!.isHealthy).toBe(false);
    expect(result!.isWarning).toBe(true);
    expect(result!.isCritical).toBe(false);
  });
});
