import type { GatewayPlugin } from "@buape/carbon/gateway";

/**
 * Module-level registry of active Discord GatewayPlugin instances.
 * Bridges the gap between agent tool handlers (which only have REST access)
 * and the gateway WebSocket (needed for operations like updatePresence).
 * Follows the same pattern as presence-cache.ts.
 *
 * Uses globalThis so the registry is shared across jiti (extension) and
 * native ESM (src/) module boundaries.
 */
const G = globalThis as unknown as {
  __openclawDiscordGatewayRegistry?: Map<string, GatewayPlugin>;
};
if (!G.__openclawDiscordGatewayRegistry) {
  G.__openclawDiscordGatewayRegistry = new Map();
}
const gatewayRegistry: Map<string, GatewayPlugin> = G.__openclawDiscordGatewayRegistry;

// Sentinel key for the default (unnamed) account. Uses a prefix that cannot
// collide with user-configured account IDs.
const DEFAULT_ACCOUNT_KEY = "\0__default__";

function resolveAccountKey(accountId?: string): string {
  return accountId ?? DEFAULT_ACCOUNT_KEY;
}

/** Register a GatewayPlugin instance for an account. */
export function registerGateway(accountId: string | undefined, gateway: GatewayPlugin): void {
  gatewayRegistry.set(resolveAccountKey(accountId), gateway);
}

/** Unregister a GatewayPlugin instance for an account. */
export function unregisterGateway(accountId?: string): void {
  gatewayRegistry.delete(resolveAccountKey(accountId));
}

/** Get the GatewayPlugin for an account. Returns undefined if not registered.
 *  When accountId is undefined and the sentinel key has no entry, falls back
 *  to the first registered gateway (common single-account setup). */
export function getGateway(accountId?: string): GatewayPlugin | undefined {
  const key = resolveAccountKey(accountId);
  const exact = gatewayRegistry.get(key);
  if (exact) {
    return exact;
  }

  // Fallback: when called without an accountId, return the first (only)
  // registered gateway. This bridges the gap when the voice extension
  // doesn't know the concrete account name used at registration time.
  if (!accountId && gatewayRegistry.size > 0) {
    return gatewayRegistry.values().next().value;
  }
  return undefined;
}

/** Clear all registered gateways (for testing). */
export function clearGateways(): void {
  gatewayRegistry.clear();
}
