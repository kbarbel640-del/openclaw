/**
 * Wexa-Service configuration types and resolution.
 *
 * Shares the same environment variables as data-service for API access.
 */

/** Configuration for the Wexa-Service tools */
export type WexaServiceConfig = {
  /** Enable/disable the Wexa service tools */
  enabled?: boolean;
  /** Base URL for the Data-Service API */
  url?: string;
  /** Server key for system calls */
  serverKey?: string;
  /** Request timeout in milliseconds */
  timeoutMs?: number;
  /** Base URL for the Identity-Service API */
  identityServiceUrl?: string;
  /** Server key for Identity-Service system calls */
  identityServiceServerKey?: string;
};

const DEFAULT_DATA_SERVICE_URL = "https://dev.api.wexa.ai";

/**
 * Resolve Wexa-Service configuration from plugin config and env vars.
 */
export function resolveWexaServiceConfig(
  pluginConfig?: Record<string, unknown>,
): WexaServiceConfig {
  const pc = pluginConfig as WexaServiceConfig | undefined;

  return {
    enabled: pc?.enabled ?? !!process.env.DATA_SERVICE_URL,
    url: pc?.url ?? process.env.DATA_SERVICE_URL ?? DEFAULT_DATA_SERVICE_URL,
    serverKey: pc?.serverKey ?? process.env.DATA_SERVICE_SERVER_KEY,
    timeoutMs: pc?.timeoutMs ?? 30000,
    identityServiceUrl:
      pc?.identityServiceUrl ?? process.env.IDENTITY_SERVICE_URL ?? "http://localhost:3002",
    identityServiceServerKey:
      pc?.identityServiceServerKey ??
      process.env.IDENTITY_SERVICE_SERVER_KEY ??
      process.env.DATA_SERVICE_SERVER_KEY,
  };
}
