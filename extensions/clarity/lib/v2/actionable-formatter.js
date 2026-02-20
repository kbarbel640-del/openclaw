/**
 * ActionableFormatter — Actionable context entries for Clarity v2
 *
 * For every entity, answers:
 * 1. What is useful about this information?
 * 2. How could it be more useful?
 *
 * New format includes:
 * - WHY it matters: "mentioned 3× in last 5 turns" or "referenced in your last response"
 * - WHAT you can do: suggestions like "/anchor clarity" or "see also: subagents"
 * - CONTEXT: brief snippet of how it was used
 * - URGENCY: "active" / "trending" / "background"
 *
 * Example output:
 *   ● plugin:clarity (active) — mentioned 3×, last: "deploy clarity plugin"
 *     → /anchor clarity | see also: subagents, tests
 *     Uses: entity extraction for context headers
 *
 * @module actionable-formatter
 */

"use strict";

// Define constants locally to avoid circular dependency with integration.js
const RELATIONSHIP_TYPES = {
  USES: "uses",
  CONTAINS: "contains",
  RELATED: "related",
  DEPENDS_ON: "depends_on",
  IMPLEMENTS: "implements",
};

const THRESHOLDS = {
  display: 20,
  highRelevance: 40,
  mediumRelevance: 25,
  track: 10,
};

/**
 * Urgency levels for context display
 */
const URGENCY = {
  ACTIVE: "active", // Mentioned in last 2 turns or multiple recent mentions
  TRENDING: "trending", // Mentioned 2+ times recently, building momentum
  BACKGROUND: "background", // Mentioned earlier, still relevant but not hot
};

/**
 * Action suggestions by entity type
 */
const ACTION_SUGGESTIONS = {
  plugin: {
    primary: ["/anchor", "/configure", "/docs"],
    related: (entity, related) =>
      related.slice(0, 2).map((r) => r.replace(/^(plugin|tool|project):/, "")),
  },
  tool: {
    primary: ["/help", "/usage"],
    related: (entity, related) =>
      related.slice(0, 2).map((r) => r.replace(/^(plugin|tool|project):/, "")),
  },
  project: {
    primary: ["/status", "/issues"],
    related: (entity, related) =>
      related.slice(0, 2).map((r) => r.replace(/^(plugin|tool|project):/, "")),
  },
  file: {
    primary: ["/open", "/edit"],
    related: (entity, related) =>
      ["memory", "docs"].filter((r) => related.some((rel) => rel.includes(r))),
  },
  person: {
    primary: ["/profile", "/contact"],
    related: () => [],
  },
  topic: {
    primary: ["/explore", "/search"],
    related: (entity, related) => related.slice(0, 2),
  },
  decision: {
    primary: ["/review", "/revert"],
    related: () => [],
  },
};

/**
 * Context snippet patterns for different entity types
 */
const CONTEXT_PATTERNS = {
  plugin: ["plugin", "extension", "module", "integration"],
  tool: ["tool", "function", "call", "invoke"],
  project: ["project", "repo", "codebase", "work"],
  file: ["file", "document", "config", "readme"],
  person: ["with", "from", "to", "by"],
  topic: ["about", "regarding", "on", "concerning"],
  decision: ["decided", "chosen", "opted", "will use"],
};

class ActionableFormatter {
  constructor(options = {}) {
    this.maxEntities = options.maxEntities || 8;
    this.maxLineLength = options.maxLineLength || 100;
    this.showRelated = options.showRelated !== false;
    this.currentTurn = options.currentTurn || 0;
    this.recentWindow = options.recentWindow || 5;
  }

  /**
   * Main entry: format entities into actionable context output
   *
   * @param {Entity[]} entities - Array of scored entities
   * @returns {string} Formatted context block
   */
  formatActionableContext(entities) {
    if (!entities || entities.length === 0) {
      return "[CLARITY CONTEXT]\n  No tracked entities";
    }

    // Sort by total score descending
    const sortedEntities = [...entities].sort((a, b) => b.totalScore - a.totalScore);

    // Filter to top entities meeting display threshold, or just top few
    const displayEntities = sortedEntities
      .filter((e) => e.totalScore >= THRESHOLDS.display)
      .slice(0, this.maxEntities);

    const finalEntities = displayEntities.length > 0 ? displayEntities : sortedEntities.slice(0, 5);

    const lines = ["[CLARITY CONTEXT]"];

    for (const entity of finalEntities) {
      const formatted = this.formatActionableEntity(entity);
      lines.push(formatted);
    }

    return lines.join("\n");
  }

