import type { PluginRuntime } from "openclaw/plugin-sdk";

let runtime: PluginRuntime | null = null;
const monitorWakeups = new Map<string, () => void>();

export function setSaintEmailRuntime(next: PluginRuntime) {
  runtime = next;
}

export function getSaintEmailRuntime(): PluginRuntime {
  if (!runtime) {
    throw new Error("Saint Email runtime not initialized");
  }
  return runtime;
}

export function registerSaintEmailMonitor(accountId: string, wake: () => void) {
  monitorWakeups.set(accountId, wake);
}

export function unregisterSaintEmailMonitor(accountId: string) {
  monitorWakeups.delete(accountId);
}

export function wakeAllSaintEmailMonitors() {
  for (const wake of monitorWakeups.values()) {
    try {
      wake();
    } catch {
      // ignore monitor wake errors
    }
  }
}
