/**
 * Per-session execution lock to prevent concurrent requests
 * from the same session. Ensures sequential processing.
 */

import type { Result } from '../../core/types/result.js';
import { ok, err } from '../../core/types/result.js';
import type { MutexHandle } from '../domain/types.js';
import { ConcurrencyError } from '../../core/types/errors.js';

/**
 * Error thrown when a session lock cannot be acquired.
 */
export class LockAcquisitionError extends ConcurrencyError {
  readonly code = 'CONCURRENCY_ERROR' as const;

  toUserMessage(): string {
    return 'Another request is already processing for this session.';
  }
}

/**
 * Manages per-session mutual exclusion locks.
 * Prevents race conditions within a single session.
 */
export class SessionMutex {
  private locks: Map<string, MutexHandle>;

  constructor() {
    this.locks = new Map();
  }

  /**
   * Attempts to acquire a lock for the given session.
   * @returns Handle if successful, error if session is already locked.
   */
  async acquire(
    sessionId: string,
    timeoutMs: number
  ): Promise<Result<MutexHandle, LockAcquisitionError>> {
    const existing = this.locks.get(sessionId);

    // Check if existing lock is still valid
    if (existing) {
      const now = new Date();
      if (now < existing.expiresAt) {
        return err(
          new LockAcquisitionError(
            `Session ${sessionId} is already locked until ${existing.expiresAt.toISOString()}`
          )
        );
      }
      // Lock expired, can be reacquired
      this.locks.delete(sessionId);
    }

    // Create new lock
    const now = new Date();
    const handle: MutexHandle = {
      sessionId,
      acquiredAt: now,
      expiresAt: new Date(now.getTime() + timeoutMs),
    };

    this.locks.set(sessionId, handle);
    return ok(handle);
  }

  /**
   * Releases a previously acquired lock.
   * Should always be called after the protected operation completes.
   */
  release(handle: MutexHandle): void {
    const existing = this.locks.get(handle.sessionId);

    // Only release if the handle matches (prevent accidental release)
    if (existing && existing.acquiredAt.getTime() === handle.acquiredAt.getTime()) {
      this.locks.delete(handle.sessionId);
    }
  }

  /**
   * Checks if a session is currently locked.
   */
  isLocked(sessionId: string): boolean {
    const lock = this.locks.get(sessionId);
    if (!lock) return false;

    const now = new Date();
    if (now >= lock.expiresAt) {
      this.locks.delete(sessionId);
      return false;
    }

    return true;
  }
}
