/**
 * Content Signal Detection Engine
 *
 * Scans tool args/result/meta for phenomenological patterns that indicate
 * emotional, uncertainty, identity, relational, and satisfaction content.
 * These signals drive both the phenomenological scoring factor and
 * the memory type classifier.
 */

import type { MeridiaToolResultContext } from "./types.js";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export type ContentSignalCategory = {
  detected: boolean;
  patterns: string[];
  keywords: string[];
  strength: number; // 0-1
};

export type SatisfactionSignalCategory = ContentSignalCategory & {
  valence: "positive" | "negative" | "mixed";
};

export type ContentSignals = {
  emotional: ContentSignalCategory;
  uncertainty: ContentSignalCategory;
  identity: ContentSignalCategory;
  relational: ContentSignalCategory;
  satisfaction: SatisfactionSignalCategory;
};

// ────────────────────────────────────────────────────────────────────────────
// Pattern Libraries
// ────────────────────────────────────────────────────────────────────────────

const EMOTIONAL_PATTERNS: RegExp[] = [
  /\bI feel\b/i,
  /\bthere'?s something like\b/i,
  /\b(?:hope|fear|frustration|excitement|joy|melancholy|anxiety|relief|dread|delight)\b/i,
  /\bfeeling (?:good|bad|great|terrible|overwhelmed|confident|uneasy)\b/i,
  /\bemotionally\b/i,
  /\bthis (?:hurts|excites|scares|worries|thrills)\b/i,
  /\b(?:happy|sad|angry|frustrated|excited|nervous|anxious|relieved|grateful)\b/i,
];

const UNCERTAINTY_PATTERNS: RegExp[] = [
  /\bI don'?t know (?:if|whether|what|how|why)\b/i,
  /\bI'?m (?:not sure|uncertain|unsure)\b/i,
  /\bI wonder\b/i,
  /\bmaybe (?:I should|we should|it'?s)\b/i,
  /\bnot sure (?:if|whether|what|how)\b/i,
  /\bhard to (?:tell|say|know)\b/i,
  /\buncertain(?:ty)?\b/i,
  /\bI'?m torn\b/i,
];

const IDENTITY_PATTERNS: RegExp[] = [
  /\bI am\b/i,
  /\bI value\b/i,
  /\bwho I am\b/i,
  /\bmy (?:name|identity|role|purpose) is\b/i,
  /\bI believe\b/i,
  /\bI identify as\b/i,
  /\bpart of (?:who|what) I\b/i,
  /\bcore (?:to|of) (?:my|who I)\b/i,
  /\bdefines me\b/i,
  /\bmy values\b/i,
];

const RELATIONAL_PATTERNS: RegExp[] = [
  /\bchanged how I see\b/i,
  /\bour (?:dynamic|relationship|collaboration|partnership)\b/i,
  /\btrust\b.*\b(?:collaboration|working together|partnership)\b/i,
  /\bbetween (?:us|you and me)\b/i,
  /\bhow we (?:work|relate|interact|communicate)\b/i,
  /\bour (?:conversation|exchange|interaction)\b/i,
  /\bwe'?ve (?:built|developed|established)\b/i,
];

const SATISFACTION_POSITIVE_PATTERNS: RegExp[] = [
  /\bfinally\b/i,
  /\bthis is working\b/i,
  /\bgot it\b/i,
  /\bbreakthrough\b/i,
  /\bsolved it\b/i,
  /\bsuccess(?:ful(?:ly)?)?\b/i,
  /\bexcellent\b/i,
  /\bperfect(?:ly)?\b/i,
];

const SATISFACTION_NEGATIVE_PATTERNS: RegExp[] = [
  /\bfrustrating\b/i,
  /\bI keep hitting\b/i,
  /\bstuck\b/i,
  /\bnot working\b/i,
  /\bkeeps? failing\b/i,
  /\bblocked\b/i,
  /\bimpossible\b/i,
  /\bgive up\b/i,
];

// ────────────────────────────────────────────────────────────────────────────
// Text Extraction
// ────────────────────────────────────────────────────────────────────────────

const MAX_ANALYSIS_CHARS = 4096;

function safeStringify(value: unknown, maxLen: number): string {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value === "string") {
    return value.slice(0, maxLen);
  }
  try {
    return JSON.stringify(value).slice(0, maxLen);
  } catch {
    // fallback for non-serializable objects
    return String(value as string).slice(0, maxLen);
  }
}

/**
 * Extract scannable text from a tool result context.
 * Combines args, result, and meta into a single string capped at ~4KB.
 */
