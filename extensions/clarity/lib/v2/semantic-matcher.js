/**
 * SemanticMatcher — Lightweight semantic similarity for entity deduplication
 *
 * Uses character n-grams and word co-occurrence vectors for local, fast
 * similarity computation without external API calls.
 *
 * Thresholds:
 * - 0.7+ : Consider entities as duplicates for merging
 * - 0.5+ : Suggest relationship between entities
 */

"use strict";

/**
 * Build a sparse vector representation from text using character n-grams
 * and word unigrams/bigrams for lightweight semantic similarity.
 *
 * @param {string} text - Input text to vectorize
 * @param {Object} options - Vectorization options
 * @returns {Map<string, number>} Sparse vector as Map of ngram -> weight
 */
function buildVector(text, options = {}) {
  const {
    ngramRange = [2, 5], // Character n-gram range (extended to 5)
    useWords = true, // Include word-level features
    wordBoost = 1.5, // Weight multiplier for word features
  } = options;

  const vector = new Map();
  const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, "");

  // Character n-grams
  for (let n = ngramRange[0]; n <= ngramRange[1]; n++) {
    for (let i = 0; i <= normalized.length - n; i++) {
      const ngram = normalized.slice(i, i + n);
      if (ngram.includes(" ")) continue; // Skip ngrams crossing word boundaries
      vector.set(`c:${ngram}`, (vector.get(`c:${ngram}`) || 0) + 1);
    }
  }

  // Word-level features
  if (useWords) {
    const words = normalized.split(/\s+/).filter((w) => w.length >= 2);

    // Unigrams
    for (const word of words) {
      const key = `w:${word}`;
      vector.set(key, (vector.get(key) || 0) + wordBoost);
    }

    // Bigrams
    for (let i = 0; i < words.length - 1; i++) {
      const bigram = `b:${words[i]}_${words[i + 1]}`;
      vector.set(bigram, (vector.get(bigram) || 0) + wordBoost * 1.5);
    }
  }

  // Normalize to unit length
  return normalizeVector(vector);
}

/**
 * Normalize a sparse vector to unit length (L2 norm)
 * @param {Map<string, number>} vector - Input vector
 * @returns {Map<string, number>} Normalized vector
 */
function normalizeVector(vector) {
  let sumSquares = 0;
  for (const weight of vector.values()) {
    sumSquares += weight * weight;
  }

  const norm = Math.sqrt(sumSquares);
  if (norm === 0) return vector;

  const normalized = new Map();
  for (const [key, weight] of vector) {
    normalized.set(key, weight / norm);
  }
  return normalized;
}

/**
 * Compute cosine similarity between two sparse vectors
 * @param {Map<string, number>} vec1 - First vector
 * @param {Map<string, number>} vec2 - Second vector
 * @returns {number} Cosine similarity in [0, 1]
 */
function cosineSimilarity(vec1, vec2) {
  let dotProduct = 0;

  // Iterate over smaller vector for efficiency
  const [small, large] = vec1.size < vec2.size ? [vec1, vec2] : [vec2, vec1];

  for (const [key, weight] of small) {
    if (large.has(key)) {
      dotProduct += weight * large.get(key);
    }
  }

  // Vectors are already normalized, so cosine = dot product
  return Math.max(0, Math.min(1, dotProduct));
}

/**
 * Semantic similarity result between two entities
 */
class SimilarityResult {
  constructor(entity1, entity2, score, thresholds = {}) {
    this.entity1Id = entity1.id;
    this.entity2Id = entity2.id;
    this.score = score;
    this.thresholds = {
      merge: thresholds.mergeThreshold ?? 0.7,
      relate: thresholds.relateThreshold ?? 0.5,
    };
    this.action = this.determineAction(score);
  }

  /**
   * Determine action based on similarity threshold
   * - >= mergeThreshold: merge (entities are duplicates)
   * - >= relateThreshold: relate (entities are related)
   * - < relateThreshold: none
   */
  determineAction(score) {
    if (score >= this.thresholds.merge) return "merge";
    if (score >= this.thresholds.relate) return "relate";
    return "none";
  }
}

/**
 * Pre-computed vector cache for entities
 */
class VectorCache {
  constructor(options = {}) {
    this.cache = new Map(); // entityId -> Map (vector)
    this.options = options;
  }

  /**
   * Get or compute vector for an entity
   */
  getVector(entity) {
    if (this.cache.has(entity.id)) {
      return this.cache.get(entity.id);
    }

    // Build vector from entity name and normalized form
    const text = `${entity.name} ${entity.normalized}`.trim();
    const vector = buildVector(text, this.options);
    this.cache.set(entity.id, vector);
    return vector;
  }

  /**
   * Invalidate cached vector for an entity
   */
  invalidate(entityId) {
    this.cache.delete(entityId);
  }

  /**
   * Clear all cached vectors
   */
  clear() {
    this.cache.clear();
  }
}

/**
 * SemanticMatcher — Main class for finding similar entities
 */
class SemanticMatcher {
  constructor(options = {}) {
    this.options = {
      mergeThreshold: 0.7,
      relateThreshold: 0.5,
      maxComparisons: 1000, // Limit comparisons for performance
      ...options,
    };
    this.vectorCache = new VectorCache(options.vectorOptions);
  }

