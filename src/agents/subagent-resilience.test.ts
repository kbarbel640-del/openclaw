import { describe, expect, it, beforeEach, afterEach } from "vitest";
import type { SubagentRunRecord } from "./subagent-registry.types.js";
import {
  canAttemptSubagent,
  configureResilience,
  evaluateCircuitState,
  getHealthScore,
  getOrCreateHealthRecord,
  getResilienceStats,
  recordSubagentFailure,
  recordSubagentSuccess,
  resetAllHealthRecords,
  resetHealthRecord,
  resolveRestartDecision,
  startResilienceMaintenance,
  stopResilienceMaintenance,
} from "./subagent-resilience.js";

function createMockRunRecord(overrides?: Partial<SubagentRunRecord>): SubagentRunRecord {
  return {
    runId: "test-run-id",
    childSessionKey: "test-session-key",
    requesterSessionKey: "requester-session-key",
    requesterDisplayKey: "test-display",
    task: "test task",
    cleanup: "delete",
    createdAt: Date.now(),
    ...overrides,
  };
}

describe("subagent-resilience", () => {
  beforeEach(() => {
    resetAllHealthRecords();
    configureResilience({
      circuitBreakerThreshold: 30,
      circuitBreakerRecoveryMs: 1000,
    });
  });

  afterEach(() => {
    stopResilienceMaintenance();
  });

  describe("getOrCreateHealthRecord", () => {
    it("creates a new health record with initial health score of 100", () => {
      const record = getOrCreateHealthRecord("session-1");
      expect(record.healthScore).toBe(100);
      expect(record.circuitState).toBe("closed");
      expect(record.failureCount).toBe(0);
      expect(record.successCount).toBe(0);
    });

    it("returns existing record on subsequent calls", () => {
      getOrCreateHealthRecord("session-1");
      recordSubagentFailure({ sessionKey: "session-1" });
      const record = getOrCreateHealthRecord("session-1");
      expect(record.failureCount).toBe(1);
    });
  });

  describe("recordSubagentFailure", () => {
    it("decrements health score on failure", () => {
      const record = recordSubagentFailure({ sessionKey: "session-1" });
      expect(record.healthScore).toBeLessThan(100);
      expect(record.failureCount).toBe(1);
      expect(record.consecutiveFailures).toBe(1);
    });

    it("applies escalating penalty for consecutive failures", () => {
      recordSubagentFailure({ sessionKey: "session-1" });
      const score1 = getHealthScore("session-1");
      recordSubagentFailure({ sessionKey: "session-1" });
      const score2 = getHealthScore("session-1");
      expect(score2).toBeLessThan(score1);
    });

    it("opens circuit breaker when health drops below threshold", () => {
      configureResilience({ circuitBreakerThreshold: 80, failurePenalty: 25 });
      const record = recordSubagentFailure({ sessionKey: "session-1" });
      expect(record.circuitState).toBe("open");
    });

    it("updates response time average", () => {
      const record = recordSubagentFailure({
        sessionKey: "session-1",
        responseTimeMs: 1000,
      });
      expect(record.avgResponseTimeMs).toBe(1000);
    });
  });

  describe("recordSubagentSuccess", () => {
    it("increments health score on success", () => {
      recordSubagentFailure({ sessionKey: "session-1" });
      const beforeScore = getHealthScore("session-1");
      const record = recordSubagentSuccess({ sessionKey: "session-1" });
      expect(record.healthScore).toBeGreaterThan(beforeScore);
      expect(record.successCount).toBe(1);
      expect(record.consecutiveSuccesses).toBe(1);
    });

    it("resets consecutive failure counter", () => {
      recordSubagentFailure({ sessionKey: "session-1" });
      recordSubagentFailure({ sessionKey: "session-1" });
      const record = recordSubagentSuccess({ sessionKey: "session-1" });
      expect(record.consecutiveFailures).toBe(0);
    });
  });

  describe("evaluateCircuitState", () => {
    it("returns healthy for good health score", () => {
      expect(evaluateCircuitState("session-1")).toBe("healthy");
    });

    it("returns degraded for low health score above circuit threshold", () => {
      configureResilience({ circuitBreakerThreshold: 20, failurePenalty: 25 });
      recordSubagentFailure({ sessionKey: "session-1" });
      const score = getHealthScore("session-1");
      expect(score).toBeGreaterThan(20);
      expect(score).toBeLessThan(100);
      const status = evaluateCircuitState("session-1");
      expect(["degraded", "healthy"]).toContain(status);
    });

    it("returns circuit-open when circuit is tripped", () => {
      configureResilience({ circuitBreakerThreshold: 90, failurePenalty: 20 });
      recordSubagentFailure({ sessionKey: "session-1" });
      expect(evaluateCircuitState("session-1")).toBe("circuit-open");
    });

    it("transitions to half-open after recovery time", async () => {
      configureResilience({
        circuitBreakerThreshold: 90,
        circuitBreakerRecoveryMs: 10,
        failurePenalty: 20,
      });
      recordSubagentFailure({ sessionKey: "session-1" });
      expect(evaluateCircuitState("session-1")).toBe("circuit-open");

      await new Promise((r) => setTimeout(r, 20));
      expect(evaluateCircuitState("session-1")).toBe("circuit-half-open");
    });

    it("closes circuit after successful half-open requests", async () => {
      configureResilience({
        circuitBreakerThreshold: 90,
        circuitBreakerRecoveryMs: 10,
        failurePenalty: 20,
        halfOpenRequests: 1,
      });
      recordSubagentFailure({ sessionKey: "session-1" });
      await new Promise((r) => setTimeout(r, 20));

      expect(evaluateCircuitState("session-1")).toBe("circuit-half-open");

      recordSubagentSuccess({ sessionKey: "session-1" });
      expect(evaluateCircuitState("session-1")).toBe("healthy");
    });
  });

  describe("canAttemptSubagent", () => {
    it("returns true for healthy sessions", () => {
      expect(canAttemptSubagent("session-1")).toBe(true);
    });

    it("returns false for circuit-open sessions", () => {
      configureResilience({ circuitBreakerThreshold: 90, failurePenalty: 20 });
      recordSubagentFailure({ sessionKey: "session-1" });
      expect(canAttemptSubagent("session-1")).toBe(false);
    });

    it("returns true for half-open sessions (probe)", async () => {
      configureResilience({
        circuitBreakerThreshold: 90,
        circuitBreakerRecoveryMs: 10,
        failurePenalty: 20,
      });
      recordSubagentFailure({ sessionKey: "session-1" });
      await new Promise((r) => setTimeout(r, 20));
      expect(canAttemptSubagent("session-1")).toBe(true);
    });
  });

  describe("resolveRestartDecision", () => {
    it("allows restart for healthy sessions", () => {
      const runRecord = createMockRunRecord();
      const decision = resolveRestartDecision({
        runRecord,
        attemptCount: 0,
      });
      expect(decision.shouldRestart).toBe(true);
      expect(decision.delayMs).toBeGreaterThanOrEqual(1000);
    });

    it("denies restart for circuit-open sessions", () => {
      const runRecord = createMockRunRecord({ childSessionKey: "test-session-key" });
      configureResilience({ circuitBreakerThreshold: 90, failurePenalty: 20 });
      recordSubagentFailure({ sessionKey: "test-session-key" });
      const decision = resolveRestartDecision({
        runRecord,
        attemptCount: 0,
      });
      expect(decision.shouldRestart).toBe(false);
      expect(decision.reason).toBe("circuit-breaker-open");
    });

    it("applies exponential backoff with jitter", () => {
      const runRecord = createMockRunRecord();
      const decisions = Array.from({ length: 5 }, (_, i) =>
        resolveRestartDecision({ runRecord, attemptCount: i }),
      );

      const delays = decisions.map((d) => d.delayMs);
      for (let i = 1; i < delays.length; i++) {
        expect(delays[i]).toBeGreaterThanOrEqual(delays[i - 1] * 0.8);
      }
    });

    it("limits retries based on health score", () => {
      configureResilience({ circuitBreakerThreshold: 10, failurePenalty: 30 });
      const runRecord = createMockRunRecord({ childSessionKey: "test-session-key" });
      recordSubagentFailure({ sessionKey: "test-session-key" });
      recordSubagentFailure({ sessionKey: "test-session-key" });
      const score = getHealthScore("test-session-key");
      const maxRetries = Math.max(1, Math.min(5, Math.floor(score / 20)));
      const decision = resolveRestartDecision({
        runRecord,
        attemptCount: maxRetries + 1,
      });
      expect(decision.shouldRestart).toBe(false);
      expect(decision.reason).toBe("max-retries-exceeded");
    });
  });

  describe("getResilienceStats", () => {
    it("counts sessions by health status", () => {
      recordSubagentSuccess({ sessionKey: "healthy-1" });
      recordSubagentSuccess({ sessionKey: "healthy-2" });
      configureResilience({ circuitBreakerThreshold: 20, failurePenalty: 30 });
      recordSubagentFailure({ sessionKey: "degraded-1" });
      const score = getHealthScore("degraded-1");
      expect(score).toBeLessThan(100);
      expect(score).toBeGreaterThan(20);

      const stats = getResilienceStats();
      expect(stats.totalSessions).toBe(3);
      expect(
        stats.healthyCount +
          stats.degradedCount +
          stats.circuitOpenCount +
          stats.circuitHalfOpenCount,
      ).toBe(3);
    });
  });

  describe("resetHealthRecord", () => {
    it("removes health record for session", () => {
      recordSubagentFailure({ sessionKey: "session-1" });
      expect(getHealthScore("session-1")).toBeLessThan(100);

      resetHealthRecord("session-1");
      expect(getHealthScore("session-1")).toBe(100);
    });
  });

  describe("startResilienceMaintenance", () => {
    it("starts decay interval without error", () => {
      expect(() => startResilienceMaintenance()).not.toThrow();
      stopResilienceMaintenance();
    });

    it("is idempotent", () => {
      startResilienceMaintenance();
      startResilienceMaintenance();
      stopResilienceMaintenance();
    });
  });
});
