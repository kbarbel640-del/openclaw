/**
 * V2 Integration Layer — Adapter connecting v2 entity tracking to existing Clarity
 *
 * Provides:
 * - V2ContextTracker: Drop-in replacement for ContextTracker
 * - extractItemsV2(): Returns entities + relationships
 * - getScoredItemsV2(): Returns sorted entities with scores
 * - formatClarityContext(): Generates new output format per design doc Section 6
 *
 * Backward Compatibility:
 * - Maintains all ContextTracker public methods
 * - Existing API calls work unchanged
 * - New methods provide v2 functionality
 */

"use strict";

// Import enhanced formatters and constants
const { RichFormatter } = require("./rich-formatter");
const { ActionableFormatter } = require("./actionable-formatter");
const { SemanticMatcher } = require("./semantic-matcher");
const ContextQuality = require("./context-quality");
const ContextHealth = require("./context-health");
const { UtilityScorer } = require("./utility-scorer");
const { TaskAwareExtractor } = require("./task-aware-extractor");
const {
  ENTITY_TYPES,
  RELATIONSHIP_TYPES,
  THRESHOLDS,
  DEFAULT_WEIGHTS,
  ANCHOR_BONUS,
} = require("./constants");

// System hyphenated terms to exclude per design doc Section 3.1
const SYSTEM_HYPHENATED = new Set([
  "high-level",
  "well-known",
  "pre-flight",
  "so-called",
  "state-of-the-art",
  "end-to-end",
  "up-to-date",
  "built-in",
  "out-of-the-box",
  "long-term",
  "short-term",
  "real-time",
  "full-time",
  "part-time",
]);

// Extended stop words per design doc Appendix A
const CLARITY_STOP_WORDS = new Set([
  // Linguistic
  "about",
  "above",
  "after",
  "again",
  "against",
  "being",
  "below",
  "between",
  "both",
  "could",
  "does",
  "doing",
  "during",
  "each",
  "either",
  "enough",
  "every",
  "from",
  "have",
  "having",
  "here",
  "however",
  "into",
  "itself",
  "just",
  "more",
  "most",
  "much",
  "myself",
  "once",
  "only",
  "other",
  "over",
  "same",
  "should",
  "such",
  "than",
  "that",
  "their",
  "them",
  "then",
  "there",
  "these",
  "they",
  "this",
  "those",
  "through",
  "under",
  "until",
  "very",
  "what",
  "when",
  "where",
  "which",
  "while",
  "with",
  "would",
  "your",
  "also",
  "been",
  "make",
  "made",
  "take",
  "taken",
  "some",
  "time",
  "will",
  "well",
  "come",
  "came",
  "know",
  "knew",
  "look",
  "looked",
  "like",
  "liked",
  "want",
  "wanted",
  "need",
  "needed",
  "use",
  "used",
  "work",
  "worked",
  "call",
  "called",
  "find",
  "found",
  "give",
  "gave",
  // System/OpenClaw
  "session",
  "model",
  "mention",
  "context",
  "plugin",
  "agent",
  "tool",
  "message",
  "text",
  "content",
  "function",
  "response",
  "request",
  "exchange",
  "turn",
  "conversation",
  "user",
  "assistant",
  "claw",
  "openclaw",
  "gateway",
  "handler",
  "hook",
  "event",
  "trigger",
  "token",
  "prompt",
  "completion",
  "inference",
  "output",
  "input",
  "parameter",
  "setting",
  "configuration",
  "config",
  "option",
  "default",
  "enabled",
  "disabled",
  "keyword",
  "track",
  "extract",
  "score",
  "count",
  "frequency",
  "recency",
  "relevance",
  "priority",
  // Technical
  "true",
  "false",
  "null",
  "undefined",
  "string",
  "number",
  "array",
  "object",
  "value",
  "return",
  "error",
  "result",
  "data",
  "name",
  "type",
  "key",
  "index",
  "length",
]);

/**
 * Represents a relationship between two entities
 */
class Relationship {
  constructor(sourceId, targetId, type, strength = 0.5, lastCooccurrence = 0) {
    this.sourceId = sourceId;
    this.targetId = targetId;
    this.type = type;
    this.strength = strength;
    this.lastCooccurrence = lastCooccurrence;
  }

  toJSON() {
    return {
      sourceId: this.sourceId,
      targetId: this.targetId,
      type: this.type,
      strength: this.strength,
      lastCooccurrence: this.lastCooccurrence,
    };
  }
}

/**
 * Represents an entity with tracking and scoring
 */
class Entity {
  constructor(id, type, name, normalized, turn = 0) {
    this.id = id;
    this.type = type;
    this.name = name;
    this.normalized = normalized;

    // Mention tracking - start at 0, addMention will increment
    this.mentionCount = 0;
    this.firstMentionTurn = turn;
    this.lastMentionTurn = turn;
    this.mentionHistory = [];

    // Scoring
    this.tfidfScore = 0;
    this.recencyScore = 0;
    this.anchorBonus = 0;
    this.relationshipScore = 0;
    this.totalScore = 0;

    // Relationships
    this.relationships = [];

    // Context
    this.contexts = [];
    this.isAnchor = false;

    // Add initial mention if turn is provided
    if (turn > 0) {
      this.addMention(turn);
    }
  }

