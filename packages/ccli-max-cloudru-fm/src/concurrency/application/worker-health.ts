/**
 * Worker health monitoring and status detection.
 * Identifies stuck, OOM, and unhealthy workers.
 */

import type { WorkerInfo, WorkerState } from '../domain/types.js';
import type { ConcurrencyConfig } from '../domain/config.js';

/**
 * Monitors worker health and detects problematic states.
 */
export class WorkerHealth {
  /**
   * Performs a comprehensive health check on a worker.
   * @returns The current health state of the worker.
   */
  checkHealth(worker: WorkerInfo, config: ConcurrencyConfig): WorkerState {
    // Check if already marked as dead
    if (worker.state === 'dead') {
      return 'dead';
    }

    // Check if draining
    if (worker.state === 'draining') {
      return 'draining';
    }

    // Check for OOM condition
    if (this.isOOM(worker, config)) {
      return 'dead';
    }

    // Check for stuck condition
    if (this.isStuck(worker, config)) {
      return 'stuck';
    }

    // Check if busy
    if (worker.currentRequest) {
      return 'busy';
    }

    return 'idle';
  }

  /**
   * Determines if a worker is stuck (unresponsive).
   * A worker is considered stuck if:
   * - It has a current request
   * - Its last heartbeat is older than the stuck threshold
   */
  isStuck(worker: WorkerInfo, config: ConcurrencyConfig): boolean {
    if (!worker.currentRequest) {
      return false;
    }

    const now = Date.now();
    const lastHeartbeat = worker.lastHeartbeat.getTime();
    const stuckDuration = now - lastHeartbeat;

    return stuckDuration > config.stuckThresholdMs;
  }

  /**
   * Determines if a worker has exceeded its memory limit (OOM).
   */
  isOOM(worker: WorkerInfo, config: ConcurrencyConfig): boolean {
    return worker.memoryUsageMb > config.memoryLimitMb;
  }

  /**
   * Determines if a worker should be recycled based on request count.
   */
  shouldRecycle(worker: WorkerInfo, config: ConcurrencyConfig): boolean {
    return worker.requestCount >= config.maxRequestsPerWorker;
  }

  /**
   * Calculates the time since the worker's last heartbeat.
   * @returns Duration in milliseconds.
   */
  timeSinceHeartbeat(worker: WorkerInfo): number {
    const now = Date.now();
    return now - worker.lastHeartbeat.getTime();
  }
}
