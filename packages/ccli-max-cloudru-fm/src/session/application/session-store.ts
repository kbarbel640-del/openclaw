/**
 * ISessionStore interface.
 *
 * Repository interface for session persistence.
 */

import type { SessionIdString } from '../../core/types/session-id.js';
import type { TenantIdString } from '../../core/types/tenant-id.js';
import type { TenantSession } from '../domain/tenant-session.js';
import type { Result } from '../../core/types/result.js';
import type { OpenClawError } from '../../core/types/errors.js';
import type { SessionNotFound } from '../domain/errors.js';

/**
 * Repository for managing TenantSession persistence.
 */
export interface ISessionStore {
  /**
   * Retrieves a session by ID.
   */
  get(sessionId: SessionIdString): Promise<Result<TenantSession, SessionNotFound>>;

  /**
   * Saves or updates a session.
   */
  save(session: TenantSession): Promise<Result<void, OpenClawError>>;

  /**
   * Deletes a session.
   */
  delete(sessionId: SessionIdString): Promise<Result<void, OpenClawError>>;

  /**
   * Finds all sessions for a tenant.
   */
  findByTenant(tenantId: TenantIdString): Promise<TenantSession[]>;

  /**
   * Finds all expired sessions.
   */
  findExpired(asOf: Date): Promise<TenantSession[]>;
}
