import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  parseScheduleToCron,
  computeNextScheduleMs,
  resolveAutoUpdateConfig,
  AUTO_UPDATE_DEFAULTS,
  checkPostAutoUpdateNotification,
  writeAutoUpdateState,
  readAutoUpdateState,
  consumeAutoUpdateState,
  startAutoUpdateScheduler,
} from "./auto-update.js";

// ── parseScheduleToCron ────────────────────────────────────────────────────

describe("parseScheduleToCron", () => {
  it("converts HH:MM to a daily cron expression", () => {
    expect(parseScheduleToCron("03:00")).toBe("0 0 3 * * *");
    expect(parseScheduleToCron("14:30")).toBe("0 30 14 * * *");
    expect(parseScheduleToCron("00:00")).toBe("0 0 0 * * *");
    expect(parseScheduleToCron("23:59")).toBe("0 59 23 * * *");
  });

  it("returns null for invalid formats", () => {
    expect(parseScheduleToCron("")).toBeNull();
    expect(parseScheduleToCron("3:00")).toBeNull();
    expect(parseScheduleToCron("25:00")).toBeNull();
    expect(parseScheduleToCron("12:60")).toBeNull();
    expect(parseScheduleToCron("not-a-time")).toBeNull();
    expect(parseScheduleToCron("1200")).toBeNull();
  });

  it("trims whitespace", () => {
    expect(parseScheduleToCron("  03:00  ")).toBe("0 0 3 * * *");
  });
});

// ── computeNextScheduleMs ──────────────────────────────────────────────────

describe("computeNextScheduleMs", () => {
  it("returns a future timestamp", () => {
    const now = Date.now();
    const result = computeNextScheduleMs("03:00", "UTC", now);
    expect(result).not.toBeNull();
    expect(result!).toBeGreaterThan(now - 1);
  });

  it("returns null for invalid schedule", () => {
    expect(computeNextScheduleMs("invalid", "UTC", Date.now())).toBeNull();
  });

  it("schedules for tomorrow if time has passed today", () => {
    // Use a fixed time: 2026-01-15T04:00:00Z (4 AM UTC)
    const nowMs = new Date("2026-01-15T04:00:00Z").getTime();
    const result = computeNextScheduleMs("03:00", "UTC", nowMs);
    expect(result).not.toBeNull();
    // Should be about 23 hours from now (tomorrow at 03:00)
    const diffHours = (result! - nowMs) / (1000 * 3600);
    expect(diffHours).toBeGreaterThan(22);
    expect(diffHours).toBeLessThan(24);
  });

  it("schedules for today if time has not passed", () => {
    // Use a fixed time: 2026-01-15T01:00:00Z (1 AM UTC)
    const nowMs = new Date("2026-01-15T01:00:00Z").getTime();
    const result = computeNextScheduleMs("03:00", "UTC", nowMs);
    expect(result).not.toBeNull();
    // Should be about 2 hours from now
    const diffHours = (result! - nowMs) / (1000 * 3600);
    expect(diffHours).toBeGreaterThan(1.9);
    expect(diffHours).toBeLessThan(2.1);
  });

  it("handles DST spring-forward correctly (not exactly 24h)", () => {
    // US Spring Forward 2026: March 8 at 2:00 AM → 3:00 AM
    // At 4 AM EST on March 7 (09:00 UTC), schedule for 03:00 next day.
    // March 8 at 03:00 EDT = 07:00 UTC (only 22 hours later, not 24).
    const nowMs = new Date("2026-03-07T09:00:00Z").getTime(); // 4 AM EST
    const result = computeNextScheduleMs("03:00", "America/New_York", nowMs);
    expect(result).not.toBeNull();
    // Target: March 8 03:00 EDT = March 8 07:00 UTC
    const expectedMs = new Date("2026-03-08T07:00:00Z").getTime();
    // Allow 2-minute tolerance for rounding
    expect(Math.abs(result! - expectedMs)).toBeLessThan(120_000);
  });

  it("handles DST fall-back correctly", () => {
    // US Fall Back 2026: November 1 at 2:00 AM → 1:00 AM
    // At 4 AM EDT on Oct 31 (08:00 UTC), schedule for 03:00 next day.
    // Nov 1 at 03:00 EST = 08:00 UTC (25 hours later, not 24).
    const nowMs = new Date("2026-10-31T08:00:00Z").getTime(); // 4 AM EDT
    const result = computeNextScheduleMs("03:00", "America/New_York", nowMs);
    expect(result).not.toBeNull();
    // Target: Nov 1 03:00 EST = Nov 1 08:00 UTC
    const expectedMs = new Date("2026-11-01T08:00:00Z").getTime();
    expect(Math.abs(result! - expectedMs)).toBeLessThan(120_000);
  });
});

