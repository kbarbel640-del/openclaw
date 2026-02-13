import type { Result } from '../../core/types/result.js';
import { ok, err } from '../../core/types/result.js';
import type { AccessTier } from '../../core/types/access-tier.js';
import { isTierAtLeast } from '../../core/types/access-tier.js';
import type { PluginInstance, PluginPermission } from '../domain/types.js';
import { PluginPermissionError } from '../domain/errors.js';

export class PermissionGuard {
  checkPermission(
    plugin: PluginInstance,
    permission: PluginPermission
  ): Result<void, PluginPermissionError> {
    if (!plugin.manifest.permissions.includes(permission)) {
      return err(
        new PluginPermissionError(
          `Plugin ${plugin.manifest.id} does not have permission: ${permission}`
        )
      );
    }

    return ok(undefined);
  }

  checkTierAccess(
    plugin: PluginInstance,
    tenantTier: AccessTier
  ): Result<void, PluginPermissionError> {
    if (!isTierAtLeast(tenantTier, plugin.manifest.requiredTier)) {
      return err(
        new PluginPermissionError(
          `Plugin ${plugin.manifest.id} requires tier ${plugin.manifest.requiredTier}, tenant has ${tenantTier}`
        )
      );
    }

    return ok(undefined);
  }

  checkAll(
    plugin: PluginInstance,
    permissions: PluginPermission[],
    tenantTier: AccessTier
  ): Result<void, PluginPermissionError> {
    const tierCheck = this.checkTierAccess(plugin, tenantTier);
    if (!tierCheck.ok) {
      return tierCheck;
    }

    for (const permission of permissions) {
      const permCheck = this.checkPermission(plugin, permission);
      if (!permCheck.ok) {
        return permCheck;
      }
    }

    return ok(undefined);
  }
}
