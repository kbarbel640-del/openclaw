/**
 * Data-Service configuration types and resolution.
 *
 * For Wexa Coworker Web integration:
 * - orgId/userId MUST be set via data-service.setContext gateway method
 * - No fallback to environment variables for user context
 * - Server-level config (url, serverKey) still comes from env vars
 */

import { getRequestContext } from "./request-context.js";

/** Configuration for the Data-Service connector tools */
export type DataServiceConfig = {
  /** Enable/disable the Data-Service connector tools */
  enabled?: boolean;
  /** Base URL for the Data-Service API */
  url?: string;
  /** Server key for system calls (required) */
  serverKey?: string;
  /** Pre-configured connector IDs by connector type (optional overrides) */
  connectorIds?: Record<string, string>;
  /** Request timeout in milliseconds */
  timeoutMs?: number;
  /** Base URL for the Identity-Service API */
  identityServiceUrl?: string;
  /** Server key for Identity-Service system calls */
  identityServiceServerKey?: string;
};

const DEFAULT_DATA_SERVICE_URL = "https://dev.api.wexa.ai";

/**
 * Resolve Data-Service configuration from plugin config and env vars.
 *
 * Note: orgId/userId are NOT resolved here — they MUST come from
 * the request context set via data-service.setContext.
 */
export function resolveDataServiceConfig(
  pluginConfig?: Record<string, unknown>,
): DataServiceConfig {
  const pc = pluginConfig as DataServiceConfig | undefined;

  return {
    enabled: pc?.enabled ?? !!process.env.DATA_SERVICE_URL,
    url: pc?.url ?? process.env.DATA_SERVICE_URL ?? DEFAULT_DATA_SERVICE_URL,
    serverKey: pc?.serverKey ?? process.env.DATA_SERVICE_SERVER_KEY,
    connectorIds: pc?.connectorIds,
    timeoutMs: pc?.timeoutMs ?? 30000,
    identityServiceUrl:
      pc?.identityServiceUrl ?? process.env.IDENTITY_SERVICE_URL ?? "http://localhost:3002",
    identityServiceServerKey:
      pc?.identityServiceServerKey ??
      process.env.IDENTITY_SERVICE_SERVER_KEY ??
      process.env.DATA_SERVICE_SERVER_KEY,
  };
}

/**
 * Get user context for the current request.
 *
 * orgId/userId MUST be set via data-service.setContext before calling agent.
 * Returns undefined values if context is not set — tools should return an error.
 */
export function getEffectiveUserContext(): {
  orgId?: string;
  userId?: string;
  projectId?: string;
  apiKey?: string;
} {
  const reqCtx = getRequestContext();

  if (!reqCtx) {
    return {
      orgId: undefined,
      userId: undefined,
      projectId: undefined,
      apiKey: undefined,
    };
  }

  return {
    orgId: reqCtx.orgId,
    userId: reqCtx.userId,
    projectId: reqCtx.projectId,
    apiKey: reqCtx.apiKey,
  };
}

/**
 * Check if user context is set for the current request.
 */
export function hasUserContext(): boolean {
  const ctx = getRequestContext();
  return !!(ctx?.orgId && ctx?.userId);
}

/**
 * Error message when user context is not set.
 */
export const MISSING_CONTEXT_ERROR =
  "User context not set. Call data-service.setContext with orgId and userId before calling the agent.";