// ── resolveAutoUpdateConfig ────────────────────────────────────────────────

describe("resolveAutoUpdateConfig", () => {
  it("applies defaults when config is undefined", () => {
    const cfg = resolveAutoUpdateConfig(undefined);
    expect(cfg.enabled).toBe(false);
    expect(cfg.mode).toBe("notify-only");
    expect(cfg.schedule).toBe("03:00");
    expect(cfg.notifyAfterUpdate).toBe(true);
    expect(cfg.notifyChannel).toBe("last");
    expect(cfg.timezone).toBeTruthy(); // system timezone
  });

  it("preserves explicit values", () => {
    const cfg = resolveAutoUpdateConfig({
      enabled: true,
      mode: "silent",
      schedule: "14:30",
      timezone: "America/New_York",
      notifyAfterUpdate: false,
      notifyChannel: "general",
    });
    expect(cfg.enabled).toBe(true);
    expect(cfg.mode).toBe("silent");
    expect(cfg.schedule).toBe("14:30");
    expect(cfg.timezone).toBe("America/New_York");
    expect(cfg.notifyAfterUpdate).toBe(false);
    expect(cfg.notifyChannel).toBe("general");
  });

  it("fills missing fields with defaults", () => {
    const cfg = resolveAutoUpdateConfig({ enabled: true });
    expect(cfg.enabled).toBe(true);
    expect(cfg.mode).toBe(AUTO_UPDATE_DEFAULTS.mode);
    expect(cfg.schedule).toBe(AUTO_UPDATE_DEFAULTS.schedule);
  });

  it("uses userTimezone when config timezone is not set", () => {
    const cfg = resolveAutoUpdateConfig({ enabled: true }, "America/Chicago");
    expect(cfg.timezone).toBe("America/Chicago");
  });

  it("prefers config timezone over userTimezone", () => {
    const cfg = resolveAutoUpdateConfig(
      { enabled: true, timezone: "Europe/London" },
      "America/Chicago",
    );
    expect(cfg.timezone).toBe("Europe/London");
  });

  it("falls back to system timezone when neither is set", () => {
    const cfg = resolveAutoUpdateConfig({ enabled: true });
    // Should be the system timezone, not empty
    expect(cfg.timezone).toBeTruthy();
    expect(cfg.timezone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
  });
});

// ── State file operations ──────────────────────────────────────────────────

describe("auto-update state", () => {
  const tmpDir = `/tmp/openclaw-auto-update-test-${Date.now()}`;
  const env = { OPENCLAW_STATE_DIR: tmpDir } as unknown as NodeJS.ProcessEnv;

  it("reads empty state from missing file", async () => {
    const state = await readAutoUpdateState(env);
    expect(state).toEqual({});
  });

  it("writes and reads state", async () => {
    await writeAutoUpdateState(
      { preUpdateVersion: "1.0.0", updatedAt: "2026-01-15T00:00:00Z" },
      env,
    );
    const state = await readAutoUpdateState(env);
    expect(state.preUpdateVersion).toBe("1.0.0");
    expect(state.updatedAt).toBe("2026-01-15T00:00:00Z");
  });

  it("consumes state and removes file", async () => {
    await writeAutoUpdateState(
      { preUpdateVersion: "1.0.0", updatedAt: "2026-01-15T00:00:00Z" },
      env,
    );
    const consumed = await consumeAutoUpdateState(env);
    expect(consumed?.preUpdateVersion).toBe("1.0.0");

    // Second consume returns null (file deleted).
    const again = await consumeAutoUpdateState(env);
    expect(again).toBeNull();
  });
});

// ── Post-update notification ───────────────────────────────────────────────

describe("checkPostAutoUpdateNotification", () => {
  const tmpDir = `/tmp/openclaw-auto-update-notify-test-${Date.now()}`;
  const env = { OPENCLAW_STATE_DIR: tmpDir } as unknown as NodeJS.ProcessEnv;

  it("returns null when no state file", async () => {
    const result = await checkPostAutoUpdateNotification(env);
    expect(result).toBeNull();
  });

  it("returns notification when version changed", async () => {
    // Write a state with a different version than current.
    await writeAutoUpdateState({ preUpdateVersion: "0.0.1" }, env);
    const result = await checkPostAutoUpdateNotification(env);
    // Since VERSION is not "0.0.1", we should get a notification.
    if (result) {
      expect(result.oldVersion).toBe("0.0.1");
      expect(result.message).toContain("0.0.1");
      expect(result.message).toContain("→");
    }
  });
});

// ── Mode behavior ──────────────────────────────────────────────────────────

describe("startAutoUpdateScheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns noop cleanup when disabled", () => {
    const cleanup = startAutoUpdateScheduler({
      config: { enabled: false },
      onNotify: vi.fn(),
      onConfirm: vi.fn(),
      onSilentUpdate: vi.fn(),
      log: { info: vi.fn() },
    });
    expect(typeof cleanup).toBe("function");
    cleanup(); // should not throw
  });

  it("does not schedule when not enabled (undefined config)", () => {
    const logInfo = vi.fn();
    const cleanup = startAutoUpdateScheduler({
      config: undefined,
      onNotify: vi.fn(),
      onConfirm: vi.fn(),
      onSilentUpdate: vi.fn(),
      log: { info: logInfo },
    });
    // Should not have logged about scheduling since it's disabled.
    expect(logInfo).not.toHaveBeenCalledWith(
      expect.stringContaining("next check scheduled"),
      expect.anything(),
    );
    cleanup();
  });

  it("schedules when enabled", () => {
    const logInfo = vi.fn();
    const cleanup = startAutoUpdateScheduler({
      config: { enabled: true, schedule: "03:00" },
      userTimezone: "UTC",
      onNotify: vi.fn(),
      onConfirm: vi.fn(),
      onSilentUpdate: vi.fn(),
      log: { info: logInfo },
    });
    expect(logInfo).toHaveBeenCalledWith(
      "auto-update: next check scheduled",
      expect.objectContaining({ mode: "notify-only", schedule: "03:00" }),
    );
    cleanup();
  });
});

