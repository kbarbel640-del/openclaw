/** @typedef {import('./entity').EntityType} EntityType */

const { EntityType } = require("./entity");
const { CLARITY_STOP_WORDS, SYSTEM_HYPHENATED } = require("./stop-words");

/**
 * Result of entity extraction from text.
 * @typedef {Object} ExtractionResult
 * @property {Array<{type: EntityType, name: string, normalized: string, confidence: number}>} entities - Extracted entities
 * @property {string[]} composites - Multi-word composite terms detected
 */

/**
 * Pattern definition for entity extraction.
 * @typedef {Object} PatternDef
 * @property {RegExp} regex - Regular expression to match
 * @property {EntityType} type - Entity type for matches
 * @property {Function} [filter] - Optional filter function (match) => boolean
 * @property {number} [confidence=1.0] - Confidence score for matches
 */

/**
 * Collection of extraction patterns for different entity types.
 * Each pattern includes regex, entity type, and optional filtering.
 */
class ExtractionPatterns {
  constructor() {
    /** @type {Set<string>} */
    this.knownPlugins = new Set([
      "clarity",
      "awareness",
      "continuity",
      "recover",
      "reflect",
      "guide",
      "sight",
    ]);

    /** @type {Set<string>} */
    this.knownTools = new Set([
      "sessions_spawn",
      "subagents",
      "memory_search",
      "memory_get",
      "recall",
      "reflect",
      "read",
      "write",
      "edit",
      "exec",
      "web_search",
      "web_fetch",
      "browser",
      "canvas",
      "message",
      "sessions_list",
      "sessions_history",
      "process",
      "nodes",
    ]);

    /** @type {Set<string>} */
    this.knownProjects = new Set(["claracore", "openclaw", "focusengine", "modelrouter"]);
  }

  /**
   * Gets all project detection patterns.
   * @returns {PatternDef[]}
   */
  getProjectPatterns() {
    return [
      // CamelCase: ClaraCore, OpenClaw, FocusEngine
      {
        regex: /\b[A-Z][a-z]+(?:[A-Z][a-z]+)+\b/g,
        type: EntityType.PROJECT,
        confidence: 0.95,
      },

      // Hyphenated: focus-engine, model-router
      {
        regex: /\b[a-z]+(?:-[a-z]+)+\b/g,
        type: EntityType.PROJECT,
        filter: (match) => !SYSTEM_HYPHENATED.has(match.toLowerCase()),
        confidence: 0.7,
      },

      // Lowercase with tech suffixes: claracore, openclaw, dashclaw
      {
        regex: /\b[a-z]{3,}(?:core|claw|stack|engine|router|board)\b/gi,
        type: EntityType.PROJECT,
        filter: (match) => {
          const lower = match.toLowerCase();
          // Don't extract standalone suffixes like just "core"
          const isJustSuffix = ["core", "claw", "stack", "engine", "router", "board"].includes(
            lower,
          );
          return !isJustSuffix && !CLARITY_STOP_WORDS.has(lower);
        },
        confidence: 0.85,
      },

      // GitHub-style: my-project, openclaw-v2
      {
        regex: /\b[a-z0-9]+(?:-[a-z0-9]+)*\b/g,
        type: EntityType.PROJECT,
        filter: (match) => {
          const lower = match.toLowerCase();
          // Common words that shouldn't be projects
          const commonWords = new Set([
            "today",
            "system",
            "here",
            "this",
            "that",
            "with",
            "from",
            "have",
            "been",
            "were",
            "they",
            "them",
            "their",
            "when",
            "where",
            "what",
            "will",
            "would",
            "there",
            "these",
            "those",
            "while",
            "about",
            "after",
            "before",
            "during",
            "through",
            "under",
            "over",
            "into",
            "onto",
            "upon",
            "within",
            "without",
            "against",
            "among",
            "between",
            "during",
            "inside",
            "outside",
            "until",
            "since",
            "despite",
            "toward",
            "towards",
            "core",
          ]);
          return (
            match.length >= 4 &&
            !CLARITY_STOP_WORDS.has(lower) &&
            !SYSTEM_HYPHENATED.has(lower) &&
            !commonWords.has(lower)
          );
        },
        confidence: 0.6,
      },
    ];
  }

  /**
   * Gets plugin detection patterns.
   * Dynamically updated from known plugins list.
   * @returns {PatternDef[]}
   */
  getPluginPatterns() {
    const pluginNames = Array.from(this.knownPlugins).join("|");

    return [
      {
        regex: new RegExp(`\\b(${pluginNames})\\b`, "gi"),
        type: EntityType.PLUGIN,
        confidence: 0.95,
      },
      // Generic plugin suffix pattern
      {
        regex: /\b[a-z]+_plugin\b/gi,
        type: EntityType.PLUGIN,
        confidence: 0.8,
      },
    ];
  }

  /**
   * Gets file detection patterns.
   * @returns {PatternDef[]}
   */
  getFilePatterns() {
    return [
      // Memory files: memory/2026-02-19.md, memory/projects/foo.md
      {
        regex: /\bmemory\/[\w\-\/]+\.md\b/gi,
        type: EntityType.FILE,
        confidence: 0.95,
      },

      // Docs: docs/architecture.md
      {
        regex: /\bdocs\/[\w\-\/]+\.md\b/gi,
        type: EntityType.FILE,
        confidence: 0.9,
      },

      // Root workspace files: SOUL.md, AGENTS.md, USER.md
      {
        regex: /\b[A-Z][A-Z_]*\.md\b/g,
        type: EntityType.FILE,
        confidence: 0.95,
      },

      // Generic .md references with path context
      {
        regex: /\b[\w\/\-]+\.md\b/gi,
        type: EntityType.FILE,
        filter: (match) => match.length >= 5 && !match.includes("http"),
        confidence: 0.7,
      },

      // Config files: openclaw.json, package.json
      {
        regex: /\b[\w\-]+\.json\b/gi,
        type: EntityType.FILE,
        filter: (match) => !match.startsWith("package.") || match === "package.json",
        confidence: 0.75,
      },

      // JavaScript/TypeScript files
      {
        regex: /\b[\w\-\/]+\.(js|ts|mjs|cjs)\b/gi,
        type: EntityType.FILE,
        filter: (match) => !match.includes("node_modules"),
        confidence: 0.7,
      },
    ];
  }

  /**
   * Gets tool detection patterns.
   * @returns {PatternDef[]}
   */
  getToolPatterns() {
    const toolNames = Array.from(this.knownTools).join("|");

    return [
      // Explicit tool names
      {
        regex: new RegExp(`\\b(${toolNames})\\b`, "g"),
        type: EntityType.TOOL,
        confidence: 0.95,
      },
      // Generic tool patterns (tool_ prefix or _tool suffix)
      {
        regex: /\b(?:tool_[a-z_]+|[a-z_]+_tool)\b/g,
        type: EntityType.TOOL,
        filter: (match) => !CLARITY_STOP_WORDS.has(match.toLowerCase()),
        confidence: 0.6,
      },
    ];
  }

  /**
   * Gets all extraction patterns combined.
   * @returns {PatternDef[]}
   */
  getAllPatterns() {
    return [
      ...this.getProjectPatterns(),
      ...this.getPluginPatterns(),
      ...this.getFilePatterns(),
      ...this.getToolPatterns(),
    ];
  }

  /**
   * Adds a plugin name to the known plugins set.
   * @param {string} name - Plugin name (will be lowercased)
   */
  addPlugin(name) {
    this.knownPlugins.add(name.toLowerCase());
  }

  /**
   * Adds a tool name to the known tools set.
   * @param {string} name - Tool name
   */
  addTool(name) {
    this.knownTools.add(name.toLowerCase());
  }

  /**
   * Adds a project name to the known projects set.
   * @param {string} name - Project name (will be lowercased)
   */
  addProject(name) {
    this.knownProjects.add(name.toLowerCase());
  }

