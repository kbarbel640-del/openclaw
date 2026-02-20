/**
 * RelationshipGraph — Graph data structure for entity relationships.
 *
 * Features:
 * - Fast lookups using Map/Set-based data structures
 * - Co-occurrence detection within sliding window
 * - Relationship strength tracking with decay
 * - JSON serialization for persistence
 *
 * Data Structures:
 * - adjacency: Map<entityId, Map<targetId, Relationship>>
 * - index: Map<entityId, Set<Relationship>> for quick traversal
 *
 * Complexity:
 * - addRelationship: O(1)
 * - getRelated: O(k) where k = number of relationships
 * - detectCooccurrences: O(n * m) where n = words, m = entities in window
 */

"use strict";

/**
 * Relationship types between entities
 * @readonly
 * @enum {string}
 */
const RelType = {
  CONTAINS: "contains", // project:claracore contains file:soul_md
  USES: "uses", // plugin:clarity uses tool:subagents
  RELATED: "related", // Generic co-occurrence
  DEPENDS_ON: "depends_on", // plugin:awareness depends_on plugin:clarity
  IMPLEMENTS: "implements", // project:X implements feature:Y
  MENTIONS: "mentions", // text mentions entity
  COREFERS: "corefers", // Entity refers to same thing
};

/**
 * @typedef {Object} Relationship
 * @property {string} sourceId - Source entity ID
 * @property {string} targetId - Target entity ID
 * @property {string} type - Relationship type from RelType
 * @property {number} strength - Relationship strength 0-1
 * @property {number} lastCooccurrence - Last turn number where co-occurred
 * @property {number} cooccurrenceCount - Total co-occurrences
 */

class RelationshipGraph {
  /**
   * @param {Object} options
   * @param {number} options.decayHalfLife - Turns for strength to halve (default: 20)
   * @param {number} options.maxRelationshipsPerEntity - Max relationships to keep (default: 50)
   */
  constructor(options = {}) {
    // Primary storage: adjacency list with Map for O(1) lookups
    // Map<entityId, Map<targetId, Relationship>>
    this._adjacency = new Map();

    // Index for quick relationship traversal: Map<entityId, Set<Relationship>>
    // This provides O(1) access to all relationships of an entity
    this._index = new Map();

    // Configuration
    this._decayHalfLife = options.decayHalfLife || 20;
    this._maxRelationshipsPerEntity = options.maxRelationshipsPerEntity || 50;
    this._minStrengthThreshold = options.minStrengthThreshold || 0.01;

    // Co-occurrence window size (in words)
    this._cooccurrenceWindow = options.cooccurrenceWindow || 10;

    // Current turn for decay calculations
    this._currentTurn = 0;
  }

  /**
   * Get current turn number.
   * @returns {number}
   */
  get currentTurn() {
    return this._currentTurn;
  }

  /**
   * Set current turn (for decay calculations).
   * @param {number} turn
   */
  setCurrentTurn(turn) {
    this._currentTurn = turn;
  }

  /**
   * Increment turn counter.
   */
  nextTurn() {
    this._currentTurn++;
  }