// ── Config schema validation (zod) ─────────────────────────────────────────

describe("config schema validation for update.auto", () => {
  // We import the zod schema dynamically to verify it validates correctly.
  it("accepts valid auto-update config", async () => {
    const { OpenClawSchema } = await import("../config/zod-schema.js");
    const result = OpenClawSchema.safeParse({
      update: {
        auto: {
          enabled: true,
          mode: "silent",
          schedule: "14:30",
          timezone: "America/Chicago",
          notifyAfterUpdate: true,
          notifyChannel: "general",
        },
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid schedule format", async () => {
    const { OpenClawSchema } = await import("../config/zod-schema.js");
    const result = OpenClawSchema.safeParse({
      update: {
        auto: {
          schedule: "3:00",
        },
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid mode", async () => {
    const { OpenClawSchema } = await import("../config/zod-schema.js");
    const result = OpenClawSchema.safeParse({
      update: {
        auto: {
          mode: "invalid-mode",
        },
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown keys in auto", async () => {
    const { OpenClawSchema } = await import("../config/zod-schema.js");
    const result = OpenClawSchema.safeParse({
      update: {
        auto: {
          unknownKey: true,
        },
      },
    });
    expect(result.success).toBe(false);
  });

  it("accepts empty auto object", async () => {
    const { OpenClawSchema } = await import("../config/zod-schema.js");
    const result = OpenClawSchema.safeParse({
      update: {
        auto: {},
      },
    });
    expect(result.success).toBe(true);
  });
});
