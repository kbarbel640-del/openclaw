import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  checkResourceAlerts,
  collectResourceMetrics,
  configureAdaptiveLimits,
  getAverageMetrics,
  getLastMetrics,
  getMetricsHistory,
  isMonitorRunning,
  resetAdaptiveState,
  resolveAdaptiveLimits,
  startAdaptiveMonitor,
  stopAdaptiveMonitor,
  type ResourceMetrics,
} from "./adaptive-limits.js";

describe("adaptive-limits", () => {
  beforeEach(() => {
    resetAdaptiveState();
    configureAdaptiveLimits({
      lowPressureThreshold: 0.4,
      highPressureThreshold: 0.7,
      criticalPressureThreshold: 0.85,
    });
  });

  afterEach(() => {
    stopAdaptiveMonitor();
  });

  describe("collectResourceMetrics", () => {
    it("collects current resource metrics", () => {
      const metrics = collectResourceMetrics();

      expect(metrics.heapUsedMB).toBeGreaterThanOrEqual(0);
      expect(metrics.heapTotalMB).toBeGreaterThan(0);
      expect(metrics.systemFreeMB).toBeGreaterThanOrEqual(0);
      expect(metrics.systemTotalMB).toBeGreaterThan(0);
      expect(metrics.cpuCount).toBeGreaterThan(0);
      expect(metrics.activeTasks).toBeGreaterThanOrEqual(0);
      expect(metrics.queuedTasks).toBeGreaterThanOrEqual(0);
      expect(metrics.timestamp).toBeGreaterThan(0);
      expect(["low", "medium", "high", "critical"]).toContain(metrics.pressure);
    });

    it("stores metrics in history", () => {
      collectResourceMetrics();
      collectResourceMetrics();
      const history = getMetricsHistory();
      expect(history.length).toBe(2);
    });

    it("limits history size", () => {
      for (let i = 0; i < 70; i++) {
        collectResourceMetrics();
      }
      const history = getMetricsHistory();
      expect(history.length).toBeLessThanOrEqual(60);
    });
  });

  describe("resolveAdaptiveLimits", () => {
    it("returns limits within configured bounds", () => {
      const limits = resolveAdaptiveLimits();

      expect(limits.mainLaneMax).toBeGreaterThanOrEqual(1);
      expect(limits.mainLaneMax).toBeLessThanOrEqual(8);
      expect(limits.subagentLaneMax).toBeGreaterThanOrEqual(2);
      expect(limits.subagentLaneMax).toBeLessThanOrEqual(16);
      expect(limits.cronLaneMax).toBeGreaterThanOrEqual(1);
      expect(limits.cronLaneMax).toBeLessThanOrEqual(4);
      expect(limits.pressureFactor).toBeGreaterThan(0);
      expect(limits.pressureFactor).toBeLessThanOrEqual(1);
    });

    it("reduces limits under pressure", () => {
      const lowPressureMetrics: ResourceMetrics = {
        heapUsedMB: 100,
        heapTotalMB: 500,
        heapUsageRatio: 0.2,
        systemFreeMB: 4000,
        systemTotalMB: 8000,
        systemUsageRatio: 0.5,
        loadAverage1: 0.5,
        loadAverage5: 0.4,
        loadAverage15: 0.3,
        cpuCount: 4,
        activeTasks: 2,
        queuedTasks: 1,
        pressure: "low",
        timestamp: Date.now(),
      };

      const highPressureMetrics: ResourceMetrics = {
        ...lowPressureMetrics,
        heapUsageRatio: 0.9,
        systemUsageRatio: 0.9,
        loadAverage1: 8,
        pressure: "critical",
      };

      const lowLimits = resolveAdaptiveLimits(lowPressureMetrics);
      const highLimits = resolveAdaptiveLimits(highPressureMetrics);

      expect(highLimits.mainLaneMax).toBeLessThan(lowLimits.mainLaneMax);
      expect(highLimits.pressureFactor).toBeLessThan(lowLimits.pressureFactor);
    });
  });

  describe("getLastMetrics", () => {
    it("returns null before first collection", () => {
      expect(getLastMetrics()).toBeNull();
    });

    it("returns last collected metrics", () => {
      const collected = collectResourceMetrics();
      const last = getLastMetrics();
      expect(last).toEqual(collected);
    });
  });

  describe("getAverageMetrics", () => {
    it("returns null when no history", () => {
      expect(getAverageMetrics()).toBeNull();
    });

    it("computes average over window", () => {
      collectResourceMetrics();
      collectResourceMetrics();
      const avg = getAverageMetrics(2);
      expect(avg).not.toBeNull();
      expect(avg!.timestamp).toBeGreaterThan(0);
    });
  });

  describe("checkResourceAlerts", () => {
    it("returns no alerts for healthy metrics", () => {
      const healthyMetrics: ResourceMetrics = {
        heapUsedMB: 100,
        heapTotalMB: 500,
        heapUsageRatio: 0.2,
        systemFreeMB: 4000,
        systemTotalMB: 8000,
        systemUsageRatio: 0.5,
        loadAverage1: 0.5,
        loadAverage5: 0.4,
        loadAverage15: 0.3,
        cpuCount: 4,
        activeTasks: 2,
        queuedTasks: 1,
        pressure: "low",
        timestamp: Date.now(),
      };

      const alerts = checkResourceAlerts(healthyMetrics);
      expect(alerts.length).toBe(0);
    });

    it("generates warning for high heap usage", () => {
      const highHeapMetrics: ResourceMetrics = {
        heapUsedMB: 400,
        heapTotalMB: 500,
        heapUsageRatio: 0.8,
        systemFreeMB: 4000,
        systemTotalMB: 8000,
        systemUsageRatio: 0.5,
        loadAverage1: 0.5,
        loadAverage5: 0.4,
        loadAverage15: 0.3,
        cpuCount: 4,
        activeTasks: 2,
        queuedTasks: 1,
        pressure: "medium",
        timestamp: Date.now(),
      };

      const alerts = checkResourceAlerts(highHeapMetrics);
      const heapAlert = alerts.find((a) => a.type === "heap");
      expect(heapAlert).toBeDefined();
      expect(heapAlert!.level).toBe("warning");
    });

    it("generates critical alert for very high heap usage", () => {
      const criticalHeapMetrics: ResourceMetrics = {
        heapUsedMB: 480,
        heapTotalMB: 500,
        heapUsageRatio: 0.96,
        systemFreeMB: 4000,
        systemTotalMB: 8000,
        systemUsageRatio: 0.5,
        loadAverage1: 0.5,
        loadAverage5: 0.4,
        loadAverage15: 0.3,
        cpuCount: 4,
        activeTasks: 2,
        queuedTasks: 1,
        pressure: "high",
        timestamp: Date.now(),
      };

      const alerts = checkResourceAlerts(criticalHeapMetrics);
      const heapAlert = alerts.find((a) => a.type === "heap");
      expect(heapAlert).toBeDefined();
      expect(heapAlert!.level).toBe("critical");
    });

    it("generates alert for high CPU load", () => {
      const highLoadMetrics: ResourceMetrics = {
        heapUsedMB: 100,
        heapTotalMB: 500,
        heapUsageRatio: 0.2,
        systemFreeMB: 4000,
        systemTotalMB: 8000,
        systemUsageRatio: 0.5,
        loadAverage1: 8,
        loadAverage5: 6,
        loadAverage15: 4,
        cpuCount: 4,
        activeTasks: 2,
        queuedTasks: 1,
        pressure: "high",
        timestamp: Date.now(),
      };

      const alerts = checkResourceAlerts(highLoadMetrics);
      const loadAlert = alerts.find((a) => a.type === "load");
      expect(loadAlert).toBeDefined();
    });
  });

  describe("startAdaptiveMonitor / stopAdaptiveMonitor", () => {
    it("starts and stops monitor", () => {
      expect(isMonitorRunning()).toBe(false);
      startAdaptiveMonitor();
      expect(isMonitorRunning()).toBe(true);
      stopAdaptiveMonitor();
      expect(isMonitorRunning()).toBe(false);
    });

    it("is idempotent", () => {
      startAdaptiveMonitor();
      startAdaptiveMonitor();
      expect(isMonitorRunning()).toBe(true);
      stopAdaptiveMonitor();
      stopAdaptiveMonitor();
      expect(isMonitorRunning()).toBe(false);
    });
  });

  describe("resetAdaptiveState", () => {
    it("clears all state", () => {
      collectResourceMetrics();
      startAdaptiveMonitor();

      resetAdaptiveState();

      expect(getLastMetrics()).toBeNull();
      expect(getMetricsHistory().length).toBe(0);
      expect(isMonitorRunning()).toBe(false);
    });
  });

  describe("configureAdaptiveLimits", () => {
    it("applies custom configuration", () => {
      configureAdaptiveLimits({
        minMainConcurrency: 2,
        maxMainConcurrency: 4,
        minSubagentConcurrency: 3,
        maxSubagentConcurrency: 6,
      });

      const limits = resolveAdaptiveLimits();
      expect(limits.mainLaneMax).toBeGreaterThanOrEqual(2);
      expect(limits.mainLaneMax).toBeLessThanOrEqual(4);
    });
  });
});
