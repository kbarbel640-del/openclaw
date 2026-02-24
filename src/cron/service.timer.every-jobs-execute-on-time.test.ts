import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CronEvent } from "./service/state.js";
import { CronService } from "./service.js";

const noopLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
};

async function makeStorePath() {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-cron-timer-test-"));
    return {
        storePath: path.join(dir, "cron", "jobs.json"),
        cleanup: async () => {
            await fs.rm(dir, { recursive: true, force: true });
        },
    };
}

describe("cron timer: every-type jobs execute on time", () => {
    let events: CronEvent[];

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2025-12-13T00:00:00.000Z"));
        events = [];
        noopLogger.debug.mockClear();
        noopLogger.info.mockClear();
        noopLogger.warn.mockClear();
        noopLogger.error.mockClear();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("executes every-type job when timer fires late", async () => {
        const store = await makeStorePath();
        const enqueueSystemEvent = vi.fn();
        const requestHeartbeatNow = vi.fn();
        const runIsolatedAgentJob = vi.fn(async () => ({
            status: "ok" as const,
            summary: "test completed",
        }));

        const cron = new CronService({
            storePath: store.storePath,
            cronEnabled: true,
            log: noopLogger,
            enqueueSystemEvent,
            requestHeartbeatNow,
            runIsolatedAgentJob,
            onEvent: (evt) => {
                events.push(evt);
            },
        });

        await cron.start();

        // Create an every-type job scheduled to run every 5 minutes
        const everyMs = 5 * 60 * 1000; // 5 minutes
        const now = Date.parse("2025-12-13T00:00:00.000Z");

        await cron.add({
            name: "Test every 5min",
            schedule: { kind: "every", everyMs, anchorMs: now },
            sessionTarget: "isolated",
            wakeMode: "now",
            payload: { kind: "agentTurn", message: "Say hello" },
            enabled: true,
        });

        // Advance time to just past the scheduled run (timer fires slightly late)
        vi.setSystemTime(new Date(now + everyMs + 5)); // 5ms past scheduled time

        // Trigger timer
        await vi.runOnlyPendingTimersAsync();

        // Job should have executed
        const startedEvents = events.filter((e) => e.action === "started");
        const finishedEvents = events.filter((e) => e.action === "finished");

        expect(startedEvents).toHaveLength(1);
        expect(finishedEvents).toHaveLength(1);
        expect(finishedEvents[0].status).toBe("ok");

        cron.stop();
        await store.cleanup();
    });

    it("does not execute job that is not yet due", async () => {
        const store = await makeStorePath();
        const enqueueSystemEvent = vi.fn();
        const requestHeartbeatNow = vi.fn();
        const runIsolatedAgentJob = vi.fn(async () => ({
            status: "ok" as const,
            summary: "test completed",
        }));

        const cron = new CronService({
            storePath: store.storePath,
            cronEnabled: true,
            log: noopLogger,
            enqueueSystemEvent,
            requestHeartbeatNow,
            runIsolatedAgentJob,
            onEvent: (evt) => {
                events.push(evt);
            },
        });

        await cron.start();

        const everyMs = 5 * 60 * 1000;
        const now = Date.parse("2025-12-13T00:00:00.000Z");

        await cron.add({
            name: "Test every 5min",
            schedule: { kind: "every", everyMs, anchorMs: now },
            sessionTarget: "isolated",
            wakeMode: "now",
            payload: { kind: "agentTurn", message: "Say hello" },
            enabled: true,
        });

        // Advance time but not enough to trigger (1 second before scheduled time)
        vi.setSystemTime(new Date(now + everyMs - 1000));

        await vi.runOnlyPendingTimersAsync();

        // Job should NOT have executed
        const startedEvents = events.filter((e) => e.action === "started");
        expect(startedEvents).toHaveLength(0);

        cron.stop();
        await store.cleanup();
    });

    it("executes multiple due jobs in sequence", async () => {
        const store = await makeStorePath();
        const enqueueSystemEvent = vi.fn();
        const requestHeartbeatNow = vi.fn();
        const runIsolatedAgentJob = vi.fn(async () => ({
            status: "ok" as const,
            summary: "test completed",
        }));

        const cron = new CronService({
            storePath: store.storePath,
            cronEnabled: true,
            log: noopLogger,
            enqueueSystemEvent,
            requestHeartbeatNow,
            runIsolatedAgentJob,
            onEvent: (evt) => {
                events.push(evt);
            },
        });

        await cron.start();

        const everyMs1 = 5 * 60 * 1000;
        const everyMs2 = 10 * 60 * 1000;
        const now = Date.parse("2025-12-13T00:00:00.000Z");

        await cron.add({
            name: "Job 1 every 5min",
            schedule: { kind: "every", everyMs: everyMs1, anchorMs: now },
            sessionTarget: "isolated",
            wakeMode: "now",
            payload: { kind: "agentTurn", message: "Job 1" },
            enabled: true,
        });

        await cron.add({
            name: "Job 2 every 10min",
            schedule: { kind: "every", everyMs: everyMs2, anchorMs: now },
            sessionTarget: "isolated",
            wakeMode: "now",
            payload: { kind: "agentTurn", message: "Job 2" },
            enabled: true,
        });

        // Advance time past both scheduled times
        vi.setSystemTime(new Date(now + everyMs2 + 100));

        await vi.runOnlyPendingTimersAsync();

        // Both jobs should have executed
        const startedEvents = events.filter((e) => e.action === "started");
        expect(startedEvents).toHaveLength(2);

        const finishedEvents = events.filter((e) => e.action === "finished");
        expect(finishedEvents).toHaveLength(2);

        cron.stop();
        await store.cleanup();
    });
});
