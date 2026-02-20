/**
 * Task-Aware Extractor
 *
 * Detects the current task from conversation context and extracts
 * entities weighted by task relevance. Replaces static stop word
 * filtering with dynamic, context-aware relevance.
 */

// Task types and their characteristics
const TASK_TYPES = {
  CODING: {
    id: "coding",
    keywords: [
      "code",
      "implement",
      "write",
      "function",
      "class",
      "module",
      "refactor",
      "fix",
      "bug",
      "error",
      "syntax",
      "compile",
      "javascript",
      "python",
      "typescript",
      "js",
      "ts",
      "py",
      "file",
      "edit",
      "create",
      "delete",
      "move",
      "rename",
    ],
    entityWeights: {
      project: 1.5,
      file: 1.4,
      tool: 1.2,
      error: 1.5,
      function: 1.3,
      person: 0.8,
      decision: 0.7,
    },
    dynamicTerms: {
      high: ["session", "model", "plugin", "config", "gateway", "handler"],
      low: ["meeting", "schedule", "birthday", "personal"],
    },
  },
  DEBUGGING: {
    id: "debugging",
    keywords: [
      "debug",
      "fix",
      "error",
      "crash",
      "fail",
      "broken",
      "issue",
      "stack trace",
      "log",
      "exception",
      "undefined",
      "null",
      "traceback",
      "console",
      "output",
      " symptom",
      "cause",
      "reproduce",
      "investigate",
      "diagnose",
    ],
    entityWeights: {
      error: 1.6,
      file: 1.4,
      log: 1.3,
      tool: 1.2,
      project: 1.3,
      recent_change: 1.5,
      person: 0.6,
    },
    dynamicTerms: {
      high: ["session", "model", "plugin", "gateway", "handler", "worker"],
      low: ["feature", "enhancement", "planning"],
    },
  },
  RESEARCH: {
    id: "research",
    keywords: [
      "research",
      "find",
      "search",
      "look up",
      "investigate",
      "learn",
      "understand",
      "explore",
      "document",
      "article",
      "paper",
      "source",
      "reference",
      "study",
      "analyze",
      "compare",
      "evaluate",
      "review",
      "survey",
    ],
    entityWeights: {
      topic: 1.5,
      document: 1.4,
      source: 1.3,
      person: 1.0,
      project: 0.9,
      decision: 0.8,
    },
    dynamicTerms: {
      high: ["documentation", "api", "reference", "guide", "manual"],
      low: ["code", "implementation", "syntax"],
    },
  },
  PLANNING: {
    id: "planning",
    keywords: [
      "plan",
      "schedule",
      "roadmap",
      "milestone",
      "deadline",
      "decision",
      "choose",
      "prioritize",
      "organize",
      "coordinate",
      "phase",
      "stage",
      "step",
      "task",
      "goal",
      "objective",
      "timeline",
      "estimate",
      "blocker",
      "dependency",
    ],
    entityWeights: {
      decision: 1.5,
      deadline: 1.4,
      blocker: 1.5,
      project: 1.3,
      person: 1.1,
      file: 0.7,
    },
    dynamicTerms: {
      high: ["model", "session", "config"], // e.g., "deployment model"
      low: ["syntax", "error", "debug"],
    },
  },
  WRITING: {
    id: "writing",
    keywords: [
      "write",
      "draft",
      "compose",
      "document",
      "email",
      "message",
      "text",
      "content",
      "blog",
      "post",
      "letter",
      "note",
      "summary",
      "report",
      "description",
    ],
    entityWeights: {
      person: 1.3,
      topic: 1.2,
      document: 1.1,
      project: 0.8,
      file: 0.9,
    },
    dynamicTerms: {
      high: ["tone", "style", "audience", "format"],
      low: ["session", "model", "plugin", "gateway", "handler"],
    },
  },
};

// Minimal static exclusions - only truly generic terms
const BASE_EXCLUSIONS = new Set([
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
  "need",
  "dare",
  "ought",
  "used",
  "it",
  "this",
  "that",
  "these",
  "those",
  "i",
  "you",
  "he",
  "she",
  "we",
  "they",
  "them",
  "their",
  "there",
]);

class TaskAwareExtractor {
  constructor() {
    this.currentTask = null;
    this.taskConfidence = 0;
    this.entityCache = new Map();
    this.mentionHistory = [];
  }

