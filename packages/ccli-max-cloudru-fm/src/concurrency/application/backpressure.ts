/**
 * Backpressure management to prevent system overload.
 * Uses queue depth and worker utilization to determine load.
 */

import type { ConcurrencyMetrics } from '../domain/metrics.js';
import type { ConcurrencyConfig } from '../domain/config.js';

/**
 * Manages backpressure decisions based on system load.
 * Helps maintain system stability under high traffic.
 */
export class Backpressure {
  /**
   * Determines if new requests should be rejected due to high load.
   * @returns true if backpressure is active and requests should be rejected.
   */
  shouldReject(metrics: ConcurrencyMetrics, config: ConcurrencyConfig): boolean {
    const level = this.getBackpressureLevel(metrics, config);
    return level >= config.backpressureThreshold;
  }

  /**
   * Calculates the current backpressure level.
   * @returns A value between 0 (no pressure) and 1 (maximum pressure).
   */
  getBackpressureLevel(metrics: ConcurrencyMetrics, config: ConcurrencyConfig): number {
    // Calculate queue pressure (0-1)
    const queuePressure = Math.min(metrics.queueDepth / config.maxQueueSize, 1.0);

    // Calculate worker utilization (0-1)
    const totalWorkers = metrics.activeWorkers + metrics.idleWorkers;
    const workerUtilization = totalWorkers > 0
      ? metrics.activeWorkers / totalWorkers
      : 0;

    // Weighted combination of queue and worker pressure
    // Queue pressure has higher weight as it indicates pending work
    const queueWeight = 0.7;
    const workerWeight = 0.3;

    const level = (queuePressure * queueWeight) + (workerUtilization * workerWeight);

    return Math.min(level, 1.0);
  }

  /**
   * Suggests the number of workers needed based on current load.
   * Used for adaptive scaling decisions.
   */
  suggestWorkerCount(metrics: ConcurrencyMetrics, config: ConcurrencyConfig): number {
    const level = this.getBackpressureLevel(metrics, config);

    if (level >= 0.8) {
      // High pressure: maximize workers
      return config.maxWorkers;
    } else if (level >= 0.5) {
      // Medium pressure: scale up proportionally
      const range = config.maxWorkers - config.minWorkers;
      const additional = Math.ceil(range * ((level - 0.5) / 0.3));
      return config.minWorkers + additional;
    } else {
      // Low pressure: maintain minimum
      return config.minWorkers;
    }
  }
}
