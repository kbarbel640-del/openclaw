/**
 * context-health.js - Context health diagnostics for Clarity v2
 *
 * Helps users understand if their context is working well or needs adjustment:
 * - Is my context too cluttered? (entity count vs quality)
 * - Are there duplicates I should merge?
 * - Are important things getting buried?
 * - What's the signal-to-noise ratio?
 */

"use strict";

const { SemanticMatcher } = require("./semantic-matcher");

/**
 * Configuration for health diagnostics
 */
const HEALTH_THRESHOLDS = {
  // Entity count thresholds
  maxHealthyEntities: 20,
  maxClutteredEntities: 40,

  // Quality percentage thresholds
  minHealthyQuality: 70,
  minClutteredQuality: 30,

  // What counts as "high-quality"
  highQualityScore: 40,

  // Buried importance detection
  buriedMentionThreshold: 3,
  buriedRecencyThreshold: 10,

  // Duplicate detection
  duplicateSimilarityThreshold: 0.7,
  relateSimilarityThreshold: 0.5,
};

/**
 * Health status indicators
 */
const HEALTH_STATUS = Object.freeze({
  HEALTHY: { emoji: "🟢", label: "Healthy", color: "green" },
  CLUTTERED: { emoji: "🟡", label: "Cluttered", color: "yellow" },
  OVERLOADED: { emoji: "🔴", label: "Overloaded", color: "red" },
});

/**
 * Calculate clutter score based on entity count and quality distribution
 * @param {Entity[]} entities - Array of entities
 * @returns {number} Clutter score 0-100 (higher = more cluttered)
 */
function calculateClutterScore(entities) {
  if (!entities || entities.length === 0) {
    return 0;
  }

  const entityCount = entities.length;
  const lowQualityEntities = entities.filter(
    (e) => (e.totalScore || 0) < HEALTH_THRESHOLDS.highQualityScore && !e.isAnchor,
  ).length;

  // Count-based score (0-50)
  let countScore = 0;
  if (entityCount > HEALTH_THRESHOLDS.maxHealthyEntities) {
    if (entityCount > HEALTH_THRESHOLDS.maxClutteredEntities) {
      countScore = 50; // Overloaded
    } else {
      // Linear scale between 0 and 50
      countScore =
        ((entityCount - HEALTH_THRESHOLDS.maxHealthyEntities) /
          (HEALTH_THRESHOLDS.maxClutteredEntities - HEALTH_THRESHOLDS.maxHealthyEntities)) *
        50;
    }
  }

  // Quality-based score (0-50)
  const lowQualityRatio = entityCount > 0 ? lowQualityEntities / entityCount : 0;
  const qualityScore = lowQualityRatio * 50;

  return Math.min(100, Math.round(countScore + qualityScore));
}

/**
 * Detect potential duplicate entities using semantic similarity
 * @param {Entity[]} entities - Array of entities
 * @returns {Array<{entity1: Entity, entity2: Entity, similarity: number, suggestion: string}>}
 *          List of potential duplicates with similarity scores
 */
function detectPotentialDuplicates(entities) {
  if (!entities || entities.length < 2) {
    return [];
  }

  const matcher = new SemanticMatcher({
    mergeThreshold: HEALTH_THRESHOLDS.duplicateSimilarityThreshold,
    relateThreshold: HEALTH_THRESHOLDS.relateSimilarityThreshold,
  });

  const duplicates = [];
  const processedPairs = new Set();

  // Check all pairs for similarity
  for (let i = 0; i < entities.length; i++) {
    for (let j = i + 1; j < entities.length; j++) {
      const entity1 = entities[i];
      const entity2 = entities[j];

      // Skip if we've already processed this pair
      const pairKey = [entity1.id, entity2.id].sort().join("|");
      if (processedPairs.has(pairKey)) continue;
      processedPairs.add(pairKey);

      const similarity = matcher.similarity(entity1, entity2);

      // Only include if above duplicate threshold
      if (similarity >= HEALTH_THRESHOLDS.duplicateSimilarityThreshold) {
        duplicates.push({
          entity1,
          entity2,
          similarity: Math.round(similarity * 100) / 100,
          suggestion: `merge ${entity1.normalized},${entity2.normalized}`,
        });
      }
    }
  }

  // Sort by similarity (highest first)
  return duplicates.sort((a, b) => b.similarity - a.similarity);
}

/**
 * Find high-value entities that are getting buried (mentioned often but not recently)
 * @param {Entity[]} entities - Array of entities
 * @param {number} currentTurn - Current turn number
 * @returns {Array<{entity: Entity, mentionCount: number, turnsSinceLast: number, reason: string}>}
 *          List of buried important entities
 */
