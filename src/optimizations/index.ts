import {
  clearCache,
  configureSkillProtocol,
  getCacheStats,
  type SkillProtocolConfig,
} from "../agents/skills/skill-protocol.js";
import type { SubagentRunRecord } from "../agents/subagent-registry.types.js";
import {
  canAttemptSubagent,
  configureResilience,
  getResilienceStats,
  recordSubagentFailure,
  recordSubagentSuccess,
  resolveRestartDecision,
  startResilienceMaintenance,
  stopResilienceMaintenance,
  type SubagentResilienceConfig,
} from "../agents/subagent-resilience.js";
import {
  applyAdaptiveLimits,
  checkResourceAlerts,
  collectResourceMetrics,
  configureAdaptiveLimits,
  getLastMetrics,
  isMonitorRunning,
  resolveAdaptiveLimits,
  startAdaptiveMonitor,
  stopAdaptiveMonitor,
  type AdaptiveConfig,
  type ResourceMetrics,
} from "../process/adaptive-limits.js";
import { defaultRuntime } from "../runtime.js";

export type OptimizationConfig = {
  resilience?: SubagentResilienceConfig;
  adaptive?: AdaptiveConfig;
  skillProtocol?: SkillProtocolConfig;
  enabled?: boolean;
};

export type OptimizationStatus = {
  enabled: boolean;
  resilience: {
    maintenanceRunning: boolean;
    stats: ReturnType<typeof getResilienceStats>;
  };
  adaptive: {
    monitorRunning: boolean;
    lastMetrics: ResourceMetrics | null;
    currentLimits: ReturnType<typeof resolveAdaptiveLimits>;
  };
  skillProtocol: {
    cacheStats: ReturnType<typeof getCacheStats>;
  };
};

const DEFAULT_OPTIMIZATION_CONFIG: OptimizationConfig = {
  enabled: true,
};

let optimizationConfig = DEFAULT_OPTIMIZATION_CONFIG;
let initialized = false;

export function configureOptimizations(config: OptimizationConfig): void {
  optimizationConfig = { ...DEFAULT_OPTIMIZATION_CONFIG, ...config };

  if (config.resilience) {
    configureResilience(config.resilience);
  }
  if (config.adaptive) {
    configureAdaptiveLimits(config.adaptive);
  }
  if (config.skillProtocol) {
    configureSkillProtocol(config.skillProtocol);
  }
}

export function initializeOptimizations(config?: OptimizationConfig): void {
  if (initialized) {
    return;
  }

  if (config) {
    configureOptimizations(config);
  }

  if (!optimizationConfig.enabled) {
    defaultRuntime.log("[optimizations] Disabled by configuration");
    return;
  }

  startResilienceMaintenance();
  startAdaptiveMonitor();

  initialized = true;
  defaultRuntime.log("[optimizations] Initialized: resilience + adaptive limits + skill protocol");
}

export function shutdownOptimizations(): void {
  if (!initialized) {
    return;
  }

  stopResilienceMaintenance();
  stopAdaptiveMonitor();
  clearCache();

  initialized = false;
  defaultRuntime.log("[optimizations] Shutdown complete");
}

export function getOptimizationStatus(): OptimizationStatus {
  const lastMetrics = getLastMetrics();
  const currentLimits = resolveAdaptiveLimits(lastMetrics ?? undefined);

  return {
    enabled: optimizationConfig.enabled ?? true,
    resilience: {
      maintenanceRunning: initialized,
      stats: getResilienceStats(),
    },
    adaptive: {
      monitorRunning: isMonitorRunning(),
      lastMetrics,
      currentLimits,
    },
    skillProtocol: {
      cacheStats: getCacheStats(),
    },
  };
}

export function onSubagentStart(sessionKey: string): {
  allowed: boolean;
  healthStatus: string;
  message: string;
} {
  if (!optimizationConfig.enabled) {
    return { allowed: true, healthStatus: "enabled", message: "Optimizations disabled" };
  }

  const allowed = canAttemptSubagent(sessionKey);
  if (!allowed) {
    return {
      allowed: false,
      healthStatus: "circuit-open",
      message: `Circuit breaker open for session ${sessionKey}`,
    };
  }

  return { allowed: true, healthStatus: "ok", message: "Subagent start allowed" };
}

