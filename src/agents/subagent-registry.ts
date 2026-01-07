import { loadConfig } from "../config/config.js";
import { callGateway } from "../gateway/call.js";
import { onAgentEvent } from "../infra/agent-events.js";
import { runSubagentAnnounceFlow } from "./subagent-announce.js";

export type SubagentRunStatus = "running" | "ok" | "error" | "timeout";

export type SubagentRunRecord = {
  runId: string;
  childSessionKey: string;
  requesterSessionKey: string;
  requesterProvider?: string;
  requesterDisplayKey: string;
  task: string;
  cleanup: "delete" | "keep";
  createdAt: number;
  startedAt?: number;
  endedAt?: number;
  lastStatus?: SubagentRunStatus;
  lastCheckedAt?: number;
  archiveAtMs?: number;
  announceHandled: boolean;
};

const subagentRuns = new Map<string, SubagentRunRecord>();
let sweeper: NodeJS.Timeout | null = null;
let listenerStarted = false;

function resolveArchiveAfterMs() {
  const cfg = loadConfig();
  const minutes = cfg.agent?.subagents?.archiveAfterMinutes ?? 60;
  if (!Number.isFinite(minutes) || minutes <= 0) return undefined;
  return Math.max(1, Math.floor(minutes)) * 60_000;
}

function startSweeper() {
  if (sweeper) return;
  sweeper = setInterval(() => {
    void sweepSubagentRuns();
  }, 60_000);
  sweeper.unref?.();
}

function stopSweeper() {
  if (!sweeper) return;
  clearInterval(sweeper);
  sweeper = null;
}

async function sweepSubagentRuns() {
  const now = Date.now();
  for (const [runId, entry] of subagentRuns.entries()) {
    if (!entry.archiveAtMs || entry.archiveAtMs > now) continue;
    subagentRuns.delete(runId);
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
  if (subagentRuns.size === 0) stopSweeper();
}

function ensureListener() {
  if (listenerStarted) return;
  listenerStarted = true;
  onAgentEvent((evt) => {
    if (!evt || evt.stream !== "lifecycle") return;
    const entry = subagentRuns.get(evt.runId);
    if (!entry) return;
    const phase = evt.data?.phase;
    if (phase === "start") {
      const startedAt =
        typeof evt.data?.startedAt === "number"
          ? (evt.data.startedAt as number)
          : undefined;
      if (startedAt) entry.startedAt = startedAt;
      return;
    }
    if (phase !== "end" && phase !== "error") return;
    const endedAt =
      typeof evt.data?.endedAt === "number"
        ? (evt.data.endedAt as number)
        : Date.now();
    entry.endedAt = endedAt;
    entry.lastStatus = phase === "error" ? "error" : "ok";
    if (!beginSubagentAnnounce(evt.runId)) {
      if (entry.cleanup === "delete") {
        subagentRuns.delete(evt.runId);
      }
      return;
    }
    void runSubagentAnnounceFlow({
      childSessionKey: entry.childSessionKey,
      childRunId: entry.runId,
      requesterSessionKey: entry.requesterSessionKey,
      requesterProvider: entry.requesterProvider,
      requesterDisplayKey: entry.requesterDisplayKey,
      task: entry.task,
      timeoutMs: 30_000,
      cleanup: entry.cleanup,
      waitForCompletion: false,
      startedAt: entry.startedAt,
      endedAt: entry.endedAt,
    });
    if (entry.cleanup === "delete") {
      subagentRuns.delete(evt.runId);
    }
  });
}

export function beginSubagentAnnounce(runId: string) {
  const entry = subagentRuns.get(runId);
  if (!entry) return false;
  if (entry.announceHandled) return false;
  entry.announceHandled = true;
  return true;
}

export function getSubagentRun(runId: string) {
  return subagentRuns.get(runId);
}

export function updateSubagentRun(
  runId: string,
  update: Partial<SubagentRunRecord>,
) {
  if (!runId) return undefined;
  const existing = subagentRuns.get(runId);
  if (!existing) return undefined;
  const next = { ...existing, ...update };
  subagentRuns.set(runId, next);
  return next;
}

export function registerSubagentRun(params: {
  runId: string;
  childSessionKey: string;
  requesterSessionKey: string;
  requesterProvider?: string;
  requesterDisplayKey: string;
  task: string;
  cleanup: "delete" | "keep";
}) {
  const now = Date.now();
  const archiveAfterMs = resolveArchiveAfterMs();
  const archiveAtMs = archiveAfterMs ? now + archiveAfterMs : undefined;
  subagentRuns.set(params.runId, {
    runId: params.runId,
    childSessionKey: params.childSessionKey,
    requesterSessionKey: params.requesterSessionKey,
    requesterProvider: params.requesterProvider,
    requesterDisplayKey: params.requesterDisplayKey,
    task: params.task,
    cleanup: params.cleanup,
    createdAt: now,
    startedAt: now,
    lastStatus: "running",
    archiveAtMs,
    announceHandled: false,
  });
  ensureListener();
  if (archiveAfterMs) startSweeper();
  void probeImmediateCompletion(params.runId);
}

async function probeImmediateCompletion(runId: string) {
  try {
    const wait = (await callGateway({
      method: "agent.wait",
      params: {
        runId,
        timeoutMs: 0,
      },
      timeoutMs: 2000,
    })) as { status?: string; startedAt?: number; endedAt?: number };
    if (wait?.status !== "ok" && wait?.status !== "error") return;
    const entry = subagentRuns.get(runId);
    if (!entry) return;
    if (typeof wait.startedAt === "number") entry.startedAt = wait.startedAt;
    if (typeof wait.endedAt === "number") entry.endedAt = wait.endedAt;
    if (!entry.endedAt) entry.endedAt = Date.now();
    entry.lastStatus = wait.status === "error" ? "error" : "ok";
    if (!beginSubagentAnnounce(runId)) return;
    void runSubagentAnnounceFlow({
      childSessionKey: entry.childSessionKey,
      childRunId: entry.runId,
      requesterSessionKey: entry.requesterSessionKey,
      requesterProvider: entry.requesterProvider,
      requesterDisplayKey: entry.requesterDisplayKey,
      task: entry.task,
      timeoutMs: 30_000,
      cleanup: entry.cleanup,
      waitForCompletion: false,
      startedAt: entry.startedAt,
      endedAt: entry.endedAt,
    });
    if (entry.cleanup === "delete") {
      subagentRuns.delete(runId);
    }
  } catch {
    // ignore
  }
}

export function resetSubagentRegistryForTests() {
  subagentRuns.clear();
  stopSweeper();
}

export function releaseSubagentRun(runId: string) {
  subagentRuns.delete(runId);
  if (subagentRuns.size === 0) stopSweeper();
}
