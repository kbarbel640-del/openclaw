/**
 * RelevancePruner — Intelligent context pruning based on relevance scores.
 *
 * Replaces static priority rules with dynamic relevance-based decisions.
 * Integrates with Clarity's strict mode to preserve critical context.
 *
 * Features:
 * - Score-based pruning decisions
 * - Strict mode compatibility (preserves ESSENTIAL tier)
 * - Budget-aware pruning (token limit compliance)
 * - Preserve anchored items regardless of score
 */

"use strict";

class RelevancePruner {
  /**
   * @param {object} options
   * @param {ContextTracker} options.tracker - ContextTracker instance
   * @param {object} options.config - Pruning configuration
   */
  constructor(options = {}) {
    this.tracker = options.tracker;
    this.config = {
      // Score below which items are pruned
      pruneThreshold: options.pruneThreshold || 8,

      // Strict mode: never prune items above this score
      strictModePreserveThreshold: options.strictModePreserveThreshold || 25,

      // Maximum items to keep per category
      maxItemsPerCategory: options.maxItemsPerCategory || 20,

      // Budget targets
      targetContextItems: options.targetContextItems || 30,
      maxContextItems: options.maxContextItems || 50,

      // Tier multipliers (in strict mode, preserve more from higher tiers)
      tierMultipliers: options.tierMultipliers || {
        essential: 2.0,
        high: 1.5,
        normal: 1.0,
        low: 0.8,
      },

      // Whether to apply tier multipliers
      useTierMultipliers: options.useTierMultipliers !== false,

      // Minimum mentions to avoid pruning (even with low score)
      minMentionsPreserve: options.minMentionsPreserve || 3,

      ...options.config,
    };
  }

  /**
   * Evaluate what should be pruned given current state.
   *
   * @param {object} options
   * @param {boolean} options.strictMode - Whether strict mode is enabled
   * @param {number} options.currentItemCount - Current number of context items
   * @param {Array} options.existingContext - Current context items with tiers
   * @returns {object} Pruning decisions
   */
  evaluate(options = {}) {
    const { strictMode = false, currentItemCount = 0, existingContext = [] } = options;

    // Get all scored items from tracker
    const scoredItems = this.tracker.getScoredItems();

    // Map existing context items by ID
    const contextMap = new Map();
    for (const ctx of existingContext) {
      if (ctx.id) {
        contextMap.set(ctx.id, ctx);
      }
    }

    // Merge tracker scores with existing context
    const merged = scoredItems.map((scored) => {
      const existing = contextMap.get(scored.id);
      return {
        ...scored,
        tier: existing?.tier || "normal",
        content: existing?.content || null,
        category: this._categorizeItem(scored.id),
      };
    });

    // Add items from existing context that tracker doesn't know about
    const trackerIds = new Set(scoredItems.map((s) => s.id));
    for (const ctx of existingContext) {
      if (ctx.id && !trackerIds.has(ctx.id)) {
        // Create a basic score for untracked items
        merged.push({
          id: ctx.id,
          finalScore: 10, // Neutral default score
          tier: ctx.tier || "normal",
          content: ctx.content,
          category: this._categorizeItem(ctx.id),
          metadata: { mentionCount: 0, anchored: false },
        });
      }
    }

    // Apply tier multipliers if enabled
    if (this.config.useTierMultipliers) {
      for (const item of merged) {
        const multiplier = this.config.tierMultipliers[item.tier] || 1.0;
        item.adjustedScore = item.finalScore * multiplier;
      }
    } else {
      for (const item of merged) {
        item.adjustedScore = item.finalScore;
      }
    }

    // Sort by adjusted score
    merged.sort((a, b) => b.adjustedScore - a.adjustedScore);

    // Determine what to keep vs prune
    const keep = [];
    const prune = [];
    const categoryCounts = new Map();

    for (const item of merged) {
      const category = item.category;
      const currentCount = categoryCounts.get(category) || 0;

      // Decision logic
      let shouldKeep = false;

      // Always keep anchored items
      if (item.metadata?.anchored) {
        shouldKeep = true;
      }
      // Strict mode: preserve high-scoring items
      else if (strictMode && item.adjustedScore >= this.config.strictModePreserveThreshold) {
        shouldKeep = true;
      }
      // Keep items with minimum mentions (frequently discussed)
      else if (item.metadata?.mentionCount >= this.config.minMentionsPreserve) {
        shouldKeep = true;
      }
      // ESSENTIAL tier always kept in strict mode
      else if (strictMode && item.tier === "essential") {
        shouldKeep = true;
      }
      // Category limit check
      else if (currentCount >= this.config.maxItemsPerCategory) {
        shouldKeep = false;
      }
      // Score-based decision
      else if (item.adjustedScore >= this.config.pruneThreshold) {
        shouldKeep = true;
      }
      // Budget-based: keep if under target
      else if (keep.length < this.config.targetContextItems) {
        shouldKeep = true;
      }

      if (shouldKeep) {
        keep.push(item);
        categoryCounts.set(category, currentCount + 1);
      } else {
        prune.push(item);
      }
    }

    // Enforce max items hard limit
    const finalKeep = keep.slice(0, this.config.maxContextItems);
    const finalPrune = [...prune, ...keep.slice(this.config.maxContextItems)];

    return {
      keep: finalKeep,
      prune: finalPrune,
      stats: {
        totalEvaluated: merged.length,
        keeping: finalKeep.length,
        pruning: finalPrune.length,
        anchoredKept: finalKeep.filter((i) => i.metadata?.anchored).length,
        byCategory: Object.fromEntries(categoryCounts),
        averageKeptScore:
          finalKeep.length > 0
            ? finalKeep.reduce((s, i) => s + i.adjustedScore, 0) / finalKeep.length
            : 0,
      },
    };
  }

