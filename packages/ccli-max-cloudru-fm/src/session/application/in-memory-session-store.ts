/**
 * In-memory implementation of ISessionStore.
 *
 * For testing and development. Not suitable for production.
 */

import type { SessionIdString } from '../../core/types/session-id.js';
import type { TenantIdString } from '../../core/types/tenant-id.js';
import type { TenantSession } from '../domain/tenant-session.js';
import type { Result } from '../../core/types/result.js';
import type { OpenClawError } from '../../core/types/errors.js';
import { ok, err } from '../../core/types/result.js';
import type { ISessionStore } from './session-store.js';
import { SessionNotFound } from '../domain/errors.js';

/**
 * In-memory session store implementation.
 */
export class InMemorySessionStore implements ISessionStore {
  private readonly sessions = new Map<SessionIdString, TenantSession>();

  async get(sessionId: SessionIdString): Promise<Result<TenantSession, SessionNotFound>> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return err(new SessionNotFound(sessionId));
    }
    return ok(session);
  }

  async save(session: TenantSession): Promise<Result<void, OpenClawError>> {
    this.sessions.set(session.sessionId, session);
    return ok(undefined);
  }

  async delete(sessionId: SessionIdString): Promise<Result<void, OpenClawError>> {
    this.sessions.delete(sessionId);
    return ok(undefined);
  }

  async findByTenant(tenantId: TenantIdString): Promise<TenantSession[]> {
    const result: TenantSession[] = [];
    for (const session of this.sessions.values()) {
      if (session.tenantId === tenantId) {
        result.push(session);
      }
    }
    return result;
  }

  async findExpired(asOf: Date): Promise<TenantSession[]> {
    const result: TenantSession[] = [];
    for (const session of this.sessions.values()) {
      if (session.expiresAt <= asOf) {
        result.push(session);
      }
    }
    return result;
  }
}
