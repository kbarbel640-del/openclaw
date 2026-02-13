/**
 * Tests for SessionMutex.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SessionMutex } from '../../../src/concurrency/application/session-mutex.js';

describe('SessionMutex', () => {
  let mutex: SessionMutex;
  const sessionId = 'test-session-123';
  const timeout = 5000;

  beforeEach(() => {
    mutex = new SessionMutex();
  });

  it('should acquire lock on first call', async () => {
    const result = await mutex.acquire(sessionId, timeout);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.sessionId).toBe(sessionId);
      expect(result.value.acquiredAt).toBeInstanceOf(Date);
      expect(result.value.expiresAt).toBeInstanceOf(Date);
    }
  });

  it('should fail to acquire same session when already held', async () => {
    const firstResult = await mutex.acquire(sessionId, timeout);
    expect(firstResult.ok).toBe(true);

    const secondResult = await mutex.acquire(sessionId, timeout);
    expect(secondResult.ok).toBe(false);
    if (!secondResult.ok) {
      expect(secondResult.error.message).toContain('already locked');
    }
  });

  it('should allow re-acquire after release', async () => {
    const firstResult = await mutex.acquire(sessionId, timeout);
    expect(firstResult.ok).toBe(true);

    if (firstResult.ok) {
      mutex.release(firstResult.value);
    }

    const secondResult = await mutex.acquire(sessionId, timeout);
    expect(secondResult.ok).toBe(true);
  });

  it('should allow different sessions to acquire simultaneously', async () => {
    const session1 = 'session-1';
    const session2 = 'session-2';

    const result1 = await mutex.acquire(session1, timeout);
    const result2 = await mutex.acquire(session2, timeout);

    expect(result1.ok).toBe(true);
    expect(result2.ok).toBe(true);
  });

  it('should report locked status correctly', async () => {
    expect(mutex.isLocked(sessionId)).toBe(false);

    const result = await mutex.acquire(sessionId, timeout);
    expect(result.ok).toBe(true);

    expect(mutex.isLocked(sessionId)).toBe(true);

    if (result.ok) {
      mutex.release(result.value);
    }

    expect(mutex.isLocked(sessionId)).toBe(false);
  });

  it('should allow acquire after lock expires', async () => {
    const shortTimeout = 10; // 10ms
    const firstResult = await mutex.acquire(sessionId, shortTimeout);
    expect(firstResult.ok).toBe(true);

    // Wait for lock to expire
    await new Promise(resolve => setTimeout(resolve, 20));

    const secondResult = await mutex.acquire(sessionId, timeout);
    expect(secondResult.ok).toBe(true);
  });

  it('should not release lock with wrong handle', async () => {
    const result = await mutex.acquire(sessionId, timeout);
    expect(result.ok).toBe(true);

    // Try to release with a different handle
    const fakeHandle = {
      sessionId,
      acquiredAt: new Date(Date.now() - 1000),
      expiresAt: new Date(Date.now() + timeout),
    };

    mutex.release(fakeHandle);

    // Lock should still be held
    expect(mutex.isLocked(sessionId)).toBe(true);
  });
});
