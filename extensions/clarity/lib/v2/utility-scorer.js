/**
 * Utility Scorer
 *
 * Scores entities by "will this help me respond better?"
 * Replaces static stop word filtering with dynamic utility thresholds.
 */

class UtilityScorer {
  constructor() {
    // Minimal base exclusions - only truly generic terms
    this.baseExclusions = new Set([
      "the",
      "a",
      "an",
      "and",
      "or",
      "but",
      "in",
      "on",
      "at",
      "to",
      "for",
      "of",
      "with",
      "by",
      "from",
      "as",
      "is",
      "was",
      "are",
      "were",
      "be",
      "been",
      "being",
      "have",
      "has",
      "had",
      "do",
      "does",
      "did",
      "will",
      "would",
      "could",
      "should",
      "may",
      "might",
      "must",
      "shall",
      "can",
    ]);

    // Term usage history
    this.termHistory = new Map();
    this.referenceHistory = [];
    this.actionItems = new Map();

    // Utility thresholds
    this.thresholds = {
      high: 70,
      medium: 40,
      low: 20,
    };
  }

  /**
   * Score an entity by its utility to AI response quality
   */
  score(entity, context = {}) {
    const {
      lastResponse = "",
      currentTask = null,
      userIntent = null,
      conversationHistory = [],
      isAnchored = false,
    } = context;

    let score = 0;
    const reasons = [];
    const factors = [];

    // 1. Referenced in my last response (high utility)
    const referenceScore = this._scoreReferenceInResponse(entity, lastResponse);
    if (referenceScore > 0) {
      score += referenceScore;
      reasons.push("Referenced in my last response");
      factors.push({ name: "ai_reference", value: referenceScore, weight: "high" });
    }

    // 2. Needed for current task (high utility)
    const taskScore = this._scoreTaskRelevance(entity, currentTask);
    if (taskScore > 0) {
      score += taskScore;
      reasons.push(`Needed for ${currentTask?.id || "current"} task`);
      factors.push({ name: "task_relevance", value: taskScore, weight: "high" });
    }

    // 3. Matches user intent (critical utility)
    const intentScore = this._scoreIntentMatch(entity, userIntent);
    if (intentScore > 0) {
      score += intentScore;
      reasons.push("Directly relevant to user intent");
      factors.push({ name: "intent_match", value: intentScore, weight: "critical" });
    }

    // 4. Recently mentioned with action items (high utility)
    const actionScore = this._scoreActionItemRelevance(entity);
    if (actionScore > 0) {
      score += actionScore;
      reasons.push("Has associated action items");
      factors.push({ name: "action_items", value: actionScore, weight: "high" });
    }

    // 5. Conversation continuity (medium utility)
    const continuityScore = this._scoreContinuity(entity, conversationHistory);
    if (continuityScore > 0) {
      score += continuityScore;
      reasons.push("Maintains conversation continuity");
      factors.push({ name: "continuity", value: continuityScore, weight: "medium" });
    }

    // 6. Anchored status (boost)
    if (isAnchored) {
      score += 25;
      reasons.push("Explicitly anchored as important");
      factors.push({ name: "anchored", value: 25, weight: "boost" });
    }

    // 7. Mention frequency vs recency balance
    const frequencyScore = this._scoreFrequency(entity, conversationHistory);
    score += frequencyScore;
    if (frequencyScore > 0) {
      factors.push({ name: "frequency", value: frequencyScore, weight: "low" });
    }

    // 8. Entity type base score
    const typeScore = this._scoreEntityType(entity.type);
    score += typeScore;
    factors.push({ name: "entity_type", value: typeScore, weight: "base" });

    // Calculate final score
    const finalScore = Math.min(100, Math.round(score));

    // Determine utility category
    const utility = this._categorizeUtility(finalScore);

    return {
      entity,
      score: finalScore,
      utility,
      reasons: reasons.length > 0 ? reasons : ["Contextually present"],
      factors,
      shouldTrack: this._shouldTrack(finalScore, entity, context),
    };
  }