  /**
   * Add or update a relationship between two entities.
   * Time complexity: O(1)
   *
   * @param {string} sourceId - Source entity ID
   * @param {string} targetId - Target entity ID
   * @param {string} type - Relationship type from RelType
   * @param {number} strength - Initial strength (0-1)
   * @param {Object} metadata - Optional metadata
   * @returns {Relationship} The created/updated relationship
   */
  addRelationship(sourceId, targetId, type, strength = 0.5, metadata = {}) {
    if (!sourceId || !targetId) {
      throw new Error("sourceId and targetId are required");
    }

    if (sourceId === targetId) {
      return null; // No self-loops
    }

    // Normalize strength to 0-1
    strength = Math.max(0, Math.min(1, strength));

    // Initialize adjacency map for source if needed
    if (!this._adjacency.has(sourceId)) {
      this._adjacency.set(sourceId, new Map());
    }

    const sourceMap = this._adjacency.get(sourceId);
    const existing = sourceMap.get(targetId);

    const now = this._currentTurn;

    if (existing) {
      // Update existing relationship
      existing.cooccurrenceCount++;
      existing.lastCooccurrence = now;
      // Strengthen existing bond (with ceiling)
      existing.strength = Math.min(1, existing.strength + strength * 0.5);
      return existing;
    }

    // Create new relationship
    const relationship = {
      sourceId,
      targetId,
      type,
      strength,
      lastCooccurrence: now,
      cooccurrenceCount: 1,
      createdAt: now,
      ...metadata,
    };

    // Add to adjacency map
    sourceMap.set(targetId, relationship);

    // Add to index for quick traversal
    if (!this._index.has(sourceId)) {
      this._index.set(sourceId, new Set());
    }
    this._index.get(sourceId).add(relationship);

    // Ensure reverse lookup exists for undirected queries
    if (!this._index.has(targetId)) {
      this._index.set(targetId, new Set());
    }
    // Note: We don't add to target's Set here to avoid duplication
    // The adjacency stores directed edges, index stores all connections

    // Prune if entity has too many relationships
    this._pruneRelationships(sourceId);

    return relationship;
  }

  /**
   * Remove a relationship.
   * Time complexity: O(1)
   *
   * @param {string} sourceId
   * @param {string} targetId
   * @returns {boolean} True if relationship was removed
   */
  removeRelationship(sourceId, targetId) {
    const sourceMap = this._adjacency.get(sourceId);
    if (!sourceMap) return false;

    const rel = sourceMap.get(targetId);
    if (!rel) return false;

    // Remove from adjacency
    sourceMap.delete(targetId);

    // Remove from index
    const indexSet = this._index.get(sourceId);
    if (indexSet) {
      indexSet.delete(rel);
    }

    return true;
  }

