import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CronService } from "./service.js";

const noopLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

async function makeStorePath() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-cron-14761-"));
  return {
    storePath: path.join(dir, "cron", "jobs.json"),
    cleanup: async () => {
      await fs.rm(dir, { recursive: true, force: true });
    },
  };
}

describe("#14761 – every-type nextRunAtMs should not drift", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-12-13T00:00:00.000Z"));
    noopLogger.debug.mockClear();
    noopLogger.info.mockClear();
    noopLogger.warn.mockClear();
    noopLogger.error.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calculates nextRunAtMs from lastRunAtMs, not wall-clock end time", async () => {
    const store = await makeStorePath();
    const baseTime = Date.parse("2025-12-13T00:00:00.000Z");
    const EXECUTION_MS = 3_000;

    const cron = new CronService({
      storePath: store.storePath,
      cronEnabled: true,
      log: noopLogger,
      enqueueSystemEvent: vi.fn(),
      requestHeartbeatNow: vi.fn(),
      runIsolatedAgentJob: vi.fn(async () => {
        // Simulate execution taking 3 seconds
        vi.setSystemTime(new Date(Date.now() + EXECUTION_MS));
        return { status: "ok", summary: "done" };
      }),
    });

    await cron.start();
    const job = await cron.add({
      name: "every-60s",
      enabled: true,
      schedule: { kind: "every", everyMs: 60_000 },
      sessionTarget: "isolated",
      wakeMode: "next-heartbeat",
      payload: { kind: "agentTurn", message: "tick" },
    });

    // First due at baseTime + 60s
    expect(job.state.nextRunAtMs).toBe(baseTime + 60_000);

    // Advance to due time and force-run
    vi.setSystemTime(new Date(baseTime + 60_000));
    const result = await cron.run(job.id, "force");
    expect(result).toEqual({ ok: true, ran: true });

    // After execution, time is baseTime + 63_000.
    // nextRunAtMs should be baseTime + 120_000 (lastRunAtMs=60_000 + everyMs=60_000),
    // NOT baseTime + 123_000 (endedAt=63_000 + everyMs=60_000).
    const jobs = await cron.list({ includeDisabled: true });
    const updated = jobs.find((j) => j.id === job.id);
    expect(updated?.state.lastRunAtMs).toBe(baseTime + 60_000);
    expect(updated?.state.nextRunAtMs).toBe(baseTime + 120_000);

    cron.stop();
    await store.cleanup();
  });

  it("snaps forward when lastRunAtMs + everyMs is already past", async () => {
    const store = await makeStorePath();
    const baseTime = Date.parse("2025-12-13T00:00:00.000Z");

    const cron = new CronService({
      storePath: store.storePath,
      cronEnabled: true,
      log: noopLogger,
      enqueueSystemEvent: vi.fn(),
      requestHeartbeatNow: vi.fn(),
      runIsolatedAgentJob: vi.fn(async () => {
        // Simulate a very long execution: 25 seconds (> 2 full 10s intervals)
        vi.setSystemTime(new Date(Date.now() + 25_000));
        return { status: "ok", summary: "done" };
      }),
    });

    await cron.start();
    const job = await cron.add({
      name: "every-10s",
      enabled: true,
      schedule: { kind: "every", everyMs: 10_000 },
      sessionTarget: "isolated",
      wakeMode: "next-heartbeat",
      payload: { kind: "agentTurn", message: "tick" },
    });

    expect(job.state.nextRunAtMs).toBe(baseTime + 10_000);

    // Advance to due time and run. Execution takes 25s.
    vi.setSystemTime(new Date(baseTime + 10_000));
    await cron.run(job.id, "force");

    // Now at baseTime + 35_000.
    // lastRunAtMs = baseTime + 10_000
    // lastRunAtMs + everyMs = 20_000 → < 35_000 (snap forward)
    // 20_000 + 10_000 = 30_000 → < 35_000 (snap forward)
    // 30_000 + 10_000 = 40_000 → ≥ 35_000 ✓
    const jobs = await cron.list({ includeDisabled: true });
    const updated = jobs.find((j) => j.id === job.id);
    expect(updated?.state.nextRunAtMs).toBe(baseTime + 40_000);

    cron.stop();
    await store.cleanup();
  });

  it("does not accumulate drift over multiple sequential runs", async () => {
    const store = await makeStorePath();
    const baseTime = Date.parse("2025-12-13T00:00:00.000Z");
    const EXECUTION_MS = 2_000;

    const cron = new CronService({
      storePath: store.storePath,
      cronEnabled: true,
      log: noopLogger,
      enqueueSystemEvent: vi.fn(),
      requestHeartbeatNow: vi.fn(),
      runIsolatedAgentJob: vi.fn(async () => {
        // Each execution takes 2 seconds
        vi.setSystemTime(new Date(Date.now() + EXECUTION_MS));
        return { status: "ok", summary: "done" };
      }),
    });

    await cron.start();
    const job = await cron.add({
      name: "every-60s-no-drift",
      enabled: true,
      schedule: { kind: "every", everyMs: 60_000 },
      sessionTarget: "isolated",
      wakeMode: "next-heartbeat",
      payload: { kind: "agentTurn", message: "tick" },
    });

    // Simulate 5 sequential runs, each taking 2 seconds.
    // Without the fix, drift would accumulate: 5 × 2s = 10s total drift.
    for (let i = 1; i <= 5; i++) {
      const dueAt = baseTime + i * 60_000;
      vi.setSystemTime(new Date(dueAt));
      const res = await cron.run(job.id, "force");
      expect(res).toEqual({ ok: true, ran: true });
    }

    // After 5 runs (each at N*60s, each taking 2s), the final state should
    // have nextRunAtMs = baseTime + 6*60_000, with zero accumulated drift.
    const jobs = await cron.list({ includeDisabled: true });
    const final = jobs.find((j) => j.id === job.id);
    expect(final?.state.nextRunAtMs).toBe(baseTime + 6 * 60_000);

    cron.stop();
    await store.cleanup();
  });

  it("preserves wall-clock computation for non-every (cron expr) jobs", async () => {
    const store = await makeStorePath();
    const enqueueSystemEvent = vi.fn();
    const requestHeartbeatNow = vi.fn();

    vi.setSystemTime(new Date("2025-12-13T00:00:59.000Z"));

    const cron = new CronService({
      storePath: store.storePath,
      cronEnabled: true,
      log: noopLogger,
      enqueueSystemEvent,
      requestHeartbeatNow,
      runIsolatedAgentJob: vi.fn(async () => ({ status: "ok" })),
    });

    await cron.start();
    const job = await cron.add({
      name: "cron-expr",
      enabled: true,
      schedule: { kind: "cron", expr: "* * * * *" },
      sessionTarget: "main",
      wakeMode: "next-heartbeat",
      payload: { kind: "systemEvent", text: "cron-tick" },
    });

    const firstDueAt = job.state.nextRunAtMs!;
    vi.setSystemTime(new Date(firstDueAt + 5));
    await cron.run(job.id, "force");

    const jobs = await cron.list({ includeDisabled: true });
    const updated = jobs.find((j) => j.id === job.id);
    // cron-expr jobs should still use the normal computation
    expect(updated?.state.nextRunAtMs).toBe(firstDueAt + 60_000);

    cron.stop();
    await store.cleanup();
  });

  it("applies error backoff correctly with lastRunAtMs-based next run", async () => {
    const store = await makeStorePath();
    const baseTime = Date.parse("2025-12-13T00:00:00.000Z");
    const EXECUTION_MS = 3_000;

    const cron = new CronService({
      storePath: store.storePath,
      cronEnabled: true,
      log: noopLogger,
      enqueueSystemEvent: vi.fn(),
      requestHeartbeatNow: vi.fn(),
      runIsolatedAgentJob: vi.fn(async () => {
        vi.setSystemTime(new Date(Date.now() + EXECUTION_MS));
        return { status: "error", error: "test error" };
      }),
    });

    await cron.start();
    const job = await cron.add({
      name: "every-60s-erroring",
      enabled: true,
      schedule: { kind: "every", everyMs: 60_000 },
      sessionTarget: "isolated",
      wakeMode: "next-heartbeat",
      payload: { kind: "agentTurn", message: "tick" },
    });

    vi.setSystemTime(new Date(baseTime + 60_000));
    await cron.run(job.id, "force");

    const jobs = await cron.list({ includeDisabled: true });
    const updated = jobs.find((j) => j.id === job.id);
    expect(updated?.state.lastStatus).toBe("error");
    // The next run should be at least lastRunAtMs + everyMs (= 120_000),
    // but also at least endedAt + backoff (= 63_000 + 30_000 = 93_000).
    // Since 120_000 > 93_000, it should be 120_000.
    expect(updated?.state.nextRunAtMs).toBe(baseTime + 120_000);

    cron.stop();
    await store.cleanup();
  });
});
