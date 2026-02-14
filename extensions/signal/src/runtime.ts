import type { PluginRuntime } from "openclaw/plugin-sdk";
import type { SignalBridgeHandle } from "./bridge-spawn.js";

let runtime: PluginRuntime | null = null;
let bridgeHandle: SignalBridgeHandle | null = null;

export function setSignalRuntime(next: PluginRuntime) {
  runtime = next;
}

export function getSignalRuntime(): PluginRuntime {
  if (!runtime) {
    throw new Error("Signal runtime not initialized");
  }
  return runtime;
}

export function setSignalBridgeHandle(handle: SignalBridgeHandle | null) {
  bridgeHandle = handle;
}

export function getSignalBridgeHandle(): SignalBridgeHandle | null {
  return bridgeHandle;
}

export function stopSignalBridge() {
  if (bridgeHandle) {
    bridgeHandle.stop();
    bridgeHandle = null;
  }
}
