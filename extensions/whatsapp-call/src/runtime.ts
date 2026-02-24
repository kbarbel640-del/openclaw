import type { PluginRuntime } from "openclaw/plugin-sdk";

let runtime: PluginRuntime | null = null;

export function setWhatsAppCallRuntime(next: PluginRuntime) {
  runtime = next;
}

export function getWhatsAppCallRuntime(): PluginRuntime {
  if (!runtime) {
    throw new Error("WhatsApp Call runtime not initialized");
  }
  return runtime;
}
