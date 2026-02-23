import { spawn } from "node:child_process";
import crypto from "node:crypto";
import { existsSync } from "node:fs";
import { loadConfig } from "../config/config.js";
import { callGateway } from "../gateway/call.js";
import { onAgentEvent } from "../infra/agent-events.js";
import { parseAgentSessionKey } from "../routing/session-key.js";
import { type DeliveryContext, normalizeDeliveryContext } from "../utils/delivery-context.js";
import { resolveAgentConfig } from "./agent-scope.js";
import { AGENT_LANE_SUBAGENT } from "./lanes.js";
import {
  buildSubagentSystemPrompt,
  runSubagentAnnounceFlow,
  type SubagentRunOutcome,
} from "./subagent-announce.js";
import {
  loadSubagentRegistryFromDisk,
  saveSubagentRegistryToDisk,
} from "./subagent-registry.store.js";
import {
  extractTranscriptSummary,
  formatTranscriptForRetry,
} from "./subagent-transcript-summary.js";
import { resolveAgentTimeoutMs } from "./timeout.js";

/** Resolve psql path once at import time. */
const PSQL_PATH =
  [
    `${process.env.HOME}/bin/psql`,
    "/Applications/Postgres.app/Contents/Versions/14/bin/psql",
    "/opt/homebrew/bin/psql",
    "/usr/local/bin/psql",
    "psql",
  ].find((p) => p === "psql" || existsSync(p)) ?? "psql";

/**
 * Log a standalone sessions_spawn run to oms.agent_work_log.
 * Fire-and-forget — productivity tracking is best-effort.
 */
