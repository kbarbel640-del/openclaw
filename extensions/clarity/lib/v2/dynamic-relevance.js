/**
 * Dynamic Relevance Scoring for Clarity v2
 *
 * This module implements AI-utility-based relevance scoring instead of
 * static keyword filtering. It analyzes conversation context to determine
 * what's actually useful for the AI right now.
 */

// Action verbs that indicate task relevance
const ACTION_VERBS = new Set([
  "fix",
  "deploy",
  "test",
  "debug",
  "implement",
  "create",
  "write",
  "update",
  "modify",
  "refactor",
  "optimize",
  "review",
  "check",
  "verify",
  "validate",
  "build",
  "run",
  "execute",
  "configure",
  "setup",
  "install",
  "migrate",
  "convert",
  "transform",
  "analyze",
  "investigate",
  "research",
  "find",
  "search",
  "query",
  "fetch",
  "load",
  "save",
  "export",
  "import",
  "sync",
  "backup",
  "restore",
  "restart",
  "stop",
  "start",
  "enable",
  "disable",
  "patch",
  "release",
]);

// Question indicators
const QUESTION_WORDS = new Set([
  "what",
  "why",
  "how",
  "when",
  "where",
  "who",
  "which",
  "can",
  "could",
  "would",
  "should",
  "is",
  "are",
  "does",
  "do",
]);

// Generic terms that are usually noise UNLESS contextually relevant
const GENERIC_TERMS = new Set([
  "session",
  "model",
  "plugin",
  "context",
  "tool",
  "agent",
  "message",
  "text",
  "content",
  "function",
  "response",
  "request",
]);

// Relevance signal weights
const SIGNAL_WEIGHTS = {
  REFERENCED_IN_RESPONSE: 50, // I actually used it
  ACTION_VERB_PRESENT: 30, // Task-related
  QUESTION_MARKED: 20, // User asked about it
  CURRENT_TASK_PART: 25, // Part of what I'm doing
  MULTIPLE_MENTIONS: 15, // Mentioned 2+ times recently
  SINGLE_MENTION_NO_CONTEXT: -10, // Likely noise
};

// Relevance thresholds
const RELEVANCE_CATEGORIES = {
  IMMEDIATE: { min: 70, icon: "🔥", label: "Immediate" },
  USEFUL: { min: 40, icon: "⭐", label: "Useful" },
  BACKGROUND: { min: 20, icon: "○", label: "Background" },
  HIDDEN: { min: 0, icon: "", label: "" },
};

/**
 * Analyzes conversation context to score term relevance dynamically
 */
class DynamicRelevanceScorer {
  constructor(options = {}) {
    this.recentTurnsWindow = options.recentTurnsWindow || 5;
    this.myResponsesWindow = options.myResponsesWindow || 3;
    this.pendingTasks = new Map(); // taskId -> task
    this.conversationHistory = []; // Array of turns
    this.currentTask = null;
  }

  /**
   * Set the current task context
   */
  setCurrentTask(task) {
    this.currentTask = task;
  }

  /**
   * Add a turn to conversation history
   */
  addTurn(turn) {
    this.conversationHistory.push({
      turnNumber: turn.number || this.conversationHistory.length + 1,
      userMessage: turn.userMessage,
      aiResponse: turn.aiResponse,
      timestamp: turn.timestamp || Date.now(),
      entities: turn.entities || [],
    });

    // Keep only recent history
    if (this.conversationHistory.length > this.recentTurnsWindow * 2) {
      this.conversationHistory = this.conversationHistory.slice(-this.recentTurnsWindow * 2);
    }
  }

