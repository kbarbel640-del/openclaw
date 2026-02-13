import type { PluginRuntime } from "openclaw/plugin-sdk";
import type { DiscordVoiceProvider } from "./voice/provider.js";
import type { DiscordVoiceStateListener } from "./voice/voice-state-listener.js";

// Voice state listener and voice provider use globalThis because the plugin
// is loaded via jiti (separate module cache) while provider.ts uses native ESM.
// Module-level singletons would be invisible across that boundary.
const G = globalThis as unknown as {
  __openclawDiscordVoiceStateListener?: DiscordVoiceStateListener | null;
  __openclawDiscordVoiceProvider?: DiscordVoiceProvider | null;
};

let runtime: PluginRuntime | null = null;

export function setDiscordRuntime(next: PluginRuntime) {
  runtime = next;
}

export function getDiscordRuntime(): PluginRuntime {
  if (!runtime) {
    throw new Error("Discord runtime not initialized");
  }
  return runtime;
}

export function setDiscordVoiceProvider(provider: DiscordVoiceProvider | null) {
  G.__openclawDiscordVoiceProvider = provider;
}

export function getDiscordVoiceProvider(): DiscordVoiceProvider | null {
  return G.__openclawDiscordVoiceProvider ?? null;
}

export function setDiscordVoiceStateListener(listener: DiscordVoiceStateListener | null) {
  G.__openclawDiscordVoiceStateListener = listener;
}

export function getDiscordVoiceStateListener(): DiscordVoiceStateListener | null {
  return G.__openclawDiscordVoiceStateListener ?? null;
}