  addMention(turn, context = null) {
    this.mentionCount++;
    this.lastMentionTurn = turn;
    this.mentionHistory.push(turn);
    if (this.mentionHistory.length > 20) {
      this.mentionHistory = this.mentionHistory.slice(-20);
    }
    if (context && this.contexts.length < 5) {
      this.contexts.push(context);
    }
  }

  addRelationship(targetId, type, strength) {
    const existing = this.relationships.find((r) => r.targetId === targetId && r.type === type);
    if (existing) {
      existing.strength = Math.min(1, existing.strength + strength * 0.1);
      existing.lastCooccurrence = this.lastMentionTurn;
    } else {
      this.relationships.push(
        new Relationship(this.id, targetId, type, strength, this.lastMentionTurn),
      );
    }
  }

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
    };
  }
}

/**
 * ExtractionResult — Result of entity extraction
 */
class ExtractionResult {
  constructor() {
    this.entities = new Map(); // id -> Entity
    this.relationships = []; // Relationship[]
    this.compositeTerms = []; // string[]
  }

  addEntity(id, type, name, normalized, turn, context = null) {
    if (!this.entities.has(id)) {
      this.entities.set(id, new Entity(id, type, name, normalized, turn));
    } else {
      // Entity exists, add another mention
      this.entities.get(id).addMention(turn, context);
    }
    return this.entities.get(id);
  }

  addRelationship(sourceId, targetId, type, strength, turn) {
    const source = this.entities.get(sourceId);
    if (source) {
      source.addRelationship(targetId, type, strength);
      this.relationships.push(new Relationship(sourceId, targetId, type, strength, turn));
    }
  }

  merge(other) {
    for (const [id, entity] of other.entities) {
      if (!this.entities.has(id)) {
        this.entities.set(id, entity);
      } else {
        // Merge mention history
        const existing = this.entities.get(id);
        for (const turn of entity.mentionHistory) {
          if (!existing.mentionHistory.includes(turn)) {
            existing.addMention(turn);
          }
        }
      }
    }
    this.relationships.push(...other.relationships);
    this.compositeTerms.push(...other.compositeTerms);
  }

  /**
   * Apply semantic matching to merge similar entities
   * Uses lightweight vector similarity to find near-duplicates
   * e.g., "clarity" and "clarity plugin" → merged with relationship
   */
  applySemanticMatching(options = {}) {
    const matcher = new SemanticMatcher({
      mergeThreshold: 0.7,
      relateThreshold: 0.5,
      ...options,
    });

    const entityList = [...this.entities.values()];
    if (entityList.length < 2) return { merged: 0, relationships: 0 };

    const { entities, merged, relationships } = matcher.deduplicateEntities(entityList);

    // Update entities map with deduplicated results
    this.entities.clear();
    for (const entity of entities) {
      this.entities.set(entity.id, entity);
    }

    // Add semantic relationships
    for (const rel of relationships) {
      this.addRelationship(rel.sourceId, rel.targetId, RELATIONSHIP_TYPES.RELATED, rel.strength, 0);

      // Update source entity's semanticSimilarity field
      const sourceEntity = this.entities.get(rel.sourceId);
      if (sourceEntity) {
        if (!sourceEntity.semanticSimilarity) {
          sourceEntity.semanticSimilarity = {};
        }
        sourceEntity.semanticSimilarity[rel.targetId] = rel.semanticSimilarity;
      }

      // Update target entity's semanticSimilarity field
      const targetEntity = this.entities.get(rel.targetId);
      if (targetEntity) {
        if (!targetEntity.semanticSimilarity) {
          targetEntity.semanticSimilarity = {};
        }
        targetEntity.semanticSimilarity[rel.sourceId] = rel.semanticSimilarity;
      }
    }

    return {
      merged: merged.size,
      relationships: relationships.length,
      mergedPairs: [...merged.entries()].map(([oldId, newId]) => ({ oldId, newId })),
    };
  }
}

/**
 * EntityExtractor — Extracts entities and relationships from text
 */
class EntityExtractor {
  constructor(config = {}) {
    this.config = {
      minWordLength: 4,
      extractProjects: true,
      extractPlugins: true,
      extractTools: true,
      extractFiles: true,
      ...config,
    };
    this.knownPlugins = new Set([
      "clarity",
      "awareness",
      "continuity",
      "recover",
      "reflect",
      "guide",
      "sight",
    ]);
    this.knownProjects = new Set(["claracore", "openclaw", "focusengine"]);
  }