  /**
   * Score a term/entity for dynamic relevance
   */
  scoreRelevance(entity, options = {}) {
    const {
      term,
      type = "keyword",
      mentionCount = 1,
      lastMentionTurn = 0,
      currentTurn = this.conversationHistory.length,
    } = entity;

    const normalizedTerm = term.toLowerCase().trim();
    let score = 0;
    const signals = [];

    // Get recent context
    const recentTurns = this.getRecentTurns(this.recentTurnsWindow);
    const myRecentResponses = this.getMyRecentResponses(this.myResponsesWindow);

    // Signal 1: Referenced in my last response (+50)
    if (this.wasReferencedInResponses(normalizedTerm, myRecentResponses)) {
      score += SIGNAL_WEIGHTS.REFERENCED_IN_RESPONSE;
      signals.push({
        type: "referenced",
        weight: SIGNAL_WEIGHTS.REFERENCED_IN_RESPONSE,
        description: "you just referenced this",
      });
    }

    // Signal 2: Mentioned with action verb (+30)
    const actionContext = this.findActionContext(normalizedTerm, recentTurns);
    if (actionContext) {
      score += SIGNAL_WEIGHTS.ACTION_VERB_PRESENT;
      signals.push({
        type: "action",
        weight: SIGNAL_WEIGHTS.ACTION_VERB_PRESENT,
        description: `mentioned with "${actionContext.verb}"`,
        context: actionContext.sentence,
      });
    }

    // Signal 3: Mentioned with question mark (+20)
    const questionContext = this.findQuestionContext(normalizedTerm, recentTurns);
    if (questionContext) {
      score += SIGNAL_WEIGHTS.QUESTION_MARKED;
      signals.push({
        type: "question",
        weight: SIGNAL_WEIGHTS.QUESTION_MARKED,
        description: "user asked about this",
        context: questionContext.sentence,
      });
    }

    // Signal 4: Part of current task/project (+25)
    if (this.isPartOfCurrentTask(normalizedTerm)) {
      score += SIGNAL_WEIGHTS.CURRENT_TASK_PART;
      signals.push({
        type: "task",
        weight: SIGNAL_WEIGHTS.CURRENT_TASK_PART,
        description: "needed for current task",
      });
    }

    // Signal 5: Mentioned 2+ times recently (+15)
    const recentMentions = this.countRecentMentions(normalizedTerm, recentTurns);
    if (recentMentions >= 2) {
      score += SIGNAL_WEIGHTS.MULTIPLE_MENTIONS;
      signals.push({
        type: "frequency",
        weight: SIGNAL_WEIGHTS.MULTIPLE_MENTIONS,
        description: `mentioned ${recentMentions} times recently`,
      });
    }

    // Signal 6: Single mention, no context (-10) - but not if other signals present
    if (signals.length === 0 && mentionCount === 1) {
      score += SIGNAL_WEIGHTS.SINGLE_MENTION_NO_CONTEXT;
      signals.push({
        type: "noise",
        weight: SIGNAL_WEIGHTS.SINGLE_MENTION_NO_CONTEXT,
        description: "mentioned once without context",
      });
    }

    // Special handling for generic terms
    if (GENERIC_TERMS.has(normalizedTerm)) {
      // Generic terms need strong contextual signals to be relevant
      const hasStrongContext = signals.some(
        (s) => s.type === "referenced" || s.type === "action" || s.type === "task",
      );

      if (!hasStrongContext) {
        score = Math.min(score, 15); // Cap low without context
        signals.push({
          type: "generic",
          weight: 0,
          description: "generic term (filtered without context)",
        });
      } else {
        signals.push({
          type: "generic-contextual",
          weight: 0,
          description: "generic term with strong context",
        });
      }
    }

    // Recency bonus (exponential decay)
    const turnsAgo = currentTurn - lastMentionTurn;
    const recencyBonus = Math.max(0, 20 * Math.exp(-turnsAgo / 3));
    score += recencyBonus;

    return {
      term: normalizedTerm,
      type,
      score: Math.round(score),
      maxPossible: 135, // Sum of all positive weights + recency
      signals,
      recencyBonus: Math.round(recencyBonus),
      category: this.categorizeRelevance(score),
    };
  }

  /**
   * Get recent turns from conversation history
   */
  getRecentTurns(count) {
    return this.conversationHistory.slice(-count);
  }

  /**
   * Get my recent responses
   */
  getMyRecentResponses(count) {
    return this.conversationHistory
      .slice(-count)
      .map((t) => t.aiResponse)
      .filter(Boolean);
  }

