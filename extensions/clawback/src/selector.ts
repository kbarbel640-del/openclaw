import type { RoutingProfile, Tier } from "./types.js";
import { PROFILES } from "./config.js";

// ---------------------------------------------------------------------------
// Select the target model for a given tier + profile
// ---------------------------------------------------------------------------

export function selectModel(tier: Tier, profile: RoutingProfile, overrideModel?: string): string {
  if (overrideModel) {
    return overrideModel;
  }

  const profileConfig = PROFILES[profile];
  return profileConfig.tierModels[tier];
}

// ---------------------------------------------------------------------------
// Fallback chain: ordered list of models to try within and across tiers
// ---------------------------------------------------------------------------

const TIER_ORDER: Tier[] = ["REASONING", "COMPLEX", "MEDIUM", "SIMPLE"];

export function getFallbackChain(tier: Tier, profile: RoutingProfile): string[] {
  const profileConfig = PROFILES[profile];
  const startIdx = TIER_ORDER.indexOf(tier);
  const chain: string[] = [];
  const seen = new Set<string>();

  // Walk from current tier down to SIMPLE
  for (let i = startIdx; i < TIER_ORDER.length; i++) {
    const model = profileConfig.tierModels[TIER_ORDER[i]];
    if (!seen.has(model)) {
      chain.push(model);
      seen.add(model);
    }
  }

  return chain;
}

// ---------------------------------------------------------------------------
// Parse a model ref like "anthropic/claude-sonnet-4-5" into provider + model
// ---------------------------------------------------------------------------

export function parseModelRef(modelRef: string): { provider: string; model: string } {
  const slashIdx = modelRef.indexOf("/");
  if (slashIdx === -1) {
    return { provider: "unknown", model: modelRef };
  }
  return {
    provider: modelRef.slice(0, slashIdx),
    model: modelRef.slice(slashIdx + 1),
  };
}
