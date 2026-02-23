import { describe, it, expect } from "vitest";
import { buildDebugTrace, formatDebugTrace, detectTraceWarnings } from "./debug-trace.js";
import type { CronRunLogEntry } from "./run-log.js";
import type { CronJob } from "./types.js";

function makeJob(overrides?: Partial<CronJob>): CronJob {
  return {
    id: "job-1",
    name: "test-job",
    enabled: true,
    createdAtMs: 1700000000000,
    updatedAtMs: 1700000000000,
    schedule: { kind: "cron", expr: "0 * * * *" },
    sessionTarget: "isolated",
    wakeMode: "now",
    payload: { kind: "agentTurn", message: "run task" },
    state: {},
    ...overrides,
  };
}

function makeRun(overrides?: Partial<CronRunLogEntry>): CronRunLogEntry {
  return {
    ts: 1700000060000,
    jobId: "job-1",
    action: "finished",
    status: "ok",
    runAtMs: 1700000000000,
    durationMs: 5000,
    ...overrides,
  };
}

describe("buildDebugTrace", () => {
  it("builds a simple job trace (schedule → dispatch → complete)", () => {
    const job = makeJob();
    const runs = [makeRun()];
    const trace = buildDebugTrace(job, runs);

    expect(trace.jobId).toBe("job-1");
    expect(trace.jobName).toBe("test-job");
    expect(trace.chain.length).toBeGreaterThanOrEqual(3);
    expect(trace.chain.some((e) => e.event === "scheduled")).toBe(true);
    expect(trace.chain.some((e) => e.event === "dispatched")).toBe(true);
    expect(trace.chain.some((e) => e.event === "completed")).toBe(true);
    expect(trace.summary).toContain("1 runs");
    expect(trace.summary).toContain("1 ok");
  });

  it("builds a failed job trace with retries", () => {
    const job = makeJob();
    const runs = [
      makeRun({ ts: 1700000060000, status: "error", error: "timeout", runAtMs: 1700000000000 }),
      makeRun({ ts: 1700000120000, status: "error", error: "timeout", runAtMs: 1700000060000 }),
      makeRun({ ts: 1700000180000, status: "ok", runAtMs: 1700000120000 }),
    ];
    const trace = buildDebugTrace(job, runs);

    expect(trace.summary).toContain("3 runs");
    expect(trace.summary).toContain("1 ok");
    expect(trace.summary).toContain("2 failed");
    expect(trace.chain.filter((e) => e.event === "failed")).toHaveLength(2);
    expect(trace.chain.filter((e) => e.event === "completed")).toHaveLength(1);
  });

  it("builds a chain trace (parent → child)", () => {
    const parentJob = makeJob({ id: "parent-1", name: "parent-job" });
    const parentRun = makeRun({
      jobId: "parent-1",
      sessionId: "session-parent",
      ts: 1700000060000,
    });

    const childRuns = new Map<string, CronRunLogEntry[]>();
    childRuns.set("child-1", [
      makeRun({
        jobId: "child-1",
        ts: 1700000120000,
        runAtMs: 1700000070000,
        scheduler: { chainTriggeredBy: "session-parent" },
      }),
    ]);

    const trace = buildDebugTrace(parentJob, [parentRun], childRuns);

    expect(trace.chain.some((e) => e.event === "chain_triggered")).toBe(true);
    const chainEntry = trace.chain.find((e) => e.event === "chain_triggered");
    expect(chainEntry?.jobId).toBe("child-1");
    expect(chainEntry?.parentRunId).toBe("session-parent");
  });

  it("builds an approval gate trace", () => {
    const job = makeJob({
      scheduler: { approval: { required: true } },
    });
    const runs = [
      makeRun({
        scheduler: { approvalId: "approval-123" },
        status: "ok",
      }),
    ];
    const trace = buildDebugTrace(job, runs);

    expect(trace.chain.some((e) => e.event === "approval_requested")).toBe(true);
    expect(trace.chain.some((e) => e.event === "approved")).toBe(true);
  });

  it("includes delivered event when run.delivered is true", () => {
    const job = makeJob();
    const runs = [makeRun({ delivered: true })];
    const trace = buildDebugTrace(job, runs);
    expect(trace.chain.some((e) => e.event === "delivered")).toBe(true);
  });
});

