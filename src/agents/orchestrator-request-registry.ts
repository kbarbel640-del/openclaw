import crypto from "node:crypto";
import type {
  OrchestratorRequestRecord,
  OrchestratorRequestStatus,
} from "./orchestrator-request-registry.store.js";
import {
  loadOrchestratorRegistryFromDisk,
  saveOrchestratorRegistryToDisk,
} from "./orchestrator-request-registry.store.js";

export type { OrchestratorRequestRecord, OrchestratorRequestStatus };

// ── Constants ──────────────────────────────────────────────────────────

const MAX_PENDING_PER_CHILD = 3;
const MAX_PENDING_PER_PARENT = 20;
const RATE_LIMIT_PER_CHILD = 5; // per minute
const TERMINAL_RECORD_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const SWEEPER_INTERVAL_MS = 5_000;
const DEFAULT_TIMEOUT_MS = 300_000; // 5 min
const MAX_TIMEOUT_MS = 3_600_000; // 1 hour
const MIN_TIMEOUT_MS = 10_000; // 10s

// ── State ──────────────────────────────────────────────────────────────

const requests = new Map<string, OrchestratorRequestRecord>();
const waiters = new Map<
  string,
  { resolve: (record: OrchestratorRequestRecord) => void; reject: (err: Error) => void }
>();
const waitTimers = new Map<string, ReturnType<typeof setTimeout>>();

// Rate limiting: track timestamps of request creation per child
const rateLimitLog = new Map<string, number[]>();

let sweeper: ReturnType<typeof setInterval> | null = null;
let restoreAttempted = false;

// ── Persistence ────────────────────────────────────────────────────────

function persistRequests() {
  try {
    saveOrchestratorRegistryToDisk(requests);
  } catch {
    // ignore persistence failures
  }
}

// ── Helpers ────────────────────────────────────────────────────────────

function isPending(status: OrchestratorRequestStatus): boolean {
  return status === "pending" || status === "notified";
}

function isTerminal(status: OrchestratorRequestStatus): boolean {
  return (
    status === "resolved" || status === "timeout" || status === "cancelled" || status === "orphaned"
  );
}

function countPendingForChild(childSessionKey: string): number {
  let count = 0;
  for (const record of requests.values()) {
    if (record.childSessionKey === childSessionKey && isPending(record.status)) {
      count++;
    }
  }
  return count;
}

function countPendingForParent(parentSessionKey: string): number {
  let count = 0;
  for (const record of requests.values()) {
    if (record.parentSessionKey === parentSessionKey && isPending(record.status)) {
      count++;
    }
  }
  return count;
}

function checkRateLimit(childSessionKey: string): boolean {
  const now = Date.now();
  const window = 60_000; // 1 minute
  const log = rateLimitLog.get(childSessionKey) ?? [];
  // Clean old entries
  const recent = log.filter((ts) => now - ts < window);
  rateLimitLog.set(childSessionKey, recent);
  return recent.length < RATE_LIMIT_PER_CHILD;
}

function recordRateLimit(childSessionKey: string): void {
  const now = Date.now();
  const log = rateLimitLog.get(childSessionKey) ?? [];
  log.push(now);
  rateLimitLog.set(childSessionKey, log);
}

function sweepTerminalRecords(): void {
  const now = Date.now();
  let mutated = false;
  for (const [id, record] of requests.entries()) {
    if (isTerminal(record.status)) {
      const resolvedAt = record.resolvedAt ?? record.createdAt;
      if (now - resolvedAt > TERMINAL_RECORD_TTL_MS) {
        requests.delete(id);
        mutated = true;
      }
    }
  }
  if (mutated) {
    persistRequests();
  }
}

function wakeWaiter(requestId: string, record: OrchestratorRequestRecord): void {
  const waiter = waiters.get(requestId);
  if (waiter) {
    waiter.resolve(record);
    waiters.delete(requestId);
  }
  const timer = waitTimers.get(requestId);
  if (timer) {
    clearTimeout(timer);
    waitTimers.delete(requestId);
  }
}

function timeoutRequest(requestId: string): void {
  const record = requests.get(requestId);
  if (!record || !isPending(record.status)) {
    return;
  }
  record.status = "timeout";
  record.error = `Parent did not respond within ${Math.round((record.timeoutAt - record.createdAt) / 1000)}s`;
  persistRequests();
  wakeWaiter(requestId, record);
}

// ── Public API ─────────────────────────────────────────────────────────

export function createOrchestratorRequest(params: {
  childSessionKey: string;
  parentSessionKey: string;
  runId?: string;
  message: string;
  context?: string;
  priority?: "normal" | "high";
  timeoutMs?: number;
}): string {
  // Sweep terminal records on every create
  sweepTerminalRecords();

  // Check pending caps
  if (countPendingForChild(params.childSessionKey) >= MAX_PENDING_PER_CHILD) {
    throw new Error(
      `Max pending requests (${MAX_PENDING_PER_CHILD}) reached for child ${params.childSessionKey}`,
    );
  }
  if (countPendingForParent(params.parentSessionKey) >= MAX_PENDING_PER_PARENT) {
    throw new Error(
      `Max pending requests (${MAX_PENDING_PER_PARENT}) reached for parent ${params.parentSessionKey}`,
    );
  }

  // Check rate limit
  if (!checkRateLimit(params.childSessionKey)) {
    throw new Error(
      `Rate limit exceeded (${RATE_LIMIT_PER_CHILD}/min) for child ${params.childSessionKey}`,
    );
  }

  const now = Date.now();
  const rawTimeout = params.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const effectiveTimeout = Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, rawTimeout));

  const requestId = `req_${crypto.randomUUID()}`;
  const record: OrchestratorRequestRecord = {
    requestId,
    childSessionKey: params.childSessionKey,
    parentSessionKey: params.parentSessionKey,
    runId: params.runId,
    message: params.message,
    context: params.context,
    priority: params.priority ?? "normal",
    status: "pending",
    createdAt: now,
    timeoutAt: now + effectiveTimeout,
  };

  requests.set(requestId, record);
  recordRateLimit(params.childSessionKey);
  persistRequests();

  return requestId;
}

