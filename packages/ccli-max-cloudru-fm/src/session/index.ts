/**
 * Session bounded context public API.
 *
 * Re-exports all public domain entities, value objects, services, and interfaces.
 */

// Domain entities
export type { UserTenant, CreateUserTenantParams } from './domain/tenant.js';
export {
  createUserTenant,
  touchTenant,
  changeTenantTier,
  suspendTenant,
  reinstateTenant,
} from './domain/tenant.js';

export type { TenantSession, SessionState } from './domain/tenant-session.js';
export {
  createTenantSession,
  transitionSession,
  isValidTransition,
  isSessionExpired,
  extendSession,
} from './domain/tenant-session.js';

// Domain value objects
export type { ToolAccessPolicy } from './domain/tool-policy.js';
export { getDefaultPolicy, isToolAllowed } from './domain/tool-policy.js';

export type { WorkspacePath } from './domain/workspace-path.js';
export { validateWorkspacePath } from './domain/workspace-path.js';

// Domain events
export type {
  SessionCreated,
  SessionActivated,
  SessionSuspended,
  TenantCreated,
  TenantTierChanged,
  WorkspaceProvisioned,
  WorkspaceCleaned,
  ToolPolicyApplied,
  SessionDomainEvent,
} from './domain/events.js';

export type { SessionExpired as SessionExpiredEvent } from './domain/events.js';

// Domain errors
export {
  SessionNotFound,
  TenantNotFound,
  TenantSuspended,
  SessionExpired,
  InvalidStateTransition,
} from './domain/errors.js';

// Application services
export { WorkspaceManager } from './application/workspace-manager.js';
export type { IFileSystem } from './application/workspace-manager.js';

export { validateTenantPath } from './application/path-validator.js';

// Application repositories
export type { ITenantStore } from './application/tenant-store.js';
export type { ISessionStore } from './application/session-store.js';

export { InMemoryTenantStore } from './application/in-memory-tenant-store.js';
export { InMemorySessionStore } from './application/in-memory-session-store.js';
