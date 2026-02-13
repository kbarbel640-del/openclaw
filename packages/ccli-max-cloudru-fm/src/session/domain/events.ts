/**
 * Domain events for the session bounded context.
 *
 * Events represent state changes and significant occurrences in the domain.
 */

import type { SessionIdString } from '../../core/types/session-id.js';
import type { TenantIdString } from '../../core/types/tenant-id.js';
import type { AccessTier } from '../../core/types/access-tier.js';

/**
 * Event emitted when a new session is created.
 */
export interface SessionCreated {
  readonly type: 'SessionCreated';
  readonly sessionId: SessionIdString;
  readonly tenantId: TenantIdString;
  readonly timestamp: Date;
}

/**
 * Event emitted when a session transitions to active state.
 */
export interface SessionActivated {
  readonly type: 'SessionActivated';
  readonly sessionId: SessionIdString;
  readonly timestamp: Date;
}

/**
 * Event emitted when a session expires.
 */
export interface SessionExpired {
  readonly type: 'SessionExpired';
  readonly sessionId: SessionIdString;
  readonly timestamp: Date;
}

/**
 * Event emitted when a session is suspended.
 */
export interface SessionSuspended {
  readonly type: 'SessionSuspended';
  readonly sessionId: SessionIdString;
  readonly reason: string;
  readonly timestamp: Date;
}

/**
 * Event emitted when a new tenant is created.
 */
export interface TenantCreated {
  readonly type: 'TenantCreated';
  readonly tenantId: TenantIdString;
  readonly tier: AccessTier;
  readonly timestamp: Date;
}

/**
 * Event emitted when a tenant's access tier changes.
 */
export interface TenantTierChanged {
  readonly type: 'TenantTierChanged';
  readonly tenantId: TenantIdString;
  readonly oldTier: AccessTier;
  readonly newTier: AccessTier;
  readonly timestamp: Date;
}

/**
 * Event emitted when a workspace is provisioned for a tenant.
 */
export interface WorkspaceProvisioned {
  readonly type: 'WorkspaceProvisioned';
  readonly tenantId: TenantIdString;
  readonly workspacePath: string;
  readonly timestamp: Date;
}

/**
 * Event emitted when a workspace is cleaned up.
 */
export interface WorkspaceCleaned {
  readonly type: 'WorkspaceCleaned';
  readonly tenantId: TenantIdString;
  readonly workspacePath: string;
  readonly timestamp: Date;
}

/**
 * Event emitted when a tool access policy is applied to a session.
 */
export interface ToolPolicyApplied {
  readonly type: 'ToolPolicyApplied';
  readonly sessionId: SessionIdString;
  readonly tier: AccessTier;
  readonly timestamp: Date;
}

/**
 * Union of all session domain events.
 */
export type SessionDomainEvent =
  | SessionCreated
  | SessionActivated
  | SessionExpired
  | SessionSuspended
  | TenantCreated
  | TenantTierChanged
  | WorkspaceProvisioned
  | WorkspaceCleaned
  | ToolPolicyApplied;