export function resolveOrchestratorRequest(
  requestId: string,
  response: string,
  respondedBySessionKey: string,
): void {
  const record = requests.get(requestId);
  if (!record) {
    throw new Error(`Request not found: ${requestId}`);
  }
  if (!isPending(record.status)) {
    throw new Error(`Request ${requestId} is already ${record.status}`);
  }
  // Check if expired
  if (Date.now() > record.timeoutAt) {
    // Mark as timed out first
    record.status = "timeout";
    record.error = "Request expired before response";
    persistRequests();
    wakeWaiter(requestId, record);
    throw new Error(`Request ${requestId} has expired`);
  }

  record.status = "resolved";
  record.response = response;
  record.resolvedBySessionKey = respondedBySessionKey;
  record.resolvedAt = Date.now();
  persistRequests();
  wakeWaiter(requestId, record);
}

export function getOrchestratorRequest(requestId: string): OrchestratorRequestRecord | undefined {
  return requests.get(requestId);
}

export function listPendingRequestsForParent(
  parentSessionKey: string,
): OrchestratorRequestRecord[] {
  const result: OrchestratorRequestRecord[] = [];
  for (const record of requests.values()) {
    if (record.parentSessionKey === parentSessionKey && isPending(record.status)) {
      result.push(record);
    }
  }
  return result;
}

export function listPendingRequestsForChild(childSessionKey: string): OrchestratorRequestRecord[] {
  const result: OrchestratorRequestRecord[] = [];
  for (const record of requests.values()) {
    if (record.childSessionKey === childSessionKey && isPending(record.status)) {
      result.push(record);
    }
  }
  return result;
}

export function cancelRequestsForChild(childSessionKey: string): void {
  let mutated = false;
  for (const record of requests.values()) {
    if (record.childSessionKey === childSessionKey && isPending(record.status)) {
      record.status = "cancelled";
      record.error = "Child session terminated";
      mutated = true;
      wakeWaiter(record.requestId, record);
    }
  }
  if (mutated) {
    persistRequests();
  }
}

export function orphanRequestsForParent(parentSessionKey: string): void {
  let mutated = false;
  for (const record of requests.values()) {
    if (record.parentSessionKey === parentSessionKey && isPending(record.status)) {
      record.status = "orphaned";
      record.error = "Parent session terminated";
      mutated = true;
      wakeWaiter(record.requestId, record);
    }
  }
  if (mutated) {
    persistRequests();
  }
}

export function waitForResolution(
  requestId: string,
  timeoutMs: number,
  abortSignal?: AbortSignal,
): Promise<OrchestratorRequestRecord> {
  const record = requests.get(requestId);
  if (!record) {
    return Promise.reject(new Error(`Request not found: ${requestId}`));
  }

  // Already resolved
  if (isTerminal(record.status)) {
    return Promise.resolve(record);
  }

  return new Promise<OrchestratorRequestRecord>((resolve, reject) => {
    // Set up abort signal handler
    if (abortSignal) {
      if (abortSignal.aborted) {
        reject(new Error("Aborted"));
        return;
      }
      const onAbort = () => {
        waiters.delete(requestId);
        const timer = waitTimers.get(requestId);
        if (timer) {
          clearTimeout(timer);
          waitTimers.delete(requestId);
        }
        reject(new Error("Aborted"));
      };
      abortSignal.addEventListener("abort", onAbort, { once: true });
    }

    // Store waiter
    waiters.set(requestId, { resolve, reject });

    // Set timeout
    const effectiveTimeout = Math.min(timeoutMs, Math.max(0, record.timeoutAt - Date.now()));
    const timer = setTimeout(() => {
      timeoutRequest(requestId);
    }, effectiveTimeout);
    if (timer.unref) {
      timer.unref();
    }
    waitTimers.set(requestId, timer);
  });
}

// ── Sweeper ────────────────────────────────────────────────────────────

export function startTimeoutSweeper(): void {
  if (sweeper) {
    return;
  }
  sweeper = setInterval(() => {
    const now = Date.now();
    for (const record of requests.values()) {
      if (isPending(record.status) && now >= record.timeoutAt) {
        timeoutRequest(record.requestId);
      }
    }
    sweepTerminalRecords();
  }, SWEEPER_INTERVAL_MS);
  if (sweeper.unref) {
    sweeper.unref();
  }
}

export function stopTimeoutSweeper(): void {
  if (!sweeper) {
    return;
  }
  clearInterval(sweeper);
  sweeper = null;
}

// ── Init & Test Reset ──────────────────────────────────────────────────

export function initOrchestratorRegistry(): void {
  if (restoreAttempted) {
    return;
  }
  restoreAttempted = true;
  try {
    const restored = loadOrchestratorRegistryFromDisk();
    for (const [id, record] of restored.entries()) {
      if (!requests.has(id)) {
        requests.set(id, record);
      }
    }
  } catch {
    // ignore restore failures
  }
}

export function resetOrchestratorRegistryForTests(): void {
  requests.clear();
  waiters.clear();
  for (const timer of waitTimers.values()) {
    clearTimeout(timer);
  }
  waitTimers.clear();
  rateLimitLog.clear();
  stopTimeoutSweeper();
  restoreAttempted = false;
  persistRequests();
}