  /**
   * Strip system-injected content from text before extraction
   */
  stripSystemContent(text) {
    if (!text) return "";
    let cleaned = text.replace(/\[GUIDE[^\]]*\][\s\S]*?(?=\[|$)/g, "");
    cleaned = cleaned.replace(/\[CLARITY CONTEXT\][\s\S]*?(?=\[|Tracked mentions:|$)/g, "");
    cleaned = cleaned.replace(/\[REFLECT\][\s\S]*?(?=\[|Conversation info:|$)/g, "");
    cleaned = cleaned.replace(/\[LENS\][\s\S]*?(?=\[|Conversation info:|$)/g, "");
    cleaned = cleaned.replace(
      /Conversation info \(untrusted metadata\):\s*```json[\s\S]*?```/g,
      "",
    );
    return cleaned;
  }

  /**
   * Main extraction method — returns ExtractionResult per design doc Section 3
   */
  extract(text, currentTurn = 0) {
    const result = new ExtractionResult();
    if (!text || text.length < 10) return result;

    const cleanedText = this.stripSystemContent(text);
    if (!cleanedText || cleanedText.length < 10) return result;

    // Extract entities by type
    this.extractProjects(cleanedText, result, currentTurn);
    this.extractPlugins(cleanedText, result, currentTurn);
    this.extractTools(cleanedText, result, currentTurn);
    this.extractFiles(cleanedText, result, currentTurn);
    this.extractPeople(cleanedText, result, currentTurn);
    this.extractDecisions(cleanedText, result, currentTurn);

    // Extract composite terms and relationships
    this.extractCompositeTerms(cleanedText, result);
    this.inferRelationships(result, currentTurn);

    // Apply semantic matching to merge near-duplicates
    // e.g., "clarity" and "clarity plugin" → merged with relationship
    result.applySemanticMatching({
      mergeThreshold: 0.7,
      relateThreshold: 0.5,
    });

    return result;
  }

  /**
   * Extract project names per design doc Section 3.1
   */
  extractProjects(text, result, turn) {
    if (!this.config.extractProjects) return;

    const patterns = [
      // CamelCase: ClaraCore, OpenClaw, FocusEngine
      { regex: /\b[A-Z][a-z]+(?:[A-Z][a-z]+)+\b/g, type: "project" },
      // Hyphenated: focus-engine, model-router (with filter)
      {
        regex: /\b[a-z]+(?:-[a-z]+)+\b/g,
        type: "project",
        filter: (m) => !SYSTEM_HYPHENATED.has(m),
      },
      // Lowercase with tech suffixes: claracore, openclaw, dashclaw
      { regex: /\b[a-z]{3,}(?:core|claw|stack|engine|router|board)\b/gi, type: "project" },
    ];

    for (const pattern of patterns) {
      pattern.regex.lastIndex = 0;
      let match;
      while ((match = pattern.regex.exec(text)) !== null) {
        const raw = match[0];
        if (pattern.filter && !pattern.filter(raw)) continue;

        const normalized = raw.toLowerCase().replace(/-/g, "_");
        const name =
          raw.charAt(0).toUpperCase() +
          raw.slice(1).replace(/[_-](\w)/g, (m, p1) => ` ${p1.toUpperCase()}`);
        const id = `project:${normalized}`;
        result.addEntity(id, ENTITY_TYPES.PROJECT, name, normalized, turn);
        this.knownProjects.add(normalized);
      }
    }
  }

  /**
   * Extract plugin names per design doc Section 3.2
   */
  extractPlugins(text, result, turn) {
    if (!this.config.extractPlugins) return;

    // Dynamic from known plugins + hardcoded common ones
    const pluginPattern = new RegExp(`\\b(${[...this.knownPlugins].join("|")})\\b`, "gi");

    let match;
    while ((match = pluginPattern.exec(text)) !== null) {
      const normalized = match[0].toLowerCase();
      const name = normalized.charAt(0).toUpperCase() + normalized.slice(1);
      const id = `plugin:${normalized}`;
      result.addEntity(id, ENTITY_TYPES.PLUGIN, name, normalized, turn);
    }
  }

  /**
   * Extract tool names per design doc Section 3.4
   */
  extractTools(text, result, turn) {
    if (!this.config.extractTools) return;

    const toolPatterns = [
      {
        regex:
          /\b(sessions_spawn|subagents|memory_search|memory_get|recall|reflect|web_search|web_fetch|read|write|edit|exec|process|nodes|message|canvas|tts|browser)\b/g,
        type: "tool",
      },
      { regex: /\bsubagent\b/gi, type: "tool", mapTo: "subagents" },
    ];

    for (const pattern of toolPatterns) {
      pattern.regex.lastIndex = 0;
      let match;
      while ((match = pattern.regex.exec(text)) !== null) {
        const raw = pattern.mapTo || match[0];
        const normalized = raw.toLowerCase();
        const name = normalized;
        const id = `tool:${normalized}`;
        result.addEntity(id, ENTITY_TYPES.TOOL, name, normalized, turn);
      }
    }
  }

  /**
   * Extract file references per design doc Section 3.3
   */
  extractFiles(text, result, turn) {
    if (!this.config.extractFiles) return;

    const filePatterns = [
      // Memory files: memory/2026-02-19.md, memory/projects/foo.md (no word boundary before memory)
      { regex: /memory\/[\w\-/]+\.md/gi, type: "file" },
      // Docs: docs/architecture.md
      { regex: /docs\/[\w\-/]+\.md/gi, type: "file" },
      // Root workspace files: SOUL.md, AGENTS.md, USER.md
      { regex: /\b[A-Z_]+\.md\b/g, type: "file" },
      // Generic .md references
      { regex: /[\w\-/]+\.md/g, type: "file", filter: (m) => m.length >= 5 && !m.includes("http") },
      // Config files: openclaw.json, package.json
      { regex: /\b[\w\-]+\.json\b/g, type: "file" },
    ];

    for (const pattern of filePatterns) {
      pattern.regex.lastIndex = 0;
      let match;
      while ((match = pattern.regex.exec(text)) !== null) {
        const raw = match[0];
        if (pattern.filter && !pattern.filter(raw)) continue;

        // Normalize: lowercase, replace /, -, and . with _
        const normalized = raw.toLowerCase().replace(/[\/\.\-]/g, "_");
        const id = `file:${normalized}`;
        result.addEntity(id, ENTITY_TYPES.FILE, raw, normalized, turn);
      }
    }
  }

  /**
   * Extract person names (basic implementation)
   */
  extractPeople(text, result, turn) {
    // Basic person detection - capitalized names that aren't project names
    // This is a simplified version - full implementation would use NER
    const namePattern = /\b(?:Valerie|Odyssey|Cassandra|Alice|Bob)\b/g;
    let match;
    while ((match = namePattern.exec(text)) !== null) {
      const raw = match[0];
      const normalized = raw.toLowerCase();
      const id = `person:${normalized}`;
      result.addEntity(id, ENTITY_TYPES.PERSON, raw, normalized, turn);
    }
  }

  /**
   * Extract decision statements
   */
  extractDecisions(text, result, turn) {
    // Pattern: "decided to...", "we will use...", "chosen..."
    const decisionPattern = /\b(decided to|we will|chosen|opted for|going with)\s+([^,.]+)/gi;
    let match;
    while ((match = decisionPattern.exec(text)) !== null) {
      const decisionText = match[2].trim().slice(0, 50);
      const normalized = decisionText
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, "_")
        .slice(0, 30);
      const id = `decision:${normalized}`;
      result.addEntity(id, ENTITY_TYPES.DECISION, decisionText, normalized, turn);
    }
  }

  /**
   * Extract composite terms (n-grams) per design doc Section 3.5
   */
  extractCompositeTerms(text, result) {
    const tokens = text
      .toLowerCase()
      .split(/\s+/)
      .map((t) => t.replace(/[^a-z0-9_]/g, ""))
      .filter((t) => t.length >= 3 && !CLARITY_STOP_WORDS.has(t));

    const knownEntities = new Set(
      [...result.entities.keys()].map((id) => {
        const parts = id.split(":");
        return parts.length > 1 ? parts[1] : parts[0];
      }),
    );

    // Bigrams and trigrams
    for (let i = 0; i < tokens.length - 1; i++) {
      const bigram = `${tokens[i]} ${tokens[i + 1]}`;
      if (this.isValidComposite(bigram, knownEntities)) {
        if (!result.compositeTerms.includes(bigram)) {
          result.compositeTerms.push(bigram);
        }
      }

      if (i < tokens.length - 2) {
        const trigram = `${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`;
        if (this.isValidComposite(trigram, knownEntities)) {
          if (!result.compositeTerms.includes(trigram)) {
            result.compositeTerms.push(trigram);
          }
        }
      }
    }
  }

  /**
   * Validate composite term
   */
  isValidComposite(term, knownEntities) {
    const parts = term.split(" ");
    const knownParts = parts.filter((p) => knownEntities.has(p));
    return knownParts.length >= 2 || knownEntities.has(term.replace(/ /g, "_"));
  }

  /**
   * Infer relationships between extracted entities
   */
  inferRelationships(result, turn) {
    const entities = [...result.entities.values()];

    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const e1 = entities[i];
        const e2 = entities[j];

        // Co-occurrence creates RELATED relationship
        result.addRelationship(e1.id, e2.id, RELATIONSHIP_TYPES.RELATED, 0.3, turn);
        result.addRelationship(e2.id, e1.id, RELATIONSHIP_TYPES.RELATED, 0.3, turn);

        // Project contains file
        if (e1.type === ENTITY_TYPES.PROJECT && e2.type === ENTITY_TYPES.FILE) {
          result.addRelationship(e1.id, e2.id, RELATIONSHIP_TYPES.CONTAINS, 0.5, turn);
        }
        if (e2.type === ENTITY_TYPES.PROJECT && e1.type === ENTITY_TYPES.FILE) {
          result.addRelationship(e2.id, e1.id, RELATIONSHIP_TYPES.CONTAINS, 0.5, turn);
        }

        // Plugin uses tool
        if (e1.type === ENTITY_TYPES.PLUGIN && e2.type === ENTITY_TYPES.TOOL) {
          result.addRelationship(e1.id, e2.id, RELATIONSHIP_TYPES.USES, 0.7, turn);
        }
        if (e2.type === ENTITY_TYPES.PLUGIN && e1.type === ENTITY_TYPES.TOOL) {
          result.addRelationship(e2.id, e1.id, RELATIONSHIP_TYPES.USES, 0.7, turn);
        }
      }
    }
  }
}

