/**
 * Session-specific error types.
 *
 * All errors extend SessionError from the core error taxonomy.
 */

import { SessionError } from '../../core/types/errors.js';

/**
 * Error thrown when a session cannot be found.
 */
export class SessionNotFound extends SessionError {
  constructor(sessionId: string, cause?: Error) {
    super(`Session not found: ${sessionId}`, cause);
  }

  toUserMessage(): string {
    return 'Your session could not be found. Please start a new session.';
  }
}

/**
 * Error thrown when a tenant cannot be found.
 */
export class TenantNotFound extends SessionError {
  constructor(tenantId: string, cause?: Error) {
    super(`Tenant not found: ${tenantId}`, cause);
  }

  toUserMessage(): string {
    return 'Your account could not be found. Please verify your credentials.';
  }
}

/**
 * Error thrown when attempting to use a suspended tenant.
 */
export class TenantSuspended extends SessionError {
  constructor(tenantId: string, reason?: string, cause?: Error) {
    const message = reason
      ? `Tenant suspended: ${tenantId} (reason: ${reason})`
      : `Tenant suspended: ${tenantId}`;
    super(message, cause);
  }

  toUserMessage(): string {
    return 'Your account has been suspended. Please contact support for assistance.';
  }
}

/**
 * Error thrown when a session has expired.
 */
export class SessionExpired extends SessionError {
  constructor(sessionId: string, cause?: Error) {
    super(`Session expired: ${sessionId}`, cause);
  }

  toUserMessage(): string {
    return 'Your session has expired. Please start a new session.';
  }
}

/**
 * Error thrown when an invalid state transition is attempted.
 */
export class InvalidStateTransition extends SessionError {
  constructor(message: string, cause?: Error) {
    super(`Invalid state transition: ${message}`, cause);
  }

  toUserMessage(): string {
    return 'An internal state error occurred. Please try again or start a new session.';
  }
}
