/**
 * scorer.js - TF-IDF based entity scoring system
 *
 * Based on Clarity v2 Design Doc - Section 4
 * Implements TF-IDF-like scoring with recency, anchors, and relationships.
 */

const {
  WEIGHTS,
  ANCHOR_BONUS,
  THRESHOLDS,
  RECENCY,
  TERM_FREQUENCY,
  RELATIONSHIP,
  DOCUMENT_FREQUENCY,
} = require("./weights");

/**
 * EntityScorer - Computes relevance scores for entities using TF-IDF principles
 *
 * Tracks document frequency across sessions to provide accurate IDF scores.
 * Uses log-scaled term frequency, exponential decay recency, and relationship boosts.
 */
class EntityScorer {
  /**
   * Create a new EntityScorer
   * @param {Object} options - Configuration options
   * @param {Map} options.documentFrequency - Existing document frequency map (term -> count)
   * @param {number} options.totalDocuments - Total number of documents/sessions tracked
   * @param {Object} options.weights - Override default weights
   */
  constructor(options = {}) {
    /** @type {Map<string, number>} Document frequency map: term -> number of docs containing it */
    this.documentFrequency = options.documentFrequency || new Map();

    /** @type {number} Total documents/sessions for IDF denominator */
    this.totalDocuments = options.totalDocuments || 0;

    /** @type {Object} Scoring weights (can override defaults) */
    this.weights = { ...WEIGHTS, ...(options.weights || {}) };

    /** @type {number} Current turn number for recency calculations */
    this.currentTurn = options.currentTurn || 0;
  }

  /**
   * Compute term frequency score using log scaling
   *
   * TF = log(1 + recentMentions) where recentMentions is count in last N turns
   * Log scaling prevents high-frequency terms from completely dominating.
   *
   * @param {Object} entity - Entity object with mentionHistory array
   * @param {number[]} entity.mentionHistory - Array of turn numbers where entity was mentioned
   * @returns {number} Log-scaled term frequency (0 to ~3.0 for reasonable mention counts)
   */
  computeTF(entity) {
    if (!entity.mentionHistory || entity.mentionHistory.length === 0) {
      return 0;
    }

    // Count mentions within the recent window
    const recentMentions = entity.mentionHistory.filter((turn) => {
      const turnsAgo = this.currentTurn - turn;
      return turnsAgo >= 0 && turnsAgo <= TERM_FREQUENCY.recentWindow;
    }).length;

    // Log scaling: log(1 + count) prevents explosive growth
    // With natural log: log(1) = 0, log(11) ≈ 2.4 for 10 mentions
    return Math.log(1 + recentMentions);
  }

  /**
   * Compute inverse document frequency
   *
   * IDF = log(totalDocuments / documentFrequency)
   * Rare terms (low document frequency) get higher scores.
   * Common terms (high document frequency) get lower scores.
   *
   * @param {string} term - Normalized term/entity name
   * @returns {number} IDF score (higher for rare terms)
   */
  computeIDF(term) {
    const docFreq = this.documentFrequency.get(term) || DOCUMENT_FREQUENCY.defaultDocFreq;

    // Ensure we have at least minDocuments to avoid division issues
    const totalDocs = Math.max(this.totalDocuments, DOCUMENT_FREQUENCY.minDocuments);

    // IDF formula: log(N / df)
    // If term appears in every document, IDF = log(1) = 0
    // If term appears in 1 of 100 documents, IDF = log(100) ≈ 4.6
    return Math.log(totalDocs / docFreq);
  }