  /**
   * Check if term was referenced in my responses
   */
  wasReferencedInResponses(term, responses) {
    const patterns = [
      new RegExp(`\\b${this.escapeRegex(term)}\\b`, "i"),
      new RegExp(`\\b${this.escapeRegex(term.replace(/[_-]/g, "[ _-]?"))}\\b`, "i"),
    ];

    return responses.some((response) => patterns.some((pattern) => pattern.test(response)));
  }

  /**
   * Find action verb context for a term
   */
  findActionContext(term, turns) {
    for (const turn of turns) {
      const text = `${turn.userMessage} ${turn.aiResponse || ""}`;
      const sentences = this.extractSentences(text);

      for (const sentence of sentences) {
        if (sentence.toLowerCase().includes(term.toLowerCase())) {
          const words = sentence.toLowerCase().split(/\s+/);
          for (const word of words) {
            const cleanWord = word.replace(/[^a-z]/g, "");
            if (ACTION_VERBS.has(cleanWord)) {
              return { verb: cleanWord, sentence: sentence.trim() };
            }
          }
        }
      }
    }
    return null;
  }

  /**
   * Find question context for a term
   */
  findQuestionContext(term, turns) {
    for (const turn of turns) {
      const text = turn.userMessage;
      if (!text) continue;

      const sentences = this.extractSentences(text);
      for (const sentence of sentences) {
        const lowerSentence = sentence.toLowerCase();
        if (
          lowerSentence.includes(term.toLowerCase()) &&
          (lowerSentence.includes("?") || this.startsWithQuestionWord(lowerSentence))
        ) {
          return { sentence: sentence.trim() };
        }
      }
    }
    return null;
  }

  /**
   * Check if sentence starts with a question word
   */
  startsWithQuestionWord(sentence) {
    const firstWord = sentence.trim().toLowerCase().split(/\s+/)[0];
    return QUESTION_WORDS.has(firstWord.replace(/[^a-z]/g, ""));
  }

  /**
   * Check if term is part of current task
   */
  isPartOfCurrentTask(term) {
    if (!this.currentTask) return false;

    const taskText =
      `${this.currentTask.description} ${this.currentTask.title || ""}`.toLowerCase();
    return taskText.includes(term.toLowerCase());
  }

  /**
   * Count recent mentions of a term
   */
  countRecentMentions(term, turns) {
    let count = 0;
    const pattern = new RegExp(`\\b${this.escapeRegex(term)}\\b`, "gi");

    for (const turn of turns) {
      const text = `${turn.userMessage || ""} ${turn.aiResponse || ""}`;
      const matches = text.match(pattern);
      if (matches) count += matches.length;
    }

    return count;
  }

  /**
   * Categorize relevance score
   */
  categorizeRelevance(score) {
    if (score >= RELEVANCE_CATEGORIES.IMMEDIATE.min) {
      return RELEVANCE_CATEGORIES.IMMEDIATE;
    }
    if (score >= RELEVANCE_CATEGORIES.USEFUL.min) {
      return RELEVANCE_CATEGORIES.USEFUL;
    }
    if (score >= RELEVANCE_CATEGORIES.BACKGROUND.min) {
      return RELEVANCE_CATEGORIES.BACKGROUND;
    }
    return RELEVANCE_CATEGORIES.HIDDEN;
  }

  /**
   * Calculate dynamic threshold based on conversation density
   */
  calculateDynamicThreshold() {
    const recentTurns = this.getRecentTurns(this.recentTurnsWindow);
    const infoDensity = this.calculateInfoDensity(recentTurns);
    const taskComplexity = this.estimateTaskComplexity();

    // High information density: show more items
    if (infoDensity > 0.7) {
      return { limit: 8, minScore: 25, group: true };
    }

    // Complex multi-task: show more with grouping
    if (taskComplexity > 2) {
      return { limit: 10, minScore: 20, group: true };
    }

    // Simple question: show fewer items
    if (infoDensity < 0.3 && taskComplexity <= 1) {
      return { limit: 3, minScore: 35, group: false };
    }

    // Default: moderate
    return { limit: 5, minScore: 30, group: false };
  }

