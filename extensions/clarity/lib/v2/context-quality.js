/**
 * context-quality.js - Context Value Quality Scoring System
 *
 * Based on Clarity v2 Enhancement - Quality Tiers
 *
 * This module provides a multi-dimensional quality scoring system that evaluates
 * entities based on four key dimensions:
 *
 * 1. Information Density - does this tell me something I don't know?
 * 2. Actionability - can I do something with this information?
 * 3. Timeliness - is this relevant to NOW or just historical?
 * 4. Uniqueness - is this redundant with other context?
 *
 * The combined Context Value (0-100) determines quality tiers:
 * - 🔥 Critical (80-100): High density + actionable + timely + unique
 * - ⭐ Important (60-79): Strong on 3 of 4 dimensions
 * - ○ Relevant (40-59): Moderate value
 * - ○ Background (<40): Low priority
 */

/**
 * Quality tier thresholds and labels
 */
const QUALITY_TIERS = {
  CRITICAL: { min: 80, max: 100, icon: "🔥", label: "Critical" },
  IMPORTANT: { min: 60, max: 79, icon: "⭐", label: "Important" },
  RELEVANT: { min: 40, max: 59, icon: "○", label: "Relevant" },
  BACKGROUND: { min: 0, max: 39, icon: "○", label: "Background" },
};

/**
 * Configuration for dimension scoring
 */
const DIMENSION_CONFIG = {
  informationDensity: {
    mentionHistoryWeight: 0.3,
    contextCountWeight: 0.4,
    relationshipCountWeight: 0.3,
    maxHistoryForBonus: 20,
    maxContextsForBonus: 5,
  },
  actionability: {
    hasRelationshipsBonus: 0.4,
    isAnchorableBonus: 0.3,
    hasActionsBonus: 0.3,
    actionTypes: ["uses", "contains", "implements", "depends_on"],
  },
  timeliness: {
    recentWindow: 5,
    halfLife: 3,
    anchorPersistence: 0.3,
  },
  uniqueness: {
    semanticThreshold: 0.7,
    typeOverlapPenalty: 0.5,
  },
};

/**
 * Calculate information density score (0-1)
 *
 * Measures how much substantive information the entity carries.
 * Factors:
 * - Mention history depth (more mentions = more context)
 * - Number of stored contexts (surrounding text snippets)
 * - Relationship richness (connected to other entities)
 *
 * @param {Object} entity - Entity to evaluate
 * @param {number[]} entity.mentionHistory - Array of turn numbers
 * @param {string[]} entity.contexts - Array of context snippets
 * @param {Array} entity.relationships - Entity relationships
 * @returns {number} Information density score (0-1)
 */
function calculateInformationDensity(entity) {
  if (!entity) return 0;

  const config = DIMENSION_CONFIG.informationDensity;

  // Factor 1: Mention history depth (log-scaled to prevent dominance)
  const mentionCount = entity.mentionHistory?.length || 0;
  const historyScore = Math.min(
    1,
    Math.log(1 + mentionCount) / Math.log(1 + config.maxHistoryForBonus),
  );

  // Factor 2: Context richness (stored snippets of surrounding text)
  const contextCount = entity.contexts?.length || 0;
  const contextScore = Math.min(1, contextCount / config.maxContextsForBonus);

  // Factor 3: Relationship richness
  const relationshipCount = entity.relationships?.length || 0;
  const relationshipScore = Math.min(1, relationshipCount / 5); // Cap at 5 relationships

  // Weighted combination
  const density =
    historyScore * config.mentionHistoryWeight +
    contextScore * config.contextCountWeight +
    relationshipScore * config.relationshipCountWeight;

  return Math.min(1, Math.max(0, density));
}

/**
 * Calculate actionability score (0-1)
 *
 * Measures whether the user can act on this information.
 * Factors:
 * - Has relationships (can navigate to related entities)
 * - Is anchorable (can be pinned/anchored for reference)
 * - Has actionable relationship types (uses, contains, etc.)
 *
 * @param {Object} entity - Entity to evaluate
 * @param {Array} entity.relationships - Entity relationships
 * @param {string} entity.type - Entity type (project, plugin, file, etc.)
 * @returns {number} Actionability score (0-1)
 */