  /**
   * Score based on whether entity was in my last response
   */
  _scoreReferenceInResponse(entity, lastResponse) {
    if (!lastResponse || !entity.name) return 0;

    const normalizedName = entity.name.toLowerCase();
    const normalizedResponse = lastResponse.toLowerCase();

    // Exact mention
    if (normalizedResponse.includes(normalizedName)) {
      // Check if it was a significant mention (quoted, emphasized, etc.)
      const patterns = [
        new RegExp(`['"\`]${entity.name}['"\`]`, "i"),
        new RegExp(`\\*${entity.name}\\*`, "i"),
        new RegExp(`_${entity.name}_`, "i"),
        new RegExp(`\\b${entity.name}\\b[^.]{0,50}\\?`, "i"), // In a question
      ];

      for (const pattern of patterns) {
        if (pattern.test(lastResponse)) {
          return 35; // Highly significant reference
        }
      }

      return 25; // Standard reference
    }

    // Partial match for multi-word names
    if (entity.name.includes(" ")) {
      const words = entity.name.split(" ");
      const matchedWords = words.filter((w) => normalizedResponse.includes(w.toLowerCase())).length;

      if (matchedWords / words.length > 0.7) {
        return 20;
      }
    }

    return 0;
  }

  /**
   * Score based on task relevance
   */
  _scoreTaskRelevance(entity, currentTask) {
    if (!currentTask) return 0;

    let score = 0;
    const taskType = currentTask.id || currentTask;

    // Task-specific entity type weights
    const taskWeights = {
      coding: { file: 20, function: 18, error: 25, project: 15 },
      debugging: { error: 30, file: 20, log: 18, recent_change: 20 },
      research: { document: 20, source: 18, topic: 15 },
      planning: { decision: 22, deadline: 20, blocker: 25 },
    };

    const weights = taskWeights[taskType] || {};
    if (weights[entity.type]) {
      score += weights[entity.type];
    }

    // Check if entity matches dynamic important terms for task
    if (currentTask.dynamicTerms?.high) {
      for (const term of currentTask.dynamicTerms.high) {
        if (entity.name?.toLowerCase().includes(term.toLowerCase())) {
          score += 15;
          break;
        }
      }
    }

    return score;
  }

  /**
   * Score based on user intent match
   */
  _scoreIntentMatch(entity, userIntent) {
    if (!userIntent) return 0;

    let score = 0;

    // Direct match with needed context
    if (userIntent.neededContext) {
      for (const need of userIntent.neededContext) {
        if (this._matchesNeed(entity, need)) {
          score += need.priority === "critical" ? 35 : 25;
        }
      }
    }

    // Match with specific goal
    if (userIntent.specificGoal?.target) {
      const target = userIntent.specificGoal.target.toLowerCase();
      if (entity.name?.toLowerCase().includes(target)) {
        score += 30;
      }
    }

    return score;
  }

  /**
   * Score based on action item relevance
   */
  _scoreActionItemRelevance(entity) {
    const history = this.actionItems.get(entity.id);
    if (!history) return 0;

    let score = 0;
    const now = Date.now();

    for (const item of history) {
      const age = now - item.timestamp;
      const daysAgo = age / (1000 * 60 * 60 * 24);

      if (daysAgo < 1) {
        score += 25; // Very recent action item
      } else if (daysAgo < 3) {
        score += 15; // Recent action item
      } else if (daysAgo < 7) {
        score += 8; // Older action item
      }

      // Unresolved action items get boost
      if (!item.resolved) {
        score += 10;
      }
    }

    return Math.min(30, score);
  }

  /**
   * Score based on conversation continuity
   */
  _scoreContinuity(entity, conversationHistory) {
    if (!conversationHistory || conversationHistory.length === 0) return 0;

    let score = 0;
    const recentTurns = conversationHistory.slice(-5);
    const entityName = entity.name?.toLowerCase();

    if (!entityName) return 0;

    // Check for repeated mentions across turns
    let mentionCount = 0;
    let lastMentionIndex = -1;

    for (let i = 0; i < recentTurns.length; i++) {
      const turn = recentTurns[i].toLowerCase();
      if (turn.includes(entityName)) {
        mentionCount++;
        lastMentionIndex = i;
      }
    }

    if (mentionCount > 1) {
      score += 10 + mentionCount * 3;
    }

    // Recent mention gets small boost
    if (lastMentionIndex === recentTurns.length - 1) {
      score += 5;
    }

    return Math.min(20, score);
  }

