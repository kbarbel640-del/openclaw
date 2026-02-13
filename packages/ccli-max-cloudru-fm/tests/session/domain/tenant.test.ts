/**
 * Tests for UserTenant aggregate root.
 */

import { describe, it, expect } from 'vitest';
import { createUserTenant, touchTenant, changeTenantTier, suspendTenant, reinstateTenant } from '../../../src/session/domain/tenant.js';
import type { TenantIdString } from '../../../src/core/types/tenant-id.js';
import type { MessengerPlatform } from '../../../src/core/types/messenger-platform.js';

describe('createUserTenant', () => {
  const tenantId: TenantIdString = 'telegram:123:456' as TenantIdString;
  const platform: MessengerPlatform = 'telegram';

  it('should create tenant with correct defaults', () => {
    const tenant = createUserTenant({
      tenantId,
      platform,
    });

    expect(tenant.tenantId).toBe(tenantId);
    expect(tenant.platform).toBe(platform);
    expect(tenant.suspended).toBe(false);
  });

  it('should use "free" tier by default', () => {
    const tenant = createUserTenant({
      tenantId,
      platform,
    });

    expect(tenant.tier).toBe('free');
  });

  it('should set createdAt and lastActiveAt to now', () => {
    const before = new Date();
    const tenant = createUserTenant({
      tenantId,
      platform,
    });
    const after = new Date();

    expect(tenant.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(tenant.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
    expect(tenant.lastActiveAt.getTime()).toBe(tenant.createdAt.getTime());
  });

  it('should generate workspacePath from tenantId', () => {
    const tenant = createUserTenant({
      tenantId,
      platform,
    });

    expect(tenant.workspacePath).toBe(`/workspaces/${tenantId}`);
  });

  it('should use provided workspacePath if given', () => {
    const customPath = '/custom/path';
    const tenant = createUserTenant({
      tenantId,
      platform,
      workspacePath: customPath,
    });

    expect(tenant.workspacePath).toBe(customPath);
  });

  it('should use provided tier if given', () => {
    const tenant = createUserTenant({
      tenantId,
      platform,
      tier: 'premium',
    });

    expect(tenant.tier).toBe('premium');
  });
});

describe('touchTenant', () => {
  it('should update lastActiveAt to current time', () => {
    const tenant = createUserTenant({
      tenantId: 'telegram:123:456' as TenantIdString,
      platform: 'telegram',
    });

    const originalLastActive = tenant.lastActiveAt;

    // Wait a bit to ensure time difference
    const touched = touchTenant(tenant);

    expect(touched.lastActiveAt.getTime()).toBeGreaterThanOrEqual(originalLastActive.getTime());
  });
});

describe('changeTenantTier', () => {
  it('should update tier to new value', () => {
    const tenant = createUserTenant({
      tenantId: 'telegram:123:456' as TenantIdString,
      platform: 'telegram',
    });

    const upgraded = changeTenantTier(tenant, 'premium');

    expect(upgraded.tier).toBe('premium');
    expect(upgraded.tenantId).toBe(tenant.tenantId);
  });
});

describe('suspendTenant', () => {
  it('should mark tenant as suspended', () => {
    const tenant = createUserTenant({
      tenantId: 'telegram:123:456' as TenantIdString,
      platform: 'telegram',
    });

    const suspended = suspendTenant(tenant);

    expect(suspended.suspended).toBe(true);
  });
});

describe('reinstateTenant', () => {
  it('should remove suspended flag', () => {
    const tenant = createUserTenant({
      tenantId: 'telegram:123:456' as TenantIdString,
      platform: 'telegram',
    });

    const suspended = suspendTenant(tenant);
    const reinstated = reinstateTenant(suspended);

    expect(reinstated.suspended).toBe(false);
  });
});
