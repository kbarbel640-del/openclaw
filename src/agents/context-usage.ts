import type { OpenClawConfig } from "../config/config.js";
import type { SessionEntry } from "../config/sessions/types.js";

/**
 * Context usage information with health thresholds.
 */
export type ContextUsageInfo = {
  /** Current total tokens used in the session. */
  totalTokens: number;
  /** Maximum context window tokens for the model. */
  contextTokens: number;
  /** Usage ratio (0.0 - 1.0). */
  usageRatio: number;
  /** Usage percentage (0 - 100). */
  usagePercent: number;
  /** Context usage is below warning threshold. */
  isHealthy: boolean;
  /** Context usage is at or above warning threshold but below critical. */
  isWarning: boolean;
  /** Context usage is at or above critical threshold. */
  isCritical: boolean;
};

/** Default warning threshold (75% of context window). */
export const DEFAULT_WARNING_THRESHOLD = 0.75;

/** Default critical threshold (90% of context window). */
export const DEFAULT_CRITICAL_THRESHOLD = 0.9;

/**
 * Calculate context usage information from raw token counts.
 * Returns null if either totalTokens or contextTokens is missing or invalid.
 */
export function calculateContextUsage(params: {
  totalTokens?: number;
  contextTokens?: number;
  warningThreshold?: number;
  criticalThreshold?: number;
}): ContextUsageInfo | null {
  const totalTokens = params.totalTokens;
  const contextTokens = params.contextTokens;

  // Require valid positive numbers
  if (typeof totalTokens !== "number" || !Number.isFinite(totalTokens) || totalTokens < 0) {
    return null;
  }
  if (typeof contextTokens !== "number" || !Number.isFinite(contextTokens) || contextTokens <= 0) {
    return null;
  }

  const warningThreshold = params.warningThreshold ?? DEFAULT_WARNING_THRESHOLD;
  const criticalThreshold = params.criticalThreshold ?? DEFAULT_CRITICAL_THRESHOLD;

  const usageRatio = Math.min(totalTokens / contextTokens, 1.0);
  const usagePercent = Math.round(usageRatio * 100);

  return {
    totalTokens,
    contextTokens,
    usageRatio,
    usagePercent,
    isHealthy: usageRatio < warningThreshold,
    isWarning: usageRatio >= warningThreshold && usageRatio < criticalThreshold,
    isCritical: usageRatio >= criticalThreshold,
  };
}

/**
 * Get context usage information from a session entry.
 * Extracts totalTokens and contextTokens from the session entry,
 * falling back to config defaults if needed.
 */
export function getSessionContextUsage(params: {
  sessionEntry?: SessionEntry;
  config?: OpenClawConfig;
  warningThreshold?: number;
  criticalThreshold?: number;
}): ContextUsageInfo | null {
  const { sessionEntry, config } = params;
  if (!sessionEntry) {
    return null;
  }

  const totalTokens = sessionEntry.totalTokens;

  // Try session's contextTokens first, then fall back to config
  let contextTokens = sessionEntry.contextTokens;
  if (typeof contextTokens !== "number" || !Number.isFinite(contextTokens) || contextTokens <= 0) {
    contextTokens = config?.agents?.defaults?.contextTokens;
  }

  return calculateContextUsage({
    totalTokens,
    contextTokens,
    warningThreshold: params.warningThreshold,
    criticalThreshold: params.criticalThreshold,
  });
}
