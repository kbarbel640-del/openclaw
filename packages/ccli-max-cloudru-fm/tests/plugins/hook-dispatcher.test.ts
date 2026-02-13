/**
 * Tests for HookDispatcher.
 */

import { describe, it, expect } from 'vitest';
import { HookDispatcher } from '../../src/plugins/application/hook-dispatcher.js';
import type { PluginHook, HookName, HookContext } from '../../src/plugins/domain/types.js';

describe('HookDispatcher', () => {
  const createHook = (pluginId: string, hookName: HookName, priority: number): PluginHook => ({
    pluginId,
    hookName,
    priority,
  });

  describe('dispatch', () => {
    it('should dispatch hooks in priority order', async () => {
      const dispatcher = new HookDispatcher();

      dispatcher.registerHook(createHook('plugin-a', 'onMessageReceived', 10));
      dispatcher.registerHook(createHook('plugin-b', 'onMessageReceived', 5));
      dispatcher.registerHook(createHook('plugin-c', 'onMessageReceived', 15));

      const executionOrder: string[] = [];
      const executor = async (pluginId: string) => {
        executionOrder.push(pluginId);
        return { modified: false };
      };

      const context: HookContext = {
        tenantId: 'test-tenant',
        sessionId: 'test-session',
        data: {},
      };

      await dispatcher.dispatch('onMessageReceived', context, executor);

      // Should execute in priority order (lower number = higher priority)
      expect(executionOrder).toEqual(['plugin-b', 'plugin-a', 'plugin-c']);
    });

    it('should stop on cancel', async () => {
      const dispatcher = new HookDispatcher();

      dispatcher.registerHook(createHook('plugin-a', 'onMessageReceived', 10));
      dispatcher.registerHook(createHook('plugin-b', 'onMessageReceived', 20));
      dispatcher.registerHook(createHook('plugin-c', 'onMessageReceived', 30));

      const executionOrder: string[] = [];
      const executor = async (pluginId: string) => {
        executionOrder.push(pluginId);
        if (pluginId === 'plugin-b') {
          return { modified: false, cancel: true };
        }
        return { modified: false };
      };

      const context: HookContext = {
        tenantId: 'test-tenant',
        sessionId: 'test-session',
        data: {},
      };

      const result = await dispatcher.dispatch('onMessageReceived', context, executor);

      expect(executionOrder).toEqual(['plugin-a', 'plugin-b']);
      expect(result.cancel).toBe(true);
    });

    it('should return unmodified result when no hooks', async () => {
      const dispatcher = new HookDispatcher();

      const context: HookContext = {
        tenantId: 'test-tenant',
        sessionId: 'test-session',
        data: { message: 'test' },
      };

      const result = await dispatcher.dispatch('onMessageReceived', context);

      expect(result.modified).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.cancel).toBeUndefined();
    });

    it('should pass modified data through hook chain', async () => {
      const dispatcher = new HookDispatcher();

      dispatcher.registerHook(createHook('plugin-a', 'onMessageReceived', 10));
      dispatcher.registerHook(createHook('plugin-b', 'onMessageReceived', 20));

      const executor = async (pluginId: string, _hookName: HookName, context: HookContext) => {
        if (pluginId === 'plugin-a') {
          return {
            modified: true,
            data: { ...context.data, processedBy: ['plugin-a'] },
          };
        }
        if (pluginId === 'plugin-b') {
          const processed = (context.data.processedBy as string[]) || [];
          return {
            modified: true,
            data: { ...context.data, processedBy: [...processed, 'plugin-b'] },
          };
        }
        return { modified: false };
      };

      const context: HookContext = {
        tenantId: 'test-tenant',
        sessionId: 'test-session',
        data: {},
      };

      const result = await dispatcher.dispatch('onMessageReceived', context, executor);

      expect(result.modified).toBe(true);
      expect(result.data).toEqual({
        processedBy: ['plugin-a', 'plugin-b'],
      });
    });
  });

  describe('registerHook and unregisterHooks', () => {
    it('should register and unregister hooks', () => {
      const dispatcher = new HookDispatcher();

      dispatcher.registerHook(createHook('plugin-a', 'onMessageReceived', 10));
      dispatcher.registerHook(createHook('plugin-a', 'onBeforeSend', 10));

      expect(dispatcher.getHooks('onMessageReceived')).toHaveLength(1);
      expect(dispatcher.getHooks('onBeforeSend')).toHaveLength(1);

      dispatcher.unregisterHooks('plugin-a');

      expect(dispatcher.getHooks('onMessageReceived')).toHaveLength(0);
      expect(dispatcher.getHooks('onBeforeSend')).toHaveLength(0);
    });
  });
});
