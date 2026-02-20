import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveCronRunLogPath } from "../../cron/run-log.js";
import type { CronJob } from "../../cron/types.js";
import { opsRuntimeRunsHandlers } from "./ops-runtime-runs.js";

type HandlerContext = Parameters<(typeof opsRuntimeRunsHandlers)["ops.runtime.runs"]>[0]["context"];

describe("ops.runtime.runs", () => {
  let fixtureRoot = "";
  let cronStorePath = "";

  beforeEach(async () => {
    fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-ops-runtime-runs-"));
    cronStorePath = path.join(fixtureRoot, "cron", "jobs.json");
  });

  afterEach(async () => {
    await fs.rm(fixtureRoot, { recursive: true, force: true });
  });

  it("returns cross-job run history with failure rollups", async () => {
    const now = Date.now();
    const jobs: CronJob[] = [
      {
        id: "job-a",
        name: "model-failover-watch",
        enabled: true,
        createdAtMs: now - 300_000,
        updatedAtMs: now - 10_000,
        schedule: { kind: "every", everyMs: 60_000 },
        sessionTarget: "isolated",
        wakeMode: "now",
        payload: { kind: "agentTurn", message: "watch failover" },
        state: {
          lastRunAtMs: now - 6_000,
          lastStatus: "error",
          lastError: "timed out after 120s",
          consecutiveErrors: 2,
        },
      },
      {
        id: "job-b",
        name: "daily-summary",
        enabled: true,
        createdAtMs: now - 300_000,
        updatedAtMs: now - 8_000,
        schedule: { kind: "every", everyMs: 300_000 },
        sessionTarget: "isolated",
        wakeMode: "now",
        payload: { kind: "agentTurn", message: "summarize" },
        state: {
          lastRunAtMs: now - 7_000,
          lastStatus: "ok",
          consecutiveErrors: 0,
        },
      },
    ];

    await writeRunLog({
      cronStorePath,
      jobId: "job-a",
      entries: [
        {
          ts: now - 10_000,
          jobId: "job-a",
          action: "finished",
          status: "error",
          error: "timed out after 120s",
          summary: "failed to switch model",
        },
        {
          ts: now - 6_000,
          jobId: "job-a",
          action: "finished",
          status: "ok",
          summary: "recovered",
        },
      ],
    });
    await writeRunLog({
      cronStorePath,
      jobId: "job-b",
      entries: [
        {
          ts: now - 7_000,
          jobId: "job-b",
          action: "finished",
          status: "ok",
          summary: "daily summary done",
        },
      ],
    });

    const respond = vi.fn();
    const context = createContext({ jobs, cronStorePath });

    await opsRuntimeRunsHandlers["ops.runtime.runs"]({
      req: { type: "req", id: "1", method: "ops.runtime.runs" },
      params: { limit: 20, perJobLimit: 20, includeDisabledCron: true },
      client: null,
      isWebchatConnect: () => false,
      respond,
      context,
    });

    expect(respond).toHaveBeenCalledTimes(1);
    const [ok, payload] = respond.mock.calls[0] ?? [];
    expect(ok).toBe(true);
    expect(payload.summary).toMatchObject({
      totalRuns: 3,
      okRuns: 2,
      errorRuns: 1,
      timeoutRuns: 1,
      jobsWithFailures: 1,
      needsAction: 1,
    });
    expect(payload.runs[0]).toMatchObject({ jobId: "job-a", status: "ok" });
    expect(payload.failures).toHaveLength(1);
    expect(payload.failures[0]).toMatchObject({
      jobId: "job-a",
      consecutiveErrors: 2,
      errors: 1,
      needsAction: true,
    });
  });

  it("supports status/search/time filters and maps failed->error", async () => {
    const now = Date.now();
    const jobs: CronJob[] = [
      {
        id: "job-c",
        name: "discord-model-fix",
        enabled: true,
        createdAtMs: now - 300_000,
        updatedAtMs: now - 5_000,
        schedule: { kind: "every", everyMs: 60_000 },
        sessionTarget: "isolated",
        wakeMode: "now",
        payload: { kind: "agentTurn", message: "fix" },
        state: {
          lastRunAtMs: now - 4_000,
          lastStatus: "error",
          consecutiveErrors: 1,
        },
      },
    ];
    await writeRunLog({
      cronStorePath,
      jobId: "job-c",
      entries: [
        {
          ts: now - 4_000,
          jobId: "job-c",
          action: "finished",
          status: "error",
          error: "manual failover switch failed in discord",
        },
        {
          ts: now - 40_000,
          jobId: "job-c",
          action: "finished",
          status: "ok",
          summary: "healthy run",
        },
      ],
    });

    const respond = vi.fn();
    const context = createContext({ jobs, cronStorePath });

    await opsRuntimeRunsHandlers["ops.runtime.runs"]({
      req: { type: "req", id: "1", method: "ops.runtime.runs" },
      params: {
        status: "failed",
        search: "discord",
        fromMs: now - 20_000,
        toMs: now,
      },
      client: null,
      isWebchatConnect: () => false,
      respond,
      context,
    });

    const [ok, payload] = respond.mock.calls[0] ?? [];
    expect(ok).toBe(true);
    expect(payload.filters.status).toBe("error");
    expect(payload.runs).toHaveLength(1);
    expect(payload.runs[0]).toMatchObject({
      jobId: "job-c",
      status: "error",
    });
    expect(payload.summary.errorRuns).toBe(1);
    expect(payload.summary.totalRuns).toBe(1);
  });

  it("rejects invalid params", async () => {
    const respond = vi.fn();
    const context = createContext({ jobs: [], cronStorePath });

    await opsRuntimeRunsHandlers["ops.runtime.runs"]({
      req: { type: "req", id: "1", method: "ops.runtime.runs" },
      params: { limit: 0 },
      client: null,
      isWebchatConnect: () => false,
      respond,
      context,
    });

    const [ok, payload, error] = respond.mock.calls[0] ?? [];
    expect(ok).toBe(false);
    expect(payload).toBeUndefined();
    expect(error?.message).toContain("limit");
  });
});

function createContext(params: { jobs: CronJob[]; cronStorePath: string }): HandlerContext {
  return {
    cron: {
      list: vi.fn(async () => params.jobs),
    },
    cronStorePath: params.cronStorePath,
  } as unknown as HandlerContext;
}

async function writeRunLog(params: {
  cronStorePath: string;
  jobId: string;
  entries: Array<Record<string, unknown>>;
}): Promise<void> {
  const logPath = resolveCronRunLogPath({
    storePath: params.cronStorePath,
    jobId: params.jobId,
  });
  await fs.mkdir(path.dirname(logPath), { recursive: true });
  const content = params.entries.map((entry) => JSON.stringify(entry)).join("\n");
  await fs.writeFile(logPath, `${content}\n`, "utf8");
}
