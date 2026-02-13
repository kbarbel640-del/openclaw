/**
 * Error types for the concurrency bounded context.
 * All errors extend ConcurrencyError from the shared kernel.
 */

import { ConcurrencyError } from '../../core/types/errors.js';

/**
 * Thrown when the request queue reaches maximum capacity.
 * Indicates system overload and backpressure should be applied.
 */
export class QueueFullError extends ConcurrencyError {
  readonly code = 'CONCURRENCY_ERROR' as const;
  readonly recoverable = true;

  toUserMessage(): string {
    return 'System is at capacity. Please try again in a moment.';
  }
}

/**
 * Thrown when a worker fails to complete a request within the timeout period.
 */
export class WorkerTimeoutError extends ConcurrencyError {
  readonly code = 'CONCURRENCY_ERROR' as const;
  readonly recoverable = true;

  toUserMessage(): string {
    return 'Request took too long to process. Please try again.';
  }
}

/**
 * Thrown when a worker exceeds its memory limit.
 */
export class WorkerOOMError extends ConcurrencyError {
  readonly code = 'CONCURRENCY_ERROR' as const;
  readonly recoverable = true;

  toUserMessage(): string {
    return 'Request consumed too many resources. Please simplify and retry.';
  }
}

/**
 * Thrown when backpressure is active and new requests must be rejected.
 */
export class BackpressureError extends ConcurrencyError {
  readonly code = 'CONCURRENCY_ERROR' as const;
  readonly recoverable = true;

  toUserMessage(): string {
    return 'System is experiencing high load. Please wait and try again.';
  }
}
