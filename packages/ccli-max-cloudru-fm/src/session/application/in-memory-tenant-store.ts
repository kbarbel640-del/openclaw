/**
 * In-memory implementation of ITenantStore.
 *
 * For testing and development. Not suitable for production.
 */

import type { TenantIdString } from '../../core/types/tenant-id.js';
import type { MessengerPlatform } from '../../core/types/messenger-platform.js';
import type { UserTenant } from '../domain/tenant.js';
import type { Result } from '../../core/types/result.js';
import type { OpenClawError } from '../../core/types/errors.js';
import { ok, err } from '../../core/types/result.js';
import type { ITenantStore } from './tenant-store.js';
import { TenantNotFound } from '../domain/errors.js';

/**
 * In-memory tenant store implementation.
 */
export class InMemoryTenantStore implements ITenantStore {
  private readonly tenants = new Map<TenantIdString, UserTenant>();

  async get(tenantId: TenantIdString): Promise<Result<UserTenant, TenantNotFound>> {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) {
      return err(new TenantNotFound(tenantId));
    }
    return ok(tenant);
  }

  async save(tenant: UserTenant): Promise<Result<void, OpenClawError>> {
    this.tenants.set(tenant.tenantId, tenant);
    return ok(undefined);
  }

  async delete(tenantId: TenantIdString): Promise<Result<void, OpenClawError>> {
    this.tenants.delete(tenantId);
    return ok(undefined);
  }

  async findByPlatformUser(
    platform: MessengerPlatform,
    userId: string
  ): Promise<Result<UserTenant, TenantNotFound>> {
    for (const tenant of this.tenants.values()) {
      if (tenant.platform === platform && tenant.tenantId.includes(userId)) {
        return ok(tenant);
      }
    }
    return err(new TenantNotFound(`${platform}:${userId}`));
  }
}
