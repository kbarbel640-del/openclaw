import type { PluginRuntime } from "openclaw/plugin-sdk";

let runtime: PluginRuntime | null = null;

/**
 * Set the OpenClaw runtime instance for the Webex plugin
 * 
 * This must be called during plugin registration to provide
 * access to core OpenClaw functionality.
 * 
 * @param next - The plugin runtime instance
 */
export function setWebexRuntime(next: PluginRuntime): void {
  runtime = next;
}

/**
 * Get the current OpenClaw runtime instance
 * 
 * @returns The runtime instance
 * @throws {Error} If runtime has not been initialized
 */
export function getWebexRuntime(): PluginRuntime {
  if (!runtime) {
    throw new Error("Webex runtime not initialized. Ensure setWebexRuntime() was called during plugin registration.");
  }
  return runtime;
}