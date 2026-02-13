import type { DomainEvent } from '../../core/types/domain-events.js';
import type { PluginManifest, HookName, HookContext, HookResult } from './types.js';

export interface PluginRegisteredPayload {
  readonly manifest: PluginManifest;
}

export interface PluginInstalledPayload {
  readonly pluginId: string;
  readonly config: Record<string, unknown>;
}

export interface PluginActivatedPayload {
  readonly pluginId: string;
}

export interface PluginDisabledPayload {
  readonly pluginId: string;
}

export interface PluginErrorPayload {
  readonly pluginId: string;
  readonly error: string;
}

export interface HookExecutedPayload {
  readonly pluginId: string;
  readonly hookName: HookName;
  readonly context: HookContext;
  readonly result: HookResult;
}

export type PluginRegistered = DomainEvent<PluginRegisteredPayload>;
export type PluginInstalled = DomainEvent<PluginInstalledPayload>;
export type PluginActivated = DomainEvent<PluginActivatedPayload>;
export type PluginDisabled = DomainEvent<PluginDisabledPayload>;
export type PluginError = DomainEvent<PluginErrorPayload>;
export type HookExecuted = DomainEvent<HookExecutedPayload>;