  /**
   * Normalizes an extracted entity name.
   * - Lowercases
   * - Replaces spaces/special chars with underscores
   * - Removes file extensions for files
   * @param {string} name - Raw entity name
   * @param {EntityType} type - Entity type
   * @returns {string} Normalized name
   */
  normalizeName(name, type) {
    let normalized = name.toLowerCase().trim();

    // Remove file extensions for files
    if (type === EntityType.FILE) {
      normalized = normalized.replace(/\.(md|json|js|ts|mjs|cjs)$/i, "");
    }

    // Replace spaces, hyphens, and slashes with underscores
    normalized = normalized.replace(/[\s\-\/]+/g, "_");

    // Remove any remaining non-alphanumeric chars except underscore
    normalized = normalized.replace(/[^a-z0-9_]/g, "");

    return normalized;
  }

  /**
   * Extracts entities from text using all patterns.
   * @param {string} text - Input text to analyze
   * @returns {ExtractionResult}
   */
  extract(text) {
    const entities = [];
    const seen = new Set();

    for (const pattern of this.getAllPatterns()) {
      const matches = text.matchAll(pattern.regex);

      for (const match of matches) {
        const name = match[0];

        // Apply filter if present
        if (pattern.filter && !pattern.filter(name)) {
          continue;
        }

        const normalized = this.normalizeName(name, pattern.type);
        const key = `${pattern.type}:${normalized}`;

        // Skip duplicates
        if (seen.has(key)) continue;
        seen.add(key);

        // Skip stop words
        if (CLARITY_STOP_WORDS.has(normalized)) continue;

        entities.push({
          type: pattern.type,
          name,
          normalized,
          confidence: pattern.confidence || 0.5,
        });
      }
    }

    // Extract composite terms
    const composites = this.extractCompositeTerms(text, entities);

    return { entities, composites };
  }

  /**
   * Extracts multi-word composite terms (n-grams).
   * Looks for combinations of known entities and valid tokens.
   * @param {string} text - Input text
   * @param {Array} entities - Already extracted entities
   * @returns {string[]} Composite terms found
   */
  extractCompositeTerms(text, entities) {
    const knownTokens = new Set(entities.map((e) => e.normalized));

    // Tokenize text
    const tokens = text
      .toLowerCase()
      .split(/\s+/)
      .map((t) => t.replace(/[^a-z0-9_]/g, ""))
      .filter((t) => t.length >= 3 && !CLARITY_STOP_WORDS.has(t));

    const composites = [];
    const seen = new Set();

    // Check bigrams and trigrams
    for (let i = 0; i < tokens.length - 1; i++) {
      // Bigram
      const bigram = `${tokens[i]} ${tokens[i + 1]}`;
      if (!seen.has(bigram) && this.isValidComposite(bigram, knownTokens)) {
        composites.push(bigram);
        seen.add(bigram);
      }

      // Trigram
      if (i < tokens.length - 2) {
        const trigram = `${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`;
        if (!seen.has(trigram) && this.isValidComposite(trigram, knownTokens)) {
          composites.push(trigram);
          seen.add(trigram);
        }
      }
    }

    return composites;
  }

  /**
   * Validates if a composite term is meaningful.
   * A composite is valid if:
   * - Multiple parts are known entities
   * - It matches a known project pattern
   * - Contains a tech suffix (core, engine, etc.)
   * @param {string} term - Composite term to validate
   * @param {Set<string>} knownTokens - Set of known entity tokens
   * @returns {boolean}
   */
  isValidComposite(term, knownTokens) {
    const parts = term.split(" ");

    // Check if multiple parts are known
    const knownParts = parts.filter((p) => knownTokens.has(p));
    if (knownParts.length >= 2) {
      return true;
    }

    // Check for tech suffix in composite
    const techSuffixes = ["core", "claw", "engine", "router", "stack", "board"];
    const hasTechSuffix = techSuffixes.some((suffix) => term.includes(suffix));
    if (hasTechSuffix && parts.length >= 2) {
      return true;
    }

    // Check against known projects
    const normalized = term.replace(/ /g, "");
    if (this.knownProjects.has(normalized)) {
      return true;
    }

    return false;
  }
}

module.exports = { ExtractionPatterns };
