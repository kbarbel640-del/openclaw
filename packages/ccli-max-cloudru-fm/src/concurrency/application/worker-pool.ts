/**
 * Worker pool orchestrator that coordinates all concurrency operations.
 * Central hub for request processing, worker management, and health monitoring.
 */

import type { Result } from '../../core/types/result.js';
import { ok, err } from '../../core/types/result.js';
import type { ConcurrencyConfig } from '../domain/config.js';
import type { ConcurrencyMetrics } from '../domain/metrics.js';
import type { WorkerRequest, WorkerResponse, QueueEntry } from '../domain/types.js';
import type { Timer } from '../../core/types/timer.js';
import { realTimer } from '../../core/types/timer.js';
import { PriorityScheduler } from './scheduler.js';
import { SessionMutex } from './session-mutex.js';
import { WorkerLifecycle } from './worker-lifecycle.js';
import { Backpressure } from './backpressure.js';
import type { ISubprocessFactory } from './subprocess-factory.js';
import { QueueFullError, WorkerTimeoutError, BackpressureError } from '../domain/errors.js';

/**
 * Orchestrates concurrent request processing with worker lifecycle management.
 * Coordinates scheduler, mutex, workers, and health checks.
 */
export class WorkerPool {
  private scheduler: PriorityScheduler;
  private mutex: SessionMutex;
  private lifecycle: WorkerLifecycle;
  private backpressure: Backpressure;
  private isShuttingDown: boolean;
  private latencies: number[];
  private timer: Timer;

  constructor(
    private readonly config: ConcurrencyConfig,
    subprocessFactory: ISubprocessFactory,
    timer: Timer = realTimer
  ) {
    this.scheduler = new PriorityScheduler(config.maxQueueSize);
    this.mutex = new SessionMutex();
    this.lifecycle = new WorkerLifecycle(subprocessFactory, config);
    this.backpressure = new Backpressure();
    this.isShuttingDown = false;
    this.latencies = [];
    this.timer = timer;
  }

  /**
   * Submits a request for processing.
   * Handles queueing, worker assignment, and session locking.
   */
  async submit(
    request: WorkerRequest
  ): Promise<Result<WorkerResponse, QueueFullError | BackpressureError | WorkerTimeoutError>> {
    if (this.isShuttingDown) {
      return err(new BackpressureError('Pool is shutting down'));
    }

    // Check backpressure
    const metrics = this.getMetrics();
    if (this.backpressure.shouldReject(metrics, this.config)) {
      return err(new BackpressureError('System under high load'));
    }

    // Acquire session lock
    const lockResult = await this.mutex.acquire(request.sessionId, request.timeoutMs);
    if (!lockResult.ok) {
      return err(new QueueFullError(lockResult.error.message));
    }

    try {
      // Enqueue request
      const entry: QueueEntry = {
        id: request.id,
        tenantId: request.tenantId,
        priority: request.priority,
        enqueuedAt: new Date(),
        timeoutMs: request.timeoutMs,
        payload: request,
      };

      const enqueueResult = this.scheduler.enqueue(entry);
      if (!enqueueResult.ok) {
        return err(enqueueResult.error);
      }

      // Process queue
      const response = await this.processQueue();

      return response;
    } finally {
      this.mutex.release(lockResult.value);
    }
  }

  /**
   * Retrieves current pool metrics for monitoring.
   */
  getMetrics(): ConcurrencyMetrics {
    const workers = this.lifecycle.getAllWorkers();
    const activeWorkers = workers.filter(w => w.state === 'busy').length;
    const idleWorkers = workers.filter(w => w.state === 'idle').length;
    const stuckWorkers = workers.filter(w => w.state === 'stuck').length;
    const queueDepth = this.scheduler.getQueueDepth();

    return {
      activeWorkers,
      idleWorkers,
      queueDepth,
      totalProcessed: this.latencies.length,
      totalErrors: 0, // Would track in production
      avgLatencyMs: this.calculateAvgLatency(),
      p95LatencyMs: this.calculatePercentile(0.95),
      p99LatencyMs: this.calculatePercentile(0.99),
      throughputPerMinute: this.calculateThroughput(),
      backpressureLevel: this.backpressure.getBackpressureLevel(
        {
          activeWorkers,
          idleWorkers,
          queueDepth,
          totalProcessed: this.latencies.length,
          totalErrors: 0,
          avgLatencyMs: this.calculateAvgLatency(),
          p95LatencyMs: this.calculatePercentile(0.95),
          p99LatencyMs: this.calculatePercentile(0.99),
          throughputPerMinute: this.calculateThroughput(),
          backpressureLevel: 0,
          stuckWorkers,
        },
        this.config
      ),
      stuckWorkers,
    };
  }

  /**
   * Gracefully shuts down the pool.
   * Waits for in-flight requests and stops all workers.
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;

    // Wait for queue to drain
    while (this.scheduler.getQueueDepth() > 0) {
      await new Promise(resolve => this.timer.setTimeout(() => resolve(undefined), 100));
    }

    // Kill all workers
    const workers = this.lifecycle.getAllWorkers();
    for (const worker of workers) {
      this.lifecycle.kill(worker.id);
    }
  }

  private async processQueue(): Promise<Result<WorkerResponse, WorkerTimeoutError>> {
    // Get next request from queue
    const entry = this.scheduler.dequeue();
    if (!entry) {
      return err(new WorkerTimeoutError('No requests in queue'));
    }

    // Find or spawn a worker
    const worker = await this.getOrSpawnWorker();
    if (!worker) {
      return err(new WorkerTimeoutError('No workers available'));
    }

    // Simulate processing (in production, would delegate to worker subprocess)
    const startTime = this.timer.now();
    const processingTime = Math.random() * 1000; // Simulated
    await new Promise(resolve => this.timer.setTimeout(() => resolve(undefined), processingTime));
    const latency = this.timer.now() - startTime;

    this.latencies.push(latency);

    const response: WorkerResponse = {
      requestId: entry.id,
      result: { success: true },
      processingTimeMs: latency,
      workerId: worker.id,
    };

    return ok(response);
  }

  private async getOrSpawnWorker() {
    const workers = this.lifecycle.getAllWorkers();
    const idleWorker = workers.find(w => w.state === 'idle');

    if (idleWorker) {
      return idleWorker;
    }

    if (workers.length < this.config.maxWorkers) {
      return await this.lifecycle.spawn();
    }

    return undefined;
  }

  private calculateAvgLatency(): number {
    if (this.latencies.length === 0) return 0;
    const sum = this.latencies.reduce((a, b) => a + b, 0);
    return sum / this.latencies.length;
  }

  private calculatePercentile(p: number): number {
    if (this.latencies.length === 0) return 0;
    const sorted = [...this.latencies].sort((a, b) => a - b);
    const index = Math.floor(sorted.length * p);
    return sorted[index] ?? 0;
  }

  private calculateThroughput(): number {
    // In production, would track over sliding window
    return this.latencies.length;
  }
}