function calculateActionability(entity) {
  if (!entity) return 0;

  const config = DIMENSION_CONFIG.actionability;

  // Factor 1: Has relationships (navigation potential)
  const hasRelationships = entity.relationships && entity.relationships.length > 0;
  const relationshipScore = hasRelationships ? config.hasRelationshipsBonus : 0;

  // Factor 2: Is anchorable (most entity types can be anchored)
  const anchorableTypes = ["project", "plugin", "tool", "file", "person", "topic", "decision"];
  const isAnchorable = anchorableTypes.includes(entity.type);
  const anchorScore = isAnchorable ? config.isAnchorableBonus : 0;

  // Factor 3: Has actionable relationship types
  let actionScore = 0;
  if (hasRelationships) {
    const actionableRels = entity.relationships.filter((r) => config.actionTypes.includes(r.type));
    actionScore = Math.min(1, actionableRels.length / 3) * config.hasActionsBonus;
  }

  // Combined score
  const actionability = relationshipScore + anchorScore + actionScore;

  return Math.min(1, Math.max(0, actionability));
}

/**
 * Calculate timeliness score (0-1)
 *
 * Measures whether the information is relevant to the current moment.
 * Factors:
 * - Recency of last mention (exponential decay)
 * - Multiple recent mentions (clustering)
 * - Anchor status (anchors retain timeliness longer)
 *
 * @param {Object} entity - Entity to evaluate
 * @param {number} entity.lastMentionTurn - Last turn where entity was mentioned
 * @param {number[]} entity.mentionHistory - Array of turn numbers
 * @param {boolean} entity.isAnchor - Whether entity is anchored
 * @param {number} currentTurn - Current turn number
 * @returns {number} Timeliness score (0-1)
 */
function calculateTimeliness(entity, currentTurn) {
  if (!entity || !currentTurn) return 0;

  const config = DIMENSION_CONFIG.timeliness;

  // Factor 1: Recency with exponential decay
  const turnsAgo = currentTurn - (entity.lastMentionTurn || 0);
  const recencyScore = Math.exp(-turnsAgo / config.halfLife);

  // Factor 2: Clustering (multiple mentions in recent window)
  const recentMentions =
    entity.mentionHistory?.filter((turn) => {
      const ago = currentTurn - turn;
      return ago >= 0 && ago <= config.recentWindow;
    }).length || 0;
  const clusteringScore = Math.min(1, recentMentions / 3); // Cap at 3 recent mentions

  // Factor 3: Anchor persistence (anchors decay slower)
  const anchorBoost = entity.isAnchor ? config.anchorPersistence : 0;

  // Combined score with anchor providing floor
  const timeliness = Math.max(recencyScore, anchorBoost) + clusteringScore * 0.2;

  return Math.min(1, Math.max(0, timeliness));
}

/**
 * Calculate uniqueness score (0-1)
 *
 * Measures whether this entity adds new information vs being redundant.
 * Factors:
 * - Semantic similarity to other entities (lower = more unique)
 * - Type overlap penalty (same type as many others)
 * - Information entropy (does it bridge different contexts)
 *
 * @param {Object} entity - Entity to evaluate
 * @param {string} entity.id - Entity identifier
 * @param {string} entity.normalized - Normalized entity name
 * @param {Array} entity.relationships - Entity relationships
 * @param {Object} entity.semanticSimilarity - Map of entity IDs to similarity scores
 * @param {Array} allEntities - All entities in context for comparison
 * @returns {number} Uniqueness score (0-1)
 */
