import os from "node:os";
import { defaultRuntime } from "../runtime.js";
import {
  getActiveTaskCount,
  getTotalQueueSize,
  setCommandLaneConcurrency,
} from "./command-queue.js";
import { CommandLane } from "./lanes.js";

export type SystemPressure = "low" | "medium" | "high" | "critical";

export type ResourceMetrics = {
  heapUsedMB: number;
  heapTotalMB: number;
  heapUsageRatio: number;
  systemFreeMB: number;
  systemTotalMB: number;
  systemUsageRatio: number;
  loadAverage1: number;
  loadAverage5: number;
  loadAverage15: number;
  cpuCount: number;
  activeTasks: number;
  queuedTasks: number;
  pressure: SystemPressure;
  timestamp: number;
};

export type AdaptiveLimits = {
  mainLaneMax: number;
  subagentLaneMax: number;
  cronLaneMax: number;
  pressureFactor: number;
  reason: string;
};

export type AdaptiveConfig = {
  lowPressureThreshold?: number;
  highPressureThreshold?: number;
  criticalPressureThreshold?: number;
  minMainConcurrency?: number;
  maxMainConcurrency?: number;
  minSubagentConcurrency?: number;
  maxSubagentConcurrency?: number;
  minCronConcurrency?: number;
  maxCronConcurrency?: number;
  heapCriticalRatio?: number;
  heapHighRatio?: number;
  systemMemoryCriticalRatio?: number;
  systemMemoryHighRatio?: number;
  loadCriticalFactor?: number;
  loadHighFactor?: number;
  sampleIntervalMs?: number;
  adjustmentCooldownMs?: number;
};

const DEFAULT_ADAPTIVE_CONFIG: Required<AdaptiveConfig> = {
  lowPressureThreshold: 0.4,
  highPressureThreshold: 0.7,
  criticalPressureThreshold: 0.85,
  minMainConcurrency: 1,
  maxMainConcurrency: 8,
  minSubagentConcurrency: 2,
  maxSubagentConcurrency: 16,
  minCronConcurrency: 1,
  maxCronConcurrency: 4,
  heapCriticalRatio: 0.9,
  heapHighRatio: 0.75,
  systemMemoryCriticalRatio: 0.9,
  systemMemoryHighRatio: 0.8,
  loadCriticalFactor: 2.0,
  loadHighFactor: 1.5,
  sampleIntervalMs: 5_000,
  adjustmentCooldownMs: 30_000,
};

let config = DEFAULT_ADAPTIVE_CONFIG;
let lastAdjustmentAt = 0;
let lastMetrics: ResourceMetrics | null = null;
let metricsHistory: ResourceMetrics[] = [];
const MAX_HISTORY_SIZE = 60;

export function configureAdaptiveLimits(newConfig: AdaptiveConfig): void {
  config = { ...DEFAULT_ADAPTIVE_CONFIG, ...newConfig };
}

export function collectResourceMetrics(): ResourceMetrics {
  const memUsage = process.memoryUsage();
  const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
  const heapUsageRatio = heapTotalMB > 0 ? heapUsedMB / heapTotalMB : 0;

  const systemFreeMB = Math.round(os.freemem() / 1024 / 1024);
  const systemTotalMB = Math.round(os.totalmem() / 1024 / 1024);
  const systemUsageRatio = systemTotalMB > 0 ? (systemTotalMB - systemFreeMB) / systemTotalMB : 0;

  const loadAverage = os.loadavg();
  const cpuCount = os.cpus().length;

  const activeTasks = getActiveTaskCount();
  const queuedTasks = getTotalQueueSize();

  const pressure = calculatePressure({
    heapUsageRatio,
    systemUsageRatio,
    loadAverage1: loadAverage[0],
    loadAverage5: loadAverage[1],
    cpuCount,
    activeTasks,
    queuedTasks,
  });

  const metrics: ResourceMetrics = {
    heapUsedMB,
    heapTotalMB,
    heapUsageRatio,
    systemFreeMB,
    systemTotalMB,
    systemUsageRatio,
    loadAverage1: loadAverage[0],
    loadAverage5: loadAverage[1],
    loadAverage15: loadAverage[2],
    cpuCount,
    activeTasks,
    queuedTasks,
    pressure,
    timestamp: Date.now(),
  };

  lastMetrics = metrics;
  metricsHistory.push(metrics);
  if (metricsHistory.length > MAX_HISTORY_SIZE) {
    metricsHistory.shift();
  }

  return metrics;
}

type PressureInputs = {
  heapUsageRatio: number;
  systemUsageRatio: number;
  loadAverage1: number;
  loadAverage5: number;
  cpuCount: number;
  activeTasks: number;
  queuedTasks: number;
};

