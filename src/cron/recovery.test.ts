import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { ExecutionStore } from "./execution-store.js";
import { recoverMissedRuns } from "./service/recovery.js";
import type { CronServiceState } from "./service/state.js";
import type { CronJob } from "./types.js";

describe("cron recovery", () => {
  it("should recover missed jobs within replay window", async () => {
    // Setup: Create temp directory for test
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cron-recovery-test-"));
    const storePath = path.join(tmpDir, "execution-store.sqlite");
    const executionStore = new ExecutionStore(storePath);

    const now = Date.now();
    const fiveMinutesAgo = now - 5 * 60 * 1000;

    // Create a job with replay policy enabled
    const job: CronJob = {
      id: "test-job-1",
      agentId: null,
      name: "Test Recovery Job",
      description: null,
      enabled: true,
      createdAtMs: now - 10 * 60 * 1000,
      updatedAtMs: now - 10 * 60 * 1000,
      schedule: { kind: "interval", intervalMs: 3600000 },
      sessionTarget: "main",
      wakeMode: "next-heartbeat",
      payload: {
        kind: "systemEvent",
        text: "Dinner reminder: Time to eat!",
      },
      replay: {
        mode: "on_recovery",
        windowMs: 3600000, // 1 hour window
        maxReplaysPerRecovery: 5,
      },
      state: {
        nextRunAtMs: fiveMinutesAgo,
      },
    };

    // Insert the occurrence as "scheduled" (simulating it was scheduled but never fired)
    executionStore.upsertOccurrence(job.id, fiveMinutesAgo);

    const enqueuedEvents: Array<{ text: string; agentId?: string | null }> = [];

    // Create mock state
    const state: CronServiceState = {
      deps: {
        storePath: path.join(tmpDir, "store.json"),
        executionStorePath: storePath,
        cronEnabled: true,
        nowMs: () => now,
        enqueueSystemEvent: (text, opts) => {
          enqueuedEvents.push({ text, agentId: opts?.agentId });
        },
        requestHeartbeatNow: () => {},
        runHeartbeatOnce: undefined,
        runIsolatedAgentJob: async () => ({ status: "skipped", summary: "" }),
        log: {
          info: () => {},
          warn: () => {},
          error: () => {},
        } as never,
        onEvent: () => {},
      },
      store: {
        version: 1,
        jobs: [job],
      },
      executionStore,
      timer: null,
      running: false,
      op: Promise.resolve(),
      warnedDisabled: false,
    };

    // Execute recovery
    await recoverMissedRuns(state);

    // Verify: Should have enqueued exactly one recovery message
    expect(enqueuedEvents).toHaveLength(1);
    const recoveryMessage = enqueuedEvents[0];

    // Verify the message has the "Late" prefix
    expect(recoveryMessage.text).toContain("Late — gateway was down at scheduled time");
    expect(recoveryMessage.text).toContain("Dinner reminder: Time to eat!");

    // Verify the occurrence was marked as missed and replayed
    const missed = executionStore.getMissedOccurrences(now);
    expect(missed).toHaveLength(0); // Should be empty because we processed it

    // Cleanup
    executionStore.close();
    fs.rmSync(tmpDir, { recursive: true });
  });

  it("should skip missed jobs outside replay window", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cron-recovery-test-"));
    const storePath = path.join(tmpDir, "execution-store.sqlite");
    const executionStore = new ExecutionStore(storePath);

    const now = Date.now();
    const twoHoursAgo = now - 2 * 60 * 60 * 1000;

    const job: CronJob = {
      id: "test-job-2",
      agentId: null,
      name: "Test Stale Job",
      description: null,
      enabled: true,
      createdAtMs: now - 3 * 60 * 60 * 1000,
      updatedAtMs: now - 3 * 60 * 60 * 1000,
      schedule: { kind: "interval", intervalMs: 3600000 },
      sessionTarget: "main",
      wakeMode: "next-heartbeat",
      payload: {
        kind: "systemEvent",
        text: "Stale reminder",
      },
      replay: {
        mode: "on_recovery",
        windowMs: 3600000, // 1 hour window (missed occurrence is 2 hours old)
        maxReplaysPerRecovery: 5,
      },
      state: {
        nextRunAtMs: twoHoursAgo,
      },
    };

    executionStore.upsertOccurrence(job.id, twoHoursAgo);

    const enqueuedEvents: Array<{ text: string }> = [];

    const state: CronServiceState = {
      deps: {
        storePath: path.join(tmpDir, "store.json"),
        executionStorePath: storePath,
        cronEnabled: true,
        nowMs: () => now,
        enqueueSystemEvent: (text) => {
          enqueuedEvents.push({ text });
        },
        requestHeartbeatNow: () => {},
        runHeartbeatOnce: undefined,
        runIsolatedAgentJob: async () => ({ status: "skipped", summary: "" }),
        log: {
          info: () => {},
          warn: () => {},
          error: () => {},
        } as never,
        onEvent: () => {},
      },
      store: {
        version: 1,
        jobs: [job],
      },
      executionStore,
      timer: null,
      running: false,
      op: Promise.resolve(),
      warnedDisabled: false,
    };

    await recoverMissedRuns(state);

    // Verify: Should NOT have enqueued any messages (too old)
    expect(enqueuedEvents).toHaveLength(0);

    // Verify the occurrence was marked as skipped_stale
    const missed = executionStore.getMissedOccurrences(now);
    expect(missed).toHaveLength(0);

    executionStore.close();
    fs.rmSync(tmpDir, { recursive: true });
  });

  it("should respect maxReplaysPerRecovery limit", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cron-recovery-test-"));
    const storePath = path.join(tmpDir, "execution-store.sqlite");
    const executionStore = new ExecutionStore(storePath);

    const now = Date.now();

    // Create 10 missed occurrences
    const job: CronJob = {
      id: "test-job-3",
      agentId: null,
      name: "Test Replay Limit",
      description: null,
      enabled: true,
      createdAtMs: now - 2 * 60 * 60 * 1000,
      updatedAtMs: now - 2 * 60 * 60 * 1000,
      schedule: { kind: "interval", intervalMs: 300000 }, // 5 min interval
      sessionTarget: "main",
      wakeMode: "next-heartbeat",
      payload: {
        kind: "systemEvent",
        text: "Frequent reminder",
      },
      replay: {
        mode: "on_recovery",
        windowMs: 3600000,
        maxReplaysPerRecovery: 3, // Only allow 3 replays
      },
      state: {
        nextRunAtMs: now - 50 * 60 * 1000,
      },
    };

    // Insert 10 missed occurrences
    for (let i = 0; i < 10; i++) {
      const scheduledAt = now - (50 - i * 5) * 60 * 1000; // Every 5 minutes
      executionStore.upsertOccurrence(job.id, scheduledAt);
    }

    const enqueuedEvents: Array<{ text: string }> = [];

    const state: CronServiceState = {
      deps: {
        storePath: path.join(tmpDir, "store.json"),
        executionStorePath: storePath,
        cronEnabled: true,
        nowMs: () => now,
        enqueueSystemEvent: (text) => {
          enqueuedEvents.push({ text });
        },
        requestHeartbeatNow: () => {},
        runHeartbeatOnce: undefined,
        runIsolatedAgentJob: async () => ({ status: "skipped", summary: "" }),
        log: {
          info: () => {},
          warn: () => {},
          error: () => {},
        } as never,
        onEvent: () => {},
      },
      store: {
        version: 1,
        jobs: [job],
      },
      executionStore,
      timer: null,
      running: false,
      op: Promise.resolve(),
      warnedDisabled: false,
    };

    await recoverMissedRuns(state);

    // Verify: Should have enqueued exactly 3 messages (maxReplaysPerRecovery limit)
    expect(enqueuedEvents).toHaveLength(3);

    executionStore.close();
    fs.rmSync(tmpDir, { recursive: true });
  });
});
