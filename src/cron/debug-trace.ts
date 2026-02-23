/**
 * Debug Trace — traces the full execution path of a job or chain.
 *
 * Answers "what happened at 3am?" by reconstructing the timeline:
 * trigger → approval → dispatch → result → children → delivery
 */

import type { CronRunLogEntry } from "./run-log.js";
import type { CronJob } from "./types.js";

export type DebugTraceEntry = {
  timestamp: number;
  event: string;
  jobId: string;
  jobName: string;
  runId?: string;
  detail?: string;
  idempotencyKey?: string;
  parentRunId?: string;
  durationMs?: number;
};

export type DebugTraceResult = {
  jobId: string;
  jobName: string;
  chain: DebugTraceEntry[];
  summary: string;
  warnings: string[];
};

function buildRunId(entry: CronRunLogEntry): string {
  return entry.sessionId ?? `run-${entry.ts}`;
}

function resolveEvent(entry: CronRunLogEntry): string {
  if (entry.scheduler?.approvalId && entry.status === undefined) {
    return "approval_requested";
  }
  if (entry.scheduler?.idempotencyKey && entry.status === "skipped") {
    return "skipped_idempotent";
  }
  if (entry.scheduler?.replayOf) {
    return "replayed";
  }
  if (entry.scheduler?.contractValidation) {
    return entry.scheduler.contractValidation.valid ? "contract_validated" : "contract_failed";
  }
  switch (entry.status) {
    case "ok":
      return "completed";
    case "error":
      return "failed";
    case "skipped":
      return "skipped_overlap";
    default:
      return "dispatched";
  }
}

/** Build a debug trace for a job from its run log entries. */
export function buildDebugTrace(
  job: CronJob,
  runs: CronRunLogEntry[],
  childRuns?: Map<string, CronRunLogEntry[]>,
): DebugTraceResult {
  const chain: DebugTraceEntry[] = [];

  for (const run of runs) {
    const runId = buildRunId(run);
    const runAtMs = run.runAtMs ?? run.ts;

    // Scheduled event
    chain.push({
      timestamp: runAtMs,
      event: "scheduled",
      jobId: job.id,
      jobName: job.name,
      runId,
      idempotencyKey: run.scheduler?.idempotencyKey,
    });

    // Approval events
    if (run.scheduler?.approvalId) {
      chain.push({
        timestamp: runAtMs,
        event: "approval_requested",
        jobId: job.id,
        jobName: job.name,
        runId,
        detail: `approval: ${run.scheduler.approvalId}`,
      });

      if (run.status === "ok" || run.status === "error") {
        chain.push({
          timestamp: runAtMs + 1,
          event: "approved",
          jobId: job.id,
          jobName: job.name,
          runId,
        });
      } else if (run.status === "skipped") {
        chain.push({
          timestamp: runAtMs + 1,
          event: "rejected",
          jobId: job.id,
          jobName: job.name,
          runId,
        });
      }
    }

    // Dispatch
    chain.push({
      timestamp: runAtMs + 1,
      event: "dispatched",
      jobId: job.id,
      jobName: job.name,
      runId,
      parentRunId: run.scheduler?.chainTriggeredBy,
    });

    // Contract validation
    if (run.scheduler?.contractValidation) {
      const cv = run.scheduler.contractValidation;
      chain.push({
        timestamp: run.ts - 1,
        event: cv.valid ? "contract_validated" : "contract_failed",
        jobId: job.id,
        jobName: job.name,
        runId,
        detail: cv.errors?.length ? cv.errors.join("; ") : undefined,
      });
    }

    // Replay marker
    if (run.scheduler?.replayOf) {
      chain.push({
        timestamp: runAtMs,
        event: "replayed",
        jobId: job.id,
        jobName: job.name,
        runId,
        detail: `replay of ${run.scheduler.replayOf}`,
      });
    }

    // Result event
    const event = resolveEvent(run);
    chain.push({
      timestamp: run.ts,
      event,
      jobId: job.id,
      jobName: job.name,
      runId,
      durationMs: run.durationMs,
      detail: run.error ?? run.summary,
      idempotencyKey: run.scheduler?.idempotencyKey,
    });

    // Delivery
    if (run.delivered) {
      chain.push({
        timestamp: run.ts + 1,
        event: "delivered",
        jobId: job.id,
        jobName: job.name,
        runId,
      });
    }

    // Chain-triggered children
    if (childRuns && run.status === "ok") {
      for (const [childJobId, childEntries] of childRuns) {
        for (const childRun of childEntries) {
          if (childRun.scheduler?.chainTriggeredBy === runId) {
            chain.push({
              timestamp: childRun.runAtMs ?? childRun.ts,
              event: "chain_triggered",
              jobId: childJobId,
              jobName: `child:${childJobId}`,
              runId: buildRunId(childRun),
              parentRunId: runId,
              durationMs: childRun.durationMs,
              detail: childRun.status === "error" ? childRun.error : childRun.summary,
            });
          }
        }
      }
    }
  }

  // Sort by timestamp
  chain.sort((a, b) => a.timestamp - b.timestamp);

  const warnings = detectTraceWarnings({
    jobId: job.id,
    jobName: job.name,
    chain,
    summary: "",
    warnings: [],
  });

  // Build summary
  const total = runs.length;
  const ok = runs.filter((r) => r.status === "ok").length;
  const failed = runs.filter((r) => r.status === "error").length;
  const skipped = runs.filter((r) => r.status === "skipped").length;
  const summary = `${job.name}: ${total} runs (${ok} ok, ${failed} failed, ${skipped} skipped)`;

  return { jobId: job.id, jobName: job.name, chain, summary, warnings };
}

