import type { PluginRuntime } from "openclaw/plugin-sdk";

let larkRuntime: PluginRuntime | undefined;

export function setLarkRuntime(runtime: PluginRuntime): void {
  larkRuntime = runtime;
}

export function getLarkRuntime(): PluginRuntime {
  if (!larkRuntime) {
    throw new Error("Lark runtime not initialized");
  }
  return larkRuntime;
}
