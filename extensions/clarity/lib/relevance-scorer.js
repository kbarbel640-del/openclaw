/**
 * RelevanceScorer — Dynamic relevance scoring for context items.
 *
 * Implements a multi-factor scoring algorithm:
 * - Recency: Items mentioned in last N turns get bonus
 * - Frequency: Items mentioned M times get boost
 * - Utility: Items actually referenced in responses are preserved
 * - Staleness: Exponential decay for unused items (half-life ~5 turns)
 *
 * Score formula:
 *   baseScore = log2(frequency + 1) * 10
 *   recencyBonus = recencyDecay ^ (turnsSinceLastMention) * maxRecencyBonus
 *   utilityBonus = referencesInResponses * referenceWeight
 *   stalenessPenalty = stalenessDecay ^ (turnsSinceLastMention - recencyWindow)
 *   finalScore = baseScore + recencyBonus + utilityBonus - stalenessPenalty
 */

"use strict";

class RelevanceScorer {
  /**
   * @param {object} config - Configuration options
   * @param {number} config.halfLife - Half-life in turns for exponential decay (default: 5)
   * @param {number} config.recencyWindow - Turns considered "recent" (default: 3)
   * @param {number} config.recencyBonus - Max bonus for recent mentions (default: 20)
   * @param {number} config.referenceWeight - Points per actual reference in response (default: 15)
   * @param {number} config.frequencyScale - Scaling factor for frequency (default: 10)
   * @param {number} config.anchorBonus - Bonus for anchored items (default: 100)
   */
  constructor(config = {}) {
    this.halfLife = config.halfLife || 5;
    this.recencyWindow = config.recencyWindow || 3;
    this.recencyBonus = config.recencyBonus || 20;
    this.referenceWeight = config.referenceWeight || 15;
    this.frequencyScale = config.frequencyScale || 10;
    this.anchorBonus = config.anchorBonus || 100;

    // Pre-calculate decay factor: 0.5^(1/halfLife)
    this.decayFactor = Math.pow(0.5, 1 / this.halfLife);
  }

  /**
   * Calculate relevance score for a context item.
   *
   * @param {object} item - The context item to score
   * @param {string} item.id - Unique identifier
   * @param {number} item.mentionCount - Total times mentioned
   * @param {number} item.lastMentionTurn - Last turn this item was mentioned
   * @param {number} item.referenceCount - Times actually referenced in responses
   * @param {boolean} item.anchored - Whether user explicitly marked as important
   * @param {number} currentTurn - Current turn number
   * @returns {object} Score breakdown and final score
   */
  calculateScore(item, currentTurn) {
    const {
      id,
      mentionCount = 0,
      lastMentionTurn = 0,
      referenceCount = 0,
      anchored = false,
    } = item;

    const turnsSinceLastMention = Math.max(0, currentTurn - lastMentionTurn);

    // Base score from frequency (logarithmic scale to prevent spam dominance)
    const frequencyScore = Math.log2(mentionCount + 1) * this.frequencyScale;

    // Recency bonus (linear decay within window, then 0)
    let recencyScore = 0;
    if (turnsSinceLastMention <= this.recencyWindow) {
      const recencyDecay = 1 - turnsSinceLastMention / (this.recencyWindow + 1);
      recencyScore = recencyDecay * this.recencyBonus;
    }

    // Utility score from actual references in responses
    const utilityScore = referenceCount * this.referenceWeight;

    // Staleness penalty (exponential decay after recency window)
    let stalenessPenalty = 0;
    if (turnsSinceLastMention > this.recencyWindow) {
      const turnsStale = turnsSinceLastMention - this.recencyWindow;
      const decayMultiplier = Math.pow(this.decayFactor, turnsStale);
      // Penalty grows as item becomes staler
      stalenessPenalty = (1 - decayMultiplier) * frequencyScore;
    }

    // Anchor bonus (user explicitly marked important)
    const anchorScore = anchored ? this.anchorBonus : 0;

    // Calculate final score
    const finalScore =
      frequencyScore + recencyScore + utilityScore - stalenessPenalty + anchorScore;

    return {
      id,
      finalScore: Math.max(0, finalScore), // Scores can't go negative
      breakdown: {
        frequency: Math.round(frequencyScore * 10) / 10,
        recency: Math.round(recencyScore * 10) / 10,
        utility: Math.round(utilityScore * 10) / 10,
        stalenessPenalty: Math.round(stalenessPenalty * 10) / 10,
        anchor: anchorScore,
      },
      metadata: {
        mentionCount,
        lastMentionTurn,
        turnsSinceLastMention,
        referenceCount,
        anchored,
      },
    };
  }

  /**
   * Score multiple items at once and return sorted results.
   *
   * @param {Array<object>} items - Array of context items
   * @param {number} currentTurn - Current turn number
   * @returns {Array<object>} Items sorted by score descending, with score details
   */
  scoreItems(items, currentTurn) {
    const scored = items.map((item) => this.calculateScore(item, currentTurn));
    return scored.sort((a, b) => b.finalScore - a.finalScore);
  }

  /**
   * Calculate decay multiplier for a given age in turns.
   * Useful for external systems to understand item freshness.
   *
   * @param {number} turnsAgo - How many turns ago was this item active
   * @returns {number} Decay multiplier (1.0 = fresh, 0.0 = ancient)
   */
  getDecayMultiplier(turnsAgo) {
    return Math.pow(this.decayFactor, turnsAgo);
  }

  /**
   * Determine if an item should be pruned based on score threshold.
   *
   * @param {object} item - Context item
   * @param {number} currentTurn - Current turn
   * @param {number} threshold - Minimum score to keep (default: 5)
   * @returns {boolean} True if item should be pruned
   */
  shouldPrune(item, currentTurn, threshold = 5) {
    const score = this.calculateScore(item, currentTurn);
    return score.finalScore < threshold;
  }

  /**
   * Get scoring configuration for inspection/debugging.
   *
   * @returns {object} Current configuration
   */
  getConfig() {
    return {
      halfLife: this.halfLife,
      recencyWindow: this.recencyWindow,
      recencyBonus: this.recencyBonus,
      referenceWeight: this.referenceWeight,
      frequencyScale: this.frequencyScale,
      anchorBonus: this.anchorBonus,
      decayFactor: Math.round(this.decayFactor * 10000) / 10000,
    };
  }
}

module.exports = RelevanceScorer;