  /**
   * Compute similarity between two entities
   * @param {Entity} entity1 - First entity
   * @param {Entity} entity2 - Second entity
   * @returns {number} Similarity score [0, 1]
   */
  similarity(entity1, entity2) {
    // Exact match shortcut
    if (entity1.normalized === entity2.normalized) {
      return 1.0;
    }

    // Type mismatch penalty (different types are less likely to be duplicates)
    let typePenalty = 1.0;
    if (entity1.type !== entity2.type) {
      typePenalty = 0.8; // Slight penalty for cross-type matches
    }

    const vec1 = this.vectorCache.getVector(entity1);
    const vec2 = this.vectorCache.getVector(entity2);
    const cosine = cosineSimilarity(vec1, vec2);

    return cosine * typePenalty;
  }

  /**
   * Find entities similar to a given entity
   * @param {Entity} entity - Target entity
   * @param {Entity[]} candidates - Array of candidate entities to compare
   * @param {number} [threshold=0.5] - Minimum similarity threshold
   * @returns {SimilarityResult[]} Sorted results (highest similarity first)
   */
  findSimilarEntities(entity, candidates, threshold = 0.5) {
    const results = [];

    for (const candidate of candidates) {
      if (candidate.id === entity.id) continue;

      const score = this.similarity(entity, candidate);
      if (score >= threshold) {
        results.push(
          new SimilarityResult(entity, candidate, score, {
            mergeThreshold: this.options.mergeThreshold,
            relateThreshold: this.options.relateThreshold,
          }),
        );
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * Deduplicate entities by merging high-similarity pairs
   * @param {Entity[]} entities - Array of entities to deduplicate
   * @returns {Object} { entities: Entity[], merged: Map<string, string> }
   *         - entities: Deduplicated entity list
   *         - merged: Map of merged entity ID -> canonical entity ID
   */
  deduplicateEntities(entities) {
    const toKeep = new Set(entities.map((e) => e.id));
    const merged = new Map(); // oldId -> newId
    const canonical = new Map(); // canonicalId -> Entity

    // Sort by mention count (keep entities with more mentions as canonical)
    const sortedEntities = [...entities].sort((a, b) => b.mentionCount - a.mentionCount);

    // Greedy clustering
    for (const entity of sortedEntities) {
      if (!toKeep.has(entity.id)) continue;

      canonical.set(entity.id, entity);

      // Find similar entities among remaining
      const candidates = sortedEntities.filter((e) => toKeep.has(e.id) && e.id !== entity.id);
      const similar = this.findSimilarEntities(entity, candidates, this.options.mergeThreshold);

      for (const result of similar) {
        if (result.action === "merge") {
          toKeep.delete(result.entity2Id);
          merged.set(result.entity2Id, result.entity1Id);

          // Merge mention history into canonical entity
          const canonicalEntity = canonical.get(result.entity1Id);
          const mergedEntity = entities.find((e) => e.id === result.entity2Id);
          if (canonicalEntity && mergedEntity) {
            this.mergeEntities(canonicalEntity, mergedEntity);
          }
        }
      }
    }

    return {
      entities: entities.filter((e) => toKeep.has(e.id)),
      merged,
      relationships: this.suggestRelationships(entities, toKeep, merged),
    };
  }

  /**
   * Merge source entity into target entity
   */
  mergeEntities(target, source) {
    // Merge mention counts
    target.mentionCount += source.mentionCount;

    // Merge mention history (keeping sorted)
    const combinedHistory = [...target.mentionHistory, ...source.mentionHistory].sort(
      (a, b) => a - b,
    );
    target.mentionHistory = combinedHistory.slice(-20); // Keep last 20

    // Update first/last mention turns
    target.firstMentionTurn = Math.min(target.firstMentionTurn, source.firstMentionTurn);
    target.lastMentionTurn = Math.max(target.lastMentionTurn, source.lastMentionTurn);

    // Merge contexts
    if (source.contexts) {
      target.contexts = [...(target.contexts || []), ...source.contexts].slice(-5);
    }

    // Mark as merged
    if (!target.semanticMerges) {
      target.semanticMerges = [];
    }
    target.semanticMerges.push({
      mergedId: source.id,
      name: source.name,
      similarity: this.similarity(target, source),
    });

    // Track semantic similarity info
    if (!target.semanticSimilarity) {
      target.semanticSimilarity = {};
    }
    target.semanticSimilarity[source.id] = this.similarity(target, source);
  }

  /**
   * Suggest relationships between remaining entities
   */
  suggestRelationships(entities, toKeep, merged) {
    const relationships = [];
    const remaining = entities.filter((e) => toKeep.has(e.id));

    // Check all pairs for relate threshold
    for (let i = 0; i < remaining.length; i++) {
      for (let j = i + 1; j < remaining.length; j++) {
        const score = this.similarity(remaining[i], remaining[j]);
        if (score >= this.options.relateThreshold && score < this.options.mergeThreshold) {
          relationships.push({
            sourceId: remaining[i].id,
            targetId: remaining[j].id,
            type: "related",
            strength: score,
            semanticSimilarity: score,
          });
        }
      }
    }

    return relationships.sort((a, b) => b.strength - a.strength);
  }

  /**
   * Batch compute all pairwise similarities (for testing/analysis)
   * @param {Entity[]} entities - Array of entities
   * @returns {SimilarityResult[]} All pairs with similarity > 0
   */
  computeAllSimilarities(entities) {
    const results = [];

    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const score = this.similarity(entities[i], entities[j]);
        if (score > 0) {
          results.push(new SimilarityResult(entities[i], entities[j], score));
        }
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * Clear internal cache
   */
  clearCache() {
    this.vectorCache.clear();
  }
}

module.exports = {
  SemanticMatcher,
  SimilarityResult,
  VectorCache,
  buildVector,
  normalizeVector,
  cosineSimilarity,
};
