import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  recordAgentOutcome,
  getPerformanceMultiplier,
  getAgentPerformanceStats,
  getAllPerformanceRecords,
  resetPerformanceTrackerForTests,
} from "./agent-performance-tracker.js";

vi.mock("./agent-performance-store.js", () => ({
  loadPerformanceStoreFromDisk: () => new Map(),
  savePerformanceStoreToDisk: vi.fn(),
}));

describe("AgentPerformanceTracker", () => {
  beforeEach(() => {
    resetPerformanceTrackerForTests();
  });

  describe("recordAgentOutcome", () => {
    it("should record success", () => {
      recordAgentOutcome({
        agentId: "coder",
        taskType: "coding",
        success: true,
        latencyMs: 1000,
        tokens: 500,
      });

      const stats = getAgentPerformanceStats("coder");
      expect(stats).toHaveLength(1);
      expect(stats[0]).toEqual({
        agentId: "coder",
        taskType: "coding",
        attempts: 1,
        successes: 1,
        failures: 0,
        totalLatencyMs: 1000,
        totalTokens: 500,
        lastUsed: expect.any(Number),
      });
    });

    it("should record failure", () => {
      recordAgentOutcome({
        agentId: "researcher",
        taskType: "reasoning",
        success: false,
        latencyMs: 500,
        tokens: 200,
      });

      const stats = getAgentPerformanceStats("researcher");
      expect(stats).toHaveLength(1);
      expect(stats[0]).toEqual({
        agentId: "researcher",
        taskType: "reasoning",
        attempts: 1,
        successes: 0,
        failures: 1,
        totalLatencyMs: 500,
        totalTokens: 200,
        lastUsed: expect.any(Number),
      });
    });

    it("should accumulate multiple outcomes", () => {
      recordAgentOutcome({
        agentId: "coder",
        taskType: "coding",
        success: true,
        latencyMs: 1000,
        tokens: 500,
      });

      recordAgentOutcome({
        agentId: "coder",
        taskType: "coding",
        success: false,
        latencyMs: 800,
        tokens: 300,
      });

      recordAgentOutcome({
        agentId: "coder",
        taskType: "coding",
        success: true,
        latencyMs: 1200,
        tokens: 600,
      });

      const stats = getAgentPerformanceStats("coder");
      expect(stats).toHaveLength(1);
      expect(stats[0]).toMatchObject({
        agentId: "coder",
        taskType: "coding",
        attempts: 3,
        successes: 2,
        failures: 1,
        totalLatencyMs: 3000,
        totalTokens: 1400,
      });
    });

    it("should handle missing optional fields", () => {
      recordAgentOutcome({
        agentId: "tester",
        taskType: "testing",
        success: true,
      });

      const stats = getAgentPerformanceStats("tester");
      expect(stats).toHaveLength(1);
      expect(stats[0]).toMatchObject({
        agentId: "tester",
        taskType: "testing",
        attempts: 1,
        successes: 1,
        failures: 0,
        totalLatencyMs: 0,
        totalTokens: 0,
      });
    });

    it("should track different task types separately for same agent", () => {
      recordAgentOutcome({
        agentId: "fullstack",
        taskType: "coding",
        success: true,
      });

      recordAgentOutcome({
        agentId: "fullstack",
        taskType: "testing",
        success: false,
      });

      const stats = getAgentPerformanceStats("fullstack");
      expect(stats).toHaveLength(2);
      expect(stats.find((s) => s.taskType === "coding")).toMatchObject({
        attempts: 1,
        successes: 1,
        failures: 0,
      });
      expect(stats.find((s) => s.taskType === "testing")).toMatchObject({
        attempts: 1,
        successes: 0,
        failures: 1,
      });
    });

    it("should update lastUsed timestamp", () => {
      const before = Date.now();

      recordAgentOutcome({
        agentId: "coder",
        taskType: "coding",
        success: true,
      });

      const after = Date.now();
      const stats = getAgentPerformanceStats("coder");

      expect(stats[0].lastUsed).toBeGreaterThanOrEqual(before);
      expect(stats[0].lastUsed).toBeLessThanOrEqual(after);
    });
  });

  describe("getPerformanceMultiplier", () => {
    it("should return exploration bonus (1.1) for new agents (<3 attempts)", () => {
      // No attempts
      expect(getPerformanceMultiplier("newbie", "coding")).toBe(1.1);

      // 1 attempt
      recordAgentOutcome({
        agentId: "newbie",
        taskType: "coding",
        success: true,
      });
      expect(getPerformanceMultiplier("newbie", "coding")).toBe(1.1);

      // 2 attempts
      recordAgentOutcome({
        agentId: "newbie",
        taskType: "coding",
        success: true,
      });
      expect(getPerformanceMultiplier("newbie", "coding")).toBe(1.1);
    });

    it("should return correct multiplier for 100% success (1.0)", () => {
      // Record 3 successes
      for (let i = 0; i < 3; i++) {
        recordAgentOutcome({
          agentId: "perfect",
          taskType: "coding",
          success: true,
        });
      }

      // 100% success: 0.6 + (1.0 * 0.4) = 1.0
      expect(getPerformanceMultiplier("perfect", "coding")).toBe(1.0);
    });

    it("should return correct multiplier for 0% success (0.6)", () => {
      // Record 3 failures
      for (let i = 0; i < 3; i++) {
        recordAgentOutcome({
          agentId: "struggling",
          taskType: "coding",
          success: false,
        });
      }

      // 0% success: 0.6 + (0.0 * 0.4) = 0.6
      expect(getPerformanceMultiplier("struggling", "coding")).toBe(0.6);
    });

    it("should return correct multiplier for 50% success (0.8)", () => {
      // Record 2 successes, 2 failures
      recordAgentOutcome({
        agentId: "average",
        taskType: "coding",
        success: true,
      });
      recordAgentOutcome({
        agentId: "average",
        taskType: "coding",
        success: false,
      });
      recordAgentOutcome({
        agentId: "average",
        taskType: "coding",
        success: true,
      });
      recordAgentOutcome({
        agentId: "average",
        taskType: "coding",
        success: false,
      });

      // 50% success: 0.6 + (0.5 * 0.4) = 0.8
      expect(getPerformanceMultiplier("average", "coding")).toBe(0.8);
    });

    it("should return correct multiplier for 75% success (0.9)", () => {
      // Record 3 successes, 1 failure
      for (let i = 0; i < 3; i++) {
        recordAgentOutcome({
          agentId: "good",
          taskType: "coding",
          success: true,
        });
      }
      recordAgentOutcome({
        agentId: "good",
        taskType: "coding",
        success: false,
      });

      // 75% success: 0.6 + (0.75 * 0.4) = 0.9
      expect(getPerformanceMultiplier("good", "coding")).toBe(0.9);
    });

    it("should return correct multiplier for 25% success (0.7)", () => {
      // Record 1 success, 3 failures
      recordAgentOutcome({
        agentId: "poor",
        taskType: "coding",
        success: true,
      });
      for (let i = 0; i < 3; i++) {
        recordAgentOutcome({
          agentId: "poor",
          taskType: "coding",
          success: false,
        });
      }

      // 25% success: 0.6 + (0.25 * 0.4) = 0.7
      expect(getPerformanceMultiplier("poor", "coding")).toBe(0.7);
    });

    it("should calculate multiplier per task type", () => {
      // Good at coding
      for (let i = 0; i < 3; i++) {
        recordAgentOutcome({
          agentId: "specialist",
          taskType: "coding",
          success: true,
        });
      }

      // Bad at testing
      for (let i = 0; i < 3; i++) {
        recordAgentOutcome({
          agentId: "specialist",
          taskType: "testing",
          success: false,
        });
      }

      expect(getPerformanceMultiplier("specialist", "coding")).toBe(1.0);
      expect(getPerformanceMultiplier("specialist", "testing")).toBe(0.6);
    });

    it("should transition from exploration bonus to calculated multiplier at 3 attempts", () => {
      const agentId = "transitioning";
      const taskType = "coding";

      // 2 attempts: exploration bonus
      recordAgentOutcome({ agentId, taskType, success: true });
      recordAgentOutcome({ agentId, taskType, success: true });
      expect(getPerformanceMultiplier(agentId, taskType)).toBe(1.1);

      // 3rd attempt: now calculated (100% success = 1.0)
      recordAgentOutcome({ agentId, taskType, success: true });
      expect(getPerformanceMultiplier(agentId, taskType)).toBe(1.0);
    });
  });

  describe("getAgentPerformanceStats", () => {
    it("should return stats for specific agent", () => {
      recordAgentOutcome({
        agentId: "coder",
        taskType: "coding",
        success: true,
      });
      recordAgentOutcome({
        agentId: "coder",
        taskType: "testing",
        success: false,
      });
      recordAgentOutcome({
        agentId: "researcher",
        taskType: "reasoning",
        success: true,
      });

      const coderStats = getAgentPerformanceStats("coder");
      expect(coderStats).toHaveLength(2);
      expect(coderStats.every((s) => s.agentId === "coder")).toBe(true);

      const researcherStats = getAgentPerformanceStats("researcher");
      expect(researcherStats).toHaveLength(1);
      expect(researcherStats[0].agentId).toBe("researcher");
    });

    it("should return empty array for unknown agent", () => {
      recordAgentOutcome({
        agentId: "coder",
        taskType: "coding",
        success: true,
      });

      const stats = getAgentPerformanceStats("unknown");
      expect(stats).toEqual([]);
    });

    it("should return copies of records (not references)", () => {
      recordAgentOutcome({
        agentId: "coder",
        taskType: "coding",
        success: true,
      });

      const stats1 = getAgentPerformanceStats("coder");
      const stats2 = getAgentPerformanceStats("coder");

      expect(stats1).toEqual(stats2);
      expect(stats1[0]).not.toBe(stats2[0]); // Different object references
    });
  });

  describe("getAllPerformanceRecords", () => {
    it("should return all records", () => {
      recordAgentOutcome({
        agentId: "coder",
        taskType: "coding",
        success: true,
      });
      recordAgentOutcome({
        agentId: "researcher",
        taskType: "reasoning",
        success: false,
      });
      recordAgentOutcome({
        agentId: "tester",
        taskType: "testing",
        success: true,
      });

      const allRecords = getAllPerformanceRecords();
      expect(allRecords).toHaveLength(3);

      const agentIds = allRecords.map((r) => r.agentId).toSorted();
      expect(agentIds).toEqual(["coder", "researcher", "tester"]);
    });

    it("should return empty array when no records exist", () => {
      const allRecords = getAllPerformanceRecords();
      expect(allRecords).toEqual([]);
    });

    it("should return copies of records (not references)", () => {
      recordAgentOutcome({
        agentId: "coder",
        taskType: "coding",
        success: true,
      });

      const records1 = getAllPerformanceRecords();
      const records2 = getAllPerformanceRecords();

      expect(records1).toEqual(records2);
      expect(records1[0]).not.toBe(records2[0]); // Different object references
    });
  });

  describe("resetPerformanceTrackerForTests", () => {
    it("should clear all state", () => {
      recordAgentOutcome({
        agentId: "coder",
        taskType: "coding",
        success: true,
      });
      recordAgentOutcome({
        agentId: "researcher",
        taskType: "reasoning",
        success: false,
      });

      expect(getAllPerformanceRecords()).toHaveLength(2);

      resetPerformanceTrackerForTests();

      expect(getAllPerformanceRecords()).toEqual([]);
      expect(getAgentPerformanceStats("coder")).toEqual([]);
      expect(getPerformanceMultiplier("coder", "coding")).toBe(1.1);
    });

    it("should allow recording new data after reset", () => {
      recordAgentOutcome({
        agentId: "old",
        taskType: "coding",
        success: true,
      });

      resetPerformanceTrackerForTests();

      recordAgentOutcome({
        agentId: "new",
        taskType: "coding",
        success: true,
      });

      const allRecords = getAllPerformanceRecords();
      expect(allRecords).toHaveLength(1);
      expect(allRecords[0].agentId).toBe("new");
    });
  });

  describe("edge cases", () => {
    it("should handle zero latency and tokens", () => {
      recordAgentOutcome({
        agentId: "fast",
        taskType: "coding",
        success: true,
        latencyMs: 0,
        tokens: 0,
      });

      const stats = getAgentPerformanceStats("fast");
      expect(stats[0]).toMatchObject({
        totalLatencyMs: 0,
        totalTokens: 0,
      });
    });

    it("should handle very large numbers", () => {
      recordAgentOutcome({
        agentId: "heavy",
        taskType: "coding",
        success: true,
        latencyMs: 999999,
        tokens: 1000000,
      });

      const stats = getAgentPerformanceStats("heavy");
      expect(stats[0]).toMatchObject({
        totalLatencyMs: 999999,
        totalTokens: 1000000,
      });
    });

    it("should handle many attempts on same agent+task", () => {
      for (let i = 0; i < 100; i++) {
        recordAgentOutcome({
          agentId: "marathon",
          taskType: "coding",
          success: i % 2 === 0,
        });
      }

      const stats = getAgentPerformanceStats("marathon");
      expect(stats[0]).toMatchObject({
        attempts: 100,
        successes: 50,
        failures: 50,
      });

      expect(getPerformanceMultiplier("marathon", "coding")).toBe(0.8);
    });

    it("should handle special characters in agentId and taskType", () => {
      recordAgentOutcome({
        agentId: "agent-123_special.char",
        taskType: "task:type/with/slashes",
        success: true,
      });

      const stats = getAgentPerformanceStats("agent-123_special.char");
      expect(stats).toHaveLength(1);
      expect(stats[0].taskType).toBe("task:type/with/slashes");
    });
  });

  describe("performance multiplier formula validation", () => {
    it("should ensure multiplier is always between 0.6 and 1.1", () => {
      const testCases = [
        { successes: 0, failures: 10, expectedMin: 0.6, expectedMax: 0.6 },
        { successes: 5, failures: 5, expectedMin: 0.8, expectedMax: 0.8 },
        { successes: 10, failures: 0, expectedMin: 1.0, expectedMax: 1.0 },
        { successes: 7, failures: 3, expectedMin: 0.88, expectedMax: 0.88 },
        { successes: 3, failures: 7, expectedMin: 0.72, expectedMax: 0.72 },
      ];

      for (const testCase of testCases) {
        resetPerformanceTrackerForTests();

        for (let i = 0; i < testCase.successes; i++) {
          recordAgentOutcome({
            agentId: "test",
            taskType: "coding",
            success: true,
          });
        }
        for (let i = 0; i < testCase.failures; i++) {
          recordAgentOutcome({
            agentId: "test",
            taskType: "coding",
            success: false,
          });
        }

        const multiplier = getPerformanceMultiplier("test", "coding");
        expect(multiplier).toBeGreaterThanOrEqual(0.6);
        expect(multiplier).toBeLessThanOrEqual(1.1);
        expect(multiplier).toBeCloseTo(testCase.expectedMin, 2);
      }
    });
  });
});
