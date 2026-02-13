/**
 * Configuration for the concurrency bounded context.
 * Defines resource limits, thresholds, and operational parameters.
 */

/**
 * Configuration settings for concurrent request processing.
 * All values are immutable to ensure consistent behavior.
 */
export interface ConcurrencyConfig {
  /** Maximum number of worker processes allowed */
  readonly maxWorkers: number;

  /** Minimum number of workers to keep alive */
  readonly minWorkers: number;

  /** Maximum number of requests that can be queued */
  readonly maxQueueSize: number;

  /** Maximum time a worker can process a request before timeout */
  readonly workerTimeoutMs: number;

  /** Maximum requests a worker can process before being recycled */
  readonly maxRequestsPerWorker: number;

  /** Memory limit per worker in megabytes */
  readonly memoryLimitMb: number;

  /** Threshold for activating backpressure (0-1, e.g., 0.7 = 70%) */
  readonly backpressureThreshold: number;

  /** Interval for worker heartbeat checks */
  readonly heartbeatIntervalMs: number;

  /** Time threshold for considering a worker stuck */
  readonly stuckThresholdMs: number;
}

/**
 * Default configuration with production-ready values.
 * Balances throughput, latency, and resource usage.
 */
export const DEFAULT_CONCURRENCY_CONFIG: ConcurrencyConfig = {
  maxWorkers: 4,
  minWorkers: 1,
  maxQueueSize: 32,
  workerTimeoutMs: 120_000,
  maxRequestsPerWorker: 100,
  memoryLimitMb: 512,
  backpressureThreshold: 0.7,
  heartbeatIntervalMs: 5_000,
  stuckThresholdMs: 60_000,
};
