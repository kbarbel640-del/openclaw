/**
 * Utilities for tracking actual vs requested model state in sessions
 */

import type { SessionEntry } from "../config/sessions.js";

export interface SessionModelState {
  /** The model that was requested/configured */
  requestedModel: string;
  requestedProvider: string;

  /** The model that is actually running */
  actualModel: string;
  actualProvider: string;

  /** Whether there's a difference between requested and actual */
  hasMismatch: boolean;
}

/**
 * Resolve the actual model state for a session
 * This distinguishes between what was requested vs what's actually running
 */
export function resolveSessionModelState(params: {
  sessionEntry: SessionEntry;
  configuredProvider: string;
  configuredModel: string;
  actualRunningModel?: string;
  actualRunningProvider?: string;
}): SessionModelState {
  // Requested is from override or config
  const requestedProvider =
    params.sessionEntry.providerOverride?.trim() || params.configuredProvider;
  const requestedModel = params.sessionEntry.modelOverride?.trim() || params.configuredModel;

  // Actual running might differ (e.g., fallback model, degradation, etc.)
  const actualProvider = params.actualRunningProvider || requestedProvider;
  const actualModel = params.actualRunningModel || requestedModel;

  return {
    requestedModel,
    requestedProvider,
    actualModel,
    actualProvider,
    hasMismatch: 
      requestedProvider !== actualProvider || requestedModel !== actualModel,
  };
}

/**
 * Format model state for display
 */
export function formatModelState(state: SessionModelState): string {
  const requested = `${state.requestedProvider}/${state.requestedModel}`;
  
  if (!state.hasMismatch) {
    return requested;
  }

  const actual = `${state.actualProvider}/${state.actualModel}`;
  return `${requested} (running: ${actual})`;
}
