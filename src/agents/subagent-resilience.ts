import { defaultRuntime } from "../runtime.js";
import type { SubagentRunRecord } from "./subagent-registry.types.js";

const HEALTH_SCORE_MAX = 100;
const HEALTH_SCORE_MIN = 0;
const HEALTH_DECAY_FACTOR = 0.95;
const FAILURE_PENALTY = 15;
const SUCCESS_BOOST = 5;
const CIRCUIT_BREAKER_THRESHOLD = 30;
const CIRCUIT_BREAKER_RECOVERY_MS = 60_000;
const CIRCUIT_BREAKER_HALF_OPEN_REQUESTS = 3;

export type SubagentHealthStatus = "healthy" | "degraded" | "circuit-open" | "circuit-half-open";

export type SubagentHealthRecord = {
  sessionKey: string;
  healthScore: number;
  failureCount: number;
  successCount: number;
  lastFailureAt?: number;
  lastSuccessAt?: number;
  circuitState: "closed" | "open" | "half-open";
  circuitOpenedAt?: number;
  halfOpenSuccesses: number;
  halfOpenFailures: number;
  lastEvaluationAt: number;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  avgResponseTimeMs: number;
  responseTimeSamples: number;
};

export type SubagentResilienceConfig = {
  healthScoreMin?: number;
  healthScoreMax?: number;
  failurePenalty?: number;
  successBoost?: number;
  circuitBreakerThreshold?: number;
  circuitBreakerRecoveryMs?: number;
  halfOpenRequests?: number;
  healthDecayFactor?: number;
  maxResponseTimeSamples?: number;
};

const DEFAULT_RESILIENCE_CONFIG: Required<SubagentResilienceConfig> = {
  healthScoreMin: HEALTH_SCORE_MIN,
  healthScoreMax: HEALTH_SCORE_MAX,
  failurePenalty: FAILURE_PENALTY,
  successBoost: SUCCESS_BOOST,
  circuitBreakerThreshold: CIRCUIT_BREAKER_THRESHOLD,
  circuitBreakerRecoveryMs: CIRCUIT_BREAKER_RECOVERY_MS,
  halfOpenRequests: CIRCUIT_BREAKER_HALF_OPEN_REQUESTS,
  healthDecayFactor: HEALTH_DECAY_FACTOR,
  maxResponseTimeSamples: 100,
};

const healthRecords = new Map<string, SubagentHealthRecord>();
let config: Required<SubagentResilienceConfig> = DEFAULT_RESILIENCE_CONFIG;

export function configureResilience(newConfig: SubagentResilienceConfig): void {
  config = { ...DEFAULT_RESILIENCE_CONFIG, ...newConfig };
}

function createHealthRecord(sessionKey: string): SubagentHealthRecord {
  return {
    sessionKey,
    healthScore: config.healthScoreMax,
    failureCount: 0,
    successCount: 0,
    circuitState: "closed",
    halfOpenSuccesses: 0,
    halfOpenFailures: 0,
    lastEvaluationAt: Date.now(),
    consecutiveFailures: 0,
    consecutiveSuccesses: 0,
    avgResponseTimeMs: 0,
    responseTimeSamples: 0,
  };
}

export function getOrCreateHealthRecord(sessionKey: string): SubagentHealthRecord {
  let record = healthRecords.get(sessionKey);
  if (!record) {
    record = createHealthRecord(sessionKey);
    healthRecords.set(sessionKey, record);
  }
  return record;
}

