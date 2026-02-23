import { describe, expect, it, vi } from "vitest";
import { createCronServiceState } from "./service/state.js";
import { executeJob, executeJobCore } from "./service/timer.js";
import type { CronJob } from "./types.js";

const noopLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

function buildBaseJob(overrides?: Partial<CronJob>): CronJob {
  return {
    id: "job-1",
    name: "test",
    enabled: true,
    createdAtMs: Date.now(),
    updatedAtMs: Date.now(),
    schedule: { kind: "every", everyMs: 60_000 },
    sessionTarget: "isolated",
    wakeMode: "next-heartbeat",
    payload: { kind: "agentTurn", message: "run" },
    state: { nextRunAtMs: Date.now() },
    ...overrides,
  };
}

function createState(params?: {
  failureTaxonomyEnabled?: boolean;
  runIsolatedAgentJob?: (args: { job: CronJob; message: string }) => Promise<{
    status: "ok" | "error" | "skipped";
    error?: string;
  }>;
  onFinished?: (evt: Record<string, unknown>) => void;
}) {
  return createCronServiceState({
    storePath: "/tmp/openclaw-cron-failure-taxonomy-test.json",
    cronEnabled: true,
    failureTaxonomyEnabled: params?.failureTaxonomyEnabled,
    log: noopLogger,
    enqueueSystemEvent: vi.fn(),
    requestHeartbeatNow: vi.fn(),
    runIsolatedAgentJob:
      params?.runIsolatedAgentJob ??
      (vi.fn(async () => ({
        status: "ok" as const,
      })) as unknown as (args: { job: CronJob; message: string }) => Promise<{
        status: "ok" | "error" | "skipped";
        error?: string;
      }>),
    onEvent: (evt) => {
      if (evt.action === "finished") {
        params?.onFinished?.(evt as unknown as Record<string, unknown>);
      }
    },
  });
}

describe("CronService failure taxonomy guardrails", () => {
  it("keeps default outcome unchanged when taxonomy is disabled", async () => {
    const state = createState({ failureTaxonomyEnabled: false });
    const job = buildBaseJob({
      sessionTarget: "main",
      payload: { kind: "agentTurn", message: "invalid for main" },
    });

    const result = await executeJobCore(state, job);
    expect(result.status).toBe("skipped");
    expect(result).not.toHaveProperty("failure");
    expect(result).not.toHaveProperty("errorKind");
  });

  it("maps runtime validation failures deterministically when taxonomy is enabled", async () => {
    const state = createState({ failureTaxonomyEnabled: true });
    const job = buildBaseJob({
      sessionTarget: "main",
      payload: { kind: "agentTurn", message: "invalid for main" },
    });

    const result = await executeJobCore(state, job);
    expect(result.status).toBe("skipped");
    expect(result.failure).toMatchObject({
      type: "runtime_validation",
      stage: "input_validation",
      rootCause: "main-job-payload-invalid",
      retriable: false,
    });
  });

  it("maps timeout failures as retriable guardrail outcomes when taxonomy is enabled", async () => {
    let finishedEvent: Record<string, unknown> | undefined;
    const state = createState({
      failureTaxonomyEnabled: true,
      runIsolatedAgentJob: vi.fn(async () => {
        throw new Error("cron: job execution timed out");
      }),
      onFinished: (evt) => {
        finishedEvent = evt;
      },
    });
    const job = buildBaseJob();

    await executeJob(state, job, Date.now(), { forced: false });

    expect(finishedEvent?.status).toBe("error");
    expect(finishedEvent?.failure).toMatchObject({
      type: "timeout",
      stage: "execution",
      rootCause: "job-execution-timeout",
      retriable: true,
    });
  });
});
