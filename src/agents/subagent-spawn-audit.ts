/**
 * ENGN-5612: Agent spawn audit logging and rate alerts.
 *
 * Tracks per-agent spawn rates and triggers warnings when thresholds
 * are exceeded. Provides queryable spawn history.
 */

import { defaultRuntime } from "../runtime.js";

export type SpawnRateAlertConfig = {
  threshold: number;
  windowMs: number;
};

const DEFAULT_THRESHOLD = 5;
const DEFAULT_WINDOW_MS = 60_000; // 1 minute

let config: SpawnRateAlertConfig = {
  threshold: DEFAULT_THRESHOLD,
  windowMs: DEFAULT_WINDOW_MS,
};

type SpawnEvent = {
  agentId: string;
  timestamp: number;
  runId: string;
  childSessionKey: string;
  label?: string;
};

const spawnHistory: SpawnEvent[] = [];
const MAX_HISTORY_SIZE = 1000;

/** Optional callback for alert delivery (e.g., Slack notification). */
let alertCallback: ((message: string, agentId: string) => void | Promise<void>) | null = null;

export function configureSpawnRateAlert(partial: Partial<SpawnRateAlertConfig>): void {
  if (typeof partial.threshold === "number" && partial.threshold >= 1) {
    config.threshold = Math.floor(partial.threshold);
  }
  if (typeof partial.windowMs === "number" && partial.windowMs > 0) {
    config.windowMs = Math.floor(partial.windowMs);
  }
}

export function setSpawnAlertCallback(
  cb: ((message: string, agentId: string) => void | Promise<void>) | null,
): void {
  alertCallback = cb;
}

function pruneHistory(now: number): void {
  // Keep events within 1 hour for query purposes, but prune older ones
  const hourAgo = now - 3_600_000;
  while (spawnHistory.length > 0 && spawnHistory[0].timestamp < hourAgo) {
    spawnHistory.shift();
  }
  // Hard cap
  while (spawnHistory.length > MAX_HISTORY_SIZE) {
    spawnHistory.shift();
  }
}

export function recordSpawn(params: {
  agentId: string;
  runId: string;
  childSessionKey: string;
  label?: string;
}): void {
  const now = Date.now();
  pruneHistory(now);

  spawnHistory.push({
    agentId: params.agentId,
    timestamp: now,
    runId: params.runId,
    childSessionKey: params.childSessionKey,
    label: params.label,
  });

  // Check rate for this agent
  const windowStart = now - config.windowMs;
  const recentForAgent = spawnHistory.filter(
    (e) => e.agentId === params.agentId && e.timestamp >= windowStart,
  );

  if (recentForAgent.length > config.threshold) {
    const message =
      `[spawn-audit] RATE ALERT: Agent "${params.agentId}" has spawned ` +
      `${recentForAgent.length} subagents in the last ${Math.round(config.windowMs / 1000)}s ` +
      `(threshold: ${config.threshold}).`;

    defaultRuntime.log(message);

    if (alertCallback) {
      void Promise.resolve(alertCallback(message, params.agentId)).catch(() => {
        // Swallow alert delivery failures
      });
    }
  }
}

export function getSpawnRate(agentId: string, windowMs?: number): number {
  const now = Date.now();
  const window = windowMs ?? config.windowMs;
  const windowStart = now - window;
  return spawnHistory.filter((e) => e.agentId === agentId && e.timestamp >= windowStart).length;
}

export type SpawnHistoryQuery = {
  agentId?: string;
  windowMs?: number;
  limit?: number;
};

export function querySpawnHistory(query?: SpawnHistoryQuery): SpawnEvent[] {
  const now = Date.now();
  pruneHistory(now);

  let results = [...spawnHistory];

  if (query?.agentId) {
    results = results.filter((e) => e.agentId === query.agentId);
  }

  if (query?.windowMs) {
    const windowStart = now - query.windowMs;
    results = results.filter((e) => e.timestamp >= windowStart);
  }

  if (query?.limit && query.limit > 0) {
    results = results.slice(-query.limit);
  }

  return results;
}

export function getSpawnSummary(): Record<string, { perMinute: number; perHour: number }> {
  const now = Date.now();
  pruneHistory(now);

  const agents = new Set(spawnHistory.map((e) => e.agentId));
  const summary: Record<string, { perMinute: number; perHour: number }> = {};

  for (const agentId of agents) {
    const minuteStart = now - 60_000;
    const hourStart = now - 3_600_000;
    const perMinute = spawnHistory.filter(
      (e) => e.agentId === agentId && e.timestamp >= minuteStart,
    ).length;
    const perHour = spawnHistory.filter(
      (e) => e.agentId === agentId && e.timestamp >= hourStart,
    ).length;
    summary[agentId] = { perMinute, perHour };
  }

  return summary;
}

export function resetSpawnAuditForTests(): void {
  spawnHistory.length = 0;
  alertCallback = null;
  config = {
    threshold: DEFAULT_THRESHOLD,
    windowMs: DEFAULT_WINDOW_MS,
  };
}
