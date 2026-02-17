/**
 * Provider health tracking and monitoring.
 * Persists health state to Redis for cross-restart continuity.
 */

import { cacheGet, cacheSet, CACHE_KEYS, CACHE_TTL } from "../../infra/cache/cache.js";
import { isRedisConnected } from "../../infra/cache/redis.js";
import type { ProviderHealthMetrics, ProviderId, ProviderStatus } from "./types.js";

/**
 * In-memory health metrics store, backed by Redis for cross-restart persistence.
 */
const healthMetrics = new Map<ProviderId, ProviderHealthMetrics>();

// ---------------------------------------------------------------------------
// Redis persistence helpers (fire-and-forget, best-effort)
// ---------------------------------------------------------------------------

/** Persist provider health metrics to Redis. */
function persistHealth(providerId: ProviderId): void {
  const metrics = healthMetrics.get(providerId);
  if (!metrics) {
    return;
  }
  cacheSet(CACHE_KEYS.providerHealth(providerId), metrics, {
    ttlSeconds: CACHE_TTL.providerHealth,
  }).catch(() => {});
}

/** Load all provider health metrics from Redis into the in-memory Map. Called once at startup. */
export async function loadHealthFromRedis(): Promise<number> {
  try {
    if (!(await isRedisConnected())) {
      return 0;
    }
    const { getRedis, getRedisConfig } = await import("../../infra/cache/redis.js");
    const redis = getRedis();
    const config = getRedisConfig();
    const prefix = config.keyPrefix ?? "openclaw:";
    const pattern = `${prefix}provider:health:*`;
    const keys = await redis.keys(pattern);
    if (keys.length === 0) {
      return 0;
    }
    let restored = 0;
    for (const fullKey of keys) {
      const unprefixed = fullKey.startsWith(prefix) ? fullKey.slice(prefix.length) : fullKey;
      const providerId: ProviderId = unprefixed.replace(/^provider:health:/, "");
      const metrics = await cacheGet<ProviderHealthMetrics>(unprefixed);
      if (metrics) {
        healthMetrics.set(providerId, metrics);
        restored++;
      }
    }
    return restored;
  } catch {
    return 0;
  }
}

/**
 * Health thresholds and configuration.
 */
const HEALTH_CONFIG = {
  /** Error rate threshold before marking as degraded */
  degradedErrorRate: 0.2, // 20%
  /** Error rate threshold before cooldown */
  cooldownErrorRate: 0.5, // 50%
  /** Cooldown duration (ms) */
  cooldownDurationMs: 5 * 60 * 1000, // 5 minutes
  /** Min calls before calculating error rate */
  minCallsForMetrics: 5,
  /** Time window for recent metrics (ms) */
  recentWindowMs: 60 * 1000, // 1 minute
};

/**
 * Initialize health metrics for a provider.
 */
function initializeMetrics(providerId: ProviderId): ProviderHealthMetrics {
  const metrics: ProviderHealthMetrics = {
    providerId,
    status: "active",
    totalCalls: 0,
    successfulCalls: 0,
    failedCalls: 0,
    successRate: 1.0,
    avgResponseTime: 0,
    errorRateViolations: 0,
  };
  healthMetrics.set(providerId, metrics);
  return metrics;
}

/**
 * Get health metrics for a provider.
 */
export function getProviderHealth(providerId: ProviderId): ProviderHealthMetrics {
  return healthMetrics.get(providerId) ?? initializeMetrics(providerId);
}

/**
 * Record a successful provider call.
 */
export function recordSuccess(providerId: ProviderId, responseTimeMs: number): void {
  const metrics = getProviderHealth(providerId);

  metrics.totalCalls++;
  metrics.successfulCalls++;
  metrics.lastSuccess = Date.now();
  metrics.successRate = metrics.successfulCalls / metrics.totalCalls;

  // Update running average response time
  const alpha = 0.1; // Smoothing factor
  metrics.avgResponseTime =
    metrics.avgResponseTime === 0
      ? responseTimeMs
      : metrics.avgResponseTime * (1 - alpha) + responseTimeMs * alpha;

  updateProviderStatus(metrics);
  persistHealth(providerId);
}

/**
 * Record a failed provider call.
 */
export function recordFailure(providerId: ProviderId, _error: string | Error): void {
  const metrics = getProviderHealth(providerId);

  metrics.totalCalls++;
  metrics.failedCalls++;
  metrics.lastFailure = Date.now();
  metrics.successRate = metrics.successfulCalls / metrics.totalCalls;

  updateProviderStatus(metrics);
  persistHealth(providerId);
}

/**
 * Update provider status based on current metrics.
 */
function updateProviderStatus(metrics: ProviderHealthMetrics): void {
  const errorRate = 1 - metrics.successRate;

  // Check if in cooldown
  if (metrics.cooldownUntil && Date.now() < metrics.cooldownUntil) {
    metrics.status = "cooldown";
    return;
  }

  // Clear cooldown if expired
  if (metrics.cooldownUntil && Date.now() >= metrics.cooldownUntil) {
    metrics.cooldownUntil = undefined;
    metrics.errorRateViolations = 0;
  }

  // Not enough data yet
  if (metrics.totalCalls < HEALTH_CONFIG.minCallsForMetrics) {
    metrics.status = "active";
    return;
  }

  // Check error rate thresholds
  if (errorRate >= HEALTH_CONFIG.cooldownErrorRate) {
    metrics.errorRateViolations++;
    if (metrics.errorRateViolations >= 2) {
      // Enter cooldown after 2 violations
      metrics.status = "cooldown";
      metrics.cooldownUntil = Date.now() + HEALTH_CONFIG.cooldownDurationMs;
      return;
    }
    // Stay degraded while accumulating violations (don't reset violations)
    metrics.status = "degraded";
    return;
  }

  if (errorRate >= HEALTH_CONFIG.degradedErrorRate) {
    metrics.status = "degraded";
    return;
  }

  // Truly healthy — reset violation counter
  metrics.status = "active";
  metrics.errorRateViolations = 0;
}

/**
 * Check if a provider is healthy and available.
 */
export function isProviderHealthy(providerId: ProviderId): boolean {
  const metrics = getProviderHealth(providerId);
  return metrics.status === "active" || metrics.status === "degraded";
}

/**
 * Get providers in order of health preference (healthiest first).
 */
export function getProvidersByHealth(providerIds: ProviderId[]): ProviderId[] {
  return providerIds.toSorted((a, b) => {
    const aMetrics = getProviderHealth(a);
    const bMetrics = getProviderHealth(b);

    // Sort by status priority
    const statusPriority: Record<ProviderStatus, number> = {
      active: 0,
      degraded: 1,
      unknown: 2,
      cooldown: 3,
      offline: 4,
    };

    const aPriority = statusPriority[aMetrics.status] ?? 5;
    const bPriority = statusPriority[bMetrics.status] ?? 5;

    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }

    // If same status, sort by success rate
    return bMetrics.successRate - aMetrics.successRate;
  });
}

/**
 * Clear health metrics (for testing).
 */
export function clearHealthMetrics(): void {
  healthMetrics.clear();
}

/**
 * Get all provider health metrics.
 */
export function getAllProviderHealth(): Map<ProviderId, ProviderHealthMetrics> {
  return new Map(healthMetrics);
}
