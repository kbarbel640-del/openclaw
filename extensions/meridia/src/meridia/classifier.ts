/**
 * Memory Type Classifier
 *
 * Classifies captured memories into one of three types:
 * - factual: objective information, tool outputs, code facts
 * - experiential: subjective experience, emotional content, process learning
 * - identity: self-referential, values, identity-defining content
 *
 * Uses content signals + scoring breakdown to assign type.
 */

import type { ContentSignals } from "./content-signals.js";
import type { ScoringBreakdown } from "./scoring/types.js";
import type { MeridiaToolResultContext } from "./types.js";
import { computeSignalStrength } from "./content-signals.js";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export type MemoryType = "factual" | "experiential" | "identity";

export type MemoryClassification = {
  memoryType: MemoryType;
  confidence: number; // 0-1
  reasons: string[];
};

// ────────────────────────────────────────────────────────────────────────────
// Classification Logic
// ────────────────────────────────────────────────────────────────────────────

/**
 * Classify a captured memory into factual, experiential, or identity type.
 *
 * Priority order:
 * 1. Identity signals → "identity"
 * 2. Strong experiential signals (emotional + uncertainty + relational) → "experiential"
 * 3. Tool is experience_capture → "experiential"
 * 4. Kind is precompact or session_end → "experiential"
 * 5. Default → "factual"
 */
export function classifyMemoryType(params: {
  ctx: MeridiaToolResultContext;
  signals: ContentSignals;
  breakdown?: ScoringBreakdown;
  kind?: string;
}): MemoryClassification {
  const { ctx, signals, kind } = params;
  const reasons: string[] = [];

  // 1. Identity signals take highest priority
  if (signals.identity.detected) {
    reasons.push(`identity_patterns:${signals.identity.patterns.length}`);
    if (signals.identity.keywords.length > 0) {
      reasons.push(`keywords:${signals.identity.keywords.slice(0, 3).join(",")}`);
    }
    return {
      memoryType: "identity",
      confidence: 0.85,
      reasons,
    };
  }

  // 2. Strong experiential signal — either a high composite or a single strong category
  const experientialStrength = computeExperientialStrength(signals);
  if (experientialStrength > 0.2) {
    if (signals.emotional.detected) {
      reasons.push("emotional_content");
    }
    if (signals.uncertainty.detected) {
      reasons.push("uncertainty_content");
    }
    if (signals.relational.detected) {
      reasons.push("relational_content");
    }
    if (signals.satisfaction.detected) {
      reasons.push(`satisfaction:${signals.satisfaction.valence}`);
    }
    return {
      memoryType: "experiential",
      confidence: Math.min(0.95, 0.5 + experientialStrength * 0.5),
      reasons,
    };
  }

  // 3. Tool-based heuristic: experience_capture tool
  if (ctx.tool.name === "experience_capture") {
    reasons.push("experience_capture_tool");
    return {
      memoryType: "experiential",
      confidence: 0.7,
      reasons,
    };
  }

  // 4. Kind-based heuristic: precompact or session_end
  if (kind === "precompact" || kind === "session_end") {
    reasons.push(`kind:${kind}`);
    return {
      memoryType: "experiential",
      confidence: 0.6,
      reasons,
    };
  }

  // 5. Weak experiential signals (detected but below composite threshold)
  if (computeSignalStrength(signals) > 0.1) {
    if (signals.emotional.detected) {
      reasons.push("weak_emotional");
    }
    if (signals.uncertainty.detected) {
      reasons.push("weak_uncertainty");
    }
    reasons.push("below_experiential_threshold");
  }

  // Default: factual
  if (reasons.length === 0) {
    reasons.push("no_experiential_signals");
  }
  return {
    memoryType: "factual",
    confidence: 0.7,
    reasons,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

/**
 * Compute a composite experiential strength from emotional, uncertainty,
 * and relational signals — the three primary experiential indicators.
 */
function computeExperientialStrength(signals: ContentSignals): number {
  const emotionalWeight = 0.4;
  const uncertaintyWeight = 0.3;
  const relationalWeight = 0.3;
  return (
    signals.emotional.strength * emotionalWeight +
    signals.uncertainty.strength * uncertaintyWeight +
    signals.relational.strength * relationalWeight
  );
}