  /**
   * Perform pruning and update tracker state.
   *
   * @param {object} options
   * @returns {object} Pruning results
   */
  prune(options = {}) {
    const evaluation = this.evaluate(options);

    // Remove pruned items from tracker
    for (const item of evaluation.prune) {
      // Don't actually delete from tracker, just mark as pruned
      // This preserves history if item is mentioned again
      const trackerItem = this.tracker.getItem(item.id);
      if (trackerItem) {
        trackerItem.prunedAt = this.tracker._currentTurn;
        trackerItem.pruned = true;
      }
    }

    return {
      ...evaluation,
      prunedIds: evaluation.prune.map((i) => i.id),
    };
  }

  /**
   * Get recommended priority tier for a context item.
   *
   * @param {string} itemId - Item to evaluate
   * @returns {string} Recommended tier (essential, high, normal, low)
   */
  recommendTier(itemId) {
    const item = this.tracker.getItem(itemId);
    if (!item) return "normal";

    const score = this.tracker.scorer.calculateScore(item, this.tracker._currentTurn);

    if (item.anchored || score.finalScore >= 50) return "essential";
    if (score.finalScore >= 30) return "high";
    if (score.finalScore >= 15) return "normal";
    return "low";
  }

  /**
   * Categorize an item by its ID prefix.
   * @private
   */
  _categorizeItem(itemId) {
    if (!itemId) return "other";
    if (itemId.startsWith("project:") || itemId.includes("_")) return "project";
    if (itemId.startsWith("tool:")) return "tool";
    if (itemId.startsWith("file:") || itemId.endsWith(".md")) return "file";
    if (itemId.startsWith("keyword:")) return "topic";
    return "other";
  }

  /**
   * Get pruning configuration for inspection.
   *
   * @returns {object} Current configuration
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Update pruning configuration.
   *
   * @param {object} updates - Configuration updates
   */
  updateConfig(updates) {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Format pruning report for display.
   *
   * @param {object} pruningResult - Result from evaluate() or prune()
   * @returns {string} Formatted report
   */
  formatReport(pruningResult) {
    const lines = [
      "[CLARITY PRUNING REPORT]",
      `Evaluated: ${pruningResult.stats.totalEvaluated} items`,
      `Keeping: ${pruningResult.stats.keeping} items`,
      `Pruning: ${pruningResult.stats.pruning} items`,
      `Anchored preserved: ${pruningResult.stats.anchoredKept}`,
      `Average kept score: ${Math.round(pruningResult.stats.averageKeptScore * 10) / 10}`,
      "",
    ];

    if (pruningResult.keep.length > 0) {
      lines.push("Top kept items:");
      for (const item of pruningResult.keep.slice(0, 10)) {
        const anchorMark = item.metadata?.anchored ? "⚓ " : "";
        lines.push(`  ${anchorMark}${item.id}: ${Math.round(item.adjustedScore * 10) / 10}`);
      }
      if (pruningResult.keep.length > 10) {
        lines.push(`  ... and ${pruningResult.keep.length - 10} more`);
      }
    }

    return lines.join("\n");
  }
}

module.exports = RelevancePruner;