/**
 * EntityScorer — TF-IDF-like scoring per design doc Section 4
 */
class EntityScorer {
  constructor(config = {}) {
    this.weights = { ...DEFAULT_WEIGHTS, ...config.weights };
    this.documentFrequency = new Map();
    this.totalDocuments = 0;
  }

  /**
   * Score all entities
   */
  scoreEntities(entities, currentTurn, totalTurns) {
    const scored = [];

    for (const entity of entities) {
      const score = this.scoreEntity(entity, currentTurn, totalTurns);
      entity.tfidfScore = score.tfidf;
      entity.recencyScore = score.recency;
      entity.anchorBonus = entity.isAnchor ? ANCHOR_BONUS : 0;
      entity.relationshipScore = this.computeRelationshipBoost(entity);
      entity.totalScore = score.total;
      scored.push(entity);
    }

    return scored.sort((a, b) => b.totalScore - a.totalScore);
  }

  /**
   * Compute individual entity score
   */
  scoreEntity(entity, currentTurn, totalTurns) {
    const tf = this.computeTF(entity);
    const idf = this.computeIDF(entity.normalized);
    const recency = this.computeRecency(entity.lastMentionTurn, currentTurn);
    const anchorBonus = entity.isAnchor ? ANCHOR_BONUS : 0;
    const relationshipBoost = this.computeRelationshipBoost(entity);

    const total = Math.min(
      100,
      (tf * this.weights.tf) / 10 +
        (idf * this.weights.idf) / 10 +
        recency * this.weights.recency +
        anchorBonus +
        relationshipBoost * this.weights.relationship,
    );

    return {
      tfidf: tf * idf,
      recency,
      anchorBonus,
      relationshipBoost,
      total,
    };
  }

