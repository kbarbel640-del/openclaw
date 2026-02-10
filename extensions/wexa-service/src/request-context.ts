/**
 * Request-scoped context for wexa-service tools.
 *
 * Uses the shared globalThis store that data-service writes to.
 * This allows wexa-service tools to access user context without
 * needing a direct import dependency on data-service.
 */

import { getGlobalSessionContext, type WexaSessionContext } from "./global-context.js";

/**
 * Current session key for the executing tool.
 * Set by the before_tool_call hook, cleared by after_tool_call.
 */
let currentSessionKey: string | undefined;

/**
 * Set the current session key (called by before_tool_call hook).
 */
export function setCurrentSessionKey(sessionKey: string | undefined): void {
  currentSessionKey = sessionKey;
}

/**
 * Clear the current session key (called by after_tool_call hook).
 */
export function clearCurrentSessionKey(): void {
  currentSessionKey = undefined;
}

/**
 * Get the current request context (orgId/userId).
 *
 * Reads from the global session context store that data-service.setContext writes to.
 * Returns undefined if no context is set — tools should return an error.
 */
export function getRequestContext(): WexaSessionContext | undefined {
  if (currentSessionKey) {
    return getGlobalSessionContext(currentSessionKey);
  }
  return undefined;
}

/**
 * Check if user context is set for the current request.
 */
export function hasUserContext(): boolean {
  const ctx = getRequestContext();
  return !!(ctx?.orgId && ctx?.userId);
}

/**
 * Get effective user context with all fields.
 */
export function getEffectiveUserContext(): {
  orgId?: string;
  userId?: string;
  projectId?: string;
  apiKey?: string;
} {
  const ctx = getRequestContext();
  if (!ctx) {
    return {
      orgId: undefined,
      userId: undefined,
      projectId: undefined,
      apiKey: undefined,
    };
  }
  return {
    orgId: ctx.orgId,
    userId: ctx.userId,
    projectId: ctx.projectId,
    apiKey: ctx.apiKey,
  };
}

/**
 * Error message when user context is not set.
 */
export const MISSING_CONTEXT_ERROR =
  "User context not set. Call data-service.setContext with orgId and userId before calling the agent.";
