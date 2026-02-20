/**
 * RichFormatter — Enhanced output formatting for Clarity v2
 *
 * Features:
 * - For each entity, find 2-3 most related entities by relationship strength
 * - Show relationship type (contains, uses, related)
 * - Add contextual phrases (e.g., "clarity plugin for OpenClaw")
 * - Group related entities by type
 * - Prioritize USES and CONTAINS relationships
 *
 * @module rich-formatter
 */

"use strict";

const { RelType } = require("./relationship-graph");
const { RELATIONSHIP_TYPES, THRESHOLDS } = require("./constants");

/**
 * Priority order for relationship types (lower = higher priority)
 * USES and CONTAINS are most meaningful for context
 */
const RELATIONSHIP_PRIORITY = {
  [RELATIONSHIP_TYPES.USES]: 1,
  [RELATIONSHIP_TYPES.CONTAINS]: 2,
  [RELATIONSHIP_TYPES.DEPENDS_ON]: 3,
  [RELATIONSHIP_TYPES.IMPLEMENTS]: 4,
  [RELATIONSHIP_TYPES.RELATED]: 5,
};

/**
 * Type labels for display (shorter for compact output)
 */
const TYPE_LABELS = {
  [RELATIONSHIP_TYPES.USES]: "uses",
  [RELATIONSHIP_TYPES.CONTAINS]: "contains",
  [RELATIONSHIP_TYPES.DEPENDS_ON]: "depends on",
  [RELATIONSHIP_TYPES.IMPLEMENTS]: "implements",
  [RELATIONSHIP_TYPES.RELATED]: "related to",
};

/**
 * Entity type descriptors for contextual phrases
 */
const ENTITY_TYPE_DESCRIPTORS = {
  project: {
    article: "the",
    preposition: "for",
    actionVerbs: ["working on", "developing", "building", "maintaining", "planning"],
  },
  plugin: {
    article: "the",
    preposition: "with",
    actionVerbs: ["using", "configuring", "developing", "extending", "integrating"],
  },
  tool: {
    article: "the",
    preposition: "via",
    actionVerbs: ["using", "calling", "invoking", "running", "executing"],
  },
  file: {
    article: "the",
    preposition: "in",
    actionVerbs: ["editing", "reading", "updating", "creating", "reviewing"],
  },
  person: {
    article: "",
    preposition: "with",
    actionVerbs: ["talking to", "working with", "collaborating with", "meeting", "discussing with"],
  },
  topic: {
    article: "the",
    preposition: "about",
    actionVerbs: ["discussing", "exploring", "investigating", "researching", "learning about"],
  },
  decision: {
    article: "the",
    preposition: "on",
    actionVerbs: ["decided on", "chosen", "selected", "opted for", "committed to"],
  },
};

class RichFormatter {
  constructor(options = {}) {
    this.maxRelatedPerEntity = options.maxRelatedPerEntity || 3;
    this.minRelationshipStrength = options.minRelationshipStrength || 0.1;
    this.showDescriptions = options.showDescriptions !== false;
    this.showContextualPhrases = options.showContextualPhrases !== false;
    this.includeTiers = options.includeTiers !== false;
  }

  /**
   * Format an entity with rich relationship information
   *
   * @param {Entity} entity - The entity to format
   * @param {Map<string, Entity>} entityMap - Map of all entities for lookup
   * @returns {string} Formatted entity line
   */
  formatEntity(entity, entityMap) {
    const indicator = this.getRelevanceIndicator(entity.totalScore);
    const scoreStr = `score: ${Math.round(entity.totalScore)}`;

    // Build related entities section
    const relatedStr = this.formatRelatedEntities(entity, entityMap);

    // Build description/context section
    const descriptionStr = this.formatDescription(entity);

    const parts = [`${indicator} ${entity.id} (${scoreStr})`];

    if (relatedStr) {
      parts.push(relatedStr);
    }

    if (descriptionStr && this.showDescriptions) {
      parts.push(descriptionStr);
    }

    return parts.join(" — ");
  }

