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

describe("CronService restart catch-up", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-12-13T17:00:00.000Z"));
    noopLogger.debug.mockClear();
    noopLogger.info.mockClear();
    noopLogger.warn.mockClear();
    noopLogger.error.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("executes an overdue recurring job immediately on start", async () => {
    const store = await makeStorePath();
    const enqueueSystemEvent = vi.fn();
    const requestHeartbeatNow = vi.fn();

    const dueAt = Date.parse("2025-12-13T15:00:00.000Z");
    const lastRunAt = Date.parse("2025-12-12T15:00:00.000Z");

    await fs.mkdir(path.dirname(store.storePath), { recursive: true });
    await fs.writeFile(
      store.storePath,
      JSON.stringify(
        {
          version: 1,
          jobs: [
            {
              id: "restart-overdue-job",
              name: "daily digest",
              enabled: true,
              createdAtMs: Date.parse("2025-12-10T12:00:00.000Z"),
              updatedAtMs: Date.parse("2025-12-12T15:00:00.000Z"),
              schedule: { kind: "cron", expr: "0 15 * * *", tz: "UTC" },
              sessionTarget: "main",
              wakeMode: "next-heartbeat",
              payload: { kind: "systemEvent", text: "digest now" },
              state: {
                nextRunAtMs: dueAt,
                lastRunAtMs: lastRunAt,
                lastStatus: "ok",
              },
            },
          ],
        },
        null,
        2,
      ),
      "utf-8",
    );

    const cron = new CronService({
      storePath: store.storePath,
      cronEnabled: true,
      log: noopLogger,
      enqueueSystemEvent,
      requestHeartbeatNow,
      runIsolatedAgentJob: vi.fn(async () => ({ status: "ok" })),
    });

    await cron.start();

    expect(enqueueSystemEvent).toHaveBeenCalledWith(
      "digest now",
      expect.objectContaining({ agentId: undefined }),
    );
    expect(requestHeartbeatNow).toHaveBeenCalled();

    const jobs = await cron.list({ includeDisabled: true });
    const updated = jobs.find((job) => job.id === "restart-overdue-job");
    expect(updated?.state.lastStatus).toBe("ok");
    expect(updated?.state.lastRunAtMs).toBe(Date.parse("2025-12-13T17:00:00.000Z"));
    expect(updated?.state.nextRunAtMs).toBeGreaterThan(Date.parse("2025-12-13T17:00:00.000Z"));

    cron.stop();
    await store.cleanup();
  });

  it("skips interrupted job on restart to avoid restart loop (#16694)", async () => {
    const store = await makeStorePath();
    const enqueueSystemEvent = vi.fn();
    const requestHeartbeatNow = vi.fn();

    const dueAt = Date.parse("2025-12-13T16:00:00.000Z");
    const staleRunningAt = Date.parse("2025-12-13T16:30:00.000Z");

    await fs.mkdir(path.dirname(store.storePath), { recursive: true });
    await fs.writeFile(
      store.storePath,
      JSON.stringify(
        {
          version: 1,
          jobs: [
            {
              id: "restart-stale-running",
              name: "daily stale marker",
              enabled: true,
              createdAtMs: Date.parse("2025-12-10T12:00:00.000Z"),
              updatedAtMs: Date.parse("2025-12-13T16:30:00.000Z"),
              schedule: { kind: "cron", expr: "0 16 * * *", tz: "UTC" },
              sessionTarget: "main",
              wakeMode: "next-heartbeat",
              payload: { kind: "systemEvent", text: "resume stale marker" },
              state: {
                nextRunAtMs: dueAt,
                runningAtMs: staleRunningAt,
              },
            },
          ],
        },
        null,
        2,
      ),
      "utf-8",
    );

    const cron = new CronService({
      storePath: store.storePath,
      cronEnabled: true,
      log: noopLogger,
      enqueueSystemEvent,
      requestHeartbeatNow,
      runIsolatedAgentJob: vi.fn(async () => ({ status: "ok" })),
    });

    await cron.start();

    // The stale running marker should be cleared…
    expect(noopLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: "restart-stale-running" }),
      "cron: clearing stale running marker on startup",
    );

    // …but the interrupted job should NOT be re-fired (#16694)
    expect(enqueueSystemEvent).not.toHaveBeenCalled();

    // The skip should be logged
    expect(noopLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: "restart-stale-running" }),
      "cron: skipping interrupted job to avoid restart loop",
    );

    const jobs = await cron.list({ includeDisabled: true });
    const updated = jobs.find((job) => job.id === "restart-stale-running");
    expect(updated?.state.runningAtMs).toBeUndefined();
    // lastStatus should be unchanged (not set to "ok") since the job was skipped
    expect(updated?.state.lastStatus).toBeUndefined();
    expect(updated?.state.lastRunAtMs).toBeUndefined();
    expect((updated?.state.nextRunAtMs ?? 0) > Date.parse("2025-12-13T17:00:00.000Z")).toBe(true);

    cron.stop();
    await store.cleanup();
  });

  it("still fires non-interrupted overdue jobs alongside interrupted ones (#16694)", async () => {
    const store = await makeStorePath();
    const enqueueSystemEvent = vi.fn();
    const requestHeartbeatNow = vi.fn();

    await fs.mkdir(path.dirname(store.storePath), { recursive: true });
    await fs.writeFile(
      store.storePath,
      JSON.stringify(
        {
          version: 1,
          jobs: [
            {
              id: "interrupted-job",
              name: "was running when process died",
              enabled: true,
              createdAtMs: Date.parse("2025-12-10T12:00:00.000Z"),
              updatedAtMs: Date.parse("2025-12-13T16:30:00.000Z"),
              schedule: { kind: "cron", expr: "0 16 * * *", tz: "UTC" },
              sessionTarget: "main",
              wakeMode: "next-heartbeat",
              payload: { kind: "systemEvent", text: "interrupted payload" },
              state: {
                nextRunAtMs: Date.parse("2025-12-13T16:00:00.000Z"),
                runningAtMs: Date.parse("2025-12-13T16:30:00.000Z"),
              },
            },
            {
              id: "clean-overdue-job",
              name: "missed but not interrupted",
              enabled: true,
              createdAtMs: Date.parse("2025-12-10T12:00:00.000Z"),
              updatedAtMs: Date.parse("2025-12-12T15:00:00.000Z"),
              schedule: { kind: "cron", expr: "0 15 * * *", tz: "UTC" },
              sessionTarget: "main",
              wakeMode: "next-heartbeat",
              payload: { kind: "systemEvent", text: "clean overdue payload" },
              state: {
                nextRunAtMs: Date.parse("2025-12-13T15:00:00.000Z"),
                lastRunAtMs: Date.parse("2025-12-12T15:00:00.000Z"),
                lastStatus: "ok",
              },
            },
          ],
        },
        null,
        2,
      ),
      "utf-8",
    );

    const cron = new CronService({
      storePath: store.storePath,
      cronEnabled: true,
      log: noopLogger,
      enqueueSystemEvent,
      requestHeartbeatNow,
      runIsolatedAgentJob: vi.fn(async () => ({ status: "ok" })),
    });

    await cron.start();

    // The clean overdue job should fire
    expect(enqueueSystemEvent).toHaveBeenCalledWith("clean overdue payload", {
      agentId: undefined,
    });
    // The interrupted job should NOT fire
    expect(enqueueSystemEvent).not.toHaveBeenCalledWith("interrupted payload", {
      agentId: undefined,
    });

    cron.stop();
    await store.cleanup();
  });
});