function logDirectSpawnWork(entry: SubagentRunRecord): void {
  if (!entry.startedAt || !entry.endedAt) return;
  const durationMs = entry.endedAt - entry.startedAt;
  if (durationMs <= 0) return;

  const parsed = parseAgentSessionKey(entry.childSessionKey);
  const agentId = parsed?.agentId;
  if (!agentId) return;

  const startIso = new Date(entry.startedAt).toISOString();
  const endIso = new Date(entry.endedAt).toISOString();
  const desc = (entry.originalTask ?? entry.task ?? "").slice(0, 500).replace(/'/g, "''");
  const status = entry.outcome?.status ?? "unknown";

  const sql =
    `INSERT INTO oms.agent_work_log (agent_id, work_type, source_id, duration_ms, started_at, ended_at, status, description) ` +
    `VALUES ('${agentId}', 'direct_spawn', '${entry.runId}', ${durationMs}, ` +
    `'${startIso}', '${endIso}', '${status}', '${desc}') ` +
    `ON CONFLICT (work_type, source_id) DO NOTHING;\n`;
  const proc = spawn(PSQL_PATH, ["-d", "brain"], { stdio: ["pipe", "ignore", "ignore"] });
  proc.stdin?.write(sql);
  proc.stdin?.end();
}

type RunCompletionInterceptor = (runId: string, entry: SubagentRunRecord) => boolean;
let runCompletionInterceptor: RunCompletionInterceptor | null = null;

export function setRunCompletionInterceptor(fn: RunCompletionInterceptor | null) {
  runCompletionInterceptor = fn;
}

export function getSubagentRun(runId: string): SubagentRunRecord | undefined {
  return subagentRuns.get(runId);
}

export type SubagentRunRecord = {
  runId: string;
  childSessionKey: string;
  requesterSessionKey: string;
  requesterOrigin?: DeliveryContext;
  requesterDisplayKey: string;
  task: string;
  cleanup: "delete" | "keep";
  label?: string;
  createdAt: number;
  startedAt?: number;
  endedAt?: number;
  outcome?: SubagentRunOutcome;
  archiveAtMs?: number;
  cleanupCompletedAt?: number;
  cleanupHandled?: boolean;
  /** Current retry number (0 = original attempt). */
  retryCount?: number;
  /** Maximum retries allowed (from agent config). */
  maxRetries?: number;
  /** Original task text before retry augmentation. */
  originalTask?: string;
};

const subagentRuns = new Map<string, SubagentRunRecord>();
let sweeper: NodeJS.Timeout | null = null;
let listenerStarted = false;
let listenerStop: (() => void) | null = null;
// Use var to avoid TDZ when init runs across circular imports during bootstrap.
var restoreAttempted = false;

function persistSubagentRuns() {
  try {
    saveSubagentRegistryToDisk(subagentRuns);
  } catch {
    // ignore persistence failures
  }
}

const resumedRuns = new Set<string>();

function resumeSubagentRun(runId: string) {
  if (!runId || resumedRuns.has(runId)) {
    return;
  }
  const entry = subagentRuns.get(runId);
  if (!entry) {
    return;
  }
  if (entry.cleanupCompletedAt) {
    return;
  }

  if (typeof entry.endedAt === "number" && entry.endedAt > 0) {
    if (!beginSubagentCleanup(runId)) {
      return;
    }
    const requesterOrigin = normalizeDeliveryContext(entry.requesterOrigin);
    void runSubagentAnnounceFlow({
      childSessionKey: entry.childSessionKey,
      childRunId: entry.runId,
      requesterSessionKey: entry.requesterSessionKey,
      requesterOrigin,
      requesterDisplayKey: entry.requesterDisplayKey,
      task: entry.task,
      timeoutMs: 30_000,
      cleanup: entry.cleanup,
      waitForCompletion: false,
      startedAt: entry.startedAt,
      endedAt: entry.endedAt,
      label: entry.label,
      outcome: entry.outcome,
    }).then((didAnnounce) => {
      finalizeSubagentCleanup(runId, entry.cleanup, didAnnounce);
    });
    resumedRuns.add(runId);
    return;
  }

  // Wait for completion again after restart.
  const cfg = loadConfig();
  const waitTimeoutMs = resolveSubagentWaitTimeoutMs(cfg, undefined);
  void waitForSubagentCompletion(runId, waitTimeoutMs);
  resumedRuns.add(runId);
}

function restoreSubagentRunsOnce() {
  if (restoreAttempted) {
    return;
  }
  restoreAttempted = true;
  try {
    const restored = loadSubagentRegistryFromDisk();
    if (restored.size === 0) {
      return;
    }
    for (const [runId, entry] of restored.entries()) {
      if (!runId || !entry) {
        continue;
      }
      // Keep any newer in-memory entries.
      if (!subagentRuns.has(runId)) {
        subagentRuns.set(runId, entry);
      }
    }

    // Resume pending work.
    ensureListener();
    if ([...subagentRuns.values()].some((entry) => entry.archiveAtMs)) {
      startSweeper();
    }
    for (const runId of subagentRuns.keys()) {
      resumeSubagentRun(runId);
    }
  } catch {
    // ignore restore failures
  }
}

function resolveArchiveAfterMs(cfg?: ReturnType<typeof loadConfig>) {
  const config = cfg ?? loadConfig();
  const minutes = config.agents?.defaults?.subagents?.archiveAfterMinutes ?? 60;
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return undefined;
  }
  return Math.max(1, Math.floor(minutes)) * 60_000;
}

function resolveSubagentWaitTimeoutMs(
  cfg: ReturnType<typeof loadConfig>,
  runTimeoutSeconds?: number,
) {
  return resolveAgentTimeoutMs({ cfg, overrideSeconds: runTimeoutSeconds });
}

function startSweeper() {
  if (sweeper) {
    return;
  }
  sweeper = setInterval(() => {
    void sweepSubagentRuns();
  }, 60_000);
  sweeper.unref?.();
}

function stopSweeper() {
  if (!sweeper) {
    return;
  }
  clearInterval(sweeper);
  sweeper = null;
}