  /**
   * Score based on mention frequency with recency decay
   */
  _scoreFrequency(entity, conversationHistory) {
    const history = this.termHistory.get(entity.id);
    if (!history || history.mentions.length === 0) return 0;

    let score = 0;
    const now = Date.now();

    for (const mention of history.mentions) {
      const age = now - mention.timestamp;
      const hoursAgo = age / (1000 * 60 * 60);

      // Exponential decay based on age
      const weight = Math.exp(-hoursAgo / 24); // 24-hour half-life
      score += 5 * weight;
    }

    // Penalize terms mentioned only once with no follow-up
    if (history.mentions.length === 1) {
      const age = now - history.mentions[0].timestamp;
      if (age > 1000 * 60 * 30) {
        // Older than 30 min
        score *= 0.5; // Reduce score
      }
    }

    return Math.min(15, score);
  }

  /**
   * Base score by entity type
   */
  _scoreEntityType(type) {
    const typeScores = {
      error: 20,
      file: 18,
      project: 16,
      decision: 15,
      person: 12,
      function: 14,
      class: 13,
      tool: 10,
      topic: 10,
      document: 12,
      continuity: 8,
      dynamic_term: 12,
    };

    return typeScores[type] || 8;
  }

  /**
   * Determine utility category
   */
  _categorizeUtility(score) {
    if (score >= this.thresholds.high) return "high";
    if (score >= this.thresholds.medium) return "medium";
    if (score >= this.thresholds.low) return "low";
    return "minimal";
  }

  /**
   * Decide if entity should be tracked
   */
  _shouldTrack(score, entity, context) {
    // Always track anchored items
    if (context.isAnchored) return true;

    // Always track high utility
    if (score >= this.thresholds.high) return true;

    // Don't track minimal utility
    if (score < this.thresholds.low) return false;

    // Track medium utility if it matches intent
    if (score >= this.thresholds.medium && context.userIntent) {
      return this._matchesNeed(entity, { type: entity.type });
    }

    return true;
  }

  _matchesNeed(entity, need) {
    if (!need) return false;

    // Type match
    if (need.type && entity.type === need.type) return true;

    // Target match
    if (need.target && entity.name?.toLowerCase().includes(need.target.toLowerCase())) {
      return true;
    }

    return false;
  }

  /**
   * Record a term mention for history tracking
   */
  recordMention(entityId, context = {}) {
    const now = Date.now();

    if (!this.termHistory.has(entityId)) {
      this.termHistory.set(entityId, {
        mentions: [],
        firstSeen: now,
      });
    }

    const history = this.termHistory.get(entityId);
    history.mentions.push({
      timestamp: now,
      context: context.message?.slice(0, 100),
    });

    // Keep history bounded
    if (history.mentions.length > 20) {
      history.mentions.shift();
    }

    // Check for action items
    if (context.hasActionItem) {
      if (!this.actionItems.has(entityId)) {
        this.actionItems.set(entityId, []);
      }
      this.actionItems.get(entityId).push({
        timestamp: now,
        description: context.actionDescription,
        resolved: false,
      });
    }
  }

  /**
   * Mark action item as resolved
   */
  resolveActionItem(entityId) {
    const items = this.actionItems.get(entityId);
    if (items) {
      for (const item of items) {
        item.resolved = true;
      }
    }
  }

  /**
   * Batch score multiple entities
   */
  scoreBatch(entities, context = {}) {
    return entities.map((entity) => this.score(entity, context));
  }

  /**
   * Get scoring explanation for an entity
   */
  explainScore(entityId, scoredEntities) {
    const scored = scoredEntities.find((s) => s.entity.id === entityId);
    if (!scored) return null;

    return {
      entity: scored.entity.name,
      score: scored.score,
      utility: scored.utility,
      why: scored.reasons,
      breakdown: scored.factors.reduce((acc, f) => {
        acc[f.name] = { value: f.value, weight: f.weight };
        return acc;
      }, {}),
    };
  }

  /**
   * Adjust thresholds dynamically
   */
  setThresholds(newThresholds) {
    this.thresholds = { ...this.thresholds, ...newThresholds };
  }

  /**
   * Check if term should be filtered
   */
  shouldFilter(term, context = {}) {
    // Base exclusions always filtered
    if (this.baseExclusions.has(term.toLowerCase())) {
      return {
        filtered: true,
        reason: "Generic term",
        suggestion: null,
      };
    }

    // Check against current task's dynamic low terms
    if (context.currentTask?.dynamicTerms?.low) {
      if (context.currentTask.dynamicTerms.low.includes(term.toLowerCase())) {
        return {
          filtered: true,
          reason: `Irrelevant for ${context.currentTask.id} task`,
          suggestion: "Term filtered by task context",
        };
      }
    }

    return { filtered: false };
  }
}

module.exports = { UtilityScorer };
