import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { CronService } from "./service.js";
import { setupCronServiceSuite } from "./service.test-harness.js";

const { logger: noopLogger, makeStorePath } = setupCronServiceSuite({
  prefix: "openclaw-cron-",
  baseTimeIso: "2026-02-06T17:00:00.000Z",
});

function createStartedCron(storePath: string) {
  const cron = new CronService({
    storePath,
    cronEnabled: true,
    log: noopLogger,
    enqueueSystemEvent: vi.fn(),
    requestHeartbeatNow: vi.fn(),
    runIsolatedAgentJob: vi.fn(async () => ({ status: "ok" as const, summary: "ok" })),
  });
  return {
    cron,
    start: async () => {
      await cron.start();
      return cron;
    },
  };
}

describe("CronService store migrations", () => {
  it("migrates legacy top-level agentTurn fields and initializes missing state", async () => {
    const store = await makeStorePath();
    await fs.mkdir(path.dirname(store.storePath), { recursive: true });
    await fs.writeFile(
      store.storePath,
      JSON.stringify(
        {
          version: 1,
          jobs: [
            {
              id: "legacy-agentturn-job",
              name: "legacy agentturn",
              enabled: true,
              createdAtMs: Date.parse("2026-02-01T12:00:00.000Z"),
              updatedAtMs: Date.parse("2026-02-05T12:00:00.000Z"),
              schedule: { kind: "cron", expr: "0 23 * * *", tz: "UTC" },
              sessionTarget: "isolated",
              wakeMode: "next-heartbeat",
              model: "openrouter/deepseek/deepseek-r1",
              thinking: "high",
              timeoutSeconds: 120,
              allowUnsafeExternalContent: true,
              deliver: true,
              channel: "telegram",
              to: "12345",
              bestEffortDeliver: true,
              payload: { kind: "agentTurn", message: "legacy payload fields" },
            },
          ],
        },
        null,
        2,
      ),
      "utf-8",
    );

    const cron = await createStartedCron(store.storePath).start();

    const status = await cron.status();
    expect(status.enabled).toBe(true);

    const jobs = await cron.list({ includeDisabled: true });
    const job = jobs.find((entry) => entry.id === "legacy-agentturn-job");
    expect(job).toBeDefined();
    expect(job?.state).toBeDefined();
    expect(job?.sessionTarget).toBe("isolated");
    expect(job?.payload.kind).toBe("agentTurn");
    if (job?.payload.kind === "agentTurn") {
      expect(job.payload.model).toBe("openrouter/deepseek/deepseek-r1");
      expect(job.payload.thinking).toBe("high");
      expect(job.payload.timeoutSeconds).toBe(120);
      expect(job.payload.allowUnsafeExternalContent).toBe(true);
    }
    expect(job?.delivery).toEqual({
      mode: "announce",
      channel: "telegram",
      to: "12345",
      bestEffort: true,
    });

    const persisted = JSON.parse(await fs.readFile(store.storePath, "utf-8")) as {
      jobs: Array<Record<string, unknown>>;
    };
    const persistedJob = persisted.jobs.find((entry) => entry.id === "legacy-agentturn-job");
    expect(persistedJob).toBeDefined();
    expect(persistedJob?.state).toEqual(expect.any(Object));
    expect(persistedJob?.model).toBeUndefined();
    expect(persistedJob?.thinking).toBeUndefined();
    expect(persistedJob?.timeoutSeconds).toBeUndefined();
    expect(persistedJob?.deliver).toBeUndefined();
    expect(persistedJob?.channel).toBeUndefined();
    expect(persistedJob?.to).toBeUndefined();
    expect(persistedJob?.bestEffortDeliver).toBeUndefined();

    cron.stop();
    await store.cleanup();
  });

  it("preserves legacy timeoutSeconds=0 during top-level agentTurn field migration", async () => {
    const store = await makeStorePath();
    await fs.mkdir(path.dirname(store.storePath), { recursive: true });
    await fs.writeFile(
      store.storePath,
      JSON.stringify(
        {
          version: 1,
          jobs: [
            {
              id: "legacy-agentturn-no-timeout",
              name: "legacy no-timeout",
              enabled: true,
              createdAtMs: Date.parse("2026-02-01T12:00:00.000Z"),
              updatedAtMs: Date.parse("2026-02-05T12:00:00.000Z"),
              schedule: { kind: "cron", expr: "0 23 * * *", tz: "UTC" },
              sessionTarget: "isolated",
              wakeMode: "next-heartbeat",
              timeoutSeconds: 0,
              payload: { kind: "agentTurn", message: "legacy payload fields" },
            },
          ],
        },
        null,
        2,
      ),
      "utf-8",
    );

    const cron = await createStartedCron(store.storePath).start();

    const jobs = await cron.list({ includeDisabled: true });
    const job = jobs.find((entry) => entry.id === "legacy-agentturn-no-timeout");
    expect(job).toBeDefined();
    expect(job?.payload.kind).toBe("agentTurn");
    if (job?.payload.kind === "agentTurn") {
      expect(job.payload.timeoutSeconds).toBe(0);
    }

    cron.stop();
    await store.cleanup();
  });

  it("infers payload from legacy top-level text without quarantining valid jobs", async () => {
    const store = await makeStorePath();
    await fs.mkdir(path.dirname(store.storePath), { recursive: true });
    await fs.writeFile(
      store.storePath,
      JSON.stringify(
        {
          version: 1,
          jobs: [
            {
              id: "legacy-top-level-text",
              name: "legacy top level text",
              enabled: true,
              createdAtMs: Date.parse("2026-02-01T12:00:00.000Z"),
              updatedAtMs: Date.parse("2026-02-05T12:00:00.000Z"),
              schedule: { kind: "cron", expr: "0 23 * * *", tz: "UTC" },
              sessionTarget: "main",
              wakeMode: "next-heartbeat",
              text: "  legacy inferred payload  ",
            },
          ],
        },
        null,
        2,
      ),
      "utf-8",
    );

    const cron = await createStartedCron(store.storePath).start();

    const jobs = await cron.list({ includeDisabled: true });
    const job = jobs.find((entry) => entry.id === "legacy-top-level-text");
    expect(job).toBeDefined();
    expect(job?.enabled).toBe(true);
    expect(job?.state.lastStatus).toBeUndefined();
    expect(job?.state.lastError).toBeUndefined();
    expect(job?.payload.kind).toBe("systemEvent");
    if (job?.payload.kind === "systemEvent") {
      expect(job.payload.text).toBe("legacy inferred payload");
    }

    const persisted = JSON.parse(await fs.readFile(store.storePath, "utf-8")) as {
      jobs: Array<Record<string, unknown>>;
    };
    const persistedJob = persisted.jobs.find((entry) => entry.id === "legacy-top-level-text");
    expect(persistedJob).toBeDefined();
    expect(persistedJob?.text).toBeUndefined();
    expect((persistedJob?.payload as { kind?: string; text?: string } | undefined)?.kind).toBe(
      "systemEvent",
    );

    cron.stop();
    await store.cleanup();
  });

  it("disables persisted jobs with missing payloads and records a skip error", async () => {
    const store = await makeStorePath();
    await fs.mkdir(path.dirname(store.storePath), { recursive: true });
    await fs.writeFile(
      store.storePath,
      JSON.stringify(
        {
          version: 1,
          jobs: [
            {
              id: "legacy-missing-payload",
              name: "legacy missing payload",
              enabled: true,
              createdAtMs: Date.parse("2026-02-01T12:00:00.000Z"),
              updatedAtMs: Date.parse("2026-02-05T12:00:00.000Z"),
              schedule: { kind: "cron", expr: "0 23 * * *", tz: "UTC" },
              sessionTarget: "isolated",
              wakeMode: "next-heartbeat",
              state: { nextRunAtMs: Date.parse("2026-02-06T12:00:00.000Z") },
            },
          ],
        },
        null,
        2,
      ),
      "utf-8",
    );

    const cron = await createStartedCron(store.storePath).start();

    const jobs = await cron.list({ includeDisabled: true });
    const job = jobs.find((entry) => entry.id === "legacy-missing-payload");
    expect(job).toBeDefined();
    expect(job?.enabled).toBe(false);
    expect(job?.state.lastStatus).toBe("skipped");
    expect(job?.state.lastError).toBe("invalid persisted cron job: missing or invalid payload");
    expect(job?.state.nextRunAtMs).toBeUndefined();

    cron.stop();
    await store.cleanup();
  });

  it("annotates missing-state jobs when payload is malformed", async () => {
    const store = await makeStorePath();
    await fs.mkdir(path.dirname(store.storePath), { recursive: true });
    await fs.writeFile(
      store.storePath,
      JSON.stringify(
        {
          version: 1,
          jobs: [
            {
              id: "legacy-missing-payload-no-state",
              name: "legacy missing payload no state",
              enabled: true,
              createdAtMs: Date.parse("2026-02-01T12:00:00.000Z"),
              updatedAtMs: Date.parse("2026-02-05T12:00:00.000Z"),
              schedule: { kind: "cron", expr: "0 23 * * *", tz: "UTC" },
              sessionTarget: "isolated",
              wakeMode: "next-heartbeat",
            },
          ],
        },
        null,
        2,
      ),
      "utf-8",
    );

    const cron = await createStartedCron(store.storePath).start();

    const jobs = await cron.list({ includeDisabled: true });
    const job = jobs.find((entry) => entry.id === "legacy-missing-payload-no-state");
    expect(job).toBeDefined();
    expect(job?.enabled).toBe(false);
    expect(job?.state.lastStatus).toBe("skipped");
    expect(job?.state.lastError).toBe("invalid persisted cron job: missing or invalid payload");
    expect(job?.state.nextRunAtMs).toBeUndefined();

    cron.stop();
    await store.cleanup();
  });

  it("disables persisted agentTurn jobs with empty payload message and records a skip error", async () => {
    const store = await makeStorePath();
    await fs.mkdir(path.dirname(store.storePath), { recursive: true });
    await fs.writeFile(
      store.storePath,
      JSON.stringify(
        {
          version: 1,
          jobs: [
            {
              id: "legacy-empty-agentturn-message",
              name: "legacy empty agentturn message",
              enabled: true,
              createdAtMs: Date.parse("2026-02-01T12:00:00.000Z"),
              updatedAtMs: Date.parse("2026-02-05T12:00:00.000Z"),
              schedule: { kind: "cron", expr: "0 23 * * *", tz: "UTC" },
              sessionTarget: "isolated",
              wakeMode: "next-heartbeat",
              payload: { kind: "agentTurn", message: "   " },
              state: { nextRunAtMs: Date.parse("2026-02-06T12:00:00.000Z") },
            },
          ],
        },
        null,
        2,
      ),
      "utf-8",
    );

    const cron = await createStartedCron(store.storePath).start();

    const jobs = await cron.list({ includeDisabled: true });
    const job = jobs.find((entry) => entry.id === "legacy-empty-agentturn-message");
    expect(job).toBeDefined();
    expect(job?.enabled).toBe(false);
    expect(job?.state.lastStatus).toBe("skipped");
    expect(job?.state.lastError).toBe("invalid persisted cron job: missing or invalid payload");
    expect(job?.state.nextRunAtMs).toBeUndefined();

    cron.stop();
    await store.cleanup();
  });
});