  /**
   * Get relevance tier indicator
   * ● high, ○ medium, · low
   */
  getRelevanceIndicator(score) {
    if (!this.includeTiers) return "";
    if (score >= THRESHOLDS.highRelevance) return "●";
    if (score >= THRESHOLDS.mediumRelevance) return "○";
    return "·";
  }

  /**
   * Format related entities grouped by relationship type
   *
   * Current: "plugin:clarity (score: 65) — related to: ..."
   * New: "plugin:clarity (score: 65) — uses: subagents, related to: claracore, openclaw"
   */
  formatRelatedEntities(entity, entityMap) {
    if (!entity.relationships || entity.relationships.length === 0) {
      return "";
    }

    // Get top relationships sorted by priority then strength
    const topRelationships = this.getTopRelationships(entity, this.maxRelatedPerEntity);

    if (topRelationships.length === 0) {
      return "";
    }

    // Group by relationship type
    const grouped = this.groupRelationshipsByType(topRelationships, entityMap);

    // Format each group
    const parts = [];
    for (const [type, targets] of grouped) {
      if (targets.length > 0) {
        const label = TYPE_LABELS[type] || type;
        // Shorten target names by removing prefix
        const shortNames = targets.map((t) => this.shortenEntityId(t.entityId)).join(", ");
        parts.push(`${label}: ${shortNames}`);
      }
    }

    return parts.join(", ");
  }

  /**
   * Get top N relationships sorted by priority and strength
   */
  getTopRelationships(entity, maxCount) {
    return entity.relationships
      .filter((r) => r.strength >= this.minRelationshipStrength)
      .sort((a, b) => {
        // Sort by priority first
        const priorityA = RELATIONSHIP_PRIORITY[a.type] || 999;
        const priorityB = RELATIONSHIP_PRIORITY[b.type] || 999;
        if (priorityA !== priorityB) {
          return priorityA - priorityB;
        }
        // Then by strength (descending)
        return b.strength - a.strength;
      })
      .slice(0, maxCount);
  }

  /**
   * Group relationships by type, limiting total items
   */
  groupRelationshipsByType(relationships, entityMap) {
    const grouped = new Map();

    for (const rel of relationships) {
      if (!grouped.has(rel.type)) {
        grouped.set(rel.type, []);
      }

      // Get target entity info
      const targetEntity = entityMap.get(rel.targetId);
      grouped.get(rel.type).push({
        entityId: rel.targetId,
        strength: rel.strength,
        targetEntity,
      });
    }

    return grouped;
  }

  /**
   * Shorten entity ID by removing type prefix
   * e.g., "project:claracore" -> "claracore"
   */
  shortenEntityId(entityId) {
    const parts = entityId.split(":");
    if (parts.length > 1) {
      return parts.slice(1).join(":");
    }
    return entityId;
  }

  /**
   * Format entity description/context
   */
  formatDescription(entity) {
    if (entity.contexts && entity.contexts.length > 0) {
      // Use first context as description, truncated
      const context = entity.contexts[0];
      if (context && context.length > 5) {
        return `context: "${context.slice(0, 40)}${context.length > 40 ? "..." : ""}"`;
      }
    }
    return "";
  }

  /**
   * Generate contextual phrases for an entity
   *
   * Examples:
   * - "working on claracore architecture"
   * - "using clarity plugin with subagents"
   *
   * @param {Entity} entity - The primary entity
   * @param {Array<{entityId: string, type: string}>} related - Related entities
   * @returns {string[]} Array of contextual phrases
   */
  getContextualPhrases(entity, related = []) {
    const phrases = [];
    const descriptor = ENTITY_TYPE_DESCRIPTORS[entity.type];

    if (!descriptor) {
      return phrases;
    }

    // Primary action phrase
    const actionVerb = descriptor.actionVerbs[0] || "working with";
    const entityName = this.shortenEntityId(entity.id);

    // Base phrase: "working on claracore"
    phrases.push(`${actionVerb} ${descriptor.article} ${entityName}`.replace(/\s+/g, " ").trim());

    // If we have related entities, create combined phrases
    if (related.length > 0) {
      const topRelated = related.slice(0, 2);

      for (const rel of topRelated) {
        const relatedName = this.shortenEntityId(rel.entityId);
        const relatedDescriptor = ENTITY_TYPE_DESCRIPTORS[this.getEntityType(rel.entityId)];

        if (rel.type === RELATIONSHIP_TYPES.USES) {
          // "using clarity plugin with subagents"
          phrases.push(`using ${entityName} ${descriptor.preposition} ${relatedName}`);
        } else if (rel.type === RELATIONSHIP_TYPES.CONTAINS) {
          // "claracore contains memory_architecture"
          phrases.push(`${entityName} contains ${relatedName}`);
        } else if (rel.type === RELATIONSHIP_TYPES.RELATED) {
          // "working on claracore and openclaw"
          phrases.push(`${actionVerb} ${descriptor.article} ${entityName} and ${relatedName}`);
        }
      }
    }

    // Limit to 2-3 unique phrases
    return [...new Set(phrases)].slice(0, 3);
  }

