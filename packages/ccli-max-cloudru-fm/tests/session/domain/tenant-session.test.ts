/**
 * Tests for TenantSession entity and state machine.
 */

import { describe, it, expect } from 'vitest';
import {
  transitionSession,
  isValidTransition,
  createTenantSession,
  isSessionExpired,
  extendSession,
} from '../../../src/session/domain/tenant-session.js';
import type { SessionIdString } from '../../../src/core/types/session-id.js';
import type { TenantIdString } from '../../../src/core/types/tenant-id.js';

describe('transitionSession', () => {
  const sessionId: SessionIdString = 'session-123' as SessionIdString;
  const tenantId: TenantIdString = 'telegram:123:456' as TenantIdString;

  it('should transition idle -> active successfully', () => {
    const session = createTenantSession(sessionId, tenantId);
    const result = transitionSession(session, 'active');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.state).toBe('active');
      expect(result.value.lastRequestAt).not.toBeNull();
    }
  });

  it('should transition active -> processing successfully', () => {
    const session = createTenantSession(sessionId, tenantId);
    const activeResult = transitionSession(session, 'active');

    expect(activeResult.ok).toBe(true);
    if (activeResult.ok) {
      const processingResult = transitionSession(activeResult.value, 'processing');

      expect(processingResult.ok).toBe(true);
      if (processingResult.ok) {
        expect(processingResult.value.state).toBe('processing');
      }
    }
  });

  it('should transition processing -> active successfully', () => {
    const session = createTenantSession(sessionId, tenantId);
    const activeResult = transitionSession(session, 'active');

    expect(activeResult.ok).toBe(true);
    if (activeResult.ok) {
      const processingResult = transitionSession(activeResult.value, 'processing');

      expect(processingResult.ok).toBe(true);
      if (processingResult.ok) {
        const backToActiveResult = transitionSession(processingResult.value, 'active');

        expect(backToActiveResult.ok).toBe(true);
        if (backToActiveResult.ok) {
          expect(backToActiveResult.value.state).toBe('active');
        }
      }
    }
  });

  it('should transition active -> expired successfully', () => {
    const session = createTenantSession(sessionId, tenantId);
    const activeResult = transitionSession(session, 'active');

    expect(activeResult.ok).toBe(true);
    if (activeResult.ok) {
      const expiredResult = transitionSession(activeResult.value, 'expired');

      expect(expiredResult.ok).toBe(true);
      if (expiredResult.ok) {
        expect(expiredResult.value.state).toBe('expired');
      }
    }
  });

  it('should fail to transition idle -> processing (invalid transition)', () => {
    const session = createTenantSession(sessionId, tenantId);
    const result = transitionSession(session, 'processing');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Cannot transition from idle to processing');
    }
  });

  it('should fail to transition expired -> active (invalid transition)', () => {
    const session = createTenantSession(sessionId, tenantId);
    const activeResult = transitionSession(session, 'active');

    expect(activeResult.ok).toBe(true);
    if (activeResult.ok) {
      const expiredResult = transitionSession(activeResult.value, 'expired');

      expect(expiredResult.ok).toBe(true);
      if (expiredResult.ok) {
        const backToActiveResult = transitionSession(expiredResult.value, 'active');

        expect(backToActiveResult.ok).toBe(false);
        if (!backToActiveResult.ok) {
          expect(backToActiveResult.error.message).toContain('Cannot transition from expired to active');
        }
      }
    }
  });

  it('should transition any state -> suspended successfully', () => {
    const session = createTenantSession(sessionId, tenantId);
    const result = transitionSession(session, 'suspended');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.state).toBe('suspended');
    }
  });
});

describe('isValidTransition', () => {
  it('should return true for valid transitions', () => {
    expect(isValidTransition('idle', 'active')).toBe(true);
    expect(isValidTransition('active', 'processing')).toBe(true);
    expect(isValidTransition('processing', 'active')).toBe(true);
    expect(isValidTransition('active', 'expired')).toBe(true);
  });

  it('should return false for invalid transitions', () => {
    expect(isValidTransition('idle', 'processing')).toBe(false);
    expect(isValidTransition('expired', 'active')).toBe(false);
    expect(isValidTransition('suspended', 'active')).toBe(false);
  });
});

describe('isSessionExpired', () => {
  it('should return false for non-expired session', () => {
    const session = createTenantSession(
      'session-123' as SessionIdString,
      'telegram:123:456' as TenantIdString,
      60 * 60 * 1000 // 1 hour
    );

    expect(isSessionExpired(session)).toBe(false);
  });

  it('should return true for expired session', () => {
    const session = createTenantSession(
      'session-123' as SessionIdString,
      'telegram:123:456' as TenantIdString,
      100 // 100ms
    );

    // Wait for expiration
    const futureTime = new Date(session.expiresAt.getTime() + 1000);
    expect(isSessionExpired(session, futureTime)).toBe(true);
  });
});

describe('extendSession', () => {
  it('should extend session expiration time', () => {
    const session = createTenantSession(
      'session-123' as SessionIdString,
      'telegram:123:456' as TenantIdString,
      60 * 60 * 1000 // 1 hour
    );

    const originalExpires = session.expiresAt.getTime();
    const extended = extendSession(session, 30 * 60 * 1000); // Add 30 minutes

    expect(extended.expiresAt.getTime()).toBe(originalExpires + 30 * 60 * 1000);
  });
});
