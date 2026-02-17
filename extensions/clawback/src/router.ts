import type { RoutingDecision, RoutingProfile, Tier } from "./types.js";
import { classifyByRules } from "./rules.js";
import { selectModel, parseModelRef } from "./selector.js";
import { getPinnedModel, pinSession } from "./session.js";
import { recordAgenticOverride, recordRequest } from "./stats.js";

// Agentic score threshold for bumping tier to COMPLEX minimum
const AGENTIC_THRESHOLD = 0.6;

// ---------------------------------------------------------------------------
// Main routing entry point
// ---------------------------------------------------------------------------

export function route(
  text: string,
  profile: RoutingProfile,
  sessionKey?: string,
  overrideModel?: string,
): RoutingDecision {
  // 1. Override model: force a specific model
  if (overrideModel) {
    const { provider } = parseModelRef(overrideModel);
    recordRequest("COMPLEX", provider);
    return {
      model: overrideModel,
      tier: "COMPLEX",
      profile,
      confidence: 1,
      cached: false,
      deduped: false,
      sessionPinned: false,
      agenticOverride: false,
    };
  }

  // 2. Session pin: reuse model within conversation
  if (sessionKey) {
    const pinned = getPinnedModel(sessionKey);
    if (pinned) {
      const { provider } = parseModelRef(pinned.model);
      recordRequest(pinned.tier, provider);
      return {
        model: pinned.model,
        tier: pinned.tier,
        profile,
        confidence: 1,
        cached: false,
        deduped: false,
        sessionPinned: true,
        agenticOverride: false,
      };
    }
  }

  // 3. Classify the prompt
  const result = classifyByRules(text);
  let tier: Tier = result.tier;
  let agenticOverride = false;

  // 4. Agentic bump: if agentic score >= threshold, bump to at least COMPLEX
  if (result.agenticScore >= AGENTIC_THRESHOLD) {
    if (tier === "SIMPLE" || tier === "MEDIUM") {
      tier = "COMPLEX";
      agenticOverride = true;
      recordAgenticOverride();
    }
  }

  // 5. Select model from profile
  const model = selectModel(tier, profile);
  const { provider } = parseModelRef(model);

  // 6. Pin to session
  if (sessionKey) {
    pinSession(sessionKey, model, tier);
  }

  recordRequest(tier, provider);

  return {
    model,
    tier,
    profile,
    confidence: result.confidence,
    cached: false,
    deduped: false,
    sessionPinned: false,
    agenticOverride,
  };
}
