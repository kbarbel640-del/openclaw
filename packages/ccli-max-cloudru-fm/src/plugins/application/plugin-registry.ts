import type { Result } from '../../core/types/result.js';
import { ok, err } from '../../core/types/result.js';
import type { AccessTier } from '../../core/types/access-tier.js';
import type { PluginManifest, PluginInstance, PluginState } from '../domain/types.js';
import { PluginSystemError, PluginNotFoundError } from '../domain/errors.js';

export interface PluginListFilter {
  readonly state?: PluginState;
  readonly tier?: AccessTier;
}

export class PluginRegistry {
  private readonly plugins = new Map<string, PluginInstance>();

  register(manifest: PluginManifest): Result<void, PluginSystemError> {
    if (this.plugins.has(manifest.id)) {
      return err(
        new PluginSystemError(`Plugin already registered: ${manifest.id}`)
      );
    }

    const instance: PluginInstance = {
      manifest,
      state: 'registered',
      config: {},
      installedAt: new Date(),
    };

    this.plugins.set(manifest.id, instance);
    return ok(undefined);
  }

  unregister(pluginId: string): Result<void, PluginNotFoundError> {
    if (!this.plugins.has(pluginId)) {
      return err(new PluginNotFoundError(pluginId));
    }

    this.plugins.delete(pluginId);
    return ok(undefined);
  }

  get(pluginId: string): PluginInstance | undefined {
    return this.plugins.get(pluginId);
  }

  list(filter?: PluginListFilter): PluginInstance[] {
    let instances = Array.from(this.plugins.values());

    if (filter?.state) {
      instances = instances.filter(p => p.state === filter.state);
    }

    if (filter?.tier) {
      instances = instances.filter(p => p.manifest.requiredTier === filter.tier);
    }

    return instances;
  }

  update(pluginId: string, updates: Partial<PluginInstance>): Result<void, PluginNotFoundError> {
    const existing = this.plugins.get(pluginId);
    if (!existing) {
      return err(new PluginNotFoundError(pluginId));
    }

    this.plugins.set(pluginId, { ...existing, ...updates });
    return ok(undefined);
  }
}
