/**
 * TenantSession entity with state machine.
 *
 * Manages session lifecycle through well-defined state transitions.
 */

import type { SessionIdString } from '../../core/types/session-id.js';
import type { TenantIdString } from '../../core/types/tenant-id.js';
import type { Result } from '../../core/types/result.js';
import { ok, err } from '../../core/types/result.js';
import { InvalidStateTransition } from './errors.js';

/**
 * Session states in the lifecycle.
 *
 * - idle: Session created but not yet active
 * - active: Session is actively handling requests
 * - processing: Session is currently processing a request
 * - expired: Session has exceeded its TTL
 * - suspended: Session suspended due to tenant suspension or policy
 */
export type SessionState = 'idle' | 'active' | 'processing' | 'expired' | 'suspended';

/**
 * TenantSession entity.
 *
 * Invariants:
 * - expiresAt must be after createdAt
 * - lastRequestAt must be between createdAt and expiresAt (when set)
 * - State transitions must follow the state machine rules
 */
export interface TenantSession {
  /** Unique session identifier */
  readonly sessionId: SessionIdString;
  /** Tenant this session belongs to */
  readonly tenantId: TenantIdString;
  /** Current session state */
  readonly state: SessionState;
  /** When this session was created */
  readonly createdAt: Date;
  /** When this session will expire */
  readonly expiresAt: Date;
  /** Last time a request was made in this session */
  readonly lastRequestAt: Date | null;
}

/**
 * Valid state transitions in the session state machine.
 *
 * - idle -> active: Session becomes active
 * - active -> processing: Request begins processing
 * - processing -> active: Request completes
 * - active -> expired: Session TTL expires
 * - any -> suspended: Tenant or policy suspension
 */
const VALID_TRANSITIONS: Record<SessionState, SessionState[]> = {
  idle: ['active', 'suspended'],
  active: ['processing', 'expired', 'suspended'],
  processing: ['active', 'expired', 'suspended'],
  expired: ['suspended'],
  suspended: [],
};

/**
 * Checks if a state transition is valid.
 *
 * @param from - Current state
 * @param to - Target state
 * @returns True if transition is allowed
 */
export function isValidTransition(from: SessionState, to: SessionState): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

/**
 * Transitions a session to a new state.
 *
 * @param session - The session to transition
 * @param newState - The target state
 * @returns Result with updated session or InvalidStateTransition error
 *
 * @example
 * const result = transitionSession(session, 'active');
 * if (result.ok) {
 *   const activeSession = result.value;
 * }
 */
export function transitionSession(
  session: TenantSession,
  newState: SessionState
): Result<TenantSession, InvalidStateTransition> {
  if (!isValidTransition(session.state, newState)) {
    return err(
      new InvalidStateTransition(
        `Cannot transition from ${session.state} to ${newState}`
      )
    );
  }

  const now = new Date();

  return ok({
    ...session,
    state: newState,
    lastRequestAt: now,
  });
}

/**
 * Creates a new TenantSession in idle state.
 *
 * @param sessionId - Unique session identifier
 * @param tenantId - Associated tenant identifier
 * @param ttlMs - Time-to-live in milliseconds (default 1 hour)
 * @returns A new idle session
 */
export function createTenantSession(
  sessionId: SessionIdString,
  tenantId: TenantIdString,
  ttlMs: number = 60 * 60 * 1000
): TenantSession {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMs);

  return {
    sessionId,
    tenantId,
    state: 'idle',
    createdAt: now,
    expiresAt,
    lastRequestAt: null,
  };
}

/**
 * Checks if a session has expired based on current time.
 *
 * @param session - The session to check
 * @param now - Current time (defaults to Date.now())
 * @returns True if session has expired
 */
export function isSessionExpired(session: TenantSession, now: Date = new Date()): boolean {
  return now >= session.expiresAt;
}

/**
 * Extends a session's expiration time.
 *
 * @param session - The session to extend
 * @param extensionMs - Additional time in milliseconds
 * @returns Updated session with new expiration
 */
export function extendSession(session: TenantSession, extensionMs: number): TenantSession {
  return {
    ...session,
    expiresAt: new Date(session.expiresAt.getTime() + extensionMs),
  };
}