function calculatePressure(inputs: PressureInputs): SystemPressure {
  let pressureScore = 0;
  const weights = { heap: 0.35, system: 0.25, load: 0.25, queue: 0.15 };

  if (inputs.heapUsageRatio > config.heapCriticalRatio) {
    pressureScore += weights.heap * 1.0;
  } else if (inputs.heapUsageRatio > config.heapHighRatio) {
    pressureScore += weights.heap * 0.7;
  } else {
    pressureScore += weights.heap * inputs.heapUsageRatio;
  }

  if (inputs.systemUsageRatio > config.systemMemoryCriticalRatio) {
    pressureScore += weights.system * 1.0;
  } else if (inputs.systemUsageRatio > config.systemMemoryHighRatio) {
    pressureScore += weights.system * 0.7;
  } else {
    pressureScore += weights.system * inputs.systemUsageRatio;
  }

  const loadRatio = inputs.cpuCount > 0 ? inputs.loadAverage1 / inputs.cpuCount : 0;
  if (loadRatio > config.loadCriticalFactor) {
    pressureScore += weights.load * 1.0;
  } else if (loadRatio > config.loadHighFactor) {
    pressureScore += weights.load * 0.7;
  } else {
    pressureScore += weights.load * Math.min(1, loadRatio);
  }

  const queuePressure =
    inputs.activeTasks + inputs.queuedTasks > 20
      ? 1
      : (inputs.activeTasks + inputs.queuedTasks) / 20;
  pressureScore += weights.queue * queuePressure;

  if (pressureScore >= config.criticalPressureThreshold) {
    return "critical";
  }
  if (pressureScore >= config.highPressureThreshold) {
    return "high";
  }
  if (pressureScore >= config.lowPressureThreshold) {
    return "medium";
  }
  return "low";
}

export function resolveAdaptiveLimits(metrics?: ResourceMetrics): AdaptiveLimits {
  const currentMetrics = metrics ?? collectResourceMetrics();
  const { pressure, cpuCount, heapUsageRatio } = currentMetrics;

  let pressureFactor: number;
  let reason: string;

  switch (pressure) {
    case "critical":
      pressureFactor = 0.25;
      reason = "critical-pressure";
      break;
    case "high":
      pressureFactor = 0.5;
      reason = "high-pressure";
      break;
    case "medium":
      pressureFactor = 0.75;
      reason = "medium-pressure";
      break;
    case "low":
    default:
      pressureFactor = 1.0;
      reason = "low-pressure";
      break;
  }

  const memoryPressureFactor = Math.max(0.5, 1 - heapUsageRatio * 0.5);
  const combinedFactor = pressureFactor * memoryPressureFactor;

  const baseMain = Math.min(cpuCount, config.maxMainConcurrency);
  const baseSubagent = Math.min(cpuCount * 2, config.maxSubagentConcurrency);
  const baseCron = Math.min(Math.max(1, Math.floor(cpuCount / 2)), config.maxCronConcurrency);

  return {
    mainLaneMax: Math.max(config.minMainConcurrency, Math.floor(baseMain * combinedFactor)),
    subagentLaneMax: Math.max(
      config.minSubagentConcurrency,
      Math.floor(baseSubagent * combinedFactor),
    ),
    cronLaneMax: Math.max(config.minCronConcurrency, Math.floor(baseCron * combinedFactor)),
    pressureFactor: combinedFactor,
    reason,
  };
}

export function applyAdaptiveLimits(dryRun = false): AdaptiveLimits & { applied: boolean } {
  const now = Date.now();
  const limits = resolveAdaptiveLimits();

  if (now - lastAdjustmentAt < config.adjustmentCooldownMs) {
    return { ...limits, applied: false };
  }

  if (!dryRun) {
    setCommandLaneConcurrency(CommandLane.Main, limits.mainLaneMax);
    setCommandLaneConcurrency(CommandLane.Subagent, limits.subagentLaneMax);
    setCommandLaneConcurrency(CommandLane.Cron, limits.cronLaneMax);
    lastAdjustmentAt = now;

    defaultRuntime.log(
      `[adaptive-limits] Applied: main=${limits.mainLaneMax} subagent=${limits.subagentLaneMax} cron=${limits.cronLaneMax} reason=${limits.reason}`,
    );
  }

  return { ...limits, applied: true };
}

export function getLastMetrics(): ResourceMetrics | null {
  return lastMetrics;
}

export function getMetricsHistory(): ResourceMetrics[] {
  return [...metricsHistory];
}