  /**
   * Get all entities related to a given entity.
   * Time complexity: O(k) where k = number of relationships
   *
   * @param {string} entityId - Entity to find relations for
   * @param {number} minStrength - Minimum relationship strength (0-1)
   * @param {Object} options
   * @param {boolean} options.includeIndirect - Include indirectly related entities
   * @param {number} options.indirectDepth - Max depth for indirect relationships (default: 2)
   * @returns {Array<{entityId: string, strength: number, type: string, path: string[]}>}
   */
  getRelated(entityId, minStrength = 0, options = {}) {
    const { includeIndirect = false, indirectDepth = 2 } = options;
    const results = [];
    const visited = new Set();

    // Always get direct neighbors first
    const directNeighbors = this._getNeighbors(entityId, minStrength);
    for (const neighbor of directNeighbors) {
      if (!visited.has(neighbor.entityId)) {
        visited.add(neighbor.entityId);
        results.push({
          entityId: neighbor.entityId,
          strength: neighbor.strength,
          type: neighbor.type,
          path: [entityId],
          depth: 1,
        });
      }
    }

    // If indirect requested, do BFS from each direct neighbor
    if (includeIndirect) {
      const queue = directNeighbors.map((n) => ({
        id: n.entityId,
        depth: 1,
        accumulatedStrength: n.strength,
      }));

      while (queue.length > 0) {
        const { id, depth, accumulatedStrength } = queue.shift();

        if (depth >= indirectDepth) continue;

        const neighbors = this._getNeighbors(id, minStrength);
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor.entityId) && neighbor.entityId !== entityId) {
            visited.add(neighbor.entityId);
            const strength = accumulatedStrength * neighbor.strength;
            results.push({
              entityId: neighbor.entityId,
              strength: strength,
              type: neighbor.type,
              path: [entityId, id],
              depth: depth + 1,
            });

            queue.push({
              id: neighbor.entityId,
              depth: depth + 1,
              accumulatedStrength: strength,
            });
          }
        }
      }
    }

    // Sort by strength descending
    return results.sort((a, b) => b.strength - a.strength);
  }

  /**
   * Get direct neighbors of an entity.
   * @private
   */
  _getNeighbors(entityId, minStrength = 0) {
    const neighbors = [];
    const sourceMap = this._adjacency.get(entityId);

    if (sourceMap) {
      for (const [targetId, rel] of sourceMap) {
        const currentStrength = this._applyDecay(rel.strength, rel.lastCooccurrence);
        if (currentStrength >= minStrength) {
          neighbors.push({ entityId: targetId, strength: currentStrength, type: rel.type });
        }
      }
    }

    // Also check reverse relationships (undirected view)
    for (const [sourceId, targetMap] of this._adjacency) {
      if (sourceId === entityId) continue;
      const rel = targetMap.get(entityId);
      if (rel) {
        const currentStrength = this._applyDecay(rel.strength, rel.lastCooccurrence);
        if (currentStrength >= minStrength) {
          neighbors.push({ entityId: sourceId, strength: currentStrength, type: rel.type });
        }
      }
    }

    return neighbors;
  }

  /**
   * Get relationship strength between two entities.
   * @private
   */
  _getRelationshipStrength(sourceId, targetId) {
    const sourceMap = this._adjacency.get(sourceId);
    if (sourceMap) {
      const rel = sourceMap.get(targetId);
      if (rel) {
        return this._applyDecay(rel.strength, rel.lastCooccurrence);
      }
    }

    // Check reverse
    const reverseMap = this._adjacency.get(targetId);
    if (reverseMap) {
      const rel = reverseMap.get(sourceId);
      if (rel) {
        return this._applyDecay(rel.strength, rel.lastCooccurrence);
      }
    }

    return 0;
  }

  /**
   * Get relationship type between two entities.
   * @private
   */
  _getRelationshipType(sourceId, targetId) {
    const sourceMap = this._adjacency.get(sourceId);
    if (sourceMap) {
      const rel = sourceMap.get(targetId);
      if (rel) return rel.type;
    }

    const reverseMap = this._adjacency.get(targetId);
    if (reverseMap) {
      const rel = reverseMap.get(sourceId);
      if (rel) return rel.type;
    }

    return null;
  }

  /**
   * Apply temporal decay to relationship strength.
   * @private
   */
  _applyDecay(strength, lastCooccurrence) {
    const turnsAgo = this._currentTurn - lastCooccurrence;
    const decayFactor = Math.exp(-turnsAgo / this._decayHalfLife);
    return strength * decayFactor;
  }

  /**
   * Prune weakest relationships when entity exceeds max.
   * @private
   */
  _pruneRelationships(entityId) {
    const sourceMap = this._adjacency.get(entityId);
    if (!sourceMap || sourceMap.size <= this._maxRelationshipsPerEntity) {
      return;
    }

    // Convert to array and sort by strength (ascending)
    const relationships = Array.from(sourceMap.entries());
    relationships.sort((a, b) => {
      const strengthA = this._applyDecay(a[1].strength, a[1].lastCooccurrence);
      const strengthB = this._applyDecay(b[1].strength, b[1].lastCooccurrence);
      return strengthA - strengthB;
    });

    // Remove weakest until at max
    const toRemove = relationships.length - this._maxRelationshipsPerEntity;
    for (let i = 0; i < toRemove; i++) {
      const [targetId, rel] = relationships[i];
      sourceMap.delete(targetId);

      const indexSet = this._index.get(entityId);
      if (indexSet) {
        indexSet.delete(rel);
      }
    }
  }

  /**
   * Detect co-occurrences of entities within a sliding window.
   * Creates/updates relationships for co-occurring entities.
   *
   * Time complexity: O(n * m) where n = words, m = avg entities per window
   *
   * @param {string} text - Text to analyze
   * @param {Array<{id: string, positions: number[]}>} entities - Entities with word positions
   * @param {Object} options
   * @param {number} options.windowSize - Window size in words (default: 10)
   * @param {string} options.relationshipType - Type for created relationships
   * @returns {Array<Relationship>} New/updated relationships
   */
  detectCooccurrences(text, entities, options = {}) {
    const windowSize = options.windowSize || this._cooccurrenceWindow;
    const relType = options.relationshipType || RelType.RELATED;
    const newRelationships = [];

    // Build position map: wordIndex -> array of entityIds at that position
    const positionMap = new Map();
    for (const entity of entities) {
      if (!entity.positions || entity.positions.length === 0) {
        // If no positions provided, extract from text
        entity.positions = this._extractPositions(text, entity);
      }

      for (const pos of entity.positions) {
        if (!positionMap.has(pos)) {
          positionMap.set(pos, new Set());
        }
        positionMap.get(pos).add(entity.id);
      }
    }

    // Get sorted unique positions
    const positions = Array.from(positionMap.keys()).sort((a, b) => a - b);

    // Sliding window to find co-occurrences
    for (let i = 0; i < positions.length; i++) {
      const startPos = positions[i];
      const windowEnd = startPos + windowSize;

      // Find all entities in window
      const windowEntities = new Set();
      for (let j = i; j < positions.length && positions[j] <= windowEnd; j++) {
        for (const entityId of positionMap.get(positions[j])) {
          windowEntities.add(entityId);
        }
      }

      // Create relationships between all pairs in window
      const windowArray = Array.from(windowEntities);
      for (let a = 0; a < windowArray.length; a++) {
        for (let b = a + 1; b < windowArray.length; b++) {
          const sourceId = windowArray[a];
          const targetId = windowArray[b];

          // Calculate strength based on proximity (closer = stronger)
          const distance = this._calculateMinDistance(
            sourceId,
            targetId,
            positionMap,
            startPos,
            windowEnd,
          );
          const strength = Math.max(0.1, 1 - distance / windowSize);

          const rel = this.addRelationship(sourceId, targetId, relType, strength);
          if (rel) {
            newRelationships.push(rel);
          }

          // Also create reverse relationship for undirected co-occurrence
          const reverseRel = this.addRelationship(targetId, sourceId, relType, strength);
          if (reverseRel && !newRelationships.includes(reverseRel)) {
            newRelationships.push(reverseRel);
          }
        }
      }
    }

    return newRelationships;
  }

  /**
   * Extract word positions for an entity from text.
   * @private
   */
  _extractPositions(text, entity) {
    const positions = [];
    const normalizedText = text.toLowerCase();
    const normalizedName =
      entity.normalized || entity.name?.toLowerCase() || entity.id.toLowerCase();

    // Simple word-based position extraction
    const words = normalizedText.split(/\s+/);
    const entityWords = normalizedName.split(/\s+/);

    for (let i = 0; i <= words.length - entityWords.length; i++) {
      const match = entityWords.every((word, idx) => words[i + idx] === word);
      if (match) {
        positions.push(i);
      }
    }

    return positions;
  }

  /**
   * Calculate minimum distance between two entities in position map.
   * @private
   */
  _calculateMinDistance(entityA, entityB, positionMap, windowStart, windowEnd) {
    let minDistance = Infinity;

    for (const [pos, entities] of positionMap) {
      if (pos < windowStart || pos > windowEnd) continue;

      if (entities.has(entityA)) {
        // Find closest position of entityB
        for (const [otherPos, otherEntities] of positionMap) {
          if (otherPos < windowStart || otherPos > windowEnd) continue;
          if (otherEntities.has(entityB)) {
            minDistance = Math.min(minDistance, Math.abs(pos - otherPos));
          }
        }
      }
    }

    return minDistance === Infinity ? windowEnd - windowStart : minDistance;
  }

  /**
   * Get all relationships for an entity.
   * @param {string} entityId
   * @returns {Array<Relationship>}
   */
  getRelationships(entityId) {
    const result = [];

    // Outgoing relationships
    const sourceMap = this._adjacency.get(entityId);
    if (sourceMap) {
      for (const rel of sourceMap.values()) {
        result.push({
          ...rel,
          strength: this._applyDecay(rel.strength, rel.lastCooccurrence),
        });
      }
    }

    // Incoming relationships
    for (const [sourceId, targetMap] of this._adjacency) {
      if (sourceId === entityId) continue;
      const rel = targetMap.get(entityId);
      if (rel) {
        result.push({
          ...rel,
          sourceId,
          targetId: entityId,
          strength: this._applyDecay(rel.strength, rel.lastCooccurrence),
        });
      }
    }

    return result.sort((a, b) => b.strength - a.strength);
  }

  /**
   * Get relationship statistics.
   * @returns {Object}
   */
  getStats() {
    let totalRelationships = 0;
    const allEntities = new Set();
    const typeCounts = {};

    for (const [entityId, targetMap] of this._adjacency) {
      allEntities.add(entityId);
      totalRelationships += targetMap.size;

      for (const rel of targetMap.values()) {
        allEntities.add(rel.targetId); // Also count target entities
        typeCounts[rel.type] = (typeCounts[rel.type] || 0) + 1;
      }
    }

    return {
      entityCount: allEntities.size,
      totalRelationships,
      averageRelationshipsPerEntity:
        allEntities.size > 0 ? totalRelationships / allEntities.size : 0,
      typeDistribution: typeCounts,
    };
  }

  /**
   * Clear all relationships.
   */
  clear() {
    this._adjacency.clear();
    this._index.clear();
    this._currentTurn = 0;
  }

  /**
   * Serialize graph to JSON.
   * @returns {Object} Serializable graph data
   */
  toJSON() {
    const relationships = [];

    for (const [sourceId, targetMap] of this._adjacency) {
      for (const rel of targetMap.values()) {
        relationships.push({
          sourceId: rel.sourceId,
          targetId: rel.targetId,
          type: rel.type,
          strength: rel.strength,
          lastCooccurrence: rel.lastCooccurrence,
          cooccurrenceCount: rel.cooccurrenceCount,
          createdAt: rel.createdAt,
        });
      }
    }

    return {
      version: "1.0",
      currentTurn: this._currentTurn,
      config: {
        decayHalfLife: this._decayHalfLife,
        maxRelationshipsPerEntity: this._maxRelationshipsPerEntity,
        cooccurrenceWindow: this._cooccurrenceWindow,
      },
      relationships,
    };
  }

  /**
   * Deserialize graph from JSON.
   * @param {Object} data - Data from toJSON()
   * @returns {RelationshipGraph} New graph instance
   */
  static fromJSON(data) {
    const graph = new RelationshipGraph(data.config || {});

    if (data.currentTurn !== undefined) {
      graph._currentTurn = data.currentTurn;
    }

    if (data.relationships && Array.isArray(data.relationships)) {
      for (const rel of data.relationships) {
        // Bypass addRelationship to avoid double-counting cooccurrences
        if (!graph._adjacency.has(rel.sourceId)) {
          graph._adjacency.set(rel.sourceId, new Map());
        }

        const sourceMap = graph._adjacency.get(rel.sourceId);
        sourceMap.set(rel.targetId, {
          sourceId: rel.sourceId,
          targetId: rel.targetId,
          type: rel.type,
          strength: rel.strength,
          lastCooccurrence: rel.lastCooccurrence,
          cooccurrenceCount: rel.cooccurrenceCount || 1,
          createdAt: rel.createdAt || rel.lastCooccurrence,
        });

        // Update index
        if (!graph._index.has(rel.sourceId)) {
          graph._index.set(rel.sourceId, new Set());
        }
        graph._index.get(rel.sourceId).add(sourceMap.get(rel.targetId));
      }
    }

    return graph;
  }

  /**
   * Load graph from serialized string.
   * @param {string} jsonString
   * @returns {RelationshipGraph}
   */
  static fromString(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      return RelationshipGraph.fromJSON(data);
    } catch (err) {
      throw new Error(`Failed to parse graph JSON: ${err.message}`);
    }
  }
}

module.exports = { RelationshipGraph, RelType };
