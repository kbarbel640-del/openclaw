/**
 * Budget configuration resolution.
 */

import type { OpenClawConfig } from "../config/config.js";
import type { BudgetConfig, BudgetLimits, BudgetProfileId } from "./types.js";
import { getDefaultProfileId, getProfileLimits, isValidProfileId } from "./profiles.js";

/**
 * Resolve budget configuration from OpenClaw config.
 */
export function resolveBudgetConfig(config?: OpenClawConfig): BudgetConfig {
  const raw = (config as Record<string, unknown> | undefined)?.budget as
    | Partial<BudgetConfig>
    | undefined;

  return {
    defaultProfile: resolveDefaultProfile(raw?.defaultProfile),
    agentProfiles: resolveAgentProfiles(raw?.agentProfiles),
    profileOverrides: raw?.profileOverrides,
    autoEscalate: raw?.autoEscalate ?? false,
    modelCosts: raw?.modelCosts,
  };
}

/**
 * Resolve the default budget profile ID.
 */
function resolveDefaultProfile(raw?: unknown): BudgetProfileId {
  if (typeof raw === "string" && isValidProfileId(raw)) {
    return raw;
  }
  return getDefaultProfileId();
}

/**
 * Resolve per-agent profile overrides.
 */
function resolveAgentProfiles(raw?: unknown): Record<string, BudgetProfileId> {
  if (!raw || typeof raw !== "object") {
    return {};
  }
  const result: Record<string, BudgetProfileId> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string" && isValidProfileId(value)) {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Get the budget profile for a specific agent.
 */
export function resolveAgentBudgetProfile(config: BudgetConfig, agentId?: string): BudgetProfileId {
  if (agentId && config.agentProfiles?.[agentId]) {
    return config.agentProfiles[agentId];
  }
  return config.defaultProfile ?? getDefaultProfileId();
}

/**
 * Get effective limits for a profile with config overrides applied.
 */
export function resolveEffectiveLimits(
  config: BudgetConfig,
  profileId: BudgetProfileId,
): BudgetLimits {
  const overrides = config.profileOverrides?.[profileId];
  return getProfileLimits(profileId, overrides);
}

/**
 * Build budget governor options from config.
 */
export function buildGovernorOptionsFromConfig(params: {
  config?: OpenClawConfig;
  agentId?: string;
  profileOverride?: BudgetProfileId;
  deepArmed?: boolean;
}): {
  profileId: BudgetProfileId;
  limitOverrides?: Partial<BudgetLimits>;
  deepArmed?: boolean;
} {
  const budgetConfig = resolveBudgetConfig(params.config);
  const profileId =
    params.profileOverride ?? resolveAgentBudgetProfile(budgetConfig, params.agentId);

  return {
    profileId,
    limitOverrides: budgetConfig.profileOverrides?.[profileId],
    deepArmed: params.deepArmed,
  };
}