  /**
   * Term frequency with log scaling
   */
  computeTF(entity) {
    const recentMentions = entity.mentionHistory.filter(
      (t) => entity.lastMentionTurn - t <= 10,
    ).length;
    return Math.log(1 + recentMentions);
  }

  /**
   * Inverse document frequency
   */
  computeIDF(term) {
    const docFreq = this.documentFrequency.get(term) || 1;
    return Math.log((this.totalDocuments + 1) / (docFreq + 1)) + 1;
  }

  /**
   * Recency with exponential decay
   */
  computeRecency(lastMention, currentTurn) {
    const turnsAgo = currentTurn - lastMention;
    const halfLife = 5;
    return Math.exp(-turnsAgo / halfLife);
  }

  /**
   * Boost based on relationship strength
   */
  computeRelationshipBoost(entity) {
    if (!entity.relationships || entity.relationships.length === 0) return 0;
    const avgStrength =
      entity.relationships.reduce((sum, r) => sum + r.strength, 0) / entity.relationships.length;
    return avgStrength * 10;
  }

  /**
   * Update document frequency for IDF calculation
   */
  updateDocumentFrequency(entities) {
    this.totalDocuments++;
    for (const entity of entities) {
      const count = this.documentFrequency.get(entity.normalized) || 0;
      this.documentFrequency.set(entity.normalized, count + 1);
    }
  }
}

/**
 * V2ContextTracker — Drop-in replacement for ContextTracker
 * Provides backward compatibility + new v2 functionality
 */
class V2ContextTracker {
  constructor(options = {}) {
    this.kv = options.kv;
    this.namespace = options.namespace || "clarity_v2";
    this._persistInterval = options.persistInterval || 10;

    // v2 data structures
    this._entities = new Map(); // id -> Entity
    this._relationships = new Map(); // composite key -> Relationship
    this._currentTurn = 0;
    this._lastPersistTurn = 0;

    // v2 components
    this.extractor = new EntityExtractor(options.extractorConfig);
    this.scorer = new EntityScorer(options.scorerConfig);
    this.utilityScorer = new UtilityScorer(options.utilityConfig);
    this.taskAwareExtractor = new TaskAwareExtractor(options.extractorConfig);
    this.richFormatter = new RichFormatter(options.formatterConfig);
    this.actionableFormatter = new ActionableFormatter({
      currentTurn: 0,
      recentWindow: 5,
      ...options.formatterConfig,
    });

    // Track last response for utility scoring
    this._lastResponse = "";

    // Legacy compatibility: maintain _items for old code
    this._items = new Map();
  }

  // =======================================================================
  // NEW V2 METHODS
  // =======================================================================

  /**
   * Extract entities and relationships from text (v2)
   * Returns: { entities: Entity[], relationships: Relationship[], compositeTerms: string[] }
   */
  extractItemsV2(text) {
    const result = this.extractor.extract(text, this._currentTurn);

    // Merge with existing entities
    for (const [id, entity] of result.entities) {
      if (this._entities.has(id)) {
        const existing = this._entities.get(id);
        for (const turn of entity.mentionHistory) {
          if (!existing.mentionHistory.includes(turn)) {
            existing.addMention(turn);
          }
        }
      } else {
        this._entities.set(id, entity);
      }
    }

    // Store relationships
    for (const rel of result.relationships) {
      const key = `${rel.sourceId}->${rel.targetId}:${rel.type}`;
      this._relationships.set(key, rel);
    }

    return {
      entities: [...result.entities.values()],
      relationships: result.relationships,
      compositeTerms: result.compositeTerms,
    };
  }

