import type { DimensionScores, ScoringResult, Tier } from "./types.js";
import {
  AGENTIC_KEYWORDS,
  CODE_KEYWORDS,
  CONFIDENCE_PARAMS,
  CONSTRAINT_MARKERS,
  CREATIVE_KEYWORDS,
  DIMENSION_WEIGHTS,
  DOMAIN_KEYWORDS,
  IMPERATIVE_KEYWORDS,
  MULTI_STEP_KEYWORDS,
  NEGATION_MARKERS,
  OUTPUT_FORMAT_MARKERS,
  REASONING_KEYWORDS,
  REFERENCE_MARKERS,
  SIMPLE_KEYWORDS,
  TECHNICAL_KEYWORDS,
  TIER_BOUNDARIES,
} from "./config.js";

// ---------------------------------------------------------------------------
// Utility: count keyword matches in text (case-insensitive)
// ---------------------------------------------------------------------------

function countMatches(text: string, keywords: readonly string[]): number {
  let count = 0;
  for (const kw of keywords) {
    if (text.includes(kw)) {
      count++;
    }
  }
  return count;
}

// Clamp a value to [0, 1]
function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

// ---------------------------------------------------------------------------
// Individual dimension scoring functions (each returns 0-1)
// ---------------------------------------------------------------------------

export function scoreTokenCount(text: string): number {
  const words = text.split(/\s+/).length;
  if (words <= 5) {
    return 0;
  }
  if (words <= 20) {
    return 0.2;
  }
  if (words <= 50) {
    return 0.4;
  }
  if (words <= 150) {
    return 0.6;
  }
  if (words <= 500) {
    return 0.8;
  }
  return 1.0;
}