function findBuriedImportant(entities, currentTurn = 0) {
  if (!entities || entities.length === 0) {
    return [];
  }

  const buried = [];

  for (const entity of entities) {
    const mentionCount = entity.mentionCount || 0;
    const lastMention = entity.lastMentionTurn || 0;
    const turnsSinceLast = currentTurn - lastMention;
    const isAnchor = entity.isAnchor || false;
    const score = entity.totalScore || 0;

    // Skip anchors (they're intentionally kept)
    if (isAnchor) continue;

    // Check if entity meets "buried important" criteria:
    // - Mentioned multiple times (has some importance)
    // - Not mentioned recently (getting buried)
    // - Has a decent score but not the highest
    const isBuried =
      mentionCount >= HEALTH_THRESHOLDS.buriedMentionThreshold &&
      turnsSinceLast >= HEALTH_THRESHOLDS.buriedRecencyThreshold &&
      score >= HEALTH_THRESHOLDS.highQualityScore * 0.5;

    if (isBuried) {
      buried.push({
        entity,
        mentionCount,
        turnsSinceLast,
        reason: `mentioned ${mentionCount}×, last ${turnsSinceLast} turns ago`,
      });
    }
  }

  // Sort by importance (mention count) then by how buried (turns since)
  return buried.sort((a, b) => {
    if (b.mentionCount !== a.mentionCount) {
      return b.mentionCount - a.mentionCount;
    }
    return b.turnsSinceLast - a.turnsSinceLast;
  });
}

/**
 * Calculate signal-to-noise ratio
 * @param {Entity[]} entities - Array of entities
 * @returns {{ratio: number, signal: number, noise: number, signalPercent: number, noisePercent: number}}
 *          Signal-to-noise breakdown
 */
function calculateSignalToNoise(entities) {
  if (!entities || entities.length === 0) {
    return { ratio: 0, signal: 0, noise: 0, signalPercent: 0, noisePercent: 0 };
  }

  const total = entities.length;

  // Signal = high-quality entities (high score or anchored)
  const signal = entities.filter(
    (e) => (e.totalScore || 0) >= HEALTH_THRESHOLDS.highQualityScore || e.isAnchor,
  ).length;

  // Noise = low-quality entities (not high quality and not anchored)
  const noise = total - signal;

  const signalPercent = Math.round((signal / total) * 100);
  const noisePercent = 100 - signalPercent;

  // Ratio: signal per unit of noise (or just signal if no noise)
  const ratio = noise > 0 ? Math.round((signal / noise) * 10) / 10 : signal;

  return {
    ratio,
    signal,
    noise,
    signalPercent,
    noisePercent,
  };
}

/**
 * Determine overall health status
 * @param {number} entityCount - Number of entities
 * @param {number} highQualityPercent - Percentage of high-quality entities
 * @param {number} duplicateCount - Number of potential duplicates
 * @returns {{status: Object, description: string}} Status info
 */
function determineHealthStatus(entityCount, highQualityPercent, duplicateCount) {
  const { HEALTHY, CLUTTERED, OVERLOADED } = HEALTH_STATUS;

  // Overloaded: too many entities OR too low quality
  if (
    entityCount > HEALTH_THRESHOLDS.maxClutteredEntities ||
    highQualityPercent < HEALTH_THRESHOLDS.minClutteredQuality
  ) {
    const reason =
      entityCount > HEALTH_THRESHOLDS.maxClutteredEntities
        ? `${entityCount} entities`
        : `${highQualityPercent}% high-quality`;
    return {
      status: OVERLOADED,
      description: `${reason}`,
    };
  }

  // Cluttered: moderate entities OR moderate low quality OR duplicates present
  if (
    entityCount > HEALTH_THRESHOLDS.maxHealthyEntities ||
    highQualityPercent < HEALTH_THRESHOLDS.minHealthyQuality ||
    duplicateCount > 0
  ) {
    const parts = [];
    if (entityCount > HEALTH_THRESHOLDS.maxHealthyEntities) {
      parts.push(`${entityCount} entities`);
    }
    if (highQualityPercent < HEALTH_THRESHOLDS.minHealthyQuality) {
      parts.push(`${highQualityPercent}% high-quality`);
    }
    if (duplicateCount > 0) {
      parts.push(`${duplicateCount} potential duplicate${duplicateCount > 1 ? "s" : ""}`);
    }
    return {
      status: CLUTTERED,
      description: parts.join(", "),
    };
  }

  // Healthy: all metrics good
  return {
    status: HEALTHY,
    description: `${entityCount} entities, ${highQualityPercent}% high-quality`,
  };
}

/**
 * Generate actionable suggestions based on health analysis
 * @param {Entity[]} entities - Array of entities
 * @param {Object} healthData - Health analysis data
 * @returns {string[]} List of actionable suggestions
 */
