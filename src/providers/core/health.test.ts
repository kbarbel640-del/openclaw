import { describe, it, expect, beforeEach } from "vitest";
import {
  recordSuccess,
  recordFailure,
  getProviderHealth,
  isProviderHealthy,
  getProvidersByHealth,
  clearHealthMetrics,
} from "./health.js";
import type { ProviderId } from "./types.js";

describe("health", () => {
  beforeEach(() => {
    clearHealthMetrics();
  });

  describe("recordSuccess", () => {
    it("tracks successful calls", () => {
      recordSuccess("anthropic", 250);
      const health = getProviderHealth("anthropic");

      expect(health.totalCalls).toBe(1);
      expect(health.successfulCalls).toBe(1);
      expect(health.failedCalls).toBe(0);
      expect(health.successRate).toBe(1.0);
      expect(health.status).toBe("active");
    });

    it("updates average response time", () => {
      recordSuccess("anthropic", 100);
      recordSuccess("anthropic", 300);
      const health = getProviderHealth("anthropic");

      expect(health.avgResponseTime).toBeGreaterThan(0);
      expect(health.avgResponseTime).toBeLessThan(300);
    });

    it("records last success timestamp", () => {
      const before = Date.now();
      recordSuccess("anthropic", 100);
      const after = Date.now();

      const health = getProviderHealth("anthropic");
      expect(health.lastSuccess).toBeGreaterThanOrEqual(before);
      expect(health.lastSuccess).toBeLessThanOrEqual(after);
    });
  });

  describe("recordFailure", () => {
    it("tracks failed calls", () => {
      recordFailure("anthropic", new Error("test error"));
      const health = getProviderHealth("anthropic");

      expect(health.totalCalls).toBe(1);
      expect(health.successfulCalls).toBe(0);
      expect(health.failedCalls).toBe(1);
      expect(health.successRate).toBe(0);
    });

    it("records last failure timestamp", () => {
      const before = Date.now();
      recordFailure("anthropic", new Error("test"));
      const after = Date.now();

      const health = getProviderHealth("anthropic");
      expect(health.lastFailure).toBeGreaterThanOrEqual(before);
      expect(health.lastFailure).toBeLessThanOrEqual(after);
    });
  });

  describe("status transitions", () => {
    it("stays active with good success rate", () => {
      for (let i = 0; i < 10; i++) {
        recordSuccess("anthropic", 100);
      }
      recordFailure("anthropic", new Error("occasional failure"));

      const health = getProviderHealth("anthropic");
      expect(health.status).toBe("active");
    });

    it("becomes degraded with moderate failures", () => {
      // Create enough calls to pass minCallsForMetrics
      for (let i = 0; i < 3; i++) {
        recordSuccess("anthropic", 100);
      }
      // Add failures to reach degraded threshold (~20%)
      recordFailure("anthropic", new Error("failure 1"));
      recordFailure("anthropic", new Error("failure 2"));

      const health = getProviderHealth("anthropic");
      expect(health.status).toBe("degraded");
    });

    it("enters cooldown after repeated failures", () => {
      // First violation
      for (let i = 0; i < 5; i++) {
        recordFailure("anthropic", new Error(`failure ${i}`));
      }

      // Second violation
      for (let i = 0; i < 5; i++) {
        recordFailure("anthropic", new Error(`failure ${i + 5}`));
      }

      const health = getProviderHealth("anthropic");
      expect(health.status).toBe("cooldown");
      expect(health.cooldownUntil).toBeGreaterThan(Date.now());
    });
  });

  describe("isProviderHealthy", () => {
    it("returns true for active providers", () => {
      recordSuccess("anthropic", 100);
      expect(isProviderHealthy("anthropic")).toBe(true);
    });

    it("returns true for degraded providers", () => {
      for (let i = 0; i < 3; i++) {
        recordSuccess("anthropic", 100);
      }
      recordFailure("anthropic", new Error("failure 1"));
      recordFailure("anthropic", new Error("failure 2"));

      expect(isProviderHealthy("anthropic")).toBe(true);
    });

    it("returns false for cooldown providers", () => {
      // Force cooldown
      for (let i = 0; i < 10; i++) {
        recordFailure("anthropic", new Error(`failure ${i}`));
      }

      expect(isProviderHealthy("anthropic")).toBe(false);
    });
  });

  describe("getProvidersByHealth", () => {
    it("sorts providers by health", () => {
      // Provider A: perfect health
      for (let i = 0; i < 10; i++) {
        recordSuccess("providerA", 100);
      }

      // Provider B: degraded
      for (let i = 0; i < 5; i++) {
        recordSuccess("providerB", 100);
      }
      for (let i = 0; i < 2; i++) {
        recordFailure("providerB", new Error("failure"));
      }

      // Provider C: cooldown
      for (let i = 0; i < 10; i++) {
        recordFailure("providerC", new Error("failure"));
      }

      const sorted = getProvidersByHealth(["providerA", "providerB", "providerC"] as ProviderId[]);
      expect(sorted[0]).toBe("providerA");
      expect(sorted[2]).toBe("providerC");
    });

    it("handles empty list", () => {
      const sorted = getProvidersByHealth([]);
      expect(sorted).toEqual([]);
    });

    it("handles single provider", () => {
      recordSuccess("anthropic", 100);
      const sorted = getProvidersByHealth(["anthropic"] as ProviderId[]);
      expect(sorted).toEqual(["anthropic"]);
    });
  });
});