  /**
   * Calculate information density of recent conversation
   */
  calculateInfoDensity(turns) {
    if (turns.length === 0) return 0.5;

    let totalEntities = 0;
    let totalWords = 0;

    for (const turn of turns) {
      const text = `${turn.userMessage || ""} ${turn.aiResponse || ""}`;
      totalWords += text.split(/\s+/).length;
      totalEntities += (turn.entities || []).length;
    }

    // Density = entities per 100 words, normalized 0-1
    const density = totalWords > 0 ? (totalEntities / totalWords) * 100 : 0;
    return Math.min(1, density / 5); // Normalize: 5 entities per 100 words = max density
  }

  /**
   * Estimate task complexity from conversation
   */
  estimateTaskComplexity() {
    const recentTurns = this.getRecentTurns(this.recentTurnsWindow);
    let actionCount = 0;
    let distinctTopics = new Set();

    for (const turn of recentTurns) {
      const text = `${turn.userMessage || ""} ${turn.aiResponse || ""}`.toLowerCase();

      // Count action verbs
      for (const verb of ACTION_VERBS) {
        if (text.includes(verb)) actionCount++;
      }

      // Track distinct entities as topics
      (turn.entities || []).forEach((e) => distinctTopics.add(e.term || e));
    }

    // Complexity score based on actions and topics
    return Math.min(5, actionCount / 3 + distinctTopics.size / 4);
  }