  /**
   * Get entity type from ID
   */
  getEntityType(entityId) {
    const parts = entityId.split(":");
    return parts[0] || "unknown";
  }

  /**
   * Format full context output with all entities
   *
   * @param {Array<Entity>} entities - All scored entities
   * @param {Map<string, Entity>} entityMap - Entity lookup map
   * @param {number} maxEntities - Maximum entities to display
   * @returns {string} Formatted context block
   */
  formatContext(entities, entityMap, maxEntities = 8) {
    const lines = ["[CLARITY CONTEXT]"];

    if (entities.length === 0) {
      lines.push("  No tracked entities");
      return lines.join("\n");
    }

    // Filter to displayable entities
    const displayEntities = entities
      .filter((e) => e.totalScore >= THRESHOLDS.display)
      .slice(0, maxEntities);

    if (displayEntities.length === 0) {
      // Show top few even if below threshold
      displayEntities.push(...entities.slice(0, Math.min(5, entities.length)));
    }

    lines.push("High-relevance entities:");

    for (const entity of displayEntities) {
      lines.push(`  ${this.formatEntity(entity, entityMap)}`);
    }

    // Add contextual phrases section if enabled
    if (this.showContextualPhrases && displayEntities.length > 0) {
      const phraseLines = this.formatContextualPhrasesSection(displayEntities, entityMap);
      if (phraseLines.length > 0) {
        lines.push("");
        lines.push(...phraseLines);
      }
    }

    return lines.join("\n");
  }

  /**
   * Format the contextual phrases section
   */
  formatContextualPhrasesSection(entities, entityMap) {
    const lines = [];
    const allPhrases = [];

    for (const entity of entities.slice(0, 5)) {
      const related = entity.relationships
        ? entity.relationships.slice(0, 2).map((r) => ({
            entityId: r.targetId,
            type: r.type,
          }))
        : [];

      const phrases = this.getContextualPhrases(entity, related);
      for (const phrase of phrases) {
        if (!allPhrases.includes(phrase)) {
          allPhrases.push(phrase);
        }
      }
    }

    if (allPhrases.length > 0) {
      lines.push("Active context:");
      for (const phrase of allPhrases.slice(0, 5)) {
        lines.push(`  • ${phrase}`);
      }
    }

    return lines;
  }

  /**
   * Format active topics from entities
   */
  formatTopics(entities, maxTopics = 5) {
    const topics = entities
      .slice(0, 10)
      .map((e) => this.shortenEntityId(e.id))
      .filter((t) => t.length > 3)
      .slice(0, maxTopics);

    return [...new Set(topics)];
  }

  /**
   * Format tracked relationships summary
   */
  formatRelationships(relationships, maxRelationships = 5) {
    const strongRels = relationships
      .filter((r) => r.strength >= 0.5)
      .sort((a, b) => b.strength - a.strength)
      .slice(0, maxRelationships);

    const lines = [];

    for (const rel of strongRels) {
      const source = this.shortenEntityId(rel.sourceId);
      const target = this.shortenEntityId(rel.targetId);
      const typeLabel = TYPE_LABELS[rel.type] || rel.type;
      lines.push(`  • ${source} → ${typeLabel} → ${target}`);
    }

    return lines;
  }
}

module.exports = { RichFormatter, RELATIONSHIP_PRIORITY, TYPE_LABELS, ENTITY_TYPE_DESCRIPTORS };
