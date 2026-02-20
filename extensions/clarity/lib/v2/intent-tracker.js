/**
 * Intent Tracker
 *
 * Parses user intent from messages and tracks what context the AI needs
 * to fulfill that intent. Connects user goals to relevant entities.
 */

const INTENT_TYPES = {
  ASK_QUESTION: {
    id: "ask_question",
    patterns: [
      /\b(?:what|how|why|when|where|who|which)\b/i,
      /\b(?:explain|describe|tell me about|clarify)\b/i,
      /\?\s*$/,
    ],
    contextNeeds: ["topic", "background", "related_decisions", "recent_changes"],
    description: "User is seeking information",
  },

  REQUEST_ACTION: {
    id: "request_action",
    patterns: [
      /\b(?:fix|debug|implement|create|write|build|deploy|configure|set up)\b/i,
      /\b(?:can you|please|could you|would you)\s+\w+/i,
      /\bneed\s+(?:to|you\s+to)\s+\w+/i,
      /\blet's\s+\w+/i,
    ],
    contextNeeds: ["target", "requirements", "constraints", "related_files", "recent_errors"],
    description: "User wants me to perform an action",
  },

  PROVIDE_INFO: {
    id: "provide_info",
    patterns: [
      /\b(?:here is|here are|I have|I've|I just|I want to|I need to)\b/i,
      /\b(?:update|status|progress|result|output|error)\b/i,
      /\b(?:tried|attempted|ran|executed|got|received)\b/i,
    ],
    contextNeeds: ["current_state", "previous_attempts", "new_information"],
    description: "User is providing information or status",
  },

  DECISION_REQUEST: {
    id: "decision_request",
    patterns: [
      /\b(?:should I|which|choose between|decide|recommend|suggest)\b/i,
      /\b(?:options?|alternatives?|pros?\s+and\s+cons?)\b/i,
      /\b(?:better|best|optimal|right choice)\b/i,
    ],
    contextNeeds: ["constraints", "priorities", "previous_decisions", "tradeoffs"],
    description: "User needs help making a decision",
  },

  CONFIRMATION: {
    id: "confirmation",
    patterns: [
      /\b(?:yes|no|correct|incorrect|right|wrong|exactly|precisely)\b/i,
      /\b(?:that works|that doesn't work|perfect|good|bad)\b/i,
      /\b(?:thanks?|thank you|got it|understood)\b/i,
    ],
    contextNeeds: ["what_was_confirmed", "next_steps"],
    description: "User is confirming or responding to previous interaction",
  },
};

// Intent-specific entity extraction patterns
const INTENT_PATTERNS = {
  fix_bug: {
    patterns: [
      /fix\s+(?:the\s+)?(\w+)\s*(?:bug|error|issue|problem)?/i,
      /debug\s+(?:the\s+)?(\w+)/i,
      /(?:bug|error|issue)\s+(?:in|with)\s+(?:the\s+)?(\w+)/i,
    ],
    entities: ["bug_location", "error_type", "recent_changes"],
  },

  deploy_something: {
    patterns: [
      /deploy\s+(?:the\s+)?(\w+)/i,
      /push\s+(?:the\s+)?(\w+)\s+(?:to|into)/i,
      /release\s+(?:the\s+)?(\w+)/i,
    ],
    entities: ["deploy_target", "deployment_config", "last_deploy"],
  },

  change_config: {
    patterns: [
      /(?:change|update|modify)\s+(?:the\s+)?config\w*\s+(?:for|of)?\s*(\w+)/i,
      /configure\s+(?:the\s+)?(\w+)/i,
    ],
    entities: ["config_target", "current_config", "config_files"],
  },

  investigate_error: {
    patterns: [
      /investigate\s+(?:the\s+)?(\w+)/i,
      /look\s+(?:into|at)\s+(?:the\s+)?(\w+)/i,
      /what['']?s\s+(?:wrong|happening)\s+(?:with\s+)?(?:the\s+)?(\w+)/i,
    ],
    entities: ["error_subject", "logs", "recent_changes"],
  },

  implement_feature: {
    patterns: [
      /implement\s+(?:the\s+)?(\w+)/i,
      /add\s+(?:the\s+)?(\w+)\s+(?:feature|functionality)?/i,
      /build\s+(?:the\s+)?(\w+)/i,
    ],
    entities: ["feature_name", "requirements", "related_code"],
  },
};

class IntentTracker {
  constructor() {
    this.currentIntent = null;
    this.intentHistory = [];
    this.trackedEntities = new Map();
    this.lastUserMessage = "";
    this.lastAiResponse = "";
  }

  /**
   * Parse intent from user message
   */
  parseIntent(message, context = {}) {
    this.lastUserMessage = message;
    const lowerMessage = message.toLowerCase();

    let detectedIntent = null;
    let maxConfidence = 0;
    const scores = {};

    // Detect primary intent type
    for (const [intentName, intentDef] of Object.entries(INTENT_TYPES)) {
      let score = 0;

      for (const pattern of intentDef.patterns) {
        const matches = message.match(pattern);
        if (matches) {
          score += matches.length * 2;
        }
      }

      // Boost for explicit intent statements
      if (
        new RegExp(
          `\\bi (?:want to|need to|am trying to) ${intentName.replace("_", " ")}`,
          "i",
        ).test(message)
      ) {
        score += 5;
      }

      scores[intentDef.id] = score;

      if (score > maxConfidence) {
        maxConfidence = score;
        detectedIntent = intentDef;
      }
    }

    // Extract specific goal/action from message
    const specificGoal = this._extractSpecificGoal(message);

    // Track what I need to know to fulfill this intent
    const neededContext = this._determineNeededContext(detectedIntent, specificGoal, message);

    const result = {
      primaryIntent: detectedIntent?.id || "unknown",
      confidence: Math.min(1, maxConfidence / 5),
      specificGoal,
      neededContext,
      contextGaps: this._identifyContextGaps(neededContext, context),
      scores,
    };

    this.currentIntent = result;
    this.intentHistory.push({
      ...result,
      timestamp: Date.now(),
      message: message.slice(0, 200),
    });

    // Keep history bounded
    if (this.intentHistory.length > 20) {
      this.intentHistory.shift();
    }

    return result;
  }

  /**
   * Extract specific goal/action from message
   */
  _extractSpecificGoal(message) {
    const goals = [];

    for (const [goalType, config] of Object.entries(INTENT_PATTERNS)) {
      for (const pattern of config.patterns) {
        const match = message.match(pattern);
        if (match) {
          goals.push({
            type: goalType,
            target: match[1],
            entities: config.entities,
          });
        }
      }
    }

    // Return the most specific goal
    return goals.sort((a, b) => b.target.length - a.target.length)[0] || null;
  }

  /**
   * Determine what context I need based on intent
   */
  _determineNeededContext(intent, goal, message) {
    const needs = [];

    if (!intent) return needs;

    // Base needs from intent type
    for (const need of intent.contextNeeds) {
      needs.push({
        type: need,
        priority: "high",
        reason: `Needed for ${intent.id}`,
      });
    }

    // Specific needs from goal type
    if (goal) {
      for (const entity of goal.entities) {
        needs.push({
          type: entity,
          target: goal.target,
          priority: "critical",
          reason: `Specific to goal: ${goal.type}`,
        });
      }
    }

    // Extract file references
    const fileMatches = message.match(/\b([\w-]+\.(?:js|ts|py|md|json|yml))\b/g);
    if (fileMatches) {
      for (const file of fileMatches) {
        needs.push({
          type: "file",
          target: file,
          priority: "critical",
          reason: "Explicitly referenced file",
        });
      }
    }

    // Extract error references
    const errorMatches = message.match(/\b(\w+(?:Error|Exception))\b/g);
    if (errorMatches) {
      for (const error of errorMatches) {
        needs.push({
          type: "error",
          target: error,
          priority: "critical",
          reason: "Error mentioned",
        });
      }
    }

    return needs;
  }

  /**
   * Identify what context might be missing
   */
  _identifyContextGaps(neededContext, availableContext) {
    const gaps = [];

    for (const need of neededContext) {
      // Check if this need is satisfied
      const isSatisfied = this._checkNeedSatisfied(need, availableContext);

      if (!isSatisfied) {
        gaps.push({
          ...need,
          suggestion: this._suggestGapFill(need),
        });
      }
    }

    return gaps;
  }

  _checkNeedSatisfied(need, availableContext) {
    // Simple check - could be more sophisticated
    if (!availableContext) return false;

    // Check if the specific target is in available context
    if (need.target && availableContext[need.type]) {
      const items = Array.isArray(availableContext[need.type])
        ? availableContext[need.type]
        : [availableContext[need.type]];

      return items.some(
        (item) => item.id?.includes(need.target) || item.name?.includes(need.target),
      );
    }

    return availableContext[need.type] !== undefined;
  }

  _suggestGapFill(need) {
    const suggestions = {
      recent_changes: "Look for recent git commits or file modifications",
      error_logs: "Check for error files or console output",
      config_files: `Search for config files related to ${need.target}`,
      related_files: `Find files related to ${need.target}`,
      requirements: "Ask user for clarification on requirements",
    };

    return suggestions[need.type] || `Need more context about ${need.type}`;
  }

  /**
   * Track what entities are relevant to current intent
   */
  trackForIntent(entities, intent) {
    const tracked = [];

    for (const entity of entities) {
      // Score based on relevance to intent
      let relevanceScore = entity.score || 50;
      let reasons = [...(entity.reasons || [])];

      // Boost if entity matches needed context
      for (const need of intent.neededContext) {
        if (this._entityMatchesNeed(entity, need)) {
          relevanceScore += 25;
          reasons.push(`Needed for intent: ${intent.primaryIntent}`);
        }
      }

      // Boost if entity is the specific goal target
      if (
        intent.specificGoal?.target &&
        entity.name?.toLowerCase().includes(intent.specificGoal.target.toLowerCase())
      ) {
        relevanceScore += 30;
        reasons.push("Primary target of user request");
      }

      tracked.push({
        ...entity,
        score: Math.min(100, relevanceScore),
        reasons: [...new Set(reasons)],
      });

      // Update tracked entities
      this.trackedEntities.set(entity.id, {
        ...entity,
        lastIntent: intent.primaryIntent,
        relevanceScore,
      });
    }

    return tracked.sort((a, b) => b.score - a.score);
  }

  _entityMatchesNeed(entity, need) {
    const entityType = entity.type?.toLowerCase();
    const needType = need.type?.toLowerCase();

    // Direct type match
    if (entityType === needType) return true;

    // Name contains target
    if (need.target && entity.name?.toLowerCase().includes(need.target.toLowerCase())) {
      return true;
    }

    // Semantic matches
    const typeMappings = {
      error: ["error", "bug", "issue", "exception"],
      file: ["file", "config", "script", "module"],
      project: ["project", "repo", "package"],
    };

    const possibleTypes = typeMappings[needType] || [needType];
    return possibleTypes.includes(entityType);
  }

  /**
   * Get tracked entities relevant to current conversation
   */
  getRelevantEntities(minScore = 40) {
    const relevant = [];

    for (const [id, entity] of this.trackedEntities) {
      if (entity.relevanceScore >= minScore) {
        relevant.push(entity);
      }
    }

    return relevant.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Generate summary of what I need to know
   */
  getContextSummary() {
    if (!this.currentIntent) return null;

    const { primaryIntent, specificGoal, neededContext, contextGaps } = this.currentIntent;

    return {
      intent: primaryIntent,
      goal: specificGoal,
      summary: this._generateIntentSummary(primaryIntent, specificGoal),
      criticalNeeds: neededContext.filter((n) => n.priority === "critical").map((n) => n.type),
      gaps: contextGaps.map((g) => ({
        type: g.type,
        target: g.target,
        suggestion: g.suggestion,
      })),
    };
  }

  _generateIntentSummary(intent, goal) {
    if (goal) {
      return `${intent}: ${goal.type.replace("_", " ")} ${goal.target || ""}`;
    }
    return `User ${intent.replace("_", " ")}`;
  }

  /**
   * Update after AI response to track what was referenced
   */
  trackResponse(response) {
    this.lastAiResponse = response;

    // Extract entities mentioned in response
    const mentionedEntities = this._extractEntitiesFromResponse(response);

    // Boost scores for entities I referenced
    for (const entityId of mentionedEntities) {
      if (this.trackedEntities.has(entityId)) {
        const entity = this.trackedEntities.get(entityId);
        entity.relevanceScore = Math.min(100, entity.relevanceScore + 10);
        entity.iReferenced = true;
      }
    }
  }

  _extractEntitiesFromResponse(response) {
    const mentioned = [];

    for (const [id, entity] of this.trackedEntities) {
      if (response.toLowerCase().includes(entity.name?.toLowerCase())) {
        mentioned.push(id);
      }
    }

    return mentioned;
  }
}

module.exports = { IntentTracker, INTENT_TYPES, INTENT_PATTERNS };
