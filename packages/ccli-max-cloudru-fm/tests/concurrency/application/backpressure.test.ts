/**
 * Tests for Backpressure management.
 */

import { describe, it, expect } from 'vitest';
import { Backpressure } from '../../../src/concurrency/application/backpressure.js';
import type { ConcurrencyMetrics } from '../../../src/concurrency/domain/metrics.js';
import type { ConcurrencyConfig } from '../../../src/concurrency/domain/config.js';

describe('Backpressure', () => {
  const backpressure = new Backpressure();

  const baseConfig: ConcurrencyConfig = {
    maxWorkers: 10,
    minWorkers: 2,
    maxQueueSize: 100,
    backpressureThreshold: 0.8,
    workerTimeoutMs: 120_000,
    maxRequestsPerWorker: 100,
    memoryLimitMb: 512,
    heartbeatIntervalMs: 5_000,
    stuckThresholdMs: 60_000,
  };

  function createMetrics(queueDepth: number, activeWorkers: number, idleWorkers: number): ConcurrencyMetrics {
    return {
      queueDepth,
      activeWorkers,
      idleWorkers,
      totalProcessed: 0,
      totalErrors: 0,
      avgLatencyMs: 0,
      p95LatencyMs: 0,
      p99LatencyMs: 0,
      throughputPerMinute: 0,
      backpressureLevel: 0,
      stuckWorkers: 0,
    };
  }

  describe('shouldReject', () => {
    it('should return false when below threshold', () => {
      const metrics = createMetrics(10, 2, 8); // Low load
      const result = backpressure.shouldReject(metrics, baseConfig);

      expect(result).toBe(false);
    });

    it('should return true when above threshold', () => {
      const metrics = createMetrics(90, 10, 0); // High load
      const result = backpressure.shouldReject(metrics, baseConfig);

      expect(result).toBe(true);
    });

    it('should return false with empty queue', () => {
      const metrics = createMetrics(0, 0, 10);
      const result = backpressure.shouldReject(metrics, baseConfig);

      expect(result).toBe(false);
    });
  });

  describe('getBackpressureLevel', () => {
    it('should return 0 when no load', () => {
      const metrics = createMetrics(0, 0, 10);
      const level = backpressure.getBackpressureLevel(metrics, baseConfig);

      expect(level).toBe(0);
    });

    it('should return value proportional to queue depth', () => {
      const metrics50 = createMetrics(50, 0, 10); // 50% queue full
      const level50 = backpressure.getBackpressureLevel(metrics50, baseConfig);

      const metrics75 = createMetrics(75, 0, 10); // 75% queue full
      const level75 = backpressure.getBackpressureLevel(metrics75, baseConfig);

      expect(level75).toBeGreaterThan(level50);
    });

    it('should factor in worker utilization', () => {
      const metrics = createMetrics(50, 8, 2); // 50% queue, 80% workers busy
      const level = backpressure.getBackpressureLevel(metrics, baseConfig);

      // Should be influenced by both queue and worker pressure
      expect(level).toBeGreaterThan(0.3); // Queue contributes 0.5 * 0.7 = 0.35
    });

    it('should cap at 1.0', () => {
      const metrics = createMetrics(200, 10, 0); // Overload
      const level = backpressure.getBackpressureLevel(metrics, baseConfig);

      expect(level).toBeLessThanOrEqual(1.0);
    });

    it('should handle zero workers gracefully', () => {
      const metrics = createMetrics(50, 0, 0);
      const level = backpressure.getBackpressureLevel(metrics, baseConfig);

      expect(level).toBeGreaterThanOrEqual(0);
      expect(Number.isNaN(level)).toBe(false);
    });
  });

  describe('suggestWorkerCount', () => {
    it('should suggest minWorkers for low pressure', () => {
      const metrics = createMetrics(10, 2, 8);
      const suggestion = backpressure.suggestWorkerCount(metrics, baseConfig);

      expect(suggestion).toBe(baseConfig.minWorkers);
    });

    it('should suggest maxWorkers for high pressure', () => {
      const metrics = createMetrics(90, 10, 0);
      const suggestion = backpressure.suggestWorkerCount(metrics, baseConfig);

      expect(suggestion).toBe(baseConfig.maxWorkers);
    });

    it('should scale proportionally for medium pressure', () => {
      const metrics = createMetrics(60, 7, 3); // Higher pressure to trigger scaling
      const suggestion = backpressure.suggestWorkerCount(metrics, baseConfig);

      expect(suggestion).toBeGreaterThan(baseConfig.minWorkers);
      expect(suggestion).toBeLessThanOrEqual(baseConfig.maxWorkers);
    });
  });
});
