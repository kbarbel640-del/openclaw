import type { AccessTier } from '../../core/types/access-tier.js';
import type { JsonSchema } from '../../core/types/json-schema.js';

export type PluginState = 'registered' | 'installed' | 'active' | 'disabled' | 'error';

export interface PluginManifest {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly author: string;
  readonly requiredTier: AccessTier;
  readonly permissions: PluginPermission[];
  readonly configSchema?: JsonSchema;
  readonly entryPoint: string;
}

export type PluginPermission =
  | 'read_messages'
  | 'send_messages'
  | 'read_files'
  | 'write_files'
  | 'execute_tools'
  | 'access_network';

export interface PluginInstance {
  readonly manifest: PluginManifest;
  readonly state: PluginState;
  readonly config: Record<string, unknown>;
  readonly installedAt: Date;
  readonly lastActiveAt?: Date;
  readonly errorMessage?: string;
}

export interface PluginHook {
  readonly pluginId: string;
  readonly hookName: HookName;
  readonly priority: number;
}

export type HookName =
  | 'onMessageReceived'
  | 'onBeforeSend'
  | 'onAfterSend'
  | 'onToolInvoked'
  | 'onToolCompleted'
  | 'onSessionStart'
  | 'onSessionEnd';

export interface HookContext {
  readonly tenantId: string;
  readonly sessionId: string;
  readonly data: Record<string, unknown>;
}

export interface HookResult {
  readonly modified: boolean;
  readonly data?: Record<string, unknown>;
  readonly cancel?: boolean;
}