export function recordSubagentFailure(params: {
  sessionKey: string;
  error?: string;
  responseTimeMs?: number;
}): SubagentHealthRecord {
  const record = getOrCreateHealthRecord(params.sessionKey);
  const now = Date.now();

  record.failureCount += 1;
  record.consecutiveFailures += 1;
  record.consecutiveSuccesses = 0;
  record.lastFailureAt = now;

  const penalty = Math.max(config.failurePenalty, record.consecutiveFailures * 3);
  record.healthScore = Math.max(config.healthScoreMin, record.healthScore - penalty);

  if (params.responseTimeMs !== undefined) {
    updateResponseTime(record, params.responseTimeMs);
  }

  if (record.circuitState === "half-open") {
    record.halfOpenFailures += 1;
    if (record.halfOpenFailures >= 1) {
      tripCircuit(record);
    }
  }

  if (record.healthScore < config.circuitBreakerThreshold && record.circuitState === "closed") {
    tripCircuit(record);
  }

  record.lastEvaluationAt = now;
  defaultRuntime.log(
    `[subagent-resilience] Failure recorded: session=${params.sessionKey} health=${record.healthScore} failures=${record.failureCount} circuit=${record.circuitState}`,
  );

  return record;
}

export function recordSubagentSuccess(params: {
  sessionKey: string;
  responseTimeMs?: number;
}): SubagentHealthRecord {
  const record = getOrCreateHealthRecord(params.sessionKey);
  const now = Date.now();

  record.successCount += 1;
  record.consecutiveSuccesses += 1;
  record.consecutiveFailures = 0;
  record.lastSuccessAt = now;

  const boost = Math.min(config.successBoost, record.consecutiveSuccesses * 2);
  record.healthScore = Math.min(config.healthScoreMax, record.healthScore + boost);

  if (params.responseTimeMs !== undefined) {
    updateResponseTime(record, params.responseTimeMs);
  }

  if (record.circuitState === "half-open") {
    record.halfOpenSuccesses += 1;
    if (record.halfOpenSuccesses >= config.halfOpenRequests) {
      closeCircuit(record);
    }
  }

  record.lastEvaluationAt = now;
  return record;
}

function updateResponseTime(record: SubagentHealthRecord, responseTimeMs: number): void {
  const samples = record.responseTimeSamples;
  const maxSamples = config.maxResponseTimeSamples;
  const newSamples = Math.min(samples + 1, maxSamples);
  record.avgResponseTimeMs =
    (record.avgResponseTimeMs * Math.min(samples, maxSamples - 1) + responseTimeMs) / newSamples;
  record.responseTimeSamples = newSamples;
}

function tripCircuit(record: SubagentHealthRecord): void {
  record.circuitState = "open";
  record.circuitOpenedAt = Date.now();
  record.halfOpenSuccesses = 0;
  record.halfOpenFailures = 0;
  defaultRuntime.log(
    `[subagent-resilience] Circuit OPENED: session=${record.sessionKey} health=${record.healthScore}`,
  );
}

function closeCircuit(record: SubagentHealthRecord): void {
  record.circuitState = "closed";
  record.circuitOpenedAt = undefined;
  record.halfOpenSuccesses = 0;
  record.halfOpenFailures = 0;
  record.healthScore = Math.max(config.circuitBreakerThreshold + 10, record.healthScore);
  defaultRuntime.log(
    `[subagent-resilience] Circuit CLOSED: session=${record.sessionKey} health=${record.healthScore}`,
  );
}

export function evaluateCircuitState(sessionKey: string): SubagentHealthStatus {
  const record = getOrCreateHealthRecord(sessionKey);
  const now = Date.now();

  if (record.circuitState === "open") {
    const timeSinceOpen = now - (record.circuitOpenedAt ?? 0);
    if (timeSinceOpen >= config.circuitBreakerRecoveryMs) {
      record.circuitState = "half-open";
      record.halfOpenSuccesses = 0;
      record.halfOpenFailures = 0;
      defaultRuntime.log(
        `[subagent-resilience] Circuit HALF-OPEN: session=${sessionKey} after ${Math.round(timeSinceOpen / 1000)}s`,
      );
      return "circuit-half-open";
    }
    return "circuit-open";
  }

  if (record.circuitState === "half-open") {
    return "circuit-half-open";
  }

  if (record.healthScore < config.circuitBreakerThreshold) {
    return "degraded";
  }

  return "healthy";
}

