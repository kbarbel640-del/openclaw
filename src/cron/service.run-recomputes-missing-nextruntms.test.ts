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
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-cron-"));
  return {
    storePath: path.join(dir, "cron", "jobs.json"),
    cleanup: async () => {
      await fs.rm(dir, { recursive: true, force: true });
    },
  };
}

describe("CronService.run recomputes missing nextRunAtMs", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-12-13T12:00:00.000Z"));
    noopLogger.debug.mockClear();
    noopLogger.info.mockClear();
    noopLogger.warn.mockClear();
    noopLogger.error.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("runs a past-due at job loaded from disk with empty state", async () => {
    const store = await makeStorePath();
    const enqueueSystemEvent = vi.fn();
    const requestHeartbeatNow = vi.fn();

    // Write a stored job with an empty state (no nextRunAtMs) and a past-due atMs.
    const pastAtMs = Date.parse("2025-12-13T10:00:00.000Z");
    await fs.mkdir(path.dirname(store.storePath), { recursive: true });
    await fs.writeFile(
      store.storePath,
      JSON.stringify({
        version: 1,
        jobs: [
          {
            id: "stale-at-job",
            name: "stale at job",
            enabled: true,
            createdAtMs: Date.parse("2025-12-13T09:00:00.000Z"),
            updatedAtMs: Date.parse("2025-12-13T09:00:00.000Z"),
            schedule: { kind: "at", atMs: pastAtMs },
            sessionTarget: "main",
            wakeMode: "now",
            payload: { kind: "systemEvent", text: "hello from stale job" },
            state: {},
          },
        ],
      }),
    );

    const cron = new CronService({
      storePath: store.storePath,
      cronEnabled: true,
      log: noopLogger,
      enqueueSystemEvent,
      requestHeartbeatNow,
      runIsolatedAgentJob: vi.fn(async () => ({ status: "ok" })),
    });

    // Start the service (this calls recomputeNextRuns).
    // But simulate the scenario where the run() call uses stale state by
    // creating a second CronService that does NOT call start().
    const cron2 = new CronService({
      storePath: store.storePath,
      cronEnabled: false,
      log: noopLogger,
      enqueueSystemEvent,
      requestHeartbeatNow,
      runHeartbeatOnce: vi.fn(async () => ({ status: "ran" as const, durationMs: 1 })),
      runIsolatedAgentJob: vi.fn(async () => ({ status: "ok" })),
    });

    // Without the fix, this would return not-due because nextRunAtMs is undefined.
    const result = await cron2.run("stale-at-job");
    expect(result.ran).toBe(true);
    expect(result.ok).toBe(true);

    cron.stop();
    cron2.stop();
    await store.cleanup();
  });

  it("does not run a future at job when nextRunAtMs is missing", async () => {
    const store = await makeStorePath();
    const enqueueSystemEvent = vi.fn();
    const requestHeartbeatNow = vi.fn();

    // Write a stored job with empty state and a future atMs.
    const futureAtMs = Date.parse("2025-12-14T00:00:00.000Z");
    await fs.mkdir(path.dirname(store.storePath), { recursive: true });
    await fs.writeFile(
      store.storePath,
      JSON.stringify({
        version: 1,
        jobs: [
          {
            id: "future-at-job",
            name: "future at job",
            enabled: true,
            createdAtMs: Date.parse("2025-12-13T09:00:00.000Z"),
            updatedAtMs: Date.parse("2025-12-13T09:00:00.000Z"),
            schedule: { kind: "at", atMs: futureAtMs },
            sessionTarget: "main",
            wakeMode: "now",
            payload: { kind: "systemEvent", text: "not yet" },
            state: {},
          },
        ],
      }),
    );

    const cron = new CronService({
      storePath: store.storePath,
      cronEnabled: false,
      log: noopLogger,
      enqueueSystemEvent,
      requestHeartbeatNow,
      runIsolatedAgentJob: vi.fn(async () => ({ status: "ok" })),
    });

    const result = await cron.run("future-at-job");
    expect(result.ran).toBe(false);
    expect("reason" in result && result.reason).toBe("not-due");

    cron.stop();
    await store.cleanup();
  });
});