function calculateUniqueness(entity, allEntities) {
  if (!entity || !allEntities || allEntities.length === 0) return 1;

  const config = DIMENSION_CONFIG.uniqueness;

  // Filter to comparable entities (same type preferred)
  const sameTypeEntities = allEntities.filter((e) => e.type === entity.type && e.id !== entity.id);

  if (sameTypeEntities.length === 0) {
    // No same-type entities = high uniqueness
    return 1;
  }

  // Factor 1: Semantic similarity to other entities
  let maxSimilarity = 0;
  for (const other of sameTypeEntities) {
    // Check pre-computed semantic similarity if available
    const similarity =
      entity.semanticSimilarity?.[other.id] ||
      other.semanticSimilarity?.[entity.id] ||
      calculateStringSimilarity(entity.normalized, other.normalized);
    maxSimilarity = Math.max(maxSimilarity, similarity);
  }

  // Convert similarity to uniqueness (inverse)
  const semanticUniqueness = 1 - maxSimilarity;

  // Factor 2: Type overlap penalty (if many same-type entities exist)
  const typeOverlapPenalty = Math.min(0.3, sameTypeEntities.length / 20);

  // Factor 3: Bridge uniqueness (connects different entity types)
  const connectedTypes = new Set(
    entity.relationships
      ?.map((r) => {
        const target = allEntities.find((e) => e.id === r.targetId);
        return target?.type;
      })
      .filter(Boolean),
  );
  const bridgeScore = Math.min(0.2, connectedTypes.size / 5);

  // Combined score
  const uniqueness = semanticUniqueness - typeOverlapPenalty + bridgeScore;

  return Math.min(1, Math.max(0, uniqueness));
}

/**
 * Calculate string similarity using normalized Levenshtein-inspired approach
 * @private
 */
function calculateStringSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 1;

  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();

  // Check for substring containment
  if (s1.includes(s2) || s2.includes(s1)) {
    const ratio = Math.min(s1.length, s2.length) / Math.max(s1.length, s2.length);
    return 0.5 + ratio * 0.5; // 0.5 to 1.0 based on length ratio
  }

  // Token overlap for multi-word entities
  const tokens1 = s1.split(/[_\s]+/);
  const tokens2 = s2.split(/[_\s]+/);
  const overlap = tokens1.filter((t) => tokens2.includes(t)).length;
  const tokenSimilarity = (2 * overlap) / (tokens1.length + tokens2.length);

  return tokenSimilarity;
}

/**
 * Calculate combined Context Value score (0-100)
 *
 * Combines all four dimensions with adaptive weighting:
 * - Information density: 25% (substantive content)
 * - Actionability: 30% (can user act on it)
 * - Timeliness: 25% (relevant now)
 * - Uniqueness: 20% (not redundant)
 *
 * @param {Object} entity - Entity to evaluate
 * @param {Array} allEntities - All entities for uniqueness comparison
 * @param {number} currentTurn - Current turn number
 * @returns {Object} Score result with dimensions, total, and tier
 */
function calculateContextValue(entity, allEntities, currentTurn) {
  if (!entity) {
    return {
      dimensions: {
        informationDensity: 0,
        actionability: 0,
        timeliness: 0,
        uniqueness: 0,
      },
      total: 0,
      tier: QUALITY_TIERS.BACKGROUND,
    };
  }

  // Calculate individual dimensions
  const density = calculateInformationDensity(entity);
  const actionability = calculateActionability(entity);
  const timeliness = calculateTimeliness(entity, currentTurn);
  const uniqueness = calculateUniqueness(entity, allEntities);

  // Weighted combination (weights sum to 1.0)
  const weights = {
    informationDensity: 0.25,
    actionability: 0.3,
    timeliness: 0.25,
    uniqueness: 0.2,
  };

  const rawScore =
    density * weights.informationDensity +
    actionability * weights.actionability +
    timeliness * weights.timeliness +
    uniqueness * weights.uniqueness;

  // Scale to 0-100
  const totalScore = Math.round(rawScore * 100);

  // Determine quality tier
  const tier = getQualityTier(totalScore);

  // Count strong dimensions (score > 0.6)
  const strongDimensions = [
    density > 0.6,
    actionability > 0.6,
    timeliness > 0.6,
    uniqueness > 0.6,
  ].filter(Boolean).length;

  return {
    dimensions: {
      informationDensity: Math.round(density * 100),
      actionability: Math.round(actionability * 100),
      timeliness: Math.round(timeliness * 100),
      uniqueness: Math.round(uniqueness * 100),
    },
    total: totalScore,
    tier,
    strongDimensions,
    isCritical: tier === QUALITY_TIERS.CRITICAL,
    isImportant: tier === QUALITY_TIERS.IMPORTANT,
  };
}

/**
 * Get quality tier for a score
 *
 * @param {number} score - Context value score (0-100)
 * @returns {Object} Tier configuration with icon and label
 */