describe("formatDebugTrace", () => {
  it("produces human-readable output with status icons", () => {
    const job = makeJob();
    const runs = [makeRun()];
    const trace = buildDebugTrace(job, runs);
    const formatted = formatDebugTrace(trace);

    expect(formatted).toContain("Debug Trace:");
    expect(formatted).toContain("test-job");
    expect(formatted).toContain("✅");
    expect(formatted).toContain("⏳");
  });

  it("includes warnings in output", () => {
    const trace = {
      jobId: "job-1",
      jobName: "test",
      chain: [],
      summary: "0 runs",
      warnings: ["something is wrong"],
    };
    const formatted = formatDebugTrace(trace);
    expect(formatted).toContain("⚠️  Warnings:");
    expect(formatted).toContain("something is wrong");
  });
});

describe("detectTraceWarnings", () => {
  it("detects consecutive failures", () => {
    const chain = Array.from({ length: 5 }, (_, i) => ({
      timestamp: 1700000000000 + i * 60000,
      event: "failed",
      jobId: "job-1",
      jobName: "test",
      durationMs: 1000,
    }));
    const warnings = detectTraceWarnings({
      jobId: "job-1",
      jobName: "test",
      chain,
      summary: "",
      warnings: [],
    });
    expect(warnings.some((w) => w.includes("consecutive failures"))).toBe(true);
  });

  it("detects chain breaks", () => {
    const chain = [
      {
        timestamp: 1700000000000,
        event: "completed",
        jobId: "job-1",
        jobName: "test",
        runId: "run-1",
      },
      {
        timestamp: 1700000060000,
        event: "chain_triggered",
        jobId: "child-1",
        jobName: "child",
        parentRunId: "run-other",
        runId: "child-run-1",
      },
    ];
    const warnings = detectTraceWarnings({
      jobId: "job-1",
      jobName: "test",
      chain,
      summary: "",
      warnings: [],
    });
    expect(warnings.some((w) => w.includes("did not trigger expected chain children"))).toBe(true);
  });

  it("detects approval timeouts", () => {
    const chain = [
      {
        timestamp: 1700000000000,
        event: "approval_requested",
        jobId: "job-1",
        jobName: "test",
      },
      {
        timestamp: 1700000010000,
        event: "approval_requested",
        jobId: "job-1",
        jobName: "test",
      },
      {
        timestamp: 1700000020000,
        event: "approved",
        jobId: "job-1",
        jobName: "test",
      },
    ];
    const warnings = detectTraceWarnings({
      jobId: "job-1",
      jobName: "test",
      chain,
      summary: "",
      warnings: [],
    });
    expect(warnings.some((w) => w.includes("approval request(s) with no response"))).toBe(true);
  });

  it("detects idempotency skip loops", () => {
    const chain = Array.from({ length: 5 }, (_, i) => ({
      timestamp: 1700000000000 + i * 1000,
      event: "skipped_idempotent",
      jobId: "job-1",
      jobName: "test",
    }));
    const warnings = detectTraceWarnings({
      jobId: "job-1",
      jobName: "test",
      chain,
      summary: "",
      warnings: [],
    });
    expect(warnings.some((w) => w.includes("idempotency skips"))).toBe(true);
  });

  it("detects slow runs (>2x average)", () => {
    const chain = [
      { timestamp: 1, event: "completed", jobId: "j", jobName: "t", durationMs: 100 },
      { timestamp: 2, event: "completed", jobId: "j", jobName: "t", durationMs: 100 },
      { timestamp: 3, event: "completed", jobId: "j", jobName: "t", durationMs: 100 },
      { timestamp: 4, event: "completed", jobId: "j", jobName: "t", durationMs: 500 },
    ];
    const warnings = detectTraceWarnings({
      jobId: "j",
      jobName: "t",
      chain,
      summary: "",
      warnings: [],
    });
    expect(warnings.some((w) => w.includes("exceeded 2x average duration"))).toBe(true);
  });

  it("returns empty array for healthy trace", () => {
    const chain = [
      { timestamp: 1, event: "completed", jobId: "j", jobName: "t", durationMs: 100 },
      { timestamp: 2, event: "completed", jobId: "j", jobName: "t", durationMs: 110 },
    ];
    const warnings = detectTraceWarnings({
      jobId: "j",
      jobName: "t",
      chain,
      summary: "",
      warnings: [],
    });
    expect(warnings).toHaveLength(0);
  });
});
