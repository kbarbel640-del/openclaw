/**
 * ReferenceDetector — Improved reference detection with word-boundary matching.
 *
 * Features:
 * - Word-boundary matching to avoid false positives
 * - Indirect reference detection via relationship graph
 * - Multiple matching strategies (exact, normalized, pattern-based)
 * - Support for pronouns and anaphora resolution
 *
 * Algorithm Complexity:
 * - detectReferences: O(n * m) where n = entities, m = average patterns per entity
 * - detectIndirectReferences: O(k) where k = related entities
 */

"use strict";

/**
 * @typedef {Object} Reference
 * @property {string} entityId - Referenced entity ID
 * @property {boolean} indirect - Whether this is an indirect reference
 * @property {string} matchedBy - How the match was found ('exact', 'normalized', 'pattern', 'indirect')
 * @property {number} position - Character position in text
 * @property {number} confidence - Match confidence 0-1
 * @property {string} via - For indirect references, the entity that provided the link
 */

class ReferenceDetector {
  /**
   * @param {Object} options
   * @param {boolean} options.enablePronouns - Detect pronoun references (default: true)
   * @param {number} options.minConfidence - Minimum confidence threshold (default: 0.5)
   * @param {Object} options.pronouns - Custom pronoun mappings
   */
  constructor(options = {}) {
    this._enablePronouns = options.enablePronouns !== false;
    this._minConfidence = options.minConfidence ?? 0.5;

    // Default pronoun mappings for anaphora resolution
    this._pronouns = options.pronouns || {
      singular: new Set(["it", "this", "that", "the"]),
      plural: new Set(["they", "them", "these", "those", "both"]),
      project: new Set(["the project", "that project", "this project", "the codebase"]),
      file: new Set(["the file", "that file", "this file", "the document"]),
      plugin: new Set(["the plugin", "that plugin", "this plugin", "the extension"]),
      tool: new Set(["the tool", "that tool", "this tool", "the function"]),
    };

    // Cache for compiled patterns
    this._patternCache = new Map();
  }

  /**
   * Detect direct references to entities in text.
   * Uses word-boundary matching to avoid false positives.
   *
   * Time complexity: O(n * m) where n = entities, m = patterns per entity
   *
   * @param {string} text - Text to search for references
   * @param {Array} entities - Entities to check for references
   * @param {Object} options
   * @param {boolean} options.includePronouns - Include pronoun-based detection
   * @returns {Array<Reference>} Detected references
   */
  detectReferences(text, entities, options = {}) {
    const references = [];
    const includePronouns = options.includePronouns !== false && this._enablePronouns;

    if (!text || !entities || entities.length === 0) {
      return references;
    }

    const normalizedText = " " + text.toLowerCase() + " ";
    const matchedPositions = new Set(); // Track matched positions to avoid duplicates

    for (const entity of entities) {
      const patterns = this._buildPatterns(entity);
      let bestMatch = null;
      let bestConfidence = 0;

      for (const pattern of patterns) {
        const matches = this._findMatches(normalizedText, pattern, matchedPositions);

        for (const match of matches) {
          const confidence = this._calculateConfidence(match, pattern, entity);

          if (confidence >= this._minConfidence && confidence > bestConfidence) {
            bestConfidence = confidence;
            bestMatch = {
              entityId: entity.id,
              indirect: false,
              matchedBy: pattern.type,
              position: match.index,
              confidence: confidence,
              matchedText: match.text,
            };
          }
        }
      }

      if (bestMatch) {
        references.push(bestMatch);
      }
    }

    // Sort by position for sequential analysis
    references.sort((a, b) => a.position - b.position);

    return references;
  }

  /**
   * Build matching patterns for an entity.
   * @private
   */
  _buildPatterns(entity) {
    const cacheKey = entity.id;
    if (this._patternCache.has(cacheKey)) {
      return this._patternCache.get(cacheKey);
    }

    const patterns = [];

    // Pattern 1: Exact ID match (highest confidence)
    if (entity.id) {
      patterns.push({
        type: "exact",
        regex: new RegExp(`\\b${this._escapeRegex(entity.id.toLowerCase())}\\b`, "g"),
        priority: 1.0,
      });
    }

    // Pattern 2: Normalized name match
    if (entity.normalized) {
      patterns.push({
        type: "normalized",
        regex: new RegExp(`\\b${this._escapeRegex(entity.normalized.toLowerCase())}\\b`, "g"),
        priority: 0.95,
      });
    }

    // Pattern 3: Display name with word boundaries
    if (entity.name) {
      patterns.push({
        type: "name",
        regex: new RegExp(`\\b${this._escapeRegex(entity.name)}\\b`, "g"),
        priority: 0.9,
      });
    }

    // Pattern 4: CamelCase variant (for projects)
    if (entity.name && entity.name.includes && /[A-Z]/.test(entity.name)) {
      const camelPattern = entity.name.replace(/([A-Z])/g, "[a-z]*$1[a-z]*");
      patterns.push({
        type: "camelcase",
        regex: new RegExp(`\\b${camelPattern}\\b`, "g"),
        priority: 0.85,
      });
    }

    // Pattern 5: Hyphenated variant
    if (entity.normalized && entity.normalized.includes("_")) {
      const hyphenated = entity.normalized.replace(/_/g, "-");
      patterns.push({
        type: "hyphenated",
        regex: new RegExp(`\\b${this._escapeRegex(hyphenated)}\\b`, "g"),
        priority: 0.85,
      });
    }

    // Pattern 6: Short name (last part of ID)
    if (entity.id && entity.id.includes(":")) {
      const shortName = entity.id.split(":").pop();
      if (shortName && shortName.length >= 3) {
        patterns.push({
          type: "short",
          regex: new RegExp(`\\b${this._escapeRegex(shortName.toLowerCase())}\\b`, "g"),
          priority: 0.7,
        });
      }
    }

    // Pattern 7: Aliases
    if (entity.aliases && Array.isArray(entity.aliases)) {
      for (const alias of entity.aliases) {
        patterns.push({
          type: "alias",
          regex: new RegExp(`\\b${this._escapeRegex(alias.toLowerCase())}\\b`, "g"),
          priority: 0.9,
        });
      }
    }

    this._patternCache.set(cacheKey, patterns);
    return patterns;
  }