  /**
   * Get entities with v2 scores
   * Returns: Entity[] sorted by totalScore
   */
  getScoredItemsV2() {
    const entities = [...this._entities.values()];
    return this.scorer.scoreEntities(entities, this._currentTurn, this._currentTurn);
  }

  /**
   * Get structured entity data
   * Returns: { entities: Entity[], topEntities: Entity[], relationships: Relationship[] }
   */
  getEntities() {
    const scored = this.getScoredItemsV2();
    const topEntities = scored.filter((e) => e.totalScore >= THRESHOLDS.display);
    const relationships = [...this._relationships.values()];

    return {
      entities: scored,
      topEntities,
      relationships,
      topics: this.extractTopics(scored),
    };
  }

  /**
   * Format context for display using quality tier system
   * Shows entities with quality icons (🔥⭐○) and actionable hints
   */
  formatClarityContext() {
    // Lazy-require context quality to avoid circular deps
    const { sortByContextValue } = require("./context-quality");

    // Ensure actionable formatter has current turn for urgency calculations
    if (this.actionableFormatter && typeof this.actionableFormatter.setCurrentTurn === "function") {
      this.actionableFormatter.setCurrentTurn(this._currentTurn);
    }

    const entities = this.getScoredItemsV2();
    if (!entities || entities.length === 0) return "";

    // Attach quality scores to entities
    const scoredEntities = sortByContextValue(entities, this._currentTurn);

    // Select display-worthy entities (quality >= 40) or fallback to top N
    let displayEntities = scoredEntities.filter(({ quality }) => quality.total >= 40).slice(0, 8);
    if (displayEntities.length === 0) {
      displayEntities = scoredEntities.slice(0, 5);
    }

    if (displayEntities.length === 0) return "";

    const lines = ["[CLARITY CONTEXT]"];

    for (const { entity, quality } of displayEntities) {
      // Short name for actions
      const shortName =
        this.actionableFormatter && typeof this.actionableFormatter.getShortName === "function"
          ? this.actionableFormatter.getShortName(entity.id)
          : entity.id.split(":")[1] || entity.id;

      // Related keywords (top relationship targets)
      const related = (entity.relationships || [])
        .slice(0, 3)
        .map((r) => r.targetId.replace(/^(project|plugin|tool|file|person|decision):/, ""))
        .filter(Boolean);

      const keywords = [...new Set(related)];

      // Fallback: derive simple keywords from stored contexts when relationships are scarce
      if (keywords.length < 2 && entity.contexts && entity.contexts.length > 0) {
        const tokens = (entity.contexts[0] || "")
          .split(/\W+/)
          .map((t) => t.toLowerCase())
          .filter((t) => t.length > 3 && !CLARITY_STOP_WORDS.has(t))
          .slice(0, 3);

        for (const t of tokens) {
          if (!keywords.includes(t)) keywords.push(t);
        }
      }

      // Use actionable formatter for 'why' and action suggestions when available
      const why =
        this.actionableFormatter &&
        typeof this.actionableFormatter.generateWhyItMatters === "function"
          ? this.actionableFormatter.generateWhyItMatters(entity)
          : `${entity.mentionCount || 0} mentions`;

      const actions =
        this.actionableFormatter &&
        typeof this.actionableFormatter.generateWhatYouCanDo === "function"
          ? this.actionableFormatter.generateWhatYouCanDo(entity)
          : `/anchor ${shortName}`;

      // Improvement suggestions derived from quality dimensions
      const dims = quality.dimensions || {};
      const improvements = [];
      if ((dims.actionability || 0) < 50)
        improvements.push(`Add relationships or anchor it (/anchor ${shortName})`);
      if ((dims.informationDensity || 0) < 50)
        improvements.push("Add a short context snippet or link docs");
      if ((dims.timeliness || 0) < 50)
        improvements.push("Mention it again or anchor to keep it active");
      if ((dims.uniqueness || 0) < 50)
        improvements.push("Consider merging duplicates (/clarity merge <a>,<b>)");

      const improvementText =
        improvements.length > 0 ? improvements.join(" | ") : "No immediate improvements suggested.";

      // Compose display block for this entity
      lines.push("");
      lines.push(`${quality.tier.icon} ${entity.id} — ${entity.name} (${quality.total})`);
      if (keywords.length > 0) lines.push(`  Related: ${keywords.join(", ")}`);
      lines.push(`  What is useful about this? ${why}`);
      lines.push(`  How could it be more useful? ${improvementText}`);
      lines.push(`  Actionable: ${actions}`);
    }

    // Active topics section
    const topics = this.extractTopics(entities);
    if (topics && topics.length > 0) {
      lines.push("");
      lines.push("Active topics:");
      lines.push(`  • ${topics.join(", ")}`);
    }

    // Strong relationships (simplified view)
    const strongRelationships = [...this._relationships.values()]
      .filter((r) => r.strength >= 0.5)
      .slice(0, 3);
    if (strongRelationships.length > 0) {
      lines.push("");
      lines.push("Key connections:");
      for (const rel of strongRelationships) {
        const source = rel.sourceId.replace(/^(project|plugin|tool|file|person|decision):/, "");
        const target = rel.targetId.replace(/^(project|plugin|tool|file|person|decision):/, "");
        lines.push(`  • ${source} → ${target}`);
      }
    }

    return lines.join("\n");
  }