function statusIcon(event: string): string {
  switch (event) {
    case "completed":
    case "delivered":
    case "approved":
    case "contract_validated":
      return "✅";
    case "failed":
    case "rejected":
    case "contract_failed":
      return "❌";
    case "scheduled":
    case "dispatched":
    case "chain_triggered":
      return "⏳";
    case "skipped_idempotent":
    case "skipped_overlap":
    case "timeout":
    case "approval_requested":
    case "retried":
    case "replayed":
      return "⚠️";
    default:
      return "  ";
  }
}

/** Format a debug trace as a human-readable string for CLI output. */
export function formatDebugTrace(trace: DebugTraceResult): string {
  const lines: string[] = [];
  lines.push(`── Debug Trace: ${trace.jobName} (${trace.jobId}) ──`);
  lines.push(`   ${trace.summary}`);
  lines.push("");

  for (const entry of trace.chain) {
    const ts = new Date(entry.timestamp).toISOString();
    const icon = statusIcon(entry.event);
    const duration = entry.durationMs !== undefined ? ` (${entry.durationMs}ms)` : "";
    const detail = entry.detail ? ` — ${entry.detail}` : "";
    const parent = entry.parentRunId ? ` [parent: ${entry.parentRunId}]` : "";
    const idem = entry.idempotencyKey ? ` [key: ${entry.idempotencyKey.slice(0, 8)}…]` : "";

    const jobLabel = entry.jobId !== trace.jobId ? ` [${entry.jobName}]` : "";
    lines.push(`  ${icon} ${ts}  ${entry.event}${jobLabel}${duration}${detail}${parent}${idem}`);
  }

  if (trace.warnings.length > 0) {
    lines.push("");
    lines.push("  ⚠️  Warnings:");
    for (const w of trace.warnings) {
      lines.push(`    • ${w}`);
    }
  }

  return lines.join("\n");
}

/** Detect common issues in a trace (stuck runs, repeated failures, chain breaks). */
export function detectTraceWarnings(trace: DebugTraceResult): string[] {
  const warnings: string[] = [];

  // >3 consecutive failures
  let consecutiveFails = 0;
  let maxConsecutiveFails = 0;
  for (const entry of trace.chain) {
    if (entry.event === "failed") {
      consecutiveFails++;
      maxConsecutiveFails = Math.max(maxConsecutiveFails, consecutiveFails);
    } else if (entry.event === "completed") {
      consecutiveFails = 0;
    }
  }
  if (maxConsecutiveFails > 3) {
    warnings.push(`${maxConsecutiveFails} consecutive failures detected`);
  }

  // Runs >2x average duration
  const durations = trace.chain
    .filter(
      (e) => (e.event === "completed" || e.event === "failed") && typeof e.durationMs === "number",
    )
    .map((e) => e.durationMs as number);
  if (durations.length >= 2) {
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    const slow = durations.filter((d) => d > avg * 2);
    if (slow.length > 0) {
      warnings.push(
        `${slow.length} run(s) exceeded 2x average duration (avg: ${Math.round(avg)}ms)`,
      );
    }
  }

  // Chain children that never fired
  const chainTriggered = new Set(
    trace.chain.filter((e) => e.event === "chain_triggered").map((e) => e.parentRunId),
  );
  const completedRuns = trace.chain.filter(
    (e) => e.event === "completed" && e.jobId === trace.jobId,
  );
  for (const run of completedRuns) {
    // If there are any chain_triggered entries at all, check if this run had children
    if (
      trace.chain.some((e) => e.event === "chain_triggered") &&
      run.runId &&
      !chainTriggered.has(run.runId)
    ) {
      warnings.push(`completed run ${run.runId} did not trigger expected chain children`);
    }
  }

  // Approval timeouts (approval requested but no approved/rejected follow)
  const approvalRequests = trace.chain.filter((e) => e.event === "approval_requested");
  const approvalResponses = trace.chain.filter(
    (e) => e.event === "approved" || e.event === "rejected",
  );
  if (approvalRequests.length > approvalResponses.length) {
    warnings.push(
      `${approvalRequests.length - approvalResponses.length} approval request(s) with no response`,
    );
  }

  // Idempotency skips (might indicate stuck replay loop)
  const idempotencySkips = trace.chain.filter((e) => e.event === "skipped_idempotent");
  if (idempotencySkips.length > 3) {
    warnings.push(
      `${idempotencySkips.length} idempotency skips detected — possible stuck replay loop`,
    );
  }

  return warnings;
}