  /**
   * Escape special regex characters.
   * @private
   */
  _escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * Find all matches of a pattern in text.
   * @private
   */
  _findMatches(text, pattern, matchedPositions) {
    const matches = [];
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
    let match;

    while ((match = regex.exec(text)) !== null) {
      // Skip if this position is already matched by a higher priority pattern
      const positionKey = `${match.index}-${match[0].length}`;
      if (matchedPositions.has(positionKey)) {
        continue;
      }

      matchedPositions.add(positionKey);
      matches.push({
        index: match.index,
        text: match[0],
        length: match[0].length,
      });

      // Prevent infinite loops on zero-width matches
      if (regex.lastIndex === match.index) {
        regex.lastIndex++;
      }
    }

    return matches;
  }

  /**
   * Calculate confidence score for a match.
   * @private
   */
  _calculateConfidence(match, pattern, entity) {
    let confidence = pattern.priority;

    // Boost confidence for longer matches (less likely to be coincidental)
    if (match.length >= 8) {
      confidence += 0.05;
    }

    // Reduce confidence for very short matches (potential false positives)
    if (match.length <= 3) {
      confidence -= 0.2;
    }

    // Boost for exact case matches
    if (pattern.type === "name" && match.text === entity.name) {
      confidence += 0.05;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Detect indirect references to an entity via related entities.
   * If "clarity" is related to "subagents", and text mentions "subagents",
   * then "clarity" may also be relevant.
   *
   * Time complexity: O(k) where k = number of related entities
   *
   * @param {string} text - Text to analyze
   * @param {Object} entity - Entity to check for indirect references
   * @param {Array} relatedEntities - Entities related to the target entity
   * @param {Object} options
   * @param {number} options.minRelationshipStrength - Minimum relationship strength (default: 0.3)
   * @param {number} options.maxHops - Maximum relationship hops (default: 2)
   * @returns {Array<Reference>} Indirect references found
   */
  detectIndirectReferences(text, entity, relatedEntities, options = {}) {
    const references = [];
    const minStrength = options.minRelationshipStrength ?? 0.3;
    const maxHops = options.maxHops ?? 2;

    if (!text || !entity || !relatedEntities || relatedEntities.length === 0) {
      return references;
    }

    const normalizedText = " " + text.toLowerCase() + " ";

    for (const related of relatedEntities) {
      // Check if related entity is directly mentioned
      const relatedPatterns = this._buildPatterns(related);
      let isMentioned = false;
      let mentionPosition = -1;
      let bestMatchType = null;

      for (const pattern of relatedPatterns) {
        const regex = new RegExp(pattern.regex.source, "i");
        const match = regex.exec(normalizedText);
        if (match) {
          isMentioned = true;
          mentionPosition = match.index;
          bestMatchType = pattern.type;
          break;
        }
      }

      if (isMentioned) {
        // Calculate indirect reference confidence
        const relationshipStrength = related.strength || related.relationshipStrength || 0.5;

        if (relationshipStrength >= minStrength) {
          const confidence = relationshipStrength * 0.7; // Indirect references have lower confidence

          if (confidence >= this._minConfidence) {
            references.push({
              entityId: entity.id,
              indirect: true,
              matchedBy: `indirect:${bestMatchType}`,
              position: mentionPosition,
              confidence: confidence,
              via: related.id || related.entityId,
              relationshipType: related.type,
              relationshipStrength: relationshipStrength,
            });
          }
        }
      }
    }

    // Sort by confidence descending
    references.sort((a, b) => b.confidence - a.confidence);

    return references;
  }

  /**
   * Detect references using a relationship graph for indirect inference.
   * Combines direct detection with graph-based indirect detection.
   *
   * @param {string} text - Text to analyze
   * @param {Array} entities - All known entities
   * @param {RelationshipGraph} graph - Relationship graph for indirect detection
   * @param {Object} options
   * @returns {Array<Reference>} All detected references (direct and indirect)
   */
  detectWithGraph(text, entities, graph, options = {}) {
    // First, get direct references
    const directRefs = this.detectReferences(text, entities, options);
    const allRefs = [...directRefs];
    const directlyReferencedIds = new Set(directRefs.map((r) => r.entityId));

    // Then check for indirect references for entities NOT directly referenced
    const indirectOptions = {
      minRelationshipStrength: options.minRelationshipStrength ?? 0.3,
      maxHops: options.maxHops ?? 2,
    };

    for (const entity of entities) {
      if (directlyReferencedIds.has(entity.id)) {
        continue; // Skip entities that are already directly referenced
      }

      // Get related entities from graph
      const related = graph
        ? graph.getRelated(entity.id, indirectOptions.minRelationshipStrength)
        : [];

      if (related.length > 0) {
        // Convert graph output to expected format
        const formattedRelated = related.map((r) => ({
          id: r.entityId,
          strength: r.strength,
          type: r.type,
        }));

        const indirectRefs = this.detectIndirectReferences(
          text,
          entity,
          formattedRelated,
          indirectOptions,
        );
        allRefs.push(...indirectRefs);
      }
    }

    // Deduplicate and sort by confidence
    const seen = new Set();
    return allRefs
      .filter((ref) => {
        const key = `${ref.entityId}-${ref.indirect}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Detect pronoun references (anaphora resolution).
   * @param {string} text - Text to analyze
   * @param {Array} previousReferences - Previously detected references (antecedents)
   * @returns {Array<Reference>} Pronoun-based references
   */
  detectPronounReferences(text, previousReferences = []) {
    if (!this._enablePronouns || previousReferences.length === 0) {
      return [];
    }

    const references = [];
    const normalizedText = text.toLowerCase();

    // Find pronouns and associate with most recent matching antecedent
    const pronounMatches = this._findPronouns(normalizedText);

    for (const pronoun of pronounMatches) {
      // Find most recent antecedent that matches the pronoun's number/gender
      const antecedent = this._resolveAntecedent(pronoun, previousReferences);

      if (antecedent) {
        references.push({
          entityId: antecedent.entityId,
          indirect: true,
          matchedBy: "pronoun",
          position: pronoun.position,
          confidence: 0.5, // Lower confidence for pronoun resolution
          via: pronoun.text,
          isPronoun: true,
        });
      }
    }

    return references;
  }

  /**
   * Find pronouns in text.
   * @private
   */
  _findPronouns(text) {
    const pronouns = [];
    const allPronouns = [
      ...Array.from(this._pronouns.singular),
      ...Array.from(this._pronouns.plural),
      ...Array.from(this._pronouns.project),
      ...Array.from(this._pronouns.file),
      ...Array.from(this._pronouns.plugin),
      ...Array.from(this._pronouns.tool),
    ];

    for (const pronoun of allPronouns) {
      const regex = new RegExp(`\\b${this._escapeRegex(pronoun)}\\b`, "g");
      let match;
      while ((match = regex.exec(text)) !== null) {
        pronouns.push({
          text: pronoun,
          position: match.index,
          isPlural: this._pronouns.plural.has(pronoun),
          category: this._getPronounCategory(pronoun),
        });
      }
    }

    return pronouns.sort((a, b) => a.position - b.position);
  }

  /**
   * Get category for a pronoun.
   * @private
   */
  _getPronounCategory(pronoun) {
    if (this._pronouns.project.has(pronoun)) return "project";
    if (this._pronouns.file.has(pronoun)) return "file";
    if (this._pronouns.plugin.has(pronoun)) return "plugin";
    if (this._pronouns.tool.has(pronoun)) return "tool";
    return "general";
  }

  /**
   * Resolve pronoun to an antecedent.
   * @private
   */
  _resolveAntecedent(pronoun, previousReferences) {
    // Sort by recency (position descending)
    const sorted = [...previousReferences].sort((a, b) => b.position - a.position);

    for (const ref of sorted) {
      // Simple heuristic: match pronoun category with entity type
      const entityType = ref.entityType || this._inferEntityType(ref.entityId);

      if (pronoun.category === entityType || pronoun.category === "general") {
        return ref;
      }
    }

    // Fallback to most recent reference
    return sorted[0];
  }

  /**
   * Infer entity type from ID.
   * @private
   */
  _inferEntityType(entityId) {
    if (!entityId) return "general";
    const prefix = entityId.split(":")[0];
    const typeMap = {
      project: "project",
      file: "file",
      plugin: "plugin",
      tool: "tool",
    };
    return typeMap[prefix] || "general";
  }

  /**
   * Clear pattern cache.
   */
  clearCache() {
    this._patternCache.clear();
  }
}

module.exports = { ReferenceDetector };
