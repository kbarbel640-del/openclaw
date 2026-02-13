/**
 * Worker lifecycle management for spawning, recycling, and killing workers.
 * Integrates with ISubprocessFactory for actual process management.
 */

import type { WorkerInfo, WorkerState } from '../domain/types.js';
import type { ISubprocessFactory } from './subprocess-factory.js';
import type { ConcurrencyConfig } from '../domain/config.js';

/**
 * Manages the lifecycle of worker processes.
 * Handles spawning, recycling (graceful restart), and killing.
 */
export class WorkerLifecycle {
  private workers: Map<string, WorkerInfo>;
  private nextWorkerId: number;

  constructor(
    private readonly subprocessFactory: ISubprocessFactory,
    private readonly config: ConcurrencyConfig
  ) {
    this.workers = new Map();
    this.nextWorkerId = 0;
  }

  /**
   * Spawns a new worker process.
   * @returns WorkerInfo for the newly created worker.
   */
  async spawn(): Promise<WorkerInfo> {
    const workerId = `worker-${this.nextWorkerId++}`;
    const subprocess = await this.subprocessFactory.create({
      id: workerId,
      timeoutMs: this.config.workerTimeoutMs,
      memoryLimitMb: this.config.memoryLimitMb,
    });

    const now = new Date();
    const worker: WorkerInfo = {
      id: workerId,
      state: 'idle',
      currentRequest: undefined,
      requestCount: 0,
      startedAt: now,
      lastHeartbeat: now,
      memoryUsageMb: 0,
      pid: subprocess.pid,
    };

    this.workers.set(workerId, worker);
    return worker;
  }

  /**
   * Recycles a worker by gracefully shutting it down and spawning a replacement.
   * Used when a worker reaches its request limit or memory threshold.
   */
  async recycle(workerId: string): Promise<void> {
    const worker = this.workers.get(workerId);
    if (!worker) return;

    // Mark as draining
    this.updateWorkerState(workerId, 'draining');

    // Kill old worker
    if (worker.pid) {
      await this.subprocessFactory.kill(worker.pid);
    }

    // Remove from pool
    this.workers.delete(workerId);
  }

  /**
   * Immediately kills a worker process.
   * Used for stuck or unresponsive workers.
   */
  kill(workerId: string): void {
    const worker = this.workers.get(workerId);
    if (!worker) return;

    if (worker.pid) {
      this.subprocessFactory.kill(worker.pid);
    }

    this.workers.delete(workerId);
  }

  /**
   * Gets current worker info.
   */
  getWorker(workerId: string): WorkerInfo | undefined {
    return this.workers.get(workerId);
  }

  /**
   * Updates worker state.
   */
  updateWorkerState(workerId: string, state: WorkerState): void {
    const worker = this.workers.get(workerId);
    if (!worker) return;

    this.workers.set(workerId, { ...worker, state });
  }

  /**
   * Updates worker heartbeat.
   */
  updateHeartbeat(workerId: string): void {
    const worker = this.workers.get(workerId);
    if (!worker) return;

    this.workers.set(workerId, { ...worker, lastHeartbeat: new Date() });
  }

  /**
   * Gets all workers.
   */
  getAllWorkers(): WorkerInfo[] {
    return Array.from(this.workers.values());
  }
}