async function sweepSubagentRuns() {
  const now = Date.now();
  let mutated = false;
  for (const [runId, entry] of subagentRuns.entries()) {
    if (!entry.archiveAtMs || entry.archiveAtMs > now) {
      continue;
    }
    subagentRuns.delete(runId);
    mutated = true;
    try {
      await callGateway({
        method: "sessions.delete",
        params: { key: entry.childSessionKey, deleteTranscript: true },
        timeoutMs: 10_000,
      });
    } catch {
      // ignore
    }
  }
  if (mutated) {
    persistSubagentRuns();
  }
  if (subagentRuns.size === 0) {
    stopSweeper();
  }
}

function shouldRetry(entry: SubagentRunRecord): boolean {
  if (!entry.outcome) return false;
  if (entry.outcome.status === "ok") return false;
  const max = entry.maxRetries ?? 0;
  const count = entry.retryCount ?? 0;
  return max > 0 && count < max;
}

async function executeRetry(entry: SubagentRunRecord): Promise<void> {
  const retryNumber = (entry.retryCount ?? 0) + 1;
  const cfg = loadConfig();

  // Extract agent ID from child session key (e.g. "agent:vulcan:subagent:uuid" → "vulcan")
  const parsed = parseAgentSessionKey(entry.childSessionKey);
  const targetAgentId = parsed?.agentId;
  if (!targetAgentId) return;

  // Extract transcript summary from the failed session
  const summary = await extractTranscriptSummary({ sessionKey: entry.childSessionKey });

  // Build retry task with previous attempt context
  const retryTask = formatTranscriptForRetry({
    originalTask: entry.originalTask ?? entry.task,
    summary,
    retryNumber,
    maxRetries: entry.maxRetries ?? 0,
    failureReason: entry.outcome?.error,
  });

  // Resolve agent config for taskDirective
  const targetAgentConfig = resolveAgentConfig(cfg, targetAgentId);
  const directive = targetAgentConfig?.taskDirective?.trim();
  const effectiveTask = directive ? `${retryTask}\n\n---\n\n${directive}` : retryTask;

  // Generate new session key for the retry
  const childSessionKey = `agent:${targetAgentId}:subagent:${crypto.randomUUID()}`;
  const requesterOrigin = normalizeDeliveryContext(entry.requesterOrigin);

  const retryLabel = entry.label ? `${entry.label} (retry ${retryNumber})` : `retry-${retryNumber}`;
  const childSystemPrompt = buildSubagentSystemPrompt({
    requesterSessionKey: entry.requesterSessionKey,
    requesterOrigin,
    childSessionKey,
    label: retryLabel,
    task: retryTask,
  });

  // Spawn the retry session via gateway
  const childIdem = crypto.randomUUID();
  let childRunId = childIdem;
  const response = await callGateway<{ runId: string }>({
    method: "agent",
    params: {
      message: effectiveTask,
      sessionKey: childSessionKey,
      idempotencyKey: childIdem,
      deliver: false,
      lane: AGENT_LANE_SUBAGENT,
      extraSystemPrompt: childSystemPrompt,
    },
    timeoutMs: 10_000,
  });
  if (typeof response?.runId === "string" && response.runId) {
    childRunId = response.runId;
  }

  // Register the retry as a new subagent run with incremented retry count
  registerSubagentRun({
    runId: childRunId,
    childSessionKey,
    requesterSessionKey: entry.requesterSessionKey,
    requesterOrigin: entry.requesterOrigin,
    requesterDisplayKey: entry.requesterDisplayKey,
    task: retryTask,
    cleanup: entry.cleanup,
    label: entry.label,
    retryCount: retryNumber,
    maxRetries: entry.maxRetries,
    originalTask: entry.originalTask ?? entry.task,
  });
}

