/**
 * Tests for PluginLifecycle.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PluginLifecycle } from '../../src/plugins/application/plugin-lifecycle.js';
import { PluginRegistry } from '../../src/plugins/application/plugin-registry.js';
import type { PluginManifest } from '../../src/plugins/domain/types.js';
import type { DomainEventBus } from '../../src/core/types/domain-events.js';

describe('PluginLifecycle', () => {
  let registry: PluginRegistry;
  let eventBus: DomainEventBus;
  let lifecycle: PluginLifecycle;

  const createMockManifest = (id: string): PluginManifest => ({
    id,
    name: `Plugin ${id}`,
    version: '1.0.0',
    description: 'Test plugin',
    author: 'Test Author',
    requiredTier: 'free',
    permissions: ['read_messages'],
    entryPoint: './index.js',
  });

  beforeEach(() => {
    registry = new PluginRegistry();
    eventBus = {
      publish: vi.fn(),
      subscribe: vi.fn(),
      subscribeAll: vi.fn(),
    };
    lifecycle = new PluginLifecycle(registry, eventBus);
  });

  describe('install', () => {
    it('should install a registered plugin', () => {
      const manifest = createMockManifest('test-plugin');
      registry.register(manifest);

      const config = { apiKey: 'test-key' };
      const result = lifecycle.install('test-plugin', config);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.state).toBe('installed');
        expect(result.value.config).toEqual(config);
        expect(result.value.installedAt).toBeInstanceOf(Date);
      }

      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'plugin.installed',
        })
      );
    });

    it('should reject installing non-existent plugin', () => {
      const result = lifecycle.install('non-existent', {});

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.name).toBe('PluginNotFoundError');
      }
    });

    it('should reject invalid state transition', () => {
      const manifest = createMockManifest('test-plugin');
      registry.register(manifest);
      lifecycle.install('test-plugin', {});
      lifecycle.activate('test-plugin');

      // Try to install from active state (active -> installed is invalid)
      const result = lifecycle.install('test-plugin', {});

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.name).toBe('PluginSystemError');
      }
    });
  });

  describe('activate', () => {
    it('should activate an installed plugin', () => {
      const manifest = createMockManifest('test-plugin');
      registry.register(manifest);
      lifecycle.install('test-plugin', {});

      const result = lifecycle.activate('test-plugin');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.state).toBe('active');
        expect(result.value.lastActiveAt).toBeInstanceOf(Date);
      }

      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'plugin.activated',
        })
      );
    });

    it('should reject activating non-existent plugin', () => {
      const result = lifecycle.activate('non-existent');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.name).toBe('PluginNotFoundError');
      }
    });

    it('should reject invalid state transition from registered', () => {
      const manifest = createMockManifest('test-plugin');
      registry.register(manifest);

      // Try to activate directly from registered state
      const result = lifecycle.activate('test-plugin');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.name).toBe('PluginSystemError');
      }
    });
  });

  describe('disable', () => {
    it('should disable an active plugin', () => {
      const manifest = createMockManifest('test-plugin');
      registry.register(manifest);
      lifecycle.install('test-plugin', {});
      lifecycle.activate('test-plugin');

      const result = lifecycle.disable('test-plugin');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.state).toBe('disabled');
      }

      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'plugin.disabled',
        })
      );
    });

    it('should reject disabling non-existent plugin', () => {
      const result = lifecycle.disable('non-existent');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.name).toBe('PluginNotFoundError');
      }
    });

    it('should reject invalid state transitions', () => {
      const manifest = createMockManifest('test-plugin');
      registry.register(manifest);

      // Try to disable from registered state
      const result = lifecycle.disable('test-plugin');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.name).toBe('PluginSystemError');
      }
    });
  });
});