function getQualityTier(score) {
  if (score >= QUALITY_TIERS.CRITICAL.min) return QUALITY_TIERS.CRITICAL;
  if (score >= QUALITY_TIERS.IMPORTANT.min) return QUALITY_TIERS.IMPORTANT;
  if (score >= QUALITY_TIERS.RELEVANT.min) return QUALITY_TIERS.RELEVANT;
  return QUALITY_TIERS.BACKGROUND;
}

/**
 * Get tier by score with detailed reason
 *
 * @param {number} score - Context value score (0-100)
 * @param {number} strongDimensions - Count of dimensions with score > 0.6
 * @returns {Object} Tier with explanation
 */
function getQualityTierWithReason(score, strongDimensions = 0) {
  const tier = getQualityTier(score);

  let reason = "";
  if (tier === QUALITY_TIERS.CRITICAL) {
    reason = "High density + actionable + timely + unique";
  } else if (tier === QUALITY_TIERS.IMPORTANT) {
    reason = `Strong on ${strongDimensions} of 4 dimensions`;
  } else if (tier === QUALITY_TIERS.RELEVANT) {
    reason = "Moderate value";
  } else {
    reason = "Low priority";
  }

  return {
    ...tier,
    reason,
  };
}

/**
 * Format entity with quality tier for display
 *
 * @param {Object} entity - Entity to format
 * @param {Object} qualityScore - Result from calculateContextValue
 * @returns {string} Formatted display string
 */
function formatEntityWithTier(entity, qualityScore) {
  const tier = qualityScore.tier;
  const parts = [`${tier.icon} ${entity.id}`];

  // Build description based on entity properties
  const descriptions = [];

  if (entity.mentionCount > 1) {
    descriptions.push(`${entity.mentionCount} mentions`);
  }

  if (entity.isAnchor) {
    descriptions.push("anchored");
  }

  if (entity.relationships?.length > 0) {
    descriptions.push(`${entity.relationships.length} related`);
  }

  // Add dimensional highlights for high-value entities
  if (qualityScore.isCritical || qualityScore.isImportant) {
    const dims = qualityScore.dimensions;
    const highlights = [];
    if (dims.actionability > 70) highlights.push("actionable");
    if (dims.timeliness > 70) highlights.push("active");
    if (dims.informationDensity > 70) highlights.push("rich context");
    if (highlights.length > 0) {
      descriptions.push(highlights.join(", "));
    }
  }

  if (descriptions.length > 0) {
    parts.push(`— ${descriptions.join(", ")}`);
  }

  // Add action hints based on entity type
  const actions = getActionHints(entity);
  if (actions) {
    parts.push(`\n  → ${actions}`);
  }

  return parts.join(" ");
}

/**
 * Get action hints for an entity based on type
 * @private
 */
function getActionHints(entity) {
  const type = entity.type;
  const normalized = entity.normalized || entity.id?.split(":")[1] || "";

  switch (type) {
    case "project":
      return `view arch docs | /anchor ${normalized}`;
    case "plugin":
      return `/anchor ${normalized} | see subagents`;
    case "tool":
      return `try ${normalized} | /anchor ${normalized}`;
    case "file":
      return `read ${entity.name} | /anchor ${normalized}`;
    case "person":
      return `view profile | /anchor ${normalized}`;
    case "decision":
      return `see rationale | /anchor ${normalized}`;
    default:
      return `/anchor ${normalized}`;
  }
}

/**
 * Sort entities by context value (highest first)
 *
 * @param {Array} entities - Entities to sort
 * @param {number} currentTurn - Current turn number
 * @returns {Array} Sorted entities with quality scores attached
 */
function sortByContextValue(entities, currentTurn) {
  if (!entities || entities.length === 0) return [];

  const withScores = entities.map((entity) => ({
    entity,
    quality: calculateContextValue(entity, entities, currentTurn),
  }));

  // Sort by total score descending
  withScores.sort((a, b) => b.quality.total - a.quality.total);

  return withScores;
}

module.exports = {
  // Core scoring functions
  calculateInformationDensity,
  calculateActionability,
  calculateTimeliness,
  calculateUniqueness,
  calculateContextValue,

  // Tier utilities
  getQualityTier,
  getQualityTierWithReason,
  formatEntityWithTier,
  sortByContextValue,

  // Constants
  QUALITY_TIERS,
  DIMENSION_CONFIG,
};