function generateSuggestions(entities, healthData) {
  const suggestions = [];
  const { entityCount, signalToNoise, duplicates, buriedImportant } = healthData;

  // Pruning suggestion for cluttered/overloaded contexts
  if (entityCount > HEALTH_THRESHOLDS.maxHealthyEntities) {
    const lowQualityCount = entities.filter(
      (e) => (e.totalScore || 0) < HEALTH_THRESHOLDS.highQualityScore && !e.isAnchor,
    ).length;
    if (lowQualityCount > 0) {
      suggestions.push(
        `/clarity prune — remove ${lowQualityCount} low-relevance item${lowQualityCount > 1 ? "s" : ""}`,
      );
    }
  }

  // Merge suggestions for duplicates
  for (const dup of duplicates.slice(0, 3)) {
    suggestions.push(`/clarity merge ${dup.entity1.normalized},${dup.entity2.normalized}`);
  }

  // Anchor suggestions for buried important items
  for (const buried of buriedImportant.slice(0, 2)) {
    suggestions.push(
      `/clarity anchor ${buried.entity.normalized} — prevent "${buried.entity.name}" from fading`,
    );
  }

  // General suggestions based on signal-to-noise
  if (signalToNoise.noisePercent > 50) {
    suggestions.push(`Consider reviewing ${signalToNoise.noise} low-relevance items`);
  }

  return suggestions;
}

/**
 * Generate a comprehensive health report
 * @param {Entity[]} entities - Array of entities
 * @param {number} currentTurn - Current turn number
 * @returns {Object} Health report with status, metrics, and suggestions
 */
function generateHealthReport(entities, currentTurn = 0) {
  if (!entities) {
    entities = [];
  }

  const entityCount = entities.length;
  const signalToNoise = calculateSignalToNoise(entities);
  const duplicates = detectPotentialDuplicates(entities);
  const buriedImportant = findBuriedImportant(entities, currentTurn);
  const clutterScore = calculateClutterScore(entities);

  const healthStatus = determineHealthStatus(
    entityCount,
    signalToNoise.signalPercent,
    duplicates.length,
  );

  const healthData = {
    entityCount,
    signalToNoise,
    duplicates,
    buriedImportant,
    clutterScore,
  };

  const suggestions = generateSuggestions(entities, healthData);

  return {
    // Core status
    status: healthStatus.status,
    description: healthStatus.description,

    // Metrics
    metrics: {
      entityCount,
      highQualityCount: signalToNoise.signal,
      highQualityPercent: signalToNoise.signalPercent,
      lowQualityCount: signalToNoise.noise,
      lowQualityPercent: signalToNoise.noisePercent,
      clutterScore,
      duplicateCount: duplicates.length,
      buriedCount: buriedImportant.length,
    },

    // Detailed findings
    duplicates: duplicates.map((d) => ({
      entity1Name: d.entity1.name,
      entity2Name: d.entity2.name,
      entity1Id: d.entity1.id,
      entity2Id: d.entity2.id,
      similarity: d.similarity,
    })),

    buriedImportant: buriedImportant.map((b) => ({
      entityName: b.entity.name,
      entityId: b.entity.id,
      mentionCount: b.mentionCount,
      turnsSinceLast: b.turnsSinceLast,
      reason: b.reason,
    })),

    // Actionable suggestions
    suggestions,

    // Raw data for programmatic use
    _raw: healthData,
  };
}

/**
 * Format health report as human-readable string
 * @param {Object} report - Health report from generateHealthReport()
 * @returns {string} Formatted health report
 */
function formatHealthReport(report) {
  const lines = [];

  // Header
  lines.push("[CONTEXT HEALTH]");
  lines.push(`Status: ${report.status.emoji} ${report.status.label} (${report.description})`);
  lines.push("");

  // Duplicates section
  if (report.duplicates.length > 0) {
    lines.push("Potential duplicates:");
    for (const dup of report.duplicates) {
      lines.push(
        `  • "${dup.entity1Name}" ≈ "${dup.entity2Name}" (similarity: ${dup.similarity.toFixed(2)})`,
      );
    }
    lines.push("");
  }

  // Buried important section
  if (report.buriedImportant.length > 0) {
    lines.push("Buried important:");
    for (const buried of report.buriedImportant) {
      lines.push(`  • ${buried.entityId} (${buried.reason})`);
    }
    lines.push("");
  }

  // Suggestions
  if (report.suggestions.length > 0) {
    lines.push("Suggestions:");
    for (const suggestion of report.suggestions) {
      lines.push(`  • ${suggestion}`);
    }
    lines.push("");
  }

  // Summary metrics (one line)
  lines.push(
    `[Metrics: ${report.metrics.highQualityPercent}% high-quality, clutter: ${report.metrics.clutterScore}/100]`,
  );

  return lines.join("\n");
}

module.exports = {
  // Core functions
  calculateClutterScore,
  detectPotentialDuplicates,
  findBuriedImportant,
  calculateSignalToNoise,
  generateHealthReport,
  formatHealthReport,

  // Utilities
  determineHealthStatus,
  generateSuggestions,

  // Constants
  HEALTH_THRESHOLDS,
  HEALTH_STATUS,
};