export function canAttemptSubagent(sessionKey: string): boolean {
  const status = evaluateCircuitState(sessionKey);
  return status !== "circuit-open";
}

export function getHealthScore(sessionKey: string): number {
  return getOrCreateHealthRecord(sessionKey).healthScore;
}

export function getResilienceStats(): {
  totalSessions: number;
  healthyCount: number;
  degradedCount: number;
  circuitOpenCount: number;
  circuitHalfOpenCount: number;
} {
  let healthyCount = 0;
  let degradedCount = 0;
  let circuitOpenCount = 0;
  let circuitHalfOpenCount = 0;

  for (const sessionKey of healthRecords.keys()) {
    const status = evaluateCircuitState(sessionKey);
    switch (status) {
      case "healthy":
        healthyCount += 1;
        break;
      case "degraded":
        degradedCount += 1;
        break;
      case "circuit-open":
        circuitOpenCount += 1;
        break;
      case "circuit-half-open":
        circuitHalfOpenCount += 1;
        break;
    }
  }

  return {
    totalSessions: healthRecords.size,
    healthyCount,
    degradedCount,
    circuitOpenCount,
    circuitHalfOpenCount,
  };
}

export function decayHealthScores(): void {
  const now = Date.now();
  for (const record of healthRecords.values()) {
    if (record.circuitState !== "closed") {
      continue;
    }
    const timeSinceEval = now - record.lastEvaluationAt;
    if (timeSinceEval > 60_000) {
      record.healthScore = Math.max(
        config.healthScoreMin,
        Math.round(record.healthScore * config.healthDecayFactor),
      );
      record.lastEvaluationAt = now;
    }
  }
}

export function resetHealthRecord(sessionKey: string): void {
  healthRecords.delete(sessionKey);
}

export function resetAllHealthRecords(): void {
  healthRecords.clear();
}

export type RestartDecision = {
  shouldRestart: boolean;
  delayMs: number;
  maxRetries: number;
  reason: string;
};

const RETRY_BASE_DELAY_MS = 1_000;
const RETRY_MAX_DELAY_MS = 30_000;
const RETRY_JITTER_RATIO = 0.3;

export function resolveRestartDecision(params: {
  runRecord: SubagentRunRecord;
  attemptCount: number;
  lastError?: string;
}): RestartDecision {
  const sessionKey = params.runRecord.childSessionKey;
  const healthRecord = getOrCreateHealthRecord(sessionKey);
  const status = evaluateCircuitState(sessionKey);

  if (status === "circuit-open") {
    return {
      shouldRestart: false,
      delayMs: 0,
      maxRetries: 0,
      reason: "circuit-breaker-open",
    };
  }

  const maxRetries = Math.max(1, Math.min(5, Math.floor(healthRecord.healthScore / 20)));
  if (params.attemptCount >= maxRetries) {
    return {
      shouldRestart: false,
      delayMs: 0,
      maxRetries,
      reason: "max-retries-exceeded",
    };
  }

  const baseDelay = RETRY_BASE_DELAY_MS * 2 ** Math.min(params.attemptCount, 6);
  const clampedDelay = Math.min(baseDelay, RETRY_MAX_DELAY_MS);
  const jitter = clampedDelay * RETRY_JITTER_RATIO * Math.random();
  const delayMs = Math.round(clampedDelay + jitter);

  return {
    shouldRestart: true,
    delayMs,
    maxRetries,
    reason: status === "circuit-half-open" ? "circuit-half-open-probe" : "exponential-backoff",
  };
}

let decayInterval: NodeJS.Timeout | null = null;

export function startResilienceMaintenance(): void {
  if (decayInterval) {
    return;
  }
  decayInterval = setInterval(() => {
    decayHealthScores();
  }, 60_000);
  decayInterval.unref?.();
}

export function stopResilienceMaintenance(): void {
  if (decayInterval) {
    clearInterval(decayInterval);
    decayInterval = null;
  }
}

export function getAllHealthRecords(): Map<string, SubagentHealthRecord> {
  return new Map(healthRecords);
}
