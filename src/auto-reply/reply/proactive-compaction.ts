import type { OpenClawConfig } from "../../config/config.js";
import type { SessionEntry } from "../../config/sessions.js";
import { calculateContextUsage, DEFAULT_WARNING_THRESHOLD } from "../../agents/context-usage.js";
import { lookupContextTokens } from "../../agents/context.js";
import { DEFAULT_CONTEXT_TOKENS } from "../../agents/defaults.js";

/** Default proactive compaction threshold (75% of context window). */
export const DEFAULT_PROACTIVE_THRESHOLD = DEFAULT_WARNING_THRESHOLD;

/**
 * Resolve the proactive compaction threshold from config.
 * Returns the threshold ratio (0.1–1.0), or null if proactive compaction is disabled.
 */
export function resolveProactiveThreshold(cfg?: OpenClawConfig): number | null {
  const threshold = cfg?.agents?.defaults?.compaction?.proactiveThreshold;
  if (typeof threshold !== "number" || !Number.isFinite(threshold)) {
    return DEFAULT_PROACTIVE_THRESHOLD;
  }
  if (threshold < 0.1 || threshold > 1.0) {
    return DEFAULT_PROACTIVE_THRESHOLD;
  }
  return threshold;
}

/**
 * Resolve context window tokens for proactive compaction check.
 */
export function resolveProactiveContextWindowTokens(params: {
  modelId?: string;
  agentCfgContextTokens?: number;
}): number {
  return (
    lookupContextTokens(params.modelId) ?? params.agentCfgContextTokens ?? DEFAULT_CONTEXT_TOKENS
  );
}

/**
 * Check if proactive compaction should run before an agent turn.
 * This triggers compaction proactively when context usage exceeds the threshold,
 * preventing overflow errors during the actual run.
 */
export function shouldRunProactiveCompaction(params: {
  entry?: Pick<SessionEntry, "totalTokens" | "contextTokens">;
  contextWindowTokens: number;
  threshold: number;
  /** Track if we've already attempted proactive compaction this session. */
  alreadyAttempted?: boolean;
}): boolean {
  if (params.alreadyAttempted) {
    return false;
  }

  const usage = calculateContextUsage({
    totalTokens: params.entry?.totalTokens,
    contextTokens: params.entry?.contextTokens ?? params.contextWindowTokens,
    warningThreshold: params.threshold,
  });

  if (!usage) {
    return false;
  }

  // Trigger if usage is at or above the threshold
  return usage.usageRatio >= params.threshold;
}
