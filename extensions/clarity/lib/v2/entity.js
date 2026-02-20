/** @typedef {import('./entity').EntityType} EntityType */
/** @typedef {import('./entity').RelType} RelType */

/**
 * Enumeration of entity types in the Clarity system.
 * @readonly
 * @enum {string}
 */
const EntityType = Object.freeze({
  /** Software projects: ClaraCore, OpenClaw, FocusEngine */
  PROJECT: "project",
  /** OpenClaw plugins: clarity, awareness, continuity */
  PLUGIN: "plugin",
  /** System tools: sessions_spawn, memory_search */
  TOOL: "tool",
  /** Files: SOUL.md, AGENTS.md, memory/2026-02-19.md */
  FILE: "file",
  /** People: Valerie, Odyssey (from PEOPLE sections) */
  PERSON: "person",
  /** Custom keywords passing strict thresholds */
  TOPIC: "topic",
  /** Explicit decisions: "Decided to use X instead of Y" */
  DECISION: "decision",
});

/**
 * Enumeration of relationship types between entities.
 * @readonly
 * @enum {string}
 */
const RelType = Object.freeze({
  /** Parent-child containment: project contains file */
  CONTAINS: "contains",
  /** Usage relationship: plugin uses tool */
  USES: "uses",
  /** Generic co-occurrence */
  RELATED: "related",
  /** Dependency: plugin depends_on another plugin */
  DEPENDS_ON: "depends_on",
  /** Implementation: project implements feature */
  IMPLEMENTS: "implements",
});

/**
 * Represents a relationship between two entities.
 * Tracks co-occurrence strength and timing.
 */
class Relationship {
  /**
   * Creates a new Relationship instance.
   * @param {Object} params - Relationship parameters
   * @param {string} params.targetId - Canonical ID of the target entity (e.g., "project:claracore")
   * @param {RelType} params.type - Type of relationship from RelType enum
   * @param {number} [params.strength=0.5] - Relationship strength 0-1 based on co-occurrence frequency
   * @param {number} [params.lastCooccurrence=0] - Turn number of most recent co-occurrence
   */
  constructor({ targetId, type, strength = 0.5, lastCooccurrence = 0 }) {
    /** @type {string} */
    this.targetId = targetId;
    /** @type {RelType} */
    this.type = type;
    /** @type {number} */
    this.strength = Math.max(0, Math.min(1, strength));
    /** @type {number} */
    this.lastCooccurrence = lastCooccurrence;
  }

  /**
   * Updates relationship strength based on new co-occurrence.
   * Uses exponential moving average for smoothing.
   * @param {number} turn - Current turn number
   * @param {number} [alpha=0.3] - Smoothing factor (higher = more weight to recent)
   * @returns {Relationship} This relationship for chaining
   */
  updateStrength(turn, alpha = 0.3) {
    this.strength = this.strength * (1 - alpha) + alpha;
    this.lastCooccurrence = turn;
    return this;
  }

  /**
   * Serializes relationship to plain object.
   * @returns {{targetId: string, type: RelType, strength: number, lastCooccurrence: number}}
   */
  toJSON() {
    return {
      targetId: this.targetId,
      type: this.type,
      strength: this.strength,
      lastCooccurrence: this.lastCooccurrence,
    };
  }

  /**
   * Creates Relationship from serialized data.
   * @param {Object} data - Serialized relationship data
   * @returns {Relationship}
   */
  static fromJSON(data) {
    return new Relationship(data);
  }
}

/**
 * Represents an extracted entity with full tracking and scoring metadata.
 * Entities are the core unit of context tracking in Clarity v2.
 */
class Entity {
  /**
   * Generates a canonical ID from type and normalized name.
   * @param {EntityType} type - Entity type
   * @param {string} normalized - Normalized name (lowercase, underscores)
   * @returns {string} Canonical ID like "project:claracore"
   */
  static makeId(type, normalized) {
    return `${type}:${normalized}`;
  }

  /**
   * Creates a new Entity instance.
   * @param {Object} params - Entity parameters
   * @param {EntityType} params.type - Entity type from EntityType enum
   * @param {string} params.name - Display name (e.g., "ClaraCore", "SOUL.md")
   * @param {string} params.normalized - Normalized name: lowercase, underscores for spaces/special chars
   * @param {number} [params.firstMentionTurn=0] - Turn number of first mention
   */
  constructor({ type, name, normalized, firstMentionTurn = 0 }) {
    /** @type {string} */
    this.id = Entity.makeId(type, normalized);
    /** @type {EntityType} */
    this.type = type;
    /** @type {string} */
    this.name = name;
    /** @type {string} */
    this.normalized = normalized;

    // Mention tracking
    /** @type {number} */
    this.mentionCount = 1;
    /** @type {number} */
    this.firstMentionTurn = firstMentionTurn;
    /** @type {number} */
    this.lastMentionTurn = firstMentionTurn;
    /** @type {number[]} */
    this.mentionHistory = [firstMentionTurn];

    // Scoring components (see ClarityScorer)
    /** @type {number} */
    this.tfidfScore = 0;
    /** @type {number} */
    this.recencyScore = 0;
    /** @type {number} */
    this.anchorBonus = 0;
    /** @type {number} */
    this.relationshipScore = 0;
    /** @type {number} */
    this.totalScore = 0;

    // Relationships to other entities
    /** @type {Relationship[]} */
    this.relationships = [];

    // Context snippets
    /** @type {string[]} */
    this.contexts = [];
    /** @type {boolean} */
    this.isAnchor = false;

    // Semantic similarity tracking
    /** @type {Object.<string, number>|null} */
    this.semanticSimilarity = null;
    /** @type {Array.<{mergedId: string, name: string, similarity: number}>|null} */
    this.semanticMerges = null;
  }

