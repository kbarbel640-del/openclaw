/**
 * OpenClaw Concurrency Bounded Context
 *
 * Provides concurrent request processing with worker pool management,
 * priority scheduling, session locking, and backpressure control.
 *
 * @module concurrency
 */

// Domain types
export type { WorkerState, Priority, QueueEntry, WorkerInfo, MutexHandle, WorkerRequest, WorkerResponse } from './domain/types.js';
export type { ConcurrencyConfig } from './domain/config.js';
export { DEFAULT_CONCURRENCY_CONFIG } from './domain/config.js';
export type { ConcurrencyMetrics } from './domain/metrics.js';

// Domain errors
export { QueueFullError, WorkerTimeoutError, WorkerOOMError, BackpressureError } from './domain/errors.js';

// Domain events
export type {
  WorkerSpawnedPayload,
  WorkerRecycledPayload,
  WorkerStuckPayload,
  RequestQueuedPayload,
  RequestStartedPayload,
  RequestCompletedPayload,
  RequestTimedOutPayload,
  BackpressureActivatedPayload,
  ConcurrencyEvent,
} from './domain/events.js';

// Application services
export { PriorityScheduler } from './application/scheduler.js';
export { SessionMutex, LockAcquisitionError } from './application/session-mutex.js';
export { WorkerLifecycle } from './application/worker-lifecycle.js';
export { WorkerHealth } from './application/worker-health.js';
export { WorkerPool } from './application/worker-pool.js';
export { Backpressure } from './application/backpressure.js';

// Infrastructure interfaces
export type { ISubprocessFactory, SubprocessConfig, SubprocessInfo } from './application/subprocess-factory.js';