  /**
   * Format a single entity with actionable information
   * Max 2 lines per entity
   *
   * @param {Entity} entity - The entity to format
   * @returns {string} Formatted entity (1-2 lines)
   */
  formatActionableEntity(entity) {
    const urgency = this.generateUrgencyIndicator(entity);
    const why = this.generateWhyItMatters(entity);
    const what = this.generateWhatYouCanDo(entity);
    const context = this.generateContextSnippet(entity);

    // Line 1: Indicator + entity ID + urgency + why it matters
    const indicator = entity.isAnchor
      ? "★"
      : entity.totalScore >= THRESHOLDS.highRelevance
        ? "●"
        : "○";
    const line1 = `  ${indicator} ${entity.id} (${urgency}) — ${why}`;

    // Line 2: Actions + context snippet (if space permits)
    let line2 = `    → ${what}`;
    if (context && line1.length + line2.length + context.length < this.maxLineLength * 2) {
      line2 += `\n    Uses: ${context}`;
    } else if (context) {
      // Try to fit context on same line truncated
      const remainingSpace = this.maxLineLength - line2.length - 8;
      if (remainingSpace > 20) {
        line2 += ` | ${context.slice(0, remainingSpace)}${context.length > remainingSpace ? "..." : ""}`;
      }
    }

    return line2.includes("\n") ? `${line1}\n${line2}` : `${line1}\n${line2}`;
  }

  /**
   * Generate WHY it matters — reason for relevance
   * Examples:
   * - "mentioned 3× in last 5 turns"
   * - "referenced in your last response"
   * - "anchor — tracking since turn 12"
   *
   * @param {Entity} entity - The entity
   * @returns {string} Why it matters description
   */
  generateWhyItMatters(entity) {
    const parts = [];

    // Mention count in recent window
    const recentMentions = this.getRecentMentions(entity, this.recentWindow);
    if (recentMentions > 0) {
      parts.push(`mentioned ${recentMentions}× in last ${this.recentWindow} turns`);
    } else if (entity.mentionCount > 0) {
      parts.push(`mentioned ${entity.mentionCount}× total`);
    }

    // Last mention context
    const lastContext = this.getLastMentionContext(entity);
    if (lastContext) {
      parts.push(`last: "${lastContext}"`);
    }

    // Anchor status
    if (entity.isAnchor) {
      parts.push(`anchor — tracking since turn ${entity.firstMentionTurn}`);
    }

    // Relationship richness
    if (entity.relationships && entity.relationships.length > 2) {
      parts.push(`linked to ${entity.relationships.length} entities`);
    }

    return parts.length > 0 ? parts.join(", ") : "tracked entity";
  }

  /**
   * Generate WHAT you can do — actionable suggestions
   * Examples:
   * - "/anchor clarity | see also: subagents, tests"
   * - "/help subagents | related: sessions_spawn, orchestrator"
   *
   * @param {Entity} entity - The entity
   * @returns {string} Action suggestions
   */
  generateWhatYouCanDo(entity) {
    const type = entity.type || this.inferEntityType(entity.id);
    const suggestions = ACTION_SUGGESTIONS[type] || ACTION_SUGGESTIONS.topic;

    const actions = [];

    // Primary actions
    const shortName = this.getShortName(entity.id);
    for (const action of suggestions.primary) {
      actions.push(`${action} ${shortName}`);
    }

    // Related entities suggestions
    if (this.showRelated && entity.relationships) {
      const relatedIds = entity.relationships
        .sort((a, b) => b.strength - a.strength)
        .slice(0, 3)
        .map((r) => r.targetId);

      const relatedShort = suggestions.related(entity, relatedIds);
      if (relatedShort.length > 0) {
        actions.push(`see also: ${relatedShort.join(", ")}`);
      }
    }

    return actions.join(" | ");
  }

  /**
   * Generate CONTEXT snippet — brief usage context
   * Shows how the entity was actually used in conversation
   *
   * @param {Entity} entity - The entity
   * @returns {string} One-sentence context snippet
   */
  generateContextSnippet(entity) {
    // Use stored contexts if available
    if (entity.contexts && entity.contexts.length > 0) {
      const bestContext =
        entity.contexts.find(
          (c) => c && c.length > 10 && c.toLowerCase().includes(entity.normalized),
        ) || entity.contexts[0];

      if (bestContext) {
        return this.truncateSentence(bestContext, 60);
      }
    }

    // Generate from mention history
    const type = entity.type || this.inferEntityType(entity.id);
    const patterns = CONTEXT_PATTERNS[type] || [];

    // Default context based on entity type and relationships
    if (entity.relationships && entity.relationships.length > 0) {
      const topRel = entity.relationships.sort((a, b) => b.strength - a.strength)[0];
      const relType = this.getRelationshipVerb(topRel.type);
      const targetName = this.getShortName(topRel.targetId);
      return `${entity.normalized} ${relType} ${targetName}`;
    }

    // Fallback: entity type description
    const typeDescriptions = {
      plugin: "extension for OpenClaw",
      tool: "available tool/function",
      project: "active project/workspace",
      file: "referenced document",
      person: "conversation participant",
      topic: "discussed subject",
      decision: "recorded decision",
    };

    return typeDescriptions[type] || "tracked context item";
  }