  /**
   * Get contextual phrases for entities (public API)
   */
  getContextualPhrases(entityId) {
    const entity = this._entities.get(entityId);
    if (!entity) return [];

    const related = entity.relationships
      ? entity.relationships.slice(0, 3).map((r) => ({
          entityId: r.targetId,
          type: r.type,
        }))
      : [];

    return this.richFormatter.getContextualPhrases(entity, related);
  }

  /**
   * Extract topics from entity context
   */
  extractTopics(entities) {
    // Get top entities and extract normalized names as topics
    const topics = entities
      .slice(0, 10)
      .map((e) => e.normalized)
      .filter((t) => t.length > 3 && !CLARITY_STOP_WORDS.has(t))
      .slice(0, 5);
    return [...new Set(topics)];
  }

  /**
   * Backward compatibility: _buildPatterns method from v1 ContextTracker
   * Returns pattern matchers in v1 format
   */
  _buildPatterns() {
    return this.extractor._buildPatterns ? this.extractor._buildPatterns() : [];
  }

  /**
   * Backward compatibility: _stripSystemContent method from v1 ContextTracker
   * Strips system-injected content from text
   */
  _stripSystemContent(text) {
    return this.extractor.stripSystemContent(text);
  }

  // =======================================================================
  // BACKWARD COMPATIBILITY: ContextTracker API
  // =======================================================================

  /**
   * Legacy extractItems — returns array of string IDs
   */
  extractItems(text) {
    const result = this.extractItemsV2(text);
    return result.entities.map((e) => e.id);
  }

  /**
   * Legacy trackMentions — track mentions from user message
   */
  trackMentions(text) {
    const result = this.extractItemsV2(text);

    // Update legacy _items for compatibility
    for (const entity of result.entities) {
      this._touchLegacyItem(entity.id);
      const item = this._items.get(entity.id);
      // Don't double-count - extractItemsV2 already incremented
      item.mentionCount = entity.mentionCount - 1;
      item.lastMentionTurn = entity.lastMentionTurn;
      // Now increment once for this tracking call
      item.mentionCount++;
    }

    this.scorer.updateDocumentFrequency(result.entities);
    return result.entities.map((e) => e.id);
  }

  /**
   * Legacy trackReference — track reference in agent response
   */
  trackReference(itemId, context = null) {
    this._touchLegacyItem(itemId);
    const item = this._items.get(itemId);
    item.referenceCount++;
    item.lastReferenceTurn = this._currentTurn;
    item.lastReferenceContext = context;

    // Also update v2 entity if exists
    const entity = this._entities.get(itemId);
    if (entity) {
      entity.addMention(this._currentTurn, context);
    }
  }

  /**
   * Legacy anchorItem — mark item as anchored
   */
  anchorItem(itemId, reason = "user-anchored") {
    this._touchLegacyItem(itemId);
    const item = this._items.get(itemId);
    item.anchored = true;
    item.anchorReason = reason;
    item.anchorSetAt = Date.now();

    // Also update v2 entity
    const entity = this._entities.get(itemId);
    if (entity) {
      entity.isAnchor = true;
    }
  }

  /**
   * Legacy unanchorItem — remove anchor
   */
  unanchorItem(itemId) {
    const item = this._items.get(itemId);
    if (item) {
      item.anchored = false;
      delete item.anchorReason;
      delete item.anchorSetAt;
    }

    const entity = this._entities.get(itemId);
    if (entity) {
      entity.isAnchor = false;
    }
  }

  /**
   * Legacy getScoredItems — returns items in legacy format
   */
  getScoredItems() {
    const v2Entities = this.getScoredItemsV2();

    return v2Entities.map((entity) => {
      const legacyItem = this._items.get(entity.id) || {};
      return {
        id: entity.id,
        finalScore: entity.totalScore,
        metadata: {
          mentionCount: entity.mentionCount,
          anchored: entity.isAnchor,
          turnsSinceLastMention: this._currentTurn - entity.lastMentionTurn,
        },
        breakdown: {
          frequency: Math.round(entity.tfidfScore),
          recency: Math.round(entity.recencyScore * 30),
          utility: legacyItem.referenceCount || 0,
        },
      };
    });
  }

  /**
   * Legacy getItemsToPrune
   */
  getItemsToPrune(threshold = 5) {
    const toPrune = [];
    for (const [id, entity] of this._entities) {
      if (entity.totalScore < threshold && !entity.isAnchor) {
        toPrune.push(id);
      }
    }
    return toPrune;
  }