  /**
   * Detect the current task from conversation text
   */
  detectTask(text, recentMessages = []) {
    const combinedText = [text, ...recentMessages.slice(-3)].join(" ").toLowerCase();

    let bestTask = null;
    let maxScore = 0;
    const scores = {};

    for (const [taskName, taskDef] of Object.entries(TASK_TYPES)) {
      let score = 0;

      // Count keyword matches
      for (const keyword of taskDef.keywords) {
        const regex = new RegExp(`\\b${keyword}\\b`, "gi");
        const matches = combinedText.match(regex);
        if (matches) {
          score += matches.length * 2;
        }
      }

      // Boost for explicit task statements
      const explicitPatterns = [
        new RegExp(`i('m| am)? (doing|working on|in) ${taskDef.id}`, "i"),
        new RegExp(`this is (a|an)? ${taskDef.id} (task|session|conversation)`, "i"),
        new RegExp(`let's ${taskDef.keywords[0]}`, "i"),
      ];

      for (const pattern of explicitPatterns) {
        if (pattern.test(combinedText)) {
          score += 10;
        }
      }

      scores[taskDef.id] = score;

      if (score > maxScore) {
        maxScore = score;
        bestTask = taskDef;
      }
    }

    // Confidence based on margin over second-best
    const sortedScores = Object.values(scores).sort((a, b) => b - a);
    const margin = sortedScores[0] - (sortedScores[1] || 0);
    this.taskConfidence = Math.min(1, margin / 10 + (maxScore > 5 ? 0.3 : 0));

    // Default to coding if unclear (common case)
    if (!bestTask || maxScore < 3) {
      bestTask = TASK_TYPES.CODING;
      this.taskConfidence = 0.3;
    }

    this.currentTask = bestTask;
    return {
      task: bestTask.id,
      confidence: this.taskConfidence,
      scores,
      reason: this._getTaskReason(bestTask, maxScore),
    };
  }

  /**
   * Extract entities with task-aware weighting
   */
  extract(text, context = {}) {
    const { recentMessages = [], lastResponse = "" } = context;

    // Detect or update task
    const taskInfo = this.detectTask(text, recentMessages);

    const entities = [];
    const lowerText = text.toLowerCase();

    // 1. Extract explicit references (files, projects, etc.)
    entities.push(...this._extractExplicitReferences(text));

    // 2. Extract code-specific entities (errors, functions, etc.)
    entities.push(...this._extractCodeEntities(text));

    // 3. Extract contextual entities based on task type
    entities.push(...this._extractTaskSpecificEntities(text, taskInfo.task));

    // 4. Cross-reference with last response for continuity
    entities.push(...this._extractFromLastResponse(text, lastResponse));

    // Score and weight entities
    const scoredEntities = this._scoreEntities(entities, {
      task: taskInfo,
      text,
      lastResponse,
    });

    return {
      task: taskInfo,
      entities: this._deduplicate(scoredEntities),
      relevanceExplanation: this._generateExplanation(taskInfo, scoredEntities),
    };
  }

  _extractExplicitReferences(text) {
    const refs = [];
    const patterns = [
      { regex: /\bproject[-:]?([a-z0-9_-]+)\b/gi, type: "project" },
      { regex: /\bfile[-:]?([a-z0-9_-]+)\b/gi, type: "file" },
      { regex: /\b([a-z0-9_-]+\.(?:js|ts|py|md|json|yml|yaml|sh))\b/gi, type: "file" },
      { regex: /\b(memory|config|skill)[-/]([a-z0-9_-]+)\b/gi, type: "file" },
      { regex: /\berror[:\s]+([A-Z][a-zA-Z0-9]*(?:Error|Exception))\b/g, type: "error" },
      { regex: /\b([a-z_][a-z0-9_]*(?:Error|Exception))\b/g, type: "error" },
      { regex: /\bfunction\s+(\w+)\b/g, type: "function" },
      { regex: /\bclass\s+(\w+)\b/g, type: "class" },
    ];

    for (const { regex, type } of patterns) {
      let match;
      while ((match = regex.exec(text)) !== null) {
        const name = match[2] || match[1];
        if (!BASE_EXCLUSIONS.has(name.toLowerCase())) {
          refs.push({
            type,
            id: `${type}:${name.toLowerCase()}`,
            name,
            source: "explicit",
            position: match.index,
          });
        }
      }
    }

    return refs;
  }

  _extractCodeEntities(text) {
    const entities = [];

    // Stack traces and error patterns
    const errorPatterns = [
      /\b(TypeError|ReferenceError|SyntaxError|RangeError)\b[^\n]*/g,
      /\bat\s+(\w+)\s+\([^)]+\)/g,
      /\bundefined\s+is\s+not\s+(?:a\s+)?(\w+)/gi,
      /cannot\s+(?:read|find|access)\s+(?:property)?\s*['"]?([^'"\s]+)['"]?/gi,
    ];