  /**
   * Generate URGENCY indicator — how hot is this entity right now?
   * - "active" — mentioned in last 2 turns OR 3+ mentions in recent window
   * - "trending" — mentioned 2+ times recently, building momentum
   * - "background" — mentioned earlier, still relevant but cooling
   *
   * @param {Entity} entity - The entity
   * @returns {string} Urgency level
   */
  generateUrgencyIndicator(entity) {
    const turnsAgo = this.currentTurn - entity.lastMentionTurn;
    const recentMentions = this.getRecentMentions(entity, this.recentWindow);

    // Active: very recent or heavily mentioned
    if (turnsAgo <= 2 || recentMentions >= 3) {
      return URGENCY.ACTIVE;
    }

    // Trending: building momentum
    if (recentMentions >= 2 || (turnsAgo <= 5 && entity.mentionCount > 2)) {
      return URGENCY.TRENDING;
    }

    // Background: still relevant but not hot
    return URGENCY.BACKGROUND;
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  /**
   * Get number of mentions in recent window
   */
  getRecentMentions(entity, window) {
    if (!entity.mentionHistory || entity.mentionHistory.length === 0) {
      return 0;
    }
    const cutoff = this.currentTurn - window;
    return entity.mentionHistory.filter((turn) => turn > cutoff).length;
  }

  /**
   * Get the most recent context/usage for this entity
   */
  getLastMentionContext(entity) {
    if (entity.contexts && entity.contexts.length > 0) {
      const lastContext = entity.contexts[entity.contexts.length - 1];
      if (lastContext && lastContext.length > 5) {
        // Extract a short phrase containing the entity name
        const normalized = entity.normalized;
        const lowerContext = lastContext.toLowerCase();

        if (lowerContext.includes(normalized)) {
          const idx = lowerContext.indexOf(normalized);
          const start = Math.max(0, idx - 15);
          const end = Math.min(lastContext.length, idx + normalized.length + 20);
          let snippet = lastContext.slice(start, end).trim();
          if (start > 0) snippet = "..." + snippet;
          if (end < lastContext.length) snippet = snippet + "...";
          return snippet.replace(/\n/g, " ");
        }

        return this.truncateSentence(lastContext, 40);
      }
    }
    return null;
  }

  /**
   * Truncate text to sentence boundary
   */
  truncateSentence(text, maxLength) {
    if (!text || text.length <= maxLength) return text;

    const truncated = text.slice(0, maxLength);
    const lastPeriod = truncated.lastIndexOf(".");
    const lastSpace = truncated.lastIndexOf(" ");

    if (lastPeriod > maxLength * 0.5) {
      return truncated.slice(0, lastPeriod + 1);
    }
    if (lastSpace > maxLength * 0.7) {
      return truncated.slice(0, lastSpace);
    }
    return truncated + "...";
  }

  /**
   * Infer entity type from ID
   */
  inferEntityType(entityId) {
    const parts = entityId.split(":");
    return parts[0] || "topic";
  }

  /**
   * Get short name (without prefix)
   */
  getShortName(entityId) {
    const parts = entityId.split(":");
    return parts.length > 1 ? parts.slice(1).join(":") : entityId;
  }

  /**
   * Get human-readable relationship verb
   */
  getRelationshipVerb(relType) {
    const verbs = {
      [RELATIONSHIP_TYPES.USES]: "uses",
      [RELATIONSHIP_TYPES.CONTAINS]: "contains",
      [RELATIONSHIP_TYPES.RELATED]: "related to",
      [RELATIONSHIP_TYPES.DEPENDS_ON]: "depends on",
      [RELATIONSHIP_TYPES.IMPLEMENTS]: "implements",
    };
    return verbs[relType] || "connected to";
  }

  /**
   * Update current turn (for recency calculations)
   */
  setCurrentTurn(turn) {
    this.currentTurn = turn;
  }

  /**
   * Format a summary line for quick overview
   */
  formatSummary(entities) {
    const active = entities.filter(
      (e) => this.generateUrgencyIndicator(e) === URGENCY.ACTIVE,
    ).length;
    const trending = entities.filter(
      (e) => this.generateUrgencyIndicator(e) === URGENCY.TRENDING,
    ).length;
    const anchored = entities.filter((e) => e.isAnchor).length;

    const parts = [];
    if (active > 0) parts.push(`${active} active`);
    if (trending > 0) parts.push(`${trending} trending`);
    if (anchored > 0) parts.push(`${anchored} anchored`);

    return parts.length > 0
      ? `Tracking: ${parts.join(", ")} of ${entities.length} entities`
      : `Tracking ${entities.length} entities`;
  }
}

module.exports = {
  ActionableFormatter,
  URGENCY,
  ACTION_SUGGESTIONS,
  CONTEXT_PATTERNS,
};
