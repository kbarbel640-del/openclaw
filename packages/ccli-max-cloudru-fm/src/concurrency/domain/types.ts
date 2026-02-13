/**
 * Core domain types for the concurrency bounded context.
 * Defines worker states, priorities, queue entries, and worker information.
 */

import type { TenantIdString } from '../../core/types/tenant-id.js';

/**
 * Represents the current state of a worker in the pool.
 */
export type WorkerState = 'idle' | 'busy' | 'draining' | 'stuck' | 'dead';

/**
 * Priority levels for request queue processing.
 * Higher priority requests are processed first.
 */
export type Priority = 'low' | 'normal' | 'high' | 'critical';

/**
 * Entry in the request queue awaiting processing.
 * Immutable to ensure queue integrity.
 */
export interface QueueEntry {
  readonly id: string;
  readonly tenantId: TenantIdString;
  readonly priority: Priority;
  readonly enqueuedAt: Date;
  readonly timeoutMs: number;
  readonly payload: unknown;
}

/**
 * Runtime information about a worker process.
 * Used for health monitoring and lifecycle management.
 */
export interface WorkerInfo {
  readonly id: string;
  readonly state: WorkerState;
  readonly currentRequest?: string;
  readonly requestCount: number;
  readonly startedAt: Date;
  readonly lastHeartbeat: Date;
  readonly memoryUsageMb: number;
  readonly pid?: number;
}

/**
 * Handle returned when acquiring a mutex lock.
 * Must be released after the protected operation completes.
 */
export interface MutexHandle {
  readonly sessionId: string;
  readonly acquiredAt: Date;
  readonly expiresAt: Date;
}

/**
 * Request submitted to the worker pool for processing.
 */
export interface WorkerRequest {
  readonly id: string;
  readonly tenantId: TenantIdString;
  readonly sessionId: string;
  readonly priority: Priority;
  readonly timeoutMs: number;
  readonly payload: unknown;
}

/**
 * Response returned after processing a request.
 */
export interface WorkerResponse {
  readonly requestId: string;
  readonly result: unknown;
  readonly processingTimeMs: number;
  readonly workerId: string;
}