/** Helper to run the normal announce flow for a completed/failed entry. */
function announceSubagentResult(runId: string, entry: SubagentRunRecord) {
  if (!beginSubagentCleanup(runId)) return;
  // Log standalone spawn duration for productivity tracking (fire-and-forget)
  logDirectSpawnWork(entry);
  const requesterOrigin = normalizeDeliveryContext(entry.requesterOrigin);
  void runSubagentAnnounceFlow({
    childSessionKey: entry.childSessionKey,
    childRunId: entry.runId,
    requesterSessionKey: entry.requesterSessionKey,
    requesterOrigin,
    requesterDisplayKey: entry.requesterDisplayKey,
    task: entry.task,
    timeoutMs: 30_000,
    cleanup: entry.cleanup,
    waitForCompletion: false,
    startedAt: entry.startedAt,
    endedAt: entry.endedAt,
    label: entry.label,
    outcome: entry.outcome,
  }).then((didAnnounce) => {
    finalizeSubagentCleanup(runId, entry.cleanup, didAnnounce);
  });
}

function ensureListener() {
  if (listenerStarted) {
    return;
  }
  listenerStarted = true;
  listenerStop = onAgentEvent((evt) => {
    if (!evt || evt.stream !== "lifecycle") {
      return;
    }
    const entry = subagentRuns.get(evt.runId);
    if (!entry) {
      return;
    }
    const phase = evt.data?.phase;
    if (phase === "start") {
      const startedAt = typeof evt.data?.startedAt === "number" ? evt.data.startedAt : undefined;
      if (startedAt) {
        entry.startedAt = startedAt;
        persistSubagentRuns();
      }
      return;
    }
    if (phase !== "end" && phase !== "error") {
      return;
    }
    const endedAt = typeof evt.data?.endedAt === "number" ? evt.data.endedAt : Date.now();
    entry.endedAt = endedAt;
    if (phase === "error") {
      const error = typeof evt.data?.error === "string" ? evt.data.error : undefined;
      entry.outcome = { status: "error", error };
    } else {
      entry.outcome = { status: "ok" };
    }
    persistSubagentRuns();

    // Let mission system claim this run before individual announce/retry
    if (runCompletionInterceptor?.(evt.runId, entry)) return;

    // Check if this failed run should be retried before announcing failure
    if (shouldRetry(entry)) {
      void executeRetry(entry).catch(() => {
        // Retry spawn failed — fall through to normal announce
        announceSubagentResult(evt.runId, entry);
      });
      return;
    }

    announceSubagentResult(evt.runId, entry);
  });
}

function finalizeSubagentCleanup(runId: string, cleanup: "delete" | "keep", didAnnounce: boolean) {
  const entry = subagentRuns.get(runId);
  if (!entry) {
    return;
  }
  if (cleanup === "delete") {
    subagentRuns.delete(runId);
    persistSubagentRuns();
    return;
  }
  if (!didAnnounce) {
    // Allow retry on the next wake if the announce failed.
    entry.cleanupHandled = false;
    persistSubagentRuns();
    return;
  }
  entry.cleanupCompletedAt = Date.now();
  persistSubagentRuns();
}

function beginSubagentCleanup(runId: string) {
  const entry = subagentRuns.get(runId);
  if (!entry) {
    return false;
  }
  if (entry.cleanupCompletedAt) {
    return false;
  }
  if (entry.cleanupHandled) {
    return false;
  }
  entry.cleanupHandled = true;
  persistSubagentRuns();
  return true;
}

