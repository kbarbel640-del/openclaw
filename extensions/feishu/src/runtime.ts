/**
 * Feishu plugin runtime context management
 * @module extensions/feishu/runtime
 */

import type { PluginRuntime } from "openclaw/plugin-sdk";

let runtime: PluginRuntime | null = null;

/**
 * Set the plugin runtime context (called during plugin initialization)
 */
export function setFeishuRuntime(next: PluginRuntime) {
  runtime = next;
}

/**
 * Get the plugin runtime context
 */
export function getFeishuRuntime(): PluginRuntime {
  if (!runtime) {
    throw new Error("Feishu runtime not initialized");
  }
  return runtime;
}
