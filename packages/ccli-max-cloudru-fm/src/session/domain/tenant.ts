/**
 * UserTenant aggregate root.
 *
 * Represents a tenant in the multi-tenant system, uniquely identified across platforms.
 * Each tenant has an associated access tier, workspace, and activity tracking.
 */

import type { TenantIdString } from '../../core/types/tenant-id.js';
import type { AccessTier } from '../../core/types/access-tier.js';
import type { MessengerPlatform } from '../../core/types/messenger-platform.js';

/**
 * UserTenant aggregate root.
 *
 * Invariants:
 * - tenantId must be unique across the system
 * - workspacePath must be a valid, isolated directory
 * - createdAt must be before or equal to lastActiveAt
 * - suspended tenants cannot perform actions
 */
export interface UserTenant {
  /** Unique identifier for this tenant across all platforms */
  readonly tenantId: TenantIdString;
  /** Platform this tenant is associated with */
  readonly platform: MessengerPlatform;
  /** Access tier determining permissions and limits */
  readonly tier: AccessTier;
  /** When this tenant was first created */
  readonly createdAt: Date;
  /** Last time this tenant was active */
  readonly lastActiveAt: Date;
  /** Whether this tenant is currently suspended */
  readonly suspended: boolean;
  /** Isolated workspace path for this tenant */
  readonly workspacePath: string;
}

/**
 * Parameters for creating a new UserTenant.
 */
export interface CreateUserTenantParams {
  /** Unique tenant identifier */
  tenantId: TenantIdString;
  /** Platform the tenant is using */
  platform: MessengerPlatform;
  /** Access tier (defaults to 'free') */
  tier?: AccessTier;
  /** Workspace path (defaults to derived path) */
  workspacePath?: string;
}

/**
 * Creates a new UserTenant aggregate.
 *
 * @param params - Tenant creation parameters
 * @returns A new UserTenant with default values for optional fields
 *
 * @example
 * const tenant = createUserTenant({
 *   tenantId: createTenantId({ platform: 'telegram', userId: '123', chatId: '456' }),
 *   platform: 'telegram'
 * });
 */
export function createUserTenant(params: CreateUserTenantParams): UserTenant {
  const now = new Date();
  const workspacePath = params.workspacePath ?? `/workspaces/${params.tenantId}`;

  return {
    tenantId: params.tenantId,
    platform: params.platform,
    tier: params.tier ?? 'free',
    createdAt: now,
    lastActiveAt: now,
    suspended: false,
    workspacePath,
  };
}

/**
 * Updates a tenant's last active timestamp.
 *
 * @param tenant - The tenant to update
 * @returns A new tenant instance with updated lastActiveAt
 */
export function touchTenant(tenant: UserTenant): UserTenant {
  return {
    ...tenant,
    lastActiveAt: new Date(),
  };
}

/**
 * Updates a tenant's access tier.
 *
 * @param tenant - The tenant to update
 * @param newTier - The new access tier
 * @returns A new tenant instance with updated tier
 */
export function changeTenantTier(tenant: UserTenant, newTier: AccessTier): UserTenant {
  return {
    ...tenant,
    tier: newTier,
  };
}

/**
 * Suspends a tenant, preventing all actions.
 *
 * @param tenant - The tenant to suspend
 * @returns A new tenant instance marked as suspended
 */
export function suspendTenant(tenant: UserTenant): UserTenant {
  return {
    ...tenant,
    suspended: true,
  };
}

/**
 * Reinstates a suspended tenant.
 *
 * @param tenant - The tenant to reinstate
 * @returns A new tenant instance no longer suspended
 */
export function reinstateTenant(tenant: UserTenant): UserTenant {
  return {
    ...tenant,
    suspended: false,
  };
}