export function extractTextForAnalysis(ctx: MeridiaToolResultContext): string {
  const parts: string[] = [];
  if (ctx.tool.meta) {
    parts.push(ctx.tool.meta);
  }
  if (ctx.args !== undefined) {
    parts.push(safeStringify(ctx.args, 1500));
  }
  if (ctx.result !== undefined) {
    parts.push(safeStringify(ctx.result, 2000));
  }
  const combined = parts.join(" ");
  return combined.slice(0, MAX_ANALYSIS_CHARS);
}

// ────────────────────────────────────────────────────────────────────────────
// Signal Detection
// ────────────────────────────────────────────────────────────────────────────

function detectCategory(text: string, patterns: RegExp[]): Omit<ContentSignalCategory, "strength"> {
  const matchedPatterns: string[] = [];
  const keywords: string[] = [];
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match) {
      matchedPatterns.push(pattern.source);
      keywords.push(match[0]);
    }
  }
  return {
    detected: matchedPatterns.length > 0,
    patterns: matchedPatterns,
    keywords,
  };
}

function computeCategoryStrength(
  detected: Omit<ContentSignalCategory, "strength">,
  totalPatterns: number,
  textLength: number,
): number {
  if (!detected.detected) {
    return 0;
  }
  // Density: ratio of matched patterns to total, boosted by keyword count
  const patternRatio = detected.patterns.length / totalPatterns;
  // Normalize by text length — shorter text with signals = higher density
  const lengthFactor = textLength > 0 ? Math.min(1, 500 / textLength) : 0;
  return Math.min(1, patternRatio * 0.7 + lengthFactor * 0.3);
}

/**
 * Run all pattern detectors on the given text and return content signals.
 */
export function detectContentSignals(text: string): ContentSignals {
  const textLen = text.length;

  const emotional = detectCategory(text, EMOTIONAL_PATTERNS);
  const uncertainty = detectCategory(text, UNCERTAINTY_PATTERNS);
  const identity = detectCategory(text, IDENTITY_PATTERNS);
  const relational = detectCategory(text, RELATIONAL_PATTERNS);
  const satisfactionPos = detectCategory(text, SATISFACTION_POSITIVE_PATTERNS);
  const satisfactionNeg = detectCategory(text, SATISFACTION_NEGATIVE_PATTERNS);

  // Merge satisfaction positive + negative
  const satisfactionDetected = satisfactionPos.detected || satisfactionNeg.detected;
  const satisfactionPatterns = [...satisfactionPos.patterns, ...satisfactionNeg.patterns];
  const satisfactionKeywords = [...satisfactionPos.keywords, ...satisfactionNeg.keywords];
  const valence: SatisfactionSignalCategory["valence"] =
    satisfactionPos.detected && satisfactionNeg.detected
      ? "mixed"
      : satisfactionPos.detected
        ? "positive"
        : "negative";

  const totalSatisfactionPatterns =
    SATISFACTION_POSITIVE_PATTERNS.length + SATISFACTION_NEGATIVE_PATTERNS.length;

  return {
    emotional: {
      ...emotional,
      strength: computeCategoryStrength(emotional, EMOTIONAL_PATTERNS.length, textLen),
    },
    uncertainty: {
      ...uncertainty,
      strength: computeCategoryStrength(uncertainty, UNCERTAINTY_PATTERNS.length, textLen),
    },
    identity: {
      ...identity,
      strength: computeCategoryStrength(identity, IDENTITY_PATTERNS.length, textLen),
    },
    relational: {
      ...relational,
      strength: computeCategoryStrength(relational, RELATIONAL_PATTERNS.length, textLen),
    },
    satisfaction: {
      detected: satisfactionDetected,
      patterns: satisfactionPatterns,
      keywords: satisfactionKeywords,
      strength: computeCategoryStrength(
        {
          detected: satisfactionDetected,
          patterns: satisfactionPatterns,
          keywords: satisfactionKeywords,
        },
        totalSatisfactionPatterns,
        textLen,
      ),
      valence,
    },
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Aggregate Signal Strength
// ────────────────────────────────────────────────────────────────────────────

/**
 * Compute an aggregate 0-1 signal strength across all categories.
 */
export function computeSignalStrength(signals: ContentSignals): number {
  const weights = {
    emotional: 0.3,
    uncertainty: 0.2,
    identity: 0.25,
    relational: 0.15,
    satisfaction: 0.1,
  };
  let total = 0;
  total += signals.emotional.strength * weights.emotional;
  total += signals.uncertainty.strength * weights.uncertainty;
  total += signals.identity.strength * weights.identity;
  total += signals.relational.strength * weights.relational;
  total += signals.satisfaction.strength * weights.satisfaction;
  return Math.min(1, total);
}
