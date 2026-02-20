/**
 * ContextTracker — Tracks context item mentions and usage across exchanges.
 *
 * Efficiently tracks:
 * - Mentions: When context items appear in user messages
 * - References: When items are actually used in agent responses
 * - Anchored items: User-explicitly important items
 *
 * Design goals:
 * - O(1) updates per turn (no O(n^2) history scanning)
 * - Compact in-memory representation
 * - Periodic persistence to kv_store
 */

"use strict";

const RelevanceScorer = require("./relevance-scorer");

class ContextTracker {
  /**
   * @param {object} options
   * @param {object} options.kv - Key-value store for persistence
   * @param {string} options.namespace - Namespace for kv storage (default: 'clarity')
   * @param {object} options.scorerConfig - Configuration for RelevanceScorer
   * @param {object} options.extractorConfig - Configuration for entity extraction
   */
  constructor(options = {}) {
    this.kv = options.kv;
    this.namespace = options.namespace || "clarity";
    this.scorer = new RelevanceScorer(options.scorerConfig || {});

    // In-memory tracking
    this._items = new Map(); // id -> item data
    this._currentTurn = 0;
    this._lastPersistTurn = 0;
    this._persistInterval = options.persistInterval || 10; // Persist every N turns

    // Extraction config
    this._extractorConfig = {
      minWordLength: 5, // Was 4 - 5+ chars filters more noise
      maxKeywordsPerMessage: 8, // Was 10 - reduce noise
      extractProjects: options.extractProjects !== false,
      extractTools: options.extractTools !== false,
      extractMemoryFiles: options.extractMemoryFiles !== false,
      extractCustomPatterns: options.customPatterns || [],
      ...options.extractorConfig,
    };

    // Pattern matchers
    this._patterns = this._buildPatterns();
  }

  /**
   * Build regex patterns for entity extraction.
   * @private
   */
  _buildPatterns() {
    const patterns = [];

    // Project names (e.g., "ClaraCore", "OpenClaw", "focus-engine")
    if (this._extractorConfig.extractProjects) {
      // Match capitalized project names, hyphenated names, or quoted names
      patterns.push({
        name: "project",
        regex: /\b[A-Z][a-z]+(?:[A-Z][a-z]+)+\b|\b[a-z]+-[a-z]+(?:-[a-z]+)*\b/g,
        normalizer: (m) => m.toLowerCase().replace(/-/g, "_"),
      });
    }

    // Tool names (e.g., "read", "edit", "web_search", "memory_search")
    if (this._extractorConfig.extractTools) {
      patterns.push({
        name: "tool",
        regex:
          /\b(read|write|edit|exec|browser|web_search|web_fetch|memory_search|recall|reflect|tts|subagents|process|nodes|message|canvas)\b/g,
        normalizer: (m) => `tool:${m.toLowerCase()}`,
      });
    }

    // Memory file references (e.g., "SOUL.md", "USER.md", "memory/active-context.md")
    if (this._extractorConfig.extractMemoryFiles) {
      patterns.push({
        name: "memory_file",
        regex: /\b([A-Z_]+\.md|memory\/[\w-]+\.md|docs\/[\w-]+\.md)\b/g,
        normalizer: (m) => `file:${m.toLowerCase()}`,
      });
    }

    // Custom patterns
    for (const custom of this._extractorConfig.extractCustomPatterns) {
      patterns.push({
        name: custom.name || "custom",
        regex: new RegExp(custom.pattern, "gi"),
        normalizer: custom.normalizer || ((m) => m.toLowerCase()),
      });
    }

    return patterns;
  }