  /**
   * Extract sentences from text
   */
  extractSentences(text) {
    if (!text) return [];
    return text
      .replace(/([.!?])\s+/g, "$1|")
      .split("|")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  /**
   * Escape special regex characters
   */
  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}

/**
 * Format clarity context with dynamic relevance and explanations
 */
function formatClarityContext(scoredEntities, options = {}) {
  const scorer = options.scorer || new DynamicRelevanceScorer();
  const threshold = scorer.calculateDynamicThreshold();

  // Sort by score descending
  const sorted = scoredEntities
    .filter((e) => e.score >= threshold.minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, threshold.limit);

  if (sorted.length === 0) {
    return "[CLARITY CONTEXT]\nNo relevant context detected.\n";
  }

  // Group by category
  const grouped = {
    immediate: sorted.filter((e) => e.category.icon === "🔥"),
    useful: sorted.filter((e) => e.category.icon === "⭐"),
    background: sorted.filter((e) => e.category.icon === "○"),
  };

  const lines = ["[CLARITY CONTEXT]"];

  // Dynamic threshold info
  const density = scorer.calculateInfoDensity(scorer.getRecentTurns(5));
  lines.push(
    `Showing top ${sorted.length} of ${scoredEntities.length} items (density: ${(density * 100).toFixed(0)}%)`,
  );
  lines.push("");

  // Immediate items
  if (grouped.immediate.length > 0) {
    lines.push("🔥 Immediate (needed to respond):");
    for (const entity of grouped.immediate) {
      lines.push(formatEntityLine(entity));
    }
    lines.push("");
  }

  // Useful items
  if (grouped.useful.length > 0) {
    lines.push("⭐ Useful (helps understand context):");
    for (const entity of grouped.useful) {
      lines.push(formatEntityLine(entity));
    }
    lines.push("");
  }

  // Background items
  if (grouped.background.length > 0 && !options.hideBackground) {
    lines.push("○ Background (mentioned but not critical):");
    for (const entity of grouped.background) {
      lines.push(formatEntityLine(entity, true));
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Format a single entity line with explanation
 */
function formatEntityLine(entity, compact = false) {
  const { type, term, score, signals } = entity;
  const icon = entity.category.icon;
  const id = `${type}:${term}`;

  // Get primary signal for explanation
  const primarySignal = signals.find((s) => s.weight > 0) || signals[0];
  const explanation = primarySignal ? primarySignal.description : "tracked";

  if (compact) {
    return `  ${icon} ${id} — ${explanation}`;
  }

  const lines = [`  ${icon} ${id} — ${explanation}`];

  // Add context hint if available
  const contextSignal = signals.find((s) => s.context);
  if (contextSignal) {
    lines.push(`    → "${truncate(contextSignal.context, 50)}"`);
  }

  // Add action hint
  if (type === "project") {
    lines.push(`    → try /anchor ${term}`);
  } else if (type === "tool") {
    lines.push(`    → try ${term}`);
  } else if (type === "file") {
    lines.push(`    → read ${term}`);
  }

  return lines.join("\n");
}

/**
 * Truncate text with ellipsis
 */
function truncate(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + "...";
}

/**
 * Test the dynamic relevance scoring with scenarios
 */
function runTests() {
  const tests = [
    {
      name: "Fix the session timeout bug",
      turns: [
        {
          userMessage: "Fix the session timeout bug",
          aiResponse:
            "I'll investigate the session timeout issue. Let me check the session configuration.",
          entities: [
            { term: "session", type: "keyword" },
            { term: "timeout", type: "keyword" },
          ],
        },
      ],
      currentTask: { description: "Fix session timeout bug in authentication module" },
      expectations: {
        session: { shouldAppear: true, minCategory: "USEFUL" },
      },
    },
    {
      name: "Deploy the model to production",
      turns: [
        {
          userMessage: "Deploy the model to production",
          aiResponse:
            "I'll help you deploy the model. First, let me check the model configuration.",
          entities: [
            { term: "model", type: "keyword" },
            { term: "production", type: "keyword" },
          ],
        },
      ],
      currentTask: { description: "Deploy ML model to production environment" },
      expectations: {
        model: { shouldAppear: true, minCategory: "USEFUL" },
      },
    },
    {
      name: "Write a poem about spring",
      turns: [
        {
          userMessage: "Write a poem about spring",
          aiResponse: "Here's a poem about spring:\n\nBlossoms open wide...",
          entities: [
            { term: "model", type: "keyword" },
            { term: "poem", type: "keyword" },
          ],
        },
      ],
      currentTask: { description: "Write a creative poem" },
      expectations: {
        model: { shouldAppear: false }, // Generic term without context
        poem: { shouldAppear: true, minCategory: "USEFUL" },
      },
    },
    {
      name: "Multi-turn session context",
      turns: [
        {
          userMessage: "What about the session manager?",
          aiResponse: "The session manager handles user sessions.",
          entities: [{ term: "session", type: "keyword" }],
        },
        {
          userMessage: "How does it store session data?",
          aiResponse: "Session data is stored in Redis with session tokens.",
          entities: [
            { term: "session", type: "keyword" },
            { term: "redis", type: "tool" },
          ],
        },
        {
          userMessage: "Fix the session expiration bug in Redis",
          aiResponse:
            "I'll fix the session expiration in Redis. Let me check the Redis config for session settings.",
          entities: [
            { term: "session", type: "keyword" },
            { term: "expiration", type: "keyword" },
            { term: "redis", type: "tool" },
          ],
        },
      ],
      currentTask: { description: "Fix session expiration bug in Redis" },
      expectations: {
        session: { shouldAppear: true, minCategory: "IMMEDIATE" },
        redis: { shouldAppear: true, minCategory: "USEFUL" },
      },
    },
    {
      name: "Generic term not in context",
      turns: [
        {
          userMessage: "What's the weather today?",
          aiResponse: "I don't have access to weather data.",
          entities: [
            { term: "context", type: "keyword" },
            { term: "plugin", type: "keyword" },
          ],
        },
      ],
      currentTask: null,
      expectations: {
        context: { shouldAppear: false }, // Generic, no relevance signals
        plugin: { shouldAppear: false },
      },
    },
  ];

  console.log("=".repeat(60));
  console.log("Dynamic Relevance Scoring Tests");
  console.log("=".repeat(60));

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    console.log(`\n📋 Test: ${test.name}`);
    console.log("-".repeat(40));

    const scorer = new DynamicRelevanceScorer();
    scorer.setCurrentTask(test.currentTask);

    // Add turns to history
    for (let i = 0; i < test.turns.length; i++) {
      const turn = test.turns[i];
      scorer.addTurn({
        number: i + 1,
        userMessage: turn.userMessage,
        aiResponse: turn.aiResponse,
        entities: turn.entities,
      });
    }

    // Score each entity
    const results = [];
    const lastTurn = test.turns[test.turns.length - 1];
    for (const entity of lastTurn.entities) {
      const scored = scorer.scoreRelevance({
        term: entity.term,
        type: entity.type,
        mentionCount: 1,
        lastMentionTurn: test.turns.length,
      });
      results.push(scored);
    }

    // Check expectations
    let testPassed = true;
    for (const [term, expected] of Object.entries(test.expectations)) {
      const result = results.find((r) => r.term === term);
      const appeared = result && result.score >= 20;

      if (expected.shouldAppear && !appeared) {
        console.log(`  ❌ FAIL: "${term}" should appear but didn't (score: ${result?.score || 0})`);
        testPassed = false;
      } else if (!expected.shouldAppear && appeared) {
        console.log(`  ❌ FAIL: "${term}" should NOT appear but did (score: ${result?.score})`);
        testPassed = false;
      } else {
        const category = result?.category?.label || "HIDDEN";
        console.log(
          `  ✅ PASS: "${term}" ${appeared ? `appeared (${category}, score: ${result.score})` : "filtered"}`,
        );
      }
    }

    // Show detailed results
    console.log("\n  Detailed scores:");
    for (const result of results) {
      console.log(
        `    ${result.category.icon || "  "} ${result.term}: ${result.score} (${result.signals.map((s) => s.type).join(", ")})`,
      );
    }

    if (testPassed) passed++;
    else failed++;
  }

  console.log("\n" + "=".repeat(60));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log("=".repeat(60));

  return { passed, failed, total: tests.length };
}

// Export for use in other modules
module.exports = {
  DynamicRelevanceScorer,
  formatClarityContext,
  formatEntityLine,
  SIGNAL_WEIGHTS,
  RELEVANCE_CATEGORIES,
  GENERIC_TERMS,
  ACTION_VERBS,
  runTests,
};

// Run tests if called directly
if (require.main === module) {
  const results = runTests();

  // Show formatClarityContext example
  console.log("\n\n" + "=".repeat(60));
  console.log("Format Output Example");
  console.log("=".repeat(60));

  const { DynamicRelevanceScorer, formatClarityContext } = module.exports;

  // Create example scored entities
  const exampleEntities = [
    {
      term: "claracore",
      type: "project",
      score: 95,
      signals: [
        { type: "referenced", weight: 50, description: "you just referenced this" },
        {
          type: "action",
          weight: 30,
          description: 'mentioned with "fix"',
          context: "Fix the session bug in claracore",
        },
        { type: "task", weight: 25, description: "needed for current task" },
      ],
      category: { icon: "🔥", label: "Immediate", min: 70 },
    },
    {
      term: "subagents",
      type: "tool",
      score: 55,
      signals: [
        { type: "action", weight: 30, description: 'mentioned with "using"' },
        { type: "frequency", weight: 15, description: "mentioned 3 times recently" },
      ],
      category: { icon: "⭐", label: "Useful", min: 40 },
    },
    {
      term: "session",
      type: "keyword",
      score: 140,
      signals: [
        { type: "referenced", weight: 50, description: "you just referenced this" },
        { type: "action", weight: 30, description: 'mentioned with "fix"' },
        { type: "task", weight: 25, description: "needed for current task" },
        { type: "generic-contextual", weight: 0, description: "generic term with strong context" },
      ],
      category: { icon: "🔥", label: "Immediate", min: 70 },
    },
    {
      term: "model",
      type: "keyword",
      score: 15,
      signals: [
        { type: "noise", weight: -10, description: "mentioned once without context" },
        { type: "generic", weight: 0, description: "generic term (filtered without context)" },
      ],
      category: { icon: "", label: "Hidden", min: 0 },
    },
  ];

  console.log("\nExample with coding task context:\n");
  console.log(formatClarityContext(exampleEntities, { hideBackground: true }));

  console.log("\n" + "=".repeat(60));
  console.log("Key Behaviors Demonstrated");
  console.log("=".repeat(60));
  console.log("✅ claracore: HIGH relevance (action verb + referenced + task)");
  console.log("✅ subagents: USEFUL relevance (mentioned with action)");
  console.log("✅ session: HIGH relevance despite being generic (strong context)");
  console.log("✅ model: FILTERED (generic + no context = noise)");
}