    for (const pattern of errorPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const errorType = match[1] || match[0].slice(0, 50);
        entities.push({
          type: "error",
          id: `error:${errorType.toLowerCase().replace(/\s+/g, "-")}`,
          name: errorType,
          source: "code_analysis",
          context: match[0],
        });
      }
    }

    return entities;
  }

  _extractTaskSpecificEntities(text, taskType) {
    const entities = [];
    const taskDef = TASK_TYPES[taskType.toUpperCase()];

    if (!taskDef) return entities;

    // Extract dynamic high-importance terms for this task
    for (const term of taskDef.dynamicTerms.high) {
      const regex = new RegExp(`\\b${term}\\b`, "gi");
      let match;
      while ((match = regex.exec(text)) !== null) {
        entities.push({
          type: "dynamic_term",
          id: `term:${term}`,
          name: term,
          source: "task_specific",
          taskRelevance: "high",
          reason: `Critical for ${taskType} task`,
        });
      }
    }

    return entities;
  }

  _extractFromLastResponse(currentText, lastResponse) {
    const entities = [];
    if (!lastResponse) return entities;

    const lowerLast = lastResponse.toLowerCase();
    const lowerCurrent = currentText.toLowerCase();

    // Find entities mentioned in last response that appear in current text
    const patterns = [
      /'([^']+)'/g,
      /"([^"]+)"/g,
      /`([^`]+)`/g,
      /\b([A-Z][a-z]+[A-Z]\w+)\b/g, // CamelCase
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(lowerLast)) !== null) {
        const term = match[1] || match[0];
        if (lowerCurrent.includes(term.toLowerCase()) && !BASE_EXCLUSIONS.has(term.toLowerCase())) {
          entities.push({
            type: "continuity",
            id: `continuity:${term.toLowerCase()}`,
            name: term,
            source: "last_response",
            reason: "Referenced in your last response",
          });
        }
      }
    }

    return entities;
  }

  _scoreEntities(entities, context) {
    const { task } = context;
    const taskDef = TASK_TYPES[task.task.toUpperCase()];

    return entities.map((entity) => {
      let score = 50; // Base score
      let reasons = [];

      // Task type weight
      if (taskDef && taskDef.entityWeights[entity.type]) {
        const weight = taskDef.entityWeights[entity.type];
        score *= weight;
        reasons.push(`${entity.type} weighted ${weight}x for ${task.task}`);
      }

      // Source-based scoring
      switch (entity.source) {
        case "last_response":
          score += 30;
          reasons.push("Referenced in your last response");
          break;
        case "explicit":
          score += 20;
          reasons.push("Explicitly mentioned");
          break;
        case "task_specific":
          score += 25;
          reasons.push(`Critical for ${task.task} task`);
          break;
        case "code_analysis":
          score += 35;
          reasons.push("Error/stack trace detected");
          break;
      }

      // Dynamic term importance
      if (entity.taskRelevance === "high") {
        score += 20;
      }

      // Confidence boost for clear task detection
      if (task.confidence > 0.7) {
        score *= 1.1;
      }

      return {
        ...entity,
        score: Math.min(100, Math.round(score)),
        reasons: reasons.length > 0 ? reasons : ["Contextually relevant"],
      };
    });
  }

  _deduplicate(entities) {
    const seen = new Map();

    for (const entity of entities) {
      const key = entity.id;
      if (seen.has(key)) {
        // Merge scores, keep higher
        const existing = seen.get(key);
        existing.score = Math.max(existing.score, entity.score);
        existing.reasons = [...new Set([...existing.reasons, ...entity.reasons])];
      } else {
        seen.set(key, { ...entity });
      }
    }

    return Array.from(seen.values()).sort((a, b) => b.score - a.score);
  }

  _getTaskReason(task, score) {
    if (score === 0) return "No clear task detected, defaulting to coding";
    return `Detected ${task.id} task based on keyword analysis`;
  }

  _generateExplanation(taskInfo, entities) {
    const topEntities = entities.slice(0, 5);

    return {
      task: taskInfo.task,
      confidence: taskInfo.confidence,
      summary: `Detected ${taskInfo.task} task (${Math.round(taskInfo.confidence * 100)}% confidence)`,
      keyEntities: topEntities.map((e) => ({
        name: e.name,
        type: e.type,
        score: e.score,
        why: e.reasons[0],
      })),
    };
  }

  /**
   * Check if a term should be filtered based on current task context
   */
  shouldFilter(term, taskType = this.currentTask?.id) {
    // Always filter base exclusions
    if (BASE_EXCLUSIONS.has(term.toLowerCase())) {
      return { filtered: true, reason: "Generic term" };
    }

    const taskDef = TASK_TYPES[taskType?.toUpperCase()];
    if (!taskDef) return { filtered: false };

    // Check if term is dynamically important for this task
    if (taskDef.dynamicTerms.high.includes(term.toLowerCase())) {
      return { filtered: false, reason: `Critical for ${taskType}` };
    }

    // Check if term is dynamically unimportant for this task
    if (taskDef.dynamicTerms.low.includes(term.toLowerCase())) {
      return { filtered: true, reason: `Irrelevant for ${taskType}` };
    }

    return { filtered: false };
  }
}

module.exports = { TaskAwareExtractor, TASK_TYPES };