export function onSubagentComplete(params: {
  sessionKey: string;
  success: boolean;
  error?: string;
  responseTimeMs?: number;
}): void {
  if (!optimizationConfig.enabled) {
    return;
  }

  if (params.success) {
    recordSubagentSuccess({
      sessionKey: params.sessionKey,
      responseTimeMs: params.responseTimeMs,
    });
  } else {
    recordSubagentFailure({
      sessionKey: params.sessionKey,
      error: params.error,
      responseTimeMs: params.responseTimeMs,
    });
  }
}

export function onSubagentRestart(params: {
  runRecord: SubagentRunRecord;
  attemptCount: number;
  lastError?: string;
}): {
  shouldRestart: boolean;
  delayMs: number;
  reason: string;
} {
  if (!optimizationConfig.enabled) {
    return { shouldRestart: true, delayMs: 1000, reason: "optimizations-disabled" };
  }

  const decision = resolveRestartDecision({
    runRecord: params.runRecord,
    attemptCount: params.attemptCount,
    lastError: params.lastError,
  });

  return {
    shouldRestart: decision.shouldRestart,
    delayMs: decision.delayMs,
    reason: decision.reason,
  };
}

export function checkSystemHealth(): {
  status: "healthy" | "degraded" | "critical";
  metrics: ResourceMetrics | null;
  alerts: ReturnType<typeof checkResourceAlerts>;
  recommendations: string[];
} {
  const metrics = collectResourceMetrics();
  const alerts = checkResourceAlerts(metrics);
  const recommendations: string[] = [];

  let status: "healthy" | "degraded" | "critical" = "healthy";

  for (const alert of alerts) {
    if (alert.level === "critical") {
      status = "critical";
      recommendations.push(`Address ${alert.type}: ${alert.message}`);
    } else if (status === "healthy") {
      status = "degraded";
      recommendations.push(`Monitor ${alert.type}: ${alert.message}`);
    }
  }

  if (metrics.pressure === "critical") {
    status = "critical";
    recommendations.push("Consider reducing concurrent operations");
  } else if (metrics.pressure === "high" && status === "healthy") {
    status = "degraded";
    recommendations.push("System under load, monitor closely");
  }

  const resilienceStats = getResilienceStats();
  if (resilienceStats.circuitOpenCount > 0) {
    recommendations.push(
      `${resilienceStats.circuitOpenCount} session(s) have open circuit breakers`,
    );
    if (status === "healthy") {
      status = "degraded";
    }
  }

  return { status, metrics, alerts, recommendations };
}

export function forceAdjustLimits(): ReturnType<typeof applyAdaptiveLimits> {
  return applyAdaptiveLimits(false);
}

export function getOptimizationReport(): string {
  const status = getOptimizationStatus();
  const health = checkSystemHealth();

  const lines = [
    "=== OpenClaw Optimization Report ===",
    "",
    "Resilience (Subagent Health):",
    `  Total sessions tracked: ${status.resilience.stats.totalSessions}`,
    `  Healthy: ${status.resilience.stats.healthyCount}`,
    `  Degraded: ${status.resilience.stats.degradedCount}`,
    `  Circuit open: ${status.resilience.stats.circuitOpenCount}`,
    `  Circuit half-open: ${status.resilience.stats.circuitHalfOpenCount}`,
    "",
    "Resource Management:",
    `  Monitor running: ${status.adaptive.monitorRunning}`,
    `  System pressure: ${health.metrics?.pressure ?? "unknown"}`,
    `  Heap usage: ${health.metrics?.heapUsageRatio?.toFixed(1) ?? "n/a"}%`,
    `  Active tasks: ${health.metrics?.activeTasks ?? 0}`,
    `  Current limits: main=${status.adaptive.currentLimits.mainLaneMax}, subagent=${status.adaptive.currentLimits.subagentLaneMax}`,
    "",
    "Skill Protocol:",
    `  Cache size: ${status.skillProtocol.cacheStats.size}/${status.skillProtocol.cacheStats.maxSize}`,
    `  Cache hit rate: ${status.skillProtocol.cacheStats.hitRate.toFixed(2)}`,
    "",
    "System Health:",
    `  Status: ${health.status}`,
  ];

  if (health.recommendations.length > 0) {
    lines.push("  Recommendations:");
    for (const rec of health.recommendations) {
      lines.push(`    - ${rec}`);
    }
  }

  return lines.join("\n");
}

export {
  canAttemptSubagent,
  collectResourceMetrics,
  getResilienceStats,
  recordSubagentFailure,
  recordSubagentSuccess,
  resolveRestartDecision,
  resolveAdaptiveLimits,
  checkResourceAlerts,
};
