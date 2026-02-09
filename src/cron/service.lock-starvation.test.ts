import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CronServiceDeps } from "./service/state.js";
import { CronService } from "./service.js";
import { onTimer } from "./service/timer.js";

const noopLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

async function makeStorePath() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-cron-lock-"));
  const storePath = path.join(dir, "cron", "jobs.json");
  return {
    storePath,
    cleanup: async () => {
      await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
    },
  };
}

function makeDeps(storePath: string, overrides: Partial<CronServiceDeps> = {}): CronServiceDeps {
  return {
    storePath,
    cronEnabled: true,
    log: noopLogger,
    enqueueSystemEvent: vi.fn(),
    requestHeartbeatNow: vi.fn(),
    runIsolatedAgentJob: vi.fn(async () => ({ status: "ok" as const, summary: "done" })),
    ...overrides,
  };
}

/** Race a promise against a timeout. Returns "resolved" or "timeout". */
function raceTimeout<T>(
  promise: Promise<T>,
  ms: number,
): Promise<{ kind: "resolved"; value: T } | { kind: "timeout" }> {
  return Promise.race([
    promise.then((value) => ({ kind: "resolved" as const, value })),
    new Promise<{ kind: "timeout" }>((resolve) =>
      setTimeout(() => resolve({ kind: "timeout" }), ms),
    ),
  ]);
}

describe("CronService lock starvation (BUG-026)", () => {
  let store: { storePath: string; cleanup: () => Promise<void> };

  // These tests use REAL timers — the lockedWithTimeout mechanism needs
  // actual setTimeout to detect when the lock is stalled.

  beforeEach(async () => {
    noopLogger.debug.mockClear();
    noopLogger.info.mockClear();
    noopLogger.warn.mockClear();
    noopLogger.error.mockClear();
    store = await makeStorePath();
  });

  afterEach(async () => {
    await store.cleanup();
  });

  it("status() responds within 10s even when an isolated job holds the lock", async () => {
    let resolveSlowJob: (() => void) | null = null;
    const slowJobPromise = new Promise<{ status: "ok"; summary: string }>((resolve) => {
      resolveSlowJob = () => resolve({ status: "ok", summary: "done" });
    });

    const deps = makeDeps(store.storePath, {
      runIsolatedAgentJob: vi.fn(() => slowJobPromise),
    });

    const cron = new CronService(deps);
    await cron.start();

    const now = Date.now();
    await cron.add({
      name: "slow-isolated-job",
      enabled: true,
      schedule: { kind: "at", at: new Date(now - 1000).toISOString() },
      sessionTarget: "isolated",
      wakeMode: "next-heartbeat",
      payload: { kind: "agentTurn", message: "do something slow" },
    });

    // Force-run the job — this holds the lock until resolveSlowJob is called
    const jobs = await cron.list();
    const runPromise = cron.run(jobs[0].id, "force");
    await new Promise((r) => setTimeout(r, 50));

    // status() should respond within 10s (after lockedWithTimeout falls back)
    const result = await raceTimeout(cron.status(), 10_000);

    // Clean up
    resolveSlowJob!();
    await runPromise.catch(() => {});

    expect(result.kind).toBe("resolved");
    if (result.kind === "resolved") {
      expect(result.value.enabled).toBe(true);
    }

    cron.stop();
  }, 15_000);

  it("list() responds while a job is executing", async () => {
    let resolveSlowJob: (() => void) | null = null;
    const slowJobPromise = new Promise<{ status: "ok"; summary: string }>((resolve) => {
      resolveSlowJob = () => resolve({ status: "ok", summary: "done" });
    });

    const deps = makeDeps(store.storePath, {
      runIsolatedAgentJob: vi.fn(() => slowJobPromise),
    });

    const cron = new CronService(deps);
    await cron.start();

    const now = Date.now();
    await cron.add({
      name: "slow-job",
      enabled: true,
      schedule: { kind: "at", at: new Date(now - 1000).toISOString() },
      sessionTarget: "isolated",
      wakeMode: "next-heartbeat",
      payload: { kind: "agentTurn", message: "do something" },
    });

    // Force-run to hold the lock
    const jobs = await cron.list();
    const runPromise = cron.run(jobs[0].id, "force");
    await new Promise((r) => setTimeout(r, 50));

    // list() should fall back after timeout
    const result = await raceTimeout(cron.list(), 10_000);

    // Clean up
    resolveSlowJob!();
    await runPromise.catch(() => {});

    expect(result.kind).toBe("resolved");
    if (result.kind === "resolved") {
      expect(result.value.length).toBeGreaterThanOrEqual(1);
    }

    cron.stop();
  }, 15_000);

  it("onTimer with 9 catch-up jobs doesn't starve status()", async () => {
    // Auto-resolve each mock job as soon as it's called.
    const deps = makeDeps(store.storePath, {
      runIsolatedAgentJob: vi.fn(
        () =>
          // Simulate a slow job that takes 100ms (fast enough for the test
          // but slow enough that all 9 will hold the lock for ~900ms total).
          new Promise<{ status: "ok"; summary: string }>((resolve) => {
            setTimeout(() => resolve({ status: "ok", summary: "done" }), 100);
          }),
      ),
    });

    const cron = new CronService(deps);
    await cron.start();

    const now = Date.now();
    for (let i = 0; i < 9; i++) {
      await cron.add({
        name: `catch-up-job-${i}`,
        enabled: true,
        schedule: { kind: "at", at: new Date(now - 1000).toISOString() },
        sessionTarget: "isolated",
        wakeMode: "next-heartbeat",
        payload: { kind: "agentTurn", message: `catch-up ${i}` },
      });
    }

    // Trigger the timer directly (simulates catch-up on gateway restart)
    // All 9 jobs will run but each takes 100ms, so the lock is held for ~900ms.
    // The lockedWithTimeout (5s) should fire before all jobs finish if they
    // were each taking >500ms, but here we just want to verify status()
    // responds even while jobs are in progress.
    const state = (cron as any).state;
    const timerPromise = onTimer(state);

    // Wait a bit for the first job to start executing (holding the lock)
    await new Promise((r) => setTimeout(r, 150));

    // Status should respond via lockedWithTimeout fallback (5s timeout)
    // or by acquiring the lock between job completions.
    const result = await raceTimeout(cron.status(), 10_000);
    expect(result.kind).toBe("resolved");

    // Wait for all jobs to complete
    await timerPromise;

    cron.stop();
  }, 15_000);
});
