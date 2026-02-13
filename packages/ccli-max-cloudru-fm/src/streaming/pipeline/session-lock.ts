/**
 * Session lock manager for ensuring only one active stream per session.
 * Prevents concurrent streaming responses from interfering with each other.
 */

/**
 * Manages per-session locks to prevent concurrent streams.
 */
export class SessionLock {
  private readonly locks = new Map<string, boolean>();

  /**
   * Attempt to acquire a lock for a session.
   * @param sessionId - The session to lock
   * @returns true if lock acquired, false if session already locked
   */
  acquire(sessionId: string): boolean {
    if (this.locks.get(sessionId)) {
      return false;
    }
    this.locks.set(sessionId, true);
    return true;
  }

  /**
   * Release a lock for a session.
   * @param sessionId - The session to unlock
   */
  release(sessionId: string): void {
    this.locks.delete(sessionId);
  }

  /**
   * Check if a session is currently locked.
   * @param sessionId - The session to check
   * @returns true if locked, false otherwise
   */
  isLocked(sessionId: string): boolean {
    return this.locks.get(sessionId) === true;
  }

  /**
   * Get count of currently locked sessions.
   */
  getLockedCount(): number {
    return this.locks.size;
  }
}