  /**
   * Legacy prune
   */
  prune(threshold = 5) {
    const toPrune = this.getItemsToPrune(threshold);
    for (const id of toPrune) {
      this._entities.delete(id);
      this._items.delete(id);
    }
    return toPrune.length;
  }

  /**
   * Legacy getItem
   */
  getItem(itemId) {
    return this._items.get(itemId) || null;
  }

  /**
   * Legacy getStats
   */
  getStats() {
    const entities = [...this._entities.values()];
    const scored = this.getScoredItems();

    return {
      totalItems: entities.length,
      anchoredItems: entities.filter((e) => e.isAnchor).length,
      currentTurn: this._currentTurn,
      averageMentions:
        entities.length > 0
          ? entities.reduce((s, e) => s + e.mentionCount, 0) / entities.length
          : 0,
      averageScore:
        scored.length > 0 ? scored.reduce((s, i) => s + i.finalScore, 0) / scored.length : 0,
      topItems: scored.slice(0, 5).map((i) => ({
        id: i.id,
        score: Math.round(i.finalScore * 10) / 10,
        mentions: i.metadata.mentionCount,
        anchored: i.metadata.anchored,
      })),
      scored: scored,
    };
  }

  /**
   * Legacy advanceTurn
   */
  advanceTurn() {
    this._currentTurn++;
    this.actionableFormatter.setCurrentTurn(this._currentTurn);
    if (this._currentTurn - this._lastPersistTurn >= this._persistInterval) {
      this.persist();
      this._lastPersistTurn = this._currentTurn;
    }
  }

  /**
   * Legacy persist
   */
  persist() {
    if (!this.kv) return;

    const state = {
      currentTurn: this._currentTurn,
      lastPersistAt: Date.now(),
      entities: [...this._entities.values()].map((e) => e.toJSON()),
      relationships: [...this._relationships.values()].map((r) => r.toJSON()),
      items: [...this._items.entries()].map(([id, item]) => ({ id, ...item })),
    };

    this.kv.set(this.namespace, "v2_state", state);
  }

  /**
   * Legacy load
   */
  load() {
    if (!this.kv) return false;

    try {
      const state = this.kv.get(this.namespace, "v2_state", null);
      if (!state) return false;

      this._currentTurn = state.currentTurn || 0;
      this._entities.clear();
      this._relationships.clear();
      this._items.clear();

      if (state.entities) {
        for (const entityData of state.entities) {
          const entity = new Entity(
            entityData.id,
            entityData.type,
            entityData.name,
            entityData.normalized,
            entityData.firstMentionTurn,
          );
          Object.assign(entity, entityData);
          this._entities.set(entity.id, entity);
        }
      }

      if (state.relationships) {
        for (const relData of state.relationships) {
          const rel = new Relationship(
            relData.sourceId,
            relData.targetId,
            relData.type,
            relData.strength,
            relData.lastCooccurrence,
          );
          const key = `${rel.sourceId}->${rel.targetId}:${rel.type}`;
          this._relationships.set(key, rel);
        }
      }

      if (state.items) {
        for (const itemData of state.items) {
          const { id, ...rest } = itemData;
          this._items.set(id, rest);
        }
      }

      return true;
    } catch (err) {
      console.error("[Clarity V2] Failed to load state:", err.message);
      return false;
    }
  }

  /**
   * Legacy reset
   */
  reset() {
    this._entities.clear();
    this._relationships.clear();
    this._items.clear();
    this._currentTurn = 0;
    this._lastPersistTurn = 0;
  }

  // =======================================================================
  // PRIVATE HELPERS
  // =======================================================================

  /**
   * Backward compatibility: _shouldExcludeItem from v1 ContextTracker
   * Determines if an item should be excluded from tracking
   */
  _shouldExcludeItem(itemId) {
    // Check if item is in stop words or matches exclusion patterns
    const parts = itemId.split(":");
    if (parts.length < 2) return true;

    const normalized = parts[1].toLowerCase();

    // Check against stop words
    if (CLARITY_STOP_WORDS.has(normalized)) return true;

    // Check for system patterns to exclude
    if (normalized.length < 3) return true;

    return false;
  }

  _touchLegacyItem(itemId) {
    if (!this._items.has(itemId)) {
      this._items.set(itemId, {
        mentionCount: 0,
        referenceCount: 0,
        lastMentionTurn: 0,
        lastReferenceTurn: 0,
        anchored: false,
        createdAt: Date.now(),
      });
    }
  }
}

// Exports
module.exports = {
  V2ContextTracker,
  EntityExtractor,
  EntityScorer,
  Entity,
  Relationship,
  ExtractionResult,
  ENTITY_TYPES,
  RELATIONSHIP_TYPES,
  THRESHOLDS,
  ANCHOR_BONUS,
  DEFAULT_WEIGHTS,
  CLARITY_STOP_WORDS,
};

// Lazy-load ActionableFormatter to avoid circular dependency
Object.defineProperty(module.exports, "ActionableFormatter", {
  get: () => require("./actionable-formatter").ActionableFormatter,
});
