import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CronService } from "./service.js";
import {
  createCronStoreHarness,
  createNoopLogger,
  withCronServiceForTest,
} from "./service.test-harness.js";

const noopLogger = createNoopLogger();
const { makeStorePath } = createCronStoreHarness();

async function withCronService(
  cronEnabled: boolean,
  run: (params: {
    cron: CronService;
    enqueueSystemEvent: ReturnType<typeof vi.fn>;
    requestHeartbeatNow: ReturnType<typeof vi.fn>;
  }) => Promise<void>,
) {
  await withCronServiceForTest(
    {
      makeStorePath,
      logger: noopLogger,
      cronEnabled,
      runIsolatedAgentJob: vi.fn(async () => ({ status: "ok" as const })),
    },
    run,
  );
}

describe("CronService", () => {
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

  it("rejects main jobs with empty systemEvent text on add", async () => {
    await withCronService(true, async ({ cron, enqueueSystemEvent, requestHeartbeatNow }) => {
      const atMs = Date.parse("2025-12-13T00:00:01.000Z");
      await expect(
        cron.add({
          name: "empty systemEvent test",
          enabled: true,
          schedule: { kind: "at", at: new Date(atMs).toISOString() },
          sessionTarget: "main",
          wakeMode: "now",
          payload: { kind: "systemEvent", text: "   " },
        }),
      ).rejects.toThrow('cron.add payload.kind="systemEvent" requires non-empty text');

      expect(enqueueSystemEvent).not.toHaveBeenCalled();
      expect(requestHeartbeatNow).not.toHaveBeenCalled();
      expect(
        noopLogger.warn.mock.calls.some(
          ([obj, msg]) =>
            msg === "cron: payload validation rejected" &&
            (obj as { action?: string; payloadKind?: string; event?: string }).action === "add" &&
            (obj as { action?: string; payloadKind?: string; event?: string }).payloadKind ===
              "systemEvent" &&
            (obj as { action?: string; payloadKind?: string; event?: string }).event ===
              "payload_validation_rejected",
        ),
      ).toBe(true);
    });
  });

  it("logs a warning when update rejects whitespace-only payload message", async () => {
    await withCronService(true, async ({ cron }) => {
      const atMs = Date.parse("2025-12-13T00:00:01.000Z");
      const job = await cron.add({
        name: "update payload reject",
        enabled: true,
        schedule: { kind: "at", at: new Date(atMs).toISOString() },
        sessionTarget: "isolated",
        wakeMode: "now",
        payload: { kind: "agentTurn", message: "hello" },
      });

      await expect(
        cron.update(job.id, {
          payload: { kind: "agentTurn", message: "   " },
        }),
      ).rejects.toThrow('cron.update payload.kind="agentTurn" requires non-empty message');
      expect(
        noopLogger.warn.mock.calls.some(
          ([obj, msg]) =>
            msg === "cron: payload validation rejected" &&
            (obj as { action?: string; payloadKind?: string; event?: string }).action ===
              "update" &&
            (obj as { action?: string; payloadKind?: string; event?: string }).payloadKind ===
              "agentTurn" &&
            (obj as { action?: string; payloadKind?: string; event?: string }).event ===
              "payload_validation_rejected",
        ),
      ).toBe(true);
    });
  });

  it("keeps job unchanged when update payload validation fails", async () => {
    await withCronService(true, async ({ cron }) => {
      const atMs = Date.parse("2025-12-13T00:00:01.000Z");
      const job = await cron.add({
        name: "atomic update payload reject",
        enabled: true,
        schedule: { kind: "at", at: new Date(atMs).toISOString() },
        sessionTarget: "isolated",
        wakeMode: "now",
        payload: { kind: "agentTurn", message: "hello" },
      });

      await expect(
        cron.update(job.id, {
          name: "should-not-apply",
          enabled: false,
          payload: { kind: "agentTurn", message: "   " },
        }),
      ).rejects.toThrow('cron.update payload.kind="agentTurn" requires non-empty message');

      const jobs = await cron.list({ includeDisabled: true });
      const unchanged = jobs.find((entry) => entry.id === job.id);
      expect(unchanged).toBeDefined();
      expect(unchanged?.name).toBe("atomic update payload reject");
      expect(unchanged?.enabled).toBe(true);
      expect(unchanged?.payload.kind).toBe("agentTurn");
      if (unchanged?.payload.kind === "agentTurn") {
        expect(unchanged.payload.message).toBe("hello");
      }
    });
  });

  it("does not schedule timers when cron is disabled", async () => {
    await withCronService(false, async ({ cron, enqueueSystemEvent, requestHeartbeatNow }) => {
      const atMs = Date.parse("2025-12-13T00:00:01.000Z");
      await cron.add({
        name: "disabled cron job",
        enabled: true,
        schedule: { kind: "at", at: new Date(atMs).toISOString() },
        sessionTarget: "main",
        wakeMode: "now",
        payload: { kind: "systemEvent", text: "hello" },
      });

      const status = await cron.status();
      expect(status.enabled).toBe(false);
      expect(status.nextWakeAtMs).toBeNull();

      vi.setSystemTime(new Date("2025-12-13T00:00:01.000Z"));
      await vi.runOnlyPendingTimersAsync();

      expect(enqueueSystemEvent).not.toHaveBeenCalled();
      expect(requestHeartbeatNow).not.toHaveBeenCalled();
      expect(noopLogger.warn).toHaveBeenCalled();
    });
  });

  it("status reports next wake when enabled", async () => {
    await withCronService(true, async ({ cron }) => {
      const atMs = Date.parse("2025-12-13T00:00:05.000Z");
      await cron.add({
        name: "status next wake",
        enabled: true,
        schedule: { kind: "at", at: new Date(atMs).toISOString() },
        sessionTarget: "main",
        wakeMode: "next-heartbeat",
        payload: { kind: "systemEvent", text: "hello" },
      });

      const status = await cron.status();
      expect(status.enabled).toBe(true);
      expect(status.jobs).toBe(1);
      expect(status.nextWakeAtMs).toBe(atMs);
    });
  });
});
