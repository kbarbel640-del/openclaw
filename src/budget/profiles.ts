/**
 * Predefined budget profiles with resource limits.
 */

import type { BudgetLimits, BudgetProfile, BudgetProfileId } from "./types.js";

/**
 * Default limits for the "cheap" profile.
 * Optimized for minimal resource usage.
 */
export const CHEAP_LIMITS: BudgetLimits = {
  maxToolCalls: 10,
  maxLlmCalls: 5,
  maxTokens: 50_000,
  maxCostUsd: 0.1,
  maxRuntimeMs: 60_000, // 1 minute
  maxRetryAttempts: 2,
  maxWebSearchCalls: 1,
  maxWebFetchCalls: 2,
  maxSubagentSpawns: 0,
  browserEnabled: false,
  preferredModelTier: "local",
};

/**
 * Default limits for the "normal" profile.
 * Balanced resource usage for typical tasks.
 */
export const NORMAL_LIMITS: BudgetLimits = {
  maxToolCalls: 50,
  maxLlmCalls: 20,
  maxTokens: 200_000,
  maxCostUsd: 1.0,
  maxRuntimeMs: 300_000, // 5 minutes
  maxRetryAttempts: 3,
  maxWebSearchCalls: 5,
  maxWebFetchCalls: 10,
  maxSubagentSpawns: 2,
  browserEnabled: false,
  preferredModelTier: "standard",
};

/**
 * Default limits for the "deep" profile.
 * Higher caps for complex tasks, requires explicit arming.
 */
export const DEEP_LIMITS: BudgetLimits = {
  maxToolCalls: 200,
  maxLlmCalls: 100,
  maxTokens: 1_000_000,
  maxCostUsd: 10.0,
  maxRuntimeMs: 1_800_000, // 30 minutes
  maxRetryAttempts: 5,
  maxWebSearchCalls: 20,
  maxWebFetchCalls: 50,
  maxSubagentSpawns: 10,
  browserEnabled: true,
  preferredModelTier: "premium",
};

/**
 * All predefined budget profiles.
 */
export const BUDGET_PROFILES: Record<BudgetProfileId, BudgetProfile> = {
  cheap: {
    id: "cheap",
    name: "Cheap",
    description: "Minimal resource usage. Local model preferred, no subagents, limited web access.",
    limits: CHEAP_LIMITS,
    requiresArming: false,
  },
  normal: {
    id: "normal",
    name: "Normal",
    description:
      "Balanced resource limits for typical tasks. Some web access and subagents allowed.",
    limits: NORMAL_LIMITS,
    requiresArming: false,
  },
  deep: {
    id: "deep",
    name: "Deep",
    description:
      "Higher caps for complex research tasks. Must be explicitly armed. Browser access enabled.",
    limits: DEEP_LIMITS,
    requiresArming: true,
  },
};

/**
 * Get a budget profile by ID.
 */
export function getBudgetProfile(id: BudgetProfileId): BudgetProfile {
  return BUDGET_PROFILES[id];
}

/**
 * Get limits for a profile, with optional overrides applied.
 */
export function getProfileLimits(
  id: BudgetProfileId,
  overrides?: Partial<BudgetLimits>,
): BudgetLimits {
  const base = BUDGET_PROFILES[id].limits;
  if (!overrides) {
    return { ...base };
  }
  return { ...base, ...overrides };
}

/**
 * Validate that a profile ID is valid.
 */
export function isValidProfileId(id: string): id is BudgetProfileId {
  return id === "cheap" || id === "normal" || id === "deep";
}

/**
 * Get the default budget profile ID.
 */
export function getDefaultProfileId(): BudgetProfileId {
  return "normal";
}

/**
 * List all available profile IDs.
 */
export function listProfileIds(): BudgetProfileId[] {
  return ["cheap", "normal", "deep"];
}