  /**
   * Compute recency score using exponential decay
   *
   * Score = exp(-turnsAgo / halfLife)
   * Exponential decay gives graceful score reduction over time.
   * At halfLife turns, score is 0.5. At 2*halfLife, score is 0.25.
   *
   * @param {number} lastMentionTurn - Turn number of last mention
   * @param {number} currentTurn - Current turn number (defaults to this.currentTurn)
   * @returns {number} Recency score (1.0 = just mentioned, → 0 as time passes)
   */
  computeRecency(lastMentionTurn, currentTurn = this.currentTurn) {
    if (lastMentionTurn === undefined || lastMentionTurn === null) {
      return 0;
    }

    const turnsAgo = currentTurn - lastMentionTurn;

    // Handle future mentions (shouldn't happen, but be safe)
    if (turnsAgo < 0) {
      return RECENCY.maxScore;
    }

    // Exponential decay: e^(-turnsAgo / halfLife)
    // halfLife = 5 turns means score halves every 5 turns
    return Math.exp(-turnsAgo / RECENCY.halfLife);
  }

  /**
   * Compute relationship boost based on average relationship strength
   *
   * Boost = average(strength) * multiplier
   * Entities with strong relationships to other entities get boosted.
   * This helps surface related concepts even if not directly mentioned.
   *
   * @param {Object} entity - Entity object with relationships array
   * @param {Array} entity.relationships - Array of relationship objects
   * @param {number} entity.relationships[].strength - Relationship strength (0-1)
   * @returns {number} Relationship boost (0 to ~10)
   */
  computeRelationshipBoost(entity) {
    if (!entity.relationships || entity.relationships.length < RELATIONSHIP.minRelationships) {
      return 0;
    }

    // Calculate average relationship strength
    const totalStrength = entity.relationships.reduce((sum, rel) => {
      const strength = typeof rel.strength === "number" ? rel.strength : 0;
      return sum + strength;
    }, 0);

    const avgStrength = totalStrength / entity.relationships.length;

    // Scale to boost range (0-1 → 0-10)
    return avgStrength * RELATIONSHIP.strengthMultiplier;
  }

  /**
   * Calculate total entity score using weighted combination of components
   *
   * Score = (TF * w_tf) + (IDF * w_idf) + (Recency * w_recency) + AnchorBonus + (RelBoost * w_rel)
   *
   * Each component contributes weighted value, then capped at 100.
   * Anchor bonus is fixed (not weighted) and reduced to 5 to prevent dominance.
   *
   * @param {Object} entity - Entity to score
   * @param {string} entity.normalized - Normalized entity name for IDF lookup
   * @param {number} entity.lastMentionTurn - Last turn where entity was mentioned
   * @param {boolean} entity.isAnchor - Whether entity is anchored
   * @param {number[]} entity.mentionHistory - History of mention turns
   * @param {Array} entity.relationships - Entity relationships
   * @param {number} currentTurn - Optional override for current turn
   * @returns {Object} Score breakdown and total
   */
  scoreEntity(entity, currentTurn = this.currentTurn) {
    if (!entity) {
      return this._createScoreResult(null);
    }

    // Compute individual components
    const tf = this.computeTF(entity);
    const idf = this.computeIDF(entity.normalized || entity.id || "");
    const recency = this.computeRecency(entity.lastMentionTurn, currentTurn);
    const anchorBonus = entity.isAnchor ? ANCHOR_BONUS : 0;
    const relationshipBoost = this.computeRelationshipBoost(entity);

    // Weighted combination
    const weightedTF = tf * this.weights.tf;
    const weightedIDF = idf * this.weights.idf;
    const weightedRecency = recency * this.weights.recency;
    const weightedRelationship = relationshipBoost * this.weights.relationship;

    // Sum all components
    const rawScore =
      weightedTF + weightedIDF + weightedRecency + anchorBonus + weightedRelationship;

    // Cap at 100 as per design spec
    const totalScore = Math.min(rawScore, 100);

    return this._createScoreResult({
      entityId: entity.id,
      entityName: entity.name,
      totalScore,
      components: {
        tf: { raw: tf, weighted: weightedTF },
        idf: { raw: idf, weighted: weightedIDF },
        recency: { raw: recency, weighted: weightedRecency },
        anchor: { raw: entity.isAnchor ? 1 : 0, weighted: anchorBonus },
        relationship: {
          raw: relationshipBoost / RELATIONSHIP.strengthMultiplier,
          weighted: weightedRelationship,
        },
      },
      isAboveThreshold: {
        display: totalScore >= THRESHOLDS.display,
        highRelevance: totalScore >= THRESHOLDS.highRelevance,
        mediumRelevance: totalScore >= THRESHOLDS.mediumRelevance,
        track: totalScore >= THRESHOLDS.track,
      },
    });
  }

