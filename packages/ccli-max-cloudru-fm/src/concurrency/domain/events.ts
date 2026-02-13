/**
 * Domain events for the concurrency bounded context.
 * Events follow the event sourcing pattern for state changes.
 */

import type { DomainEvent } from '../../core/types/domain-events.js';
import type { Priority } from './types.js';
import type { TenantIdString } from '../../core/types/tenant-id.js';

/** Emitted when a new worker is spawned */
export interface WorkerSpawnedPayload {
  readonly workerId: string;
  readonly pid: number;
  readonly timestamp: Date;
}

/** Emitted when a worker is recycled after reaching request limit */
export interface WorkerRecycledPayload {
  readonly workerId: string;
  readonly requestsProcessed: number;
  readonly reason: 'request_limit' | 'memory_limit' | 'manual';
}

/** Emitted when a worker is detected as stuck */
export interface WorkerStuckPayload {
  readonly workerId: string;
  readonly currentRequest: string;
  readonly stuckDurationMs: number;
  readonly lastHeartbeat: Date;
}

/** Emitted when a request is added to the queue */
export interface RequestQueuedPayload {
  readonly requestId: string;
  readonly tenantId: TenantIdString;
  readonly priority: Priority;
  readonly queueDepth: number;
}

/** Emitted when a worker starts processing a request */
export interface RequestStartedPayload {
  readonly requestId: string;
  readonly workerId: string;
  readonly startedAt: Date;
}

/** Emitted when a request completes successfully */
export interface RequestCompletedPayload {
  readonly requestId: string;
  readonly workerId: string;
  readonly processingTimeMs: number;
  readonly success: boolean;
}

/** Emitted when a request times out */
export interface RequestTimedOutPayload {
  readonly requestId: string;
  readonly workerId: string;
  readonly timeoutMs: number;
}

/** Emitted when backpressure is activated */
export interface BackpressureActivatedPayload {
  readonly queueDepth: number;
  readonly activeWorkers: number;
  readonly threshold: number;
  readonly level: number;
}

/** Union type for all concurrency events */
export type ConcurrencyEvent =
  | DomainEvent<WorkerSpawnedPayload>
  | DomainEvent<WorkerRecycledPayload>
  | DomainEvent<WorkerStuckPayload>
  | DomainEvent<RequestQueuedPayload>
  | DomainEvent<RequestStartedPayload>
  | DomainEvent<RequestCompletedPayload>
  | DomainEvent<RequestTimedOutPayload>
  | DomainEvent<BackpressureActivatedPayload>;
