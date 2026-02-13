// Domain types
export type {
  PluginState,
  PluginManifest,
  PluginPermission,
  PluginInstance,
  PluginHook,
  HookName,
  HookContext,
  HookResult,
} from './domain/types.js';

// Domain errors
export {
  PluginSystemError,
  PluginNotFoundError,
  PluginInstallError,
  PluginPermissionError,
  PluginExecutionError,
  PluginConfigError,
} from './domain/errors.js';

// Domain events
export type {
  PluginRegistered,
  PluginInstalled,
  PluginActivated,
  PluginDisabled,
  PluginError,
  HookExecuted,
  PluginRegisteredPayload,
  PluginInstalledPayload,
  PluginActivatedPayload,
  PluginDisabledPayload,
  PluginErrorPayload,
  HookExecutedPayload,
} from './domain/events.js';

// State machine
export {
  transitionPlugin,
  canTransition,
  getValidTransitions,
} from './domain/state-machine.js';

// Application services
export { PluginRegistry } from './application/plugin-registry.js';
export type { PluginListFilter } from './application/plugin-registry.js';

export { PluginLifecycle } from './application/plugin-lifecycle.js';
export { PermissionGuard } from './application/permission-guard.js';
export { HookDispatcher } from './application/hook-dispatcher.js';

export type { IPluginSandbox } from './application/plugin-sandbox.js';
export { NoOpSandbox } from './application/plugin-sandbox.js';