export function registerSubagentRun(params: {
  runId: string;
  childSessionKey: string;
  requesterSessionKey: string;
  requesterOrigin?: DeliveryContext;
  requesterDisplayKey: string;
  task: string;
  cleanup: "delete" | "keep";
  label?: string;
  runTimeoutSeconds?: number;
  retryCount?: number;
  maxRetries?: number;
  originalTask?: string;
}) {
  const now = Date.now();
  const cfg = loadConfig();
  const archiveAfterMs = resolveArchiveAfterMs(cfg);
  const archiveAtMs = archiveAfterMs ? now + archiveAfterMs : undefined;
  const waitTimeoutMs = resolveSubagentWaitTimeoutMs(cfg, params.runTimeoutSeconds);
  const requesterOrigin = normalizeDeliveryContext(params.requesterOrigin);
  subagentRuns.set(params.runId, {
    runId: params.runId,
    childSessionKey: params.childSessionKey,
    requesterSessionKey: params.requesterSessionKey,
    requesterOrigin,
    requesterDisplayKey: params.requesterDisplayKey,
    task: params.task,
    cleanup: params.cleanup,
    label: params.label,
    createdAt: now,
    startedAt: now,
    archiveAtMs,
    cleanupHandled: false,
    retryCount: params.retryCount ?? 0,
    maxRetries: params.maxRetries ?? 0,
    originalTask: params.originalTask ?? params.task,
  });
  ensureListener();
  persistSubagentRuns();
  if (archiveAfterMs) {
    startSweeper();
  }
  // Wait for subagent completion via gateway RPC (cross-process).
  // The in-process lifecycle listener is a fallback for embedded runs.
  void waitForSubagentCompletion(params.runId, waitTimeoutMs);
}

async function waitForSubagentCompletion(runId: string, waitTimeoutMs: number) {
  try {
    const timeoutMs = Math.max(1, Math.floor(waitTimeoutMs));
    const wait = await callGateway<{
      status?: string;
      startedAt?: number;
      endedAt?: number;
      error?: string;
    }>({
      method: "agent.wait",
      params: {
        runId,
        timeoutMs,
      },
      timeoutMs: timeoutMs + 10_000,
    });
    if (wait?.status !== "ok" && wait?.status !== "error") {
      return;
    }
    const entry = subagentRuns.get(runId);
    if (!entry) {
      return;
    }
    let mutated = false;
    if (typeof wait.startedAt === "number") {
      entry.startedAt = wait.startedAt;
      mutated = true;
    }
    if (typeof wait.endedAt === "number") {
      entry.endedAt = wait.endedAt;
      mutated = true;
    }
    if (!entry.endedAt) {
      entry.endedAt = Date.now();
      mutated = true;
    }
    const waitError = typeof wait.error === "string" ? wait.error : undefined;
    entry.outcome =
      wait.status === "error" ? { status: "error", error: waitError } : { status: "ok" };
    mutated = true;
    if (mutated) {
      persistSubagentRuns();
    }

    // Let mission system claim this run before individual announce/retry
    if (runCompletionInterceptor?.(runId, entry)) return;

    // Check if this failed run should be retried before announcing failure
    if (shouldRetry(entry)) {
      void executeRetry(entry).catch(() => {
        // Retry spawn failed — fall through to normal announce
        announceSubagentResult(runId, entry);
      });
      return;
    }

    announceSubagentResult(runId, entry);
  } catch {
    // ignore
  }
}

export function resetSubagentRegistryForTests() {
  subagentRuns.clear();
  resumedRuns.clear();
  stopSweeper();
  restoreAttempted = false;
  if (listenerStop) {
    listenerStop();
    listenerStop = null;
  }
  listenerStarted = false;
  runCompletionInterceptor = null;
  persistSubagentRuns();
}

export function addSubagentRunForTests(entry: SubagentRunRecord) {
  subagentRuns.set(entry.runId, entry);
  persistSubagentRuns();
}

export function releaseSubagentRun(runId: string) {
  const didDelete = subagentRuns.delete(runId);
  if (didDelete) {
    persistSubagentRuns();
  }
  if (subagentRuns.size === 0) {
    stopSweeper();
  }
}

export function listSubagentRunsForRequester(requesterSessionKey: string): SubagentRunRecord[] {
  const key = requesterSessionKey.trim();
  if (!key) {
    return [];
  }
  return [...subagentRuns.values()].filter((entry) => entry.requesterSessionKey === key);
}

export function initSubagentRegistry() {
  restoreSubagentRunsOnce();
}