export function getAverageMetrics(windowSize = 10): ResourceMetrics | null {
  if (metricsHistory.length === 0) {
    return null;
  }

  const window = metricsHistory.slice(-windowSize);
  if (window.length === 0) {
    return null;
  }

  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

  return {
    heapUsedMB: Math.round(avg(window.map((m) => m.heapUsedMB))),
    heapTotalMB: Math.round(avg(window.map((m) => m.heapTotalMB))),
    heapUsageRatio: avg(window.map((m) => m.heapUsageRatio)),
    systemFreeMB: Math.round(avg(window.map((m) => m.systemFreeMB))),
    systemTotalMB: Math.round(avg(window.map((m) => m.systemTotalMB))),
    systemUsageRatio: avg(window.map((m) => m.systemUsageRatio)),
    loadAverage1: avg(window.map((m) => m.loadAverage1)),
    loadAverage5: avg(window.map((m) => m.loadAverage5)),
    loadAverage15: avg(window.map((m) => m.loadAverage15)),
    cpuCount: window[window.length - 1].cpuCount,
    activeTasks: Math.round(avg(window.map((m) => m.activeTasks))),
    queuedTasks: Math.round(avg(window.map((m) => m.queuedTasks))),
    pressure: window[window.length - 1].pressure,
    timestamp: Date.now(),
  };
}

let monitorInterval: NodeJS.Timeout | null = null;

export function startAdaptiveMonitor(): void {
  if (monitorInterval) {
    return;
  }

  collectResourceMetrics();

  monitorInterval = setInterval(() => {
    collectResourceMetrics();
    applyAdaptiveLimits();
  }, config.sampleIntervalMs);

  monitorInterval.unref?.();
  defaultRuntime.log("[adaptive-limits] Monitor started");
}

export function stopAdaptiveMonitor(): void {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    defaultRuntime.log("[adaptive-limits] Monitor stopped");
  }
}

export function isMonitorRunning(): boolean {
  return monitorInterval !== null;
}

export function resetAdaptiveState(): void {
  stopAdaptiveMonitor();
  metricsHistory = [];
  lastMetrics = null;
  lastAdjustmentAt = 0;
}

export type ResourceAlert = {
  level: "warning" | "critical";
  type: "heap" | "system-memory" | "load" | "queue";
  message: string;
  value: number;
  threshold: number;
  timestamp: number;
};

export function checkResourceAlerts(metrics?: ResourceMetrics): ResourceAlert[] {
  const currentMetrics = metrics ?? collectResourceMetrics();
  const alerts: ResourceAlert[] = [];
  const now = Date.now();

  if (currentMetrics.heapUsageRatio > config.heapCriticalRatio) {
    alerts.push({
      level: "critical",
      type: "heap",
      message: `Heap usage critical: ${Math.round(currentMetrics.heapUsageRatio * 100)}%`,
      value: currentMetrics.heapUsageRatio,
      threshold: config.heapCriticalRatio,
      timestamp: now,
    });
  } else if (currentMetrics.heapUsageRatio > config.heapHighRatio) {
    alerts.push({
      level: "warning",
      type: "heap",
      message: `Heap usage high: ${Math.round(currentMetrics.heapUsageRatio * 100)}%`,
      value: currentMetrics.heapUsageRatio,
      threshold: config.heapHighRatio,
      timestamp: now,
    });
  }

  if (currentMetrics.systemUsageRatio > config.systemMemoryCriticalRatio) {
    alerts.push({
      level: "critical",
      type: "system-memory",
      message: `System memory critical: ${Math.round(currentMetrics.systemUsageRatio * 100)}%`,
      value: currentMetrics.systemUsageRatio,
      threshold: config.systemMemoryCriticalRatio,
      timestamp: now,
    });
  } else if (currentMetrics.systemUsageRatio > config.systemMemoryHighRatio) {
    alerts.push({
      level: "warning",
      type: "system-memory",
      message: `System memory high: ${Math.round(currentMetrics.systemUsageRatio * 100)}%`,
      value: currentMetrics.systemUsageRatio,
      threshold: config.systemMemoryHighRatio,
      timestamp: now,
    });
  }

  const loadRatio =
    currentMetrics.cpuCount > 0
      ? currentMetrics.loadAverage1 / currentMetrics.cpuCount
      : currentMetrics.loadAverage1;

  if (loadRatio > config.loadCriticalFactor) {
    alerts.push({
      level: "critical",
      type: "load",
      message: `CPU load critical: ${loadRatio.toFixed(2)}x CPU count`,
      value: loadRatio,
      threshold: config.loadCriticalFactor,
      timestamp: now,
    });
  } else if (loadRatio > config.loadHighFactor) {
    alerts.push({
      level: "warning",
      type: "load",
      message: `CPU load high: ${loadRatio.toFixed(2)}x CPU count`,
      value: loadRatio,
      threshold: config.loadHighFactor,
      timestamp: now,
    });
  }

  return alerts;
}
