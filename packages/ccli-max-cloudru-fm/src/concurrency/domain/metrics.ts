/**
 * Metrics tracking for the concurrency bounded context.
 * Provides observability into worker pool performance.
 */

/**
 * Real-time metrics about the worker pool state and performance.
 * Used for monitoring, alerting, and adaptive scaling.
 */
export interface ConcurrencyMetrics {
  /** Number of workers currently processing requests */
  activeWorkers: number;

  /** Number of workers available to accept requests */
  idleWorkers: number;

  /** Number of requests waiting in the queue */
  queueDepth: number;

  /** Total number of requests processed since startup */
  totalProcessed: number;

  /** Total number of requests that resulted in errors */
  totalErrors: number;

  /** Average request processing latency in milliseconds */
  avgLatencyMs: number;

  /** 95th percentile latency in milliseconds */
  p95LatencyMs: number;

  /** 99th percentile latency in milliseconds */
  p99LatencyMs: number;

  /** Number of requests processed per minute */
  throughputPerMinute: number;

  /** Current backpressure level (0-1) */
  backpressureLevel: number;

  /** Number of workers in stuck state */
  stuckWorkers: number;
}
