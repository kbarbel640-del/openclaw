import type { Result } from '../../core/types/result.js';
import { ok, err } from '../../core/types/result.js';
import type { DomainEventBus } from '../../core/types/domain-events.js';
import { createEvent } from '../../core/types/domain-events.js';
import type { PluginInstance } from '../domain/types.js';
import { PluginSystemError, PluginNotFoundError } from '../domain/errors.js';
import { transitionPlugin } from '../domain/state-machine.js';
import type { PluginRegistry } from './plugin-registry.js';

export class PluginLifecycle {
  constructor(
    private readonly registry: PluginRegistry,
    private readonly eventBus: DomainEventBus
  ) {}

  install(
    pluginId: string,
    config: Record<string, unknown>
  ): Result<PluginInstance, PluginSystemError> {
    const plugin = this.registry.get(pluginId);
    if (!plugin) {
      return err(new PluginNotFoundError(pluginId));
    }

    const transitionResult = transitionPlugin(plugin.state, 'installed');
    if (!transitionResult.ok) {
      const error = transitionResult.error;
      return err(error);
    }

    const updated: PluginInstance = {
      ...plugin,
      state: 'installed',
      config,
      installedAt: new Date(),
    };

    this.registry.update(pluginId, updated);

    this.eventBus.publish(
      createEvent('plugin.installed', { pluginId, config }, 'plugins')
    );

    return ok(updated);
  }

  activate(pluginId: string): Result<PluginInstance, PluginSystemError> {
    const plugin = this.registry.get(pluginId);
    if (!plugin) {
      return err(new PluginNotFoundError(pluginId));
    }

    const transitionResult = transitionPlugin(plugin.state, 'active');
    if (!transitionResult.ok) {
      const error = transitionResult.error;
      return err(error);
    }

    const updated: PluginInstance = {
      ...plugin,
      state: 'active',
      lastActiveAt: new Date(),
    };

    this.registry.update(pluginId, updated);

    this.eventBus.publish(
      createEvent('plugin.activated', { pluginId }, 'plugins')
    );

    return ok(updated);
  }

  disable(pluginId: string): Result<PluginInstance, PluginSystemError> {
    const plugin = this.registry.get(pluginId);
    if (!plugin) {
      return err(new PluginNotFoundError(pluginId));
    }

    const transitionResult = transitionPlugin(plugin.state, 'disabled');
    if (!transitionResult.ok) {
      const error = transitionResult.error;
      return err(error);
    }

    const updated: PluginInstance = {
      ...plugin,
      state: 'disabled',
    };

    this.registry.update(pluginId, updated);

    this.eventBus.publish(
      createEvent('plugin.disabled', { pluginId }, 'plugins')
    );

    return ok(updated);
  }
}