  /**
   * Strip system-injected content from text before extraction.
   * @private
   */
  _stripSystemContent(text) {
    if (!text) return "";

    // Remove system headers like "[GUIDE — User Message (Sonnet)]"
    let cleaned = text.replace(/\[GUIDE[^\]]*\][\s\S]*?(?=\[|$)/g, "");

    // Remove system metadata sections
    cleaned = cleaned.replace(/\[CLARITY CONTEXT\][\s\S]*?(?=\[|Tracked mentions:|$)/g, "");
    cleaned = cleaned.replace(/\[REFLECT\][\s\S]*?(?=\[|Conversation info:|$)/g, "");
    cleaned = cleaned.replace(/\[LENS\][\s\S]*?(?=\[|Conversation info:|$)/g, "");

    // Remove conversation info JSON block
    cleaned = cleaned.replace(
      /Conversation info \(untrusted metadata\):\s*```json[\s\S]*?```/g,
      "",
    );

    return cleaned;
  }

  /**
   * Check if an extracted item should be excluded from tracking.
   * @private
   */
  _shouldExcludeItem(itemId) {
    // Exclude model names and provider prefixes
    const excludedPatterns = [
      // Direct model names (without prefix)
      /^github_copilot$/,
      /^claude_/, // claude_sonnet, claude_opus, etc.
      /^gpt_/, // gpt_4, gpt_5_mini, etc.
      /^kimi_/, // kimi_coding, etc.
      /^sonnet$/,
      /^opus$/,
      /^haiku$/,
      /^gateway_client$/, // Internal routing

      // Keywords derived from model names or system content
      /^keyword:.*(claude|sonnet|opus|haiku|gpt|kimi|copilot|github)/,
      /^keyword:gateway_client$/,
      /^keyword:typetext/, // JSON artifacts like "type":"text"
      /^keyword:contenttype/, // JSON artifacts
      /^keyword:total$/, // Common in curl/command output
      /^keyword:command_error$/, // Reflect section patterns
      /^keyword:non_interactive$/, // System commands
    ];

    return excludedPatterns.some((pattern) => pattern.test(itemId));
  }

  /**
   * Extract context items from text.
   *
   * @param {string} text - Text to analyze
   * @returns {Array<string>} Extracted item IDs
   */
  extractItems(text) {
    if (!text || text.length < 10) return [];

    // Strip system-injected content before extraction
    const cleanedText = this._stripSystemContent(text);
    if (!cleanedText || cleanedText.length < 10) return [];

    const items = new Set();

    // Run pattern matchers
    for (const pattern of this._patterns) {
      pattern.regex.lastIndex = 0;
      let match;
      while ((match = pattern.regex.exec(cleanedText)) !== null) {
        const normalized = pattern.normalizer(match[0]);
        if (normalized.length >= this._extractorConfig.minWordLength) {
          // Skip excluded items (model names, etc.)
          if (!this._shouldExcludeItem(normalized)) {
            items.add(normalized);
          }
        }
      }
    }

    // Also extract important keywords (frequency-based)
    const words = this._extractKeywords(cleanedText);
    for (const word of words) {
      const keywordId = `keyword:${word}`;
      // Skip keywords derived from model names
      if (!this._shouldExcludeItem(keywordId)) {
        items.add(keywordId);
      }
    }

    return [...items];
  }

  /**
   * Extract important keywords from text using frequency analysis.
   * @private
   */
  _extractKeywords(text) {
    const words = text
      .toLowerCase()
      .split(/\s+/)
      .map((w) => w.replace(/[^a-z0-9_]/g, ""))
      .filter((w) => w.length >= this._extractorConfig.minWordLength && !this._isStopWord(w));

    // Count frequency
    const freq = new Map();
    for (const word of words) {
      freq.set(word, (freq.get(word) || 0) + 1);
    }

    // Return words that appear 3+ times or are particularly long (likely important)
    const keywords = [];
    for (const [word, count] of freq) {
      if (count >= 3 || word.length >= 12) {
        keywords.push(word);
      }
    }

    return keywords.slice(0, this._extractorConfig.maxKeywordsPerMessage);
  }

  /**
   * Check if word is a stop word.
   * Includes linguistic stop words + OpenClaw/AI system jargon.
   * @private
   */
  _isStopWord(word) {
    // Core linguistic stop words
    const linguisticStopWords = new Set([
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
      "being",
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
    ]);

    // OpenClaw/AI system jargon — high-frequency, low-meaning in context
    const systemStopWords = new Set([
      // Core system terms
      "session",
      "sessions",
      "model",
      "models",
      "mention",
      "mentions",
      "mentioned",
      "context",
      "contexts",
      "plugin",
      "plugins",
      "agent",
      "agents",
      "tool",
      "tools",
      "message",
      "messages",
      "text",
      "content",
      "function",
      "functions",
      "response",
      "responses",
      "request",
      "requests",
      "exchange",
      "exchanges",
      "turn",
      "turns",
      "conversation",
      "conversations",
      "user",
      "users",
      "assistant",
      "claw",
      "openclaw",
      "gateway",
      "handler",
      "handlers",
      "hook",
      "hooks",
      "event",
      "events",
      "trigger",
      "triggers",

      // LLM/AI terms that appear in every conversation
      "token",
      "tokens",
      "prompt",
      "prompts",
      "completion",
      "completions",
      "inference",
      "generate",
      "generates",
      "generated",
      "output",
      "outputs",
      "input",
      "inputs",
      "parameter",
      "parameters",
      "setting",
      "settings",
      "configuration",
      "config",
      "configs",
      "option",
      "options",
      "default",
      "defaults",
      "enabled",
      "disabled",
      "enable",
      "disable",

      // Metadata/tracking terms
      "keyword",
      "keywords",
      "key",
      "keys",
      "track",
      "tracks",
      "tracking",
      "extract",
      "extracts",
      "extraction",
      "score",
      "scores",
      "scoring",
      "count",
      "counts",
      "counting",
      "frequency",
      "recency",
      "relevance",
      "mentioncount",
      "priority",
      "priorities",
      "important",

      // Generic verbs in technical contexts
      "using",
      "create",
      "created",
      "creates",
      "update",
      "updates",
      "updated",
      "delete",
      "deleted",
      "deletes",
      "remove",
      "removed",
      "removes",
      "add",
      "added",
      "adds",
      "get",
      "got",
      "gets",
      "set",
      "sets",
      "put",
      "puts",
      "make",
      "makes",
      "run",
      "ran",
      "runs",
      "execute",
      "executed",
      "executes",
      "call",
      "called",
      "calls",
    ]);

    // Programming/technical noise
    const technicalStopWords = new Set([
      "true",
      "false",
      "null",
      "undefined",
      "string",
      "strings",
      "number",
      "numbers",
      "array",
      "arrays",
      "object",
      "objects",
      "boolean",
      "booleans",
      "value",
      "values",
      "return",
      "returns",
      "returned",
      "returning",
      "error",
      "errors",
      "fail",
      "failed",
      "fails",
      "success",
      "successful",
      "successfully",
      "valid",
      "invalid",
      "length",
      "index",
      "indexe",
      "indices",
      "name",
      "names",
      "named",
      "type",
      "types",
      "typed",
      "data",
      "datum",
      "info",
      "information",
      "result",
      "results",
      "output",
      "outputs",
      "input",
      "inputs",
    ]);

    return (
      linguisticStopWords.has(word) || systemStopWords.has(word) || technicalStopWords.has(word)
    );
  }

  /**
   * Record mentions from a user message.
   *
   * @param {string} text - User message text
   * @returns {Array<string>} IDs of items that were mentioned
   */
  trackMentions(text) {
    const items = this.extractItems(text);

    for (const itemId of items) {
      this._touchItem(itemId);
      const item = this._items.get(itemId);
      item.mentionCount++;
      item.lastMentionTurn = this._currentTurn;
      item.mentionHistory = item.mentionHistory || [];
      item.mentionHistory.push(this._currentTurn);
      // Trim history to last 20 mentions
      if (item.mentionHistory.length > 20) {
        item.mentionHistory = item.mentionHistory.slice(-20);
      }
    }

    return items;
  }

  /**
   * Record that an item was actually referenced in an agent response.
   *
   * @param {string} itemId - The item that was referenced
   * @param {string} context - Optional context snippet
   */
  trackReference(itemId, context = null) {
    this._touchItem(itemId);
    const item = this._items.get(itemId);
    item.referenceCount++;
    item.lastReferenceTurn = this._currentTurn;
    item.lastReferenceContext = context;
  }

  /**
   * Mark an item as anchored (user-explicitly important).
   *
   * @param {string} itemId - Item to anchor
   * @param {string} reason - Why it's anchored
   */
  anchorItem(itemId, reason = "user-anchored") {
    this._touchItem(itemId);
    const item = this._items.get(itemId);
    item.anchored = true;
    item.anchorReason = reason;
    item.anchorSetAt = Date.now();
  }

  /**
   * Remove anchor from an item.
   *
   * @param {string} itemId - Item to unanchor
   */
  unanchorItem(itemId) {
    const item = this._items.get(itemId);
    if (item) {
      item.anchored = false;
      delete item.anchorReason;
      delete item.anchorSetAt;
    }
  }

  /**
   * Advance to the next turn.
   * This should be called once per exchange.
   */
  advanceTurn() {
    this._currentTurn++;

    // Periodic persistence
    if (this._currentTurn - this._lastPersistTurn >= this._persistInterval) {
      this.persist();
      this._lastPersistTurn = this._currentTurn;
    }
  }

  /**
   * Get all tracked items with their current scores.
   *
   * @returns {Array<object>} Items sorted by relevance score
   */
  getScoredItems() {
    const items = [...this._items.entries()].map(([id, data]) => ({ id, ...data }));
    return this.scorer.scoreItems(items, this._currentTurn);
  }

  /**
   * Get items that should be pruned (below threshold).
   *
   * @param {number} threshold - Minimum score to keep (default: 5)
   * @returns {Array<string>} IDs of items to prune
   */
  getItemsToPrune(threshold = 5) {
    const toPrune = [];
    for (const [id, item] of this._items) {
      if (this.scorer.shouldPrune(item, this._currentTurn, threshold)) {
        toPrune.push(id);
      }
    }
    return toPrune;
  }

  /**
   * Prune items below threshold.
   *
   * @param {number} threshold - Minimum score to keep
   * @returns {number} Number of items pruned
   */
  prune(threshold = 5) {
    const toPrune = this.getItemsToPrune(threshold);
    for (const id of toPrune) {
      this._items.delete(id);
    }
    return toPrune.length;
  }

  /**
   * Get a specific item's current state.
   *
   * @param {string} itemId - Item ID
   * @returns {object|null} Item data or null
   */
  getItem(itemId) {
    return this._items.get(itemId) || null;
  }

  /**
   * Get statistics about tracked items.
   *
   * @returns {object} Statistics
   */
  getStats() {
    const items = [...this._items.values()];
    const scored = this.getScoredItems();

    return {
      totalItems: items.length,
      anchoredItems: items.filter((i) => i.anchored).length,
      currentTurn: this._currentTurn,
      averageMentions:
        items.length > 0 ? items.reduce((s, i) => s + i.mentionCount, 0) / items.length : 0,
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
   * Persist current state to kv_store.
   */
  persist() {
    if (!this.kv) return;

    const state = {
      currentTurn: this._currentTurn,
      lastPersistAt: Date.now(),
      items: [...this._items.entries()].map(([id, item]) => ({
        id,
        ...item,
      })),
    };

    this.kv.set(this.namespace, "relevance_state", state);
  }

  /**
   * Load state from kv_store.
   */
  load() {
    if (!this.kv) return false;

    try {
      const state = this.kv.get(this.namespace, "relevance_state", null);
      if (!state) return false;

      this._currentTurn = state.currentTurn || 0;
      this._items.clear();

      if (state.items && Array.isArray(state.items)) {
        for (const itemData of state.items) {
          const { id, ...rest } = itemData;
          this._items.set(id, rest);
        }
      }

      return true;
    } catch (err) {
      console.error("[Clarity] Failed to load state:", err.message);
      return false;
    }
  }

  /**
   * Create or update an item entry.
   * @private
   */
  _touchItem(itemId) {
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

  /**
   * Reset all tracking state.
   */
  reset() {
    this._items.clear();
    this._currentTurn = 0;
    this._lastPersistTurn = 0;
  }
}

module.exports = ContextTracker;
