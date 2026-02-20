/**
 * weights.js - Tunable weights and thresholds for TF-IDF scoring
 *
 * Based on Clarity v2 Design Doc - Section 4
 * Anchor bonus reduced to 5 (was 100) to prevent anchor dominance
 */

/**
 * Scoring weights for entity relevance calculation.
 * All weights are tunable and should sum to a reasonable range.
 * Maximum possible score is capped at 100.
 */
const WEIGHTS = {
  /** Term frequency weight (0-30 range with log scaling) */
  tf: 15,

  /** Inverse document frequency weight (0-50 range, rare terms get boost) */
  idf: 25,

  /** Recency weight (0-30 range, most recent = max) */
  recency: 30,

  /** Relationship strength weight (0-10 range) */
  relationship: 10,
};

/**
 * Fixed bonus for anchored entities.
 * Reduced from 100 to 5 to prevent anchors from drowning out relevant non-anchored items.
 */
const ANCHOR_BONUS = 5;

/**
 * Score thresholds for entity display and tracking decisions.
 */
const THRESHOLDS = {
  /** Minimum score to display in [CLARITY CONTEXT] */
  display: 20,

  /** High relevance marker threshold (● in output) */
  highRelevance: 40,

  /** Medium relevance marker threshold (○ in output) */
  mediumRelevance: 25,

  /** Minimum score to track entity at all */
  track: 10,
};

/**
 * Recency calculation parameters
 */
const RECENCY = {
  /** Half-life in turns (score halves every N turns) */
  halfLife: 5,

  /** Maximum recency score (at turn of mention) */
  maxScore: 1.0,
};

/**
 * Term frequency parameters
 */
const TERM_FREQUENCY = {
  /** Number of recent turns to consider for TF calculation */
  recentWindow: 10,

  /** Log base for TF scaling (using natural log: Math.log) */
  logBase: Math.E,
};

/**
 * Relationship boost parameters
 */
const RELATIONSHIP = {
  /** Multiplier for average relationship strength (0-1 → 0-10 boost) */
  strengthMultiplier: 10,

  /** Minimum relationships to consider for boost */
  minRelationships: 1,
};

/**
 * Document frequency tracking defaults
 */
const DOCUMENT_FREQUENCY = {
  /** Default document frequency for unseen terms */
  defaultDocFreq: 1,

  /** Minimum total documents before IDF is meaningful */
  minDocuments: 1,
};

module.exports = {
  WEIGHTS,
  ANCHOR_BONUS,
  THRESHOLDS,
  RECENCY,
  TERM_FREQUENCY,
  RELATIONSHIP,
  DOCUMENT_FREQUENCY,
};
