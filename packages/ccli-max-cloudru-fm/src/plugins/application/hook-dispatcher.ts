import type { PluginHook, HookName, HookContext, HookResult } from '../domain/types.js';

export class HookDispatcher {
  private readonly hooks = new Map<HookName, PluginHook[]>();

  registerHook(hook: PluginHook): void {
    const existing = this.hooks.get(hook.hookName) || [];

    // Insert in priority order (lower number = higher priority)
    const insertIndex = existing.findIndex(h => h.priority > hook.priority);
    if (insertIndex === -1) {
      existing.push(hook);
    } else {
      existing.splice(insertIndex, 0, hook);
    }

    this.hooks.set(hook.hookName, existing);
  }

  unregisterHooks(pluginId: string): void {
    const hookNames = Array.from(this.hooks.keys());
    for (const hookName of hookNames) {
      const hooks = this.hooks.get(hookName);
      if (!hooks) continue;

      const filtered = hooks.filter(h => h.pluginId !== pluginId);
      if (filtered.length > 0) {
        this.hooks.set(hookName, filtered);
      } else {
        this.hooks.delete(hookName);
      }
    }
  }

  async dispatch(
    hookName: HookName,
    context: HookContext,
    executor?: (pluginId: string, hookName: HookName, context: HookContext) => Promise<HookResult>
  ): Promise<HookResult> {
    const hooks = this.hooks.get(hookName) || [];

    let currentData = context.data;
    let modified = false;

    for (const hook of hooks) {
      const hookContext: HookContext = {
        ...context,
        data: currentData,
      };

      const result = executor
        ? await executor(hook.pluginId, hookName, hookContext)
        : { modified: false };

      if (result.modified && result.data) {
        currentData = result.data;
        modified = true;
      }

      if (result.cancel) {
        return {
          modified,
          data: currentData,
          cancel: true,
        };
      }
    }

    return {
      modified,
      data: modified ? currentData : undefined,
    };
  }

  getHooks(hookName: HookName): PluginHook[] {
    return [...(this.hooks.get(hookName) || [])];
  }
}