  /**
   * Records a new mention of this entity.
   * Updates mention count, history, and last mention turn.
   * Keeps only last 20 mentions in history.
   * @param {number} turn - Current turn number
   * @param {string} [context] - Optional context snippet
   * @returns {Entity} This entity for chaining
   */
  addMention(turn, context) {
    this.mentionCount++;
    this.lastMentionTurn = turn;
    this.mentionHistory.push(turn);

    // Keep only last 20 mentions
    if (this.mentionHistory.length > 20) {
      this.mentionHistory.shift();
    }

    // Add context if provided (keep last 5)
    if (context) {
      this.contexts.push(context.slice(0, 200)); // Limit snippet length
      if (this.contexts.length > 5) {
        this.contexts.shift();
      }
    }

    return this;
  }

  /**
   * Gets mention count within a turn window.
   * @param {number} currentTurn - Current turn number
   * @param {number} windowSize - Number of turns to look back
   * @returns {number} Count of mentions in window
   */
  getMentionsInWindow(currentTurn, windowSize) {
    return this.mentionHistory.filter((t) => currentTurn - t <= windowSize).length;
  }

  /**
   * Adds or updates a relationship to another entity.
   * @param {string} targetId - Target entity ID
   * @param {RelType} type - Relationship type
   * @param {number} turn - Current turn number
   * @returns {Relationship} The relationship (new or updated)
   */
  addRelationship(targetId, type, turn) {
    let rel = this.relationships.find((r) => r.targetId === targetId && r.type === type);
    if (rel) {
      rel.updateStrength(turn);
    } else {
      rel = new Relationship({ targetId, type, lastCooccurrence: turn });
      this.relationships.push(rel);
    }
    return rel;
  }

  /**
   * Gets relationships of a specific type.
   * @param {RelType} [type] - Optional type filter
   * @returns {Relationship[]} Matching relationships
   */
  getRelationships(type) {
    if (!type) return this.relationships;
    return this.relationships.filter((r) => r.type === type);
  }

  /**
   * Gets top relationships by strength.
   * @param {number} [limit=3] - Maximum number to return
   * @returns {Relationship[]} Top N relationships
   */
  getTopRelationships(limit = 3) {
    return this.relationships.sort((a, b) => b.strength - a.strength).slice(0, limit);
  }

  /**
   * Marks this entity as an anchor.
   * @param {boolean} [value=true] - Anchor state
   * @returns {Entity} This entity for chaining
   */
  setAnchor(value = true) {
    this.isAnchor = value;
    return this;
  }

  /**
   * Updates the total score based on component scores.
   * @param {Object} scores - Score components
   * @param {number} scores.tfidf - TF-IDF score
   * @param {number} scores.recency - Recency score
   * @param {number} scores.relationship - Relationship score
   * @param {number} [anchorBonus=5] - Bonus for anchored entities
   * @returns {Entity} This entity for chaining
   */
  updateScore({ tfidf, recency, relationship }, anchorBonus = 5) {
    this.tfidfScore = tfidf;
    this.recencyScore = recency;
    this.relationshipScore = relationship;
    this.anchorBonus = this.isAnchor ? anchorBonus : 0;

    this.totalScore = Math.min(100, tfidf + recency + relationship + this.anchorBonus);

    return this;
  }

  /**
   * Serializes entity to plain object.
   * @returns {Object} Serializable entity data
   */
  toJSON() {
    return {
      id: this.id,
      type: this.type,
      name: this.name,
      normalized: this.normalized,
      mentionCount: this.mentionCount,
      firstMentionTurn: this.firstMentionTurn,
      lastMentionTurn: this.lastMentionTurn,
      mentionHistory: this.mentionHistory,
      tfidfScore: this.tfidfScore,
      recencyScore: this.recencyScore,
      anchorBonus: this.anchorBonus,
      relationshipScore: this.relationshipScore,
      totalScore: this.totalScore,
      relationships: this.relationships.map((r) => r.toJSON()),
      contexts: this.contexts,
      isAnchor: this.isAnchor,
      semanticSimilarity: this.semanticSimilarity,
      semanticMerges: this.semanticMerges,
    };
  }

  /**
   * Creates Entity from serialized data.
   * @param {Object} data - Serialized entity data
   * @returns {Entity}
   */
  static fromJSON(data) {
    const entity = new Entity({
      type: data.type,
      name: data.name,
      normalized: data.normalized,
      firstMentionTurn: data.firstMentionTurn,
    });

    entity.mentionCount = data.mentionCount;
    entity.lastMentionTurn = data.lastMentionTurn;
    entity.mentionHistory = data.mentionHistory;
    entity.tfidfScore = data.tfidfScore;
    entity.recencyScore = data.recencyScore;
    entity.anchorBonus = data.anchorBonus;
    entity.relationshipScore = data.relationshipScore;
    entity.totalScore = data.totalScore;
    entity.relationships = data.relationships.map(Relationship.fromJSON);
    entity.contexts = data.contexts;
    entity.isAnchor = data.isAnchor;
    entity.semanticSimilarity = data.semanticSimilarity || null;
    entity.semanticMerges = data.semanticMerges || null;

    return entity;
  }
}

module.exports = {
  Entity,
  Relationship,
  EntityType,
  RelType,
};
