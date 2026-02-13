/**
 * ITenantStore interface.
 *
 * Repository interface for tenant persistence.
 */

import type { TenantIdString } from '../../core/types/tenant-id.js';
import type { MessengerPlatform } from '../../core/types/messenger-platform.js';
import type { UserTenant } from '../domain/tenant.js';
import type { Result } from '../../core/types/result.js';
import type { OpenClawError } from '../../core/types/errors.js';
import type { TenantNotFound } from '../domain/errors.js';

/**
 * Repository for managing UserTenant persistence.
 */
export interface ITenantStore {
  /**
   * Retrieves a tenant by ID.
   */
  get(tenantId: TenantIdString): Promise<Result<UserTenant, TenantNotFound>>;

  /**
   * Saves or updates a tenant.
   */
  save(tenant: UserTenant): Promise<Result<void, OpenClawError>>;

  /**
   * Deletes a tenant.
   */
  delete(tenantId: TenantIdString): Promise<Result<void, OpenClawError>>;

  /**
   * Finds a tenant by platform and user identifier.
   */
  findByPlatformUser(platform: MessengerPlatform, userId: string): Promise<Result<UserTenant, TenantNotFound>>;
}