export function scoreCodePresence(text: string): number {
  const lower = text.toLowerCase();
  const matches = countMatches(lower, CODE_KEYWORDS);
  const hasCodeBlock = text.includes("```");
  const hasInlineCode = /`[^`]+`/.test(text);
  const codeScore = clamp01(matches / 5);
  const blockBonus = hasCodeBlock ? 0.3 : hasInlineCode ? 0.1 : 0;
  return clamp01(codeScore + blockBonus);
}

export function scoreReasoningMarkers(text: string): number {
  const lower = text.toLowerCase();
  const matches = countMatches(lower, REASONING_KEYWORDS);
  return clamp01(matches / 4);
}

export function scoreTechnicalTerms(text: string): number {
  const lower = text.toLowerCase();
  const matches = countMatches(lower, TECHNICAL_KEYWORDS);
  return clamp01(matches / 4);
}

export function scoreCreativeMarkers(text: string): number {
  const lower = text.toLowerCase();
  const matches = countMatches(lower, CREATIVE_KEYWORDS);
  return clamp01(matches / 3);
}

export function scoreSimpleIndicators(text: string): number {
  const lower = text.toLowerCase().trim();
  const words = lower.split(/\s+/).length;

  // Very short messages with simple keywords get high simple scores
  if (words <= 3) {
    const matches = countMatches(lower, SIMPLE_KEYWORDS);
    if (matches > 0) {
      return 1.0;
    }
    return 0.7; // Short but not a known greeting
  }
  if (words <= 8) {
    const matches = countMatches(lower, SIMPLE_KEYWORDS);
    return matches > 0 ? 0.6 : 0.3;
  }
  return 0;
}

export function scoreMultiStepPatterns(text: string): number {
  const lower = text.toLowerCase();
  const matches = countMatches(lower, MULTI_STEP_KEYWORDS);
  // Numbered lists are a strong signal
  const numberedItems = (text.match(/^\s*\d+[.)]/gm) ?? []).length;
  return clamp01(matches / 3 + numberedItems / 4);
}

export function scoreQuestionComplexity(text: string): number {
  const questions = (text.match(/\?/g) ?? []).length;
  const lower = text.toLowerCase();
  const hasWhyHow = /\b(why|how)\b/.test(lower);
  const hasWhatIf = /what (would|if|happens)/.test(lower);
  let score = clamp01(questions / 3);
  if (hasWhyHow) {
    score = clamp01(score + 0.3);
  }
  if (hasWhatIf) {
    score = clamp01(score + 0.2);
  }
  return score;
}

export function scoreImperativeVerbs(text: string): number {
  const lower = text.toLowerCase();
  const matches = countMatches(lower, IMPERATIVE_KEYWORDS);
  return clamp01(matches / 4);
}

export function scoreConstraintCount(text: string): number {
  const lower = text.toLowerCase();
  const matches = countMatches(lower, CONSTRAINT_MARKERS);
  return clamp01(matches / 4);
}

export function scoreOutputFormat(text: string): number {
  const lower = text.toLowerCase();
  const matches = countMatches(lower, OUTPUT_FORMAT_MARKERS);
  return clamp01(matches / 2);
}

export function scoreReferenceComplexity(text: string): number {
  const lower = text.toLowerCase();
  const matches = countMatches(lower, REFERENCE_MARKERS);
  // URLs and file paths add complexity
  const urlCount = (text.match(/https?:\/\/\S+/g) ?? []).length;
  const pathCount = (text.match(/[./]\w+\/\w+/g) ?? []).length;
  return clamp01(matches / 3 + (urlCount + pathCount) / 4);
}

export function scoreNegationComplexity(text: string): number {
  const lower = text.toLowerCase();
  const matches = countMatches(lower, NEGATION_MARKERS);
  // Double negation is more complex
  const doubleNeg = (lower.match(/not\s+\w+\s+not/g) ?? []).length;
  return clamp01(matches / 5 + doubleNeg * 0.3);
}

export function scoreDomainSpecificity(text: string): number {
  const lower = text.toLowerCase();
  const matches = countMatches(lower, DOMAIN_KEYWORDS);
  return clamp01(matches / 3);
}

export function scoreAgenticTask(text: string): number {
  const lower = text.toLowerCase();
  const matches = countMatches(lower, AGENTIC_KEYWORDS);
  if (matches >= 4) {
    return 1.0;
  }
  if (matches === 3) {
    return 0.6;
  }
  if (matches >= 1) {
    return 0.2;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Sigmoid confidence calibration
// ---------------------------------------------------------------------------

export function calibrateConfidence(rawScore: number): number {
  const { steepness, threshold } = CONFIDENCE_PARAMS;
  return 1 / (1 + Math.exp(-steepness * (rawScore - threshold)));
}

// ---------------------------------------------------------------------------
// Tier classification from raw score
// ---------------------------------------------------------------------------

function scoresToTier(rawScore: number): Tier {
  if (rawScore >= TIER_BOUNDARIES.complexReasoning) {
    return "REASONING";
  }
  if (rawScore >= TIER_BOUNDARIES.mediumComplex) {
    return "COMPLEX";
  }
  if (rawScore > TIER_BOUNDARIES.simpleMedium) {
    return "MEDIUM";
  }
  return "SIMPLE";
}

// ---------------------------------------------------------------------------
// Main classifier: 14-dimension weighted scoring
// ---------------------------------------------------------------------------

export function classifyByRules(text: string): ScoringResult {
  const scores: DimensionScores = {
    tokenCount: scoreTokenCount(text),
    codePresence: scoreCodePresence(text),
    reasoningMarkers: scoreReasoningMarkers(text),
    technicalTerms: scoreTechnicalTerms(text),
    creativeMarkers: scoreCreativeMarkers(text),
    simpleIndicators: scoreSimpleIndicators(text),
    multiStepPatterns: scoreMultiStepPatterns(text),
    questionComplexity: scoreQuestionComplexity(text),
    imperativeVerbs: scoreImperativeVerbs(text),
    constraintCount: scoreConstraintCount(text),
    outputFormat: scoreOutputFormat(text),
    referenceComplexity: scoreReferenceComplexity(text),
    negationComplexity: scoreNegationComplexity(text),
    domainSpecificity: scoreDomainSpecificity(text),
    agenticTask: scoreAgenticTask(text),
  };

  // Simple indicators are inverse-weighted: high simple score suppresses total
  const simpleSuppress = scores.simpleIndicators > 0.5 ? 0.5 : 1.0;

  let rawScore = 0;
  for (const [dim, weight] of Object.entries(DIMENSION_WEIGHTS)) {
    const key = dim as keyof DimensionScores;
    if (key === "simpleIndicators") {
      continue; // handled via suppression
    }
    rawScore += scores[key] * weight * simpleSuppress;
  }

  const agenticScore = scores.agenticTask;
  const tier = scoresToTier(rawScore);
  const confidence = calibrateConfidence(rawScore);

  return {
    tier,
    confidence,
    rawScore,
    scores,
    agenticScore,
    isAgentic: agenticScore >= 0.6,
  };
}