  /**
   * Score multiple entities at once
   *
   * @param {Array<Object>} entities - Array of entities to score
   * @param {number} currentTurn - Optional override for current turn
   * @returns {Array<Object>} Array of score results
   */
  scoreEntities(entities, currentTurn = this.currentTurn) {
    if (!Array.isArray(entities)) {
      return [];
    }
    return entities.map((entity) => this.scoreEntity(entity, currentTurn));
  }

  /**
   * Update document frequency with a new document/session
   *
   * Call this when processing a new document/session to update IDF values.
   * Increments totalDocuments and updates frequency counts for all terms.
   *
   * @param {Set<string>|Array<string>} terms - Terms present in the document
   */
  updateDocumentFrequency(terms) {
    if (!terms) return;

    // Convert to array if Set
    const termArray = Array.from(terms);

    // Increment document frequency for each unique term
    for (const term of termArray) {
      const normalized = this._normalizeTerm(term);
      const current = this.documentFrequency.get(normalized) || 0;
      this.documentFrequency.set(normalized, current + 1);
    }

    // Increment total document count
    this.totalDocuments++;
  }

  /**
   * Get document frequency statistics
   *
   * @returns {Object} DF statistics
   */
  getDocumentFrequencyStats() {
    return {
      totalDocuments: this.totalDocuments,
      uniqueTerms: this.documentFrequency.size,
      topTerms: Array.from(this.documentFrequency.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10),
    };
  }

  /**
   * Serialize document frequency state for persistence
   *
   * @returns {Object} Serializable state
   */
  serialize() {
    return {
      documentFrequency: Array.from(this.documentFrequency.entries()),
      totalDocuments: this.totalDocuments,
      timestamp: Date.now(),
    };
  }

  /**
   * Deserialize document frequency state from persistence
   *
   * @param {Object} data - Serialized state
   * @param {Array} data.documentFrequency - Array of [term, count] pairs
   * @param {number} data.totalDocuments - Total document count
   * @returns {EntityScorer} New scorer with restored state
   */
  static deserialize(data) {
    if (!data) return new EntityScorer();

    const df = new Map(data.documentFrequency || []);
    return new EntityScorer({
      documentFrequency: df,
      totalDocuments: data.totalDocuments || 0,
    });
  }

  /**
   * Create a score result object with consistent structure
   * @private
   */
  _createScoreResult(data) {
    if (!data) {
      return {
        entityId: null,
        entityName: null,
        totalScore: 0,
        components: {
          tf: { raw: 0, weighted: 0 },
          idf: { raw: 0, weighted: 0 },
          recency: { raw: 0, weighted: 0 },
          anchor: { raw: 0, weighted: 0 },
          relationship: { raw: 0, weighted: 0 },
        },
        isAboveThreshold: {
          display: false,
          highRelevance: false,
          mediumRelevance: false,
          track: false,
        },
      };
    }
    return data;
  }

  /**
   * Normalize a term for consistent IDF lookup
   * @private
   */
  _normalizeTerm(term) {
    return term.toLowerCase().trim().replace(/\s+/g, "_");
  }

  /**
   * Set the current turn number
   * @param {number} turn - Current turn number
   */
  setCurrentTurn(turn) {
    this.currentTurn = turn;
  }
}

module.exports = { EntityScorer };
