import type { OpenClawConfig } from "../config/config.js";
import { shouldLogVerbose } from "../globals.js";
import { logDebug } from "../logger.js";

/**
 * Classification result for a single agent.
 */
export type IntentMatch = {
  /** Agent ID that matched the intent. */
  agentId: string;
  /** Confidence score (0.0 - 1.0) indicating match strength. */
  confidence: number;
  /** Reason for the match (keyword, category, or default). */
  matchReason: "keyword" | "category" | "default";
  /** Specific keyword or category that matched (if applicable). */
  matchedValue?: string;
};

/**
 * Result of intent classification.
 */
export type IntentClassificationResult = {
  /** Matched agents sorted by confidence (highest first). */
  matches: IntentMatch[];
  /** Input message that was classified. */
  message: string;
};

/**
 * Options for intent classification.
 */
export type ClassifyIntentOptions = {
  /** Configuration containing agent definitions. */
  cfg: OpenClawConfig;
  /** Message to classify. */
  message: string;
  /** Optional channel context for filtering. */
  channel?: string;
};

/**
 * Normalizes a token for comparison (lowercase, trimmed).
 */
function normalizeToken(value: string | undefined | null): string {
  return (value ?? "").trim().toLowerCase();
}

/**
 * Extracts all agents from configuration that have intent classification enabled.
 */
function getIntentEnabledAgents(cfg: OpenClawConfig) {
  const agents = cfg.agents?.list;
  if (!Array.isArray(agents)) {
    return [];
  }

  return agents.filter((agent) => {
    const orchestration = agent?.orchestration;
    const intents = orchestration?.intents;
    return intents?.enabled === true;
  });
}

/**
 * Checks if a message matches any of the provided keywords.
 * Uses case-insensitive partial matching.
 */
function matchKeywords(message: string, keywords: string[]): string | null {
  const normalized = normalizeToken(message);
  for (const keyword of keywords) {
    const normalizedKeyword = normalizeToken(keyword);
    if (normalizedKeyword && normalized.includes(normalizedKeyword)) {
      return keyword;
    }
  }
  return null;
}

/**
 * Checks if a message matches any of the provided categories.
 * Uses case-insensitive partial matching for category names.
 */
function matchCategory(message: string, categories: string[]): string | null {
  const normalized = normalizeToken(message);
  for (const category of categories) {
    const normalizedCategory = normalizeToken(category);
    if (normalizedCategory && normalized.includes(normalizedCategory)) {
      return category;
    }
  }
  return null;
}

/**
 * Calculates confidence score based on match type and specificity.
 * - Keyword matches: 0.9 (highly specific)
 * - Category matches: 0.7 (moderately specific)
 * - Default fallback: 0.3 (low confidence)
 */
function calculateConfidence(
  matchReason: IntentMatch["matchReason"],
  matchedValue?: string,
): number {
  switch (matchReason) {
    case "keyword":
      // Keywords are most specific - high confidence
      return 0.9;
    case "category":
      // Categories are less specific - medium confidence
      return 0.7;
    case "default":
      // Fallback default - low confidence
      return 0.3;
    default:
      return 0.0;
  }
}

/**
 * Classifies a message against configured agent intents.
 *
 * Matches are ranked by:
 * 1. Keyword matches (highest confidence)
 * 2. Category matches (medium confidence)
 * 3. Default agent (lowest confidence, if configured)
 *
 * @returns Classification result with matched agents sorted by confidence.
 */
export function classifyIntent(options: ClassifyIntentOptions): IntentClassificationResult {
  const { cfg, message } = options;
  const matches: IntentMatch[] = [];

  const shouldLog = shouldLogVerbose();
  if (shouldLog) {
    logDebug(`[intent-classifier] classifying message: "${message}"`);
  }

  const agents = getIntentEnabledAgents(cfg);
  if (shouldLog) {
    logDebug(`[intent-classifier] found ${agents.length} intent-enabled agents`);
  }

  // First pass: match keywords and categories
  for (const agent of agents) {
    const agentId = agent.id;
    const intents = agent.orchestration?.intents;

    if (!intents) {
      continue;
    }

    // Check keyword matches
    const keywords = intents.keywords ?? [];
    const matchedKeyword = matchKeywords(message, keywords);
    if (matchedKeyword) {
      const confidence = calculateConfidence("keyword", matchedKeyword);
      matches.push({
        agentId,
        confidence,
        matchReason: "keyword",
        matchedValue: matchedKeyword,
      });
      if (shouldLog) {
        logDebug(
          `[intent-classifier] keyword match: agentId=${agentId} keyword="${matchedKeyword}" confidence=${confidence}`,
        );
      }
      continue; // Don't check categories if keyword matched
    }

    // Check category matches
    const categories = intents.categories ?? [];
    const matchedCategory = matchCategory(message, categories);
    if (matchedCategory) {
      const confidence = calculateConfidence("category", matchedCategory);
      matches.push({
        agentId,
        confidence,
        matchReason: "category",
        matchedValue: matchedCategory,
      });
      if (shouldLog) {
        logDebug(
          `[intent-classifier] category match: agentId=${agentId} category="${matchedCategory}" confidence=${confidence}`,
        );
      }
    }
  }

  // Sort by confidence (highest first), then by agent ID for deterministic ordering
  matches.sort((a, b) => {
    const confDiff = b.confidence - a.confidence;
    if (confDiff !== 0) {
      return confDiff;
    }
    return a.agentId.localeCompare(b.agentId);
  });

  // If no matches found, check for default supervisor agent
  if (matches.length === 0) {
    const defaultAgent = findDefaultSupervisorAgent(cfg);
    if (defaultAgent) {
      const confidence = calculateConfidence("default");
      matches.push({
        agentId: defaultAgent,
        confidence,
        matchReason: "default",
      });
      if (shouldLog) {
        logDebug(
          `[intent-classifier] using default supervisor: agentId=${defaultAgent} confidence=${confidence}`,
        );
      }
    }
  }

  if (shouldLog) {
    logDebug(`[intent-classifier] classification complete: ${matches.length} matches`);
  }

  return {
    matches,
    message,
  };
}

/**
 * Finds the default supervisor agent from configuration.
 * Returns the agent ID if found, or null otherwise.
 */
function findDefaultSupervisorAgent(cfg: OpenClawConfig): string | null {
  const agents = cfg.agents?.list;
  if (!Array.isArray(agents)) {
    return null;
  }

  // Look for agent with supervisor config that has a defaultAgent specified
  for (const agent of agents) {
    const supervisor = agent.orchestration?.supervisor;
    if (supervisor && typeof supervisor === "object" && supervisor.defaultAgent) {
      return supervisor.defaultAgent;
    }
  }

  // Look for any agent marked as supervisor
  for (const agent of agents) {
    const supervisor = agent.orchestration?.supervisor;
    if (supervisor === true || (supervisor && typeof supervisor === "object")) {
      return agent.id;
    }
  }

  return null;
}

/**
 * Gets the highest confidence match from classification results.
 * Returns null if no matches found.
 */
export function getBestMatch(result: IntentClassificationResult): IntentMatch | null {
  return result.matches.length > 0 ? result.matches[0] : null;
}

/**
 * Gets all matches above a confidence threshold.
 */
export function getMatchesAboveThreshold(
  result: IntentClassificationResult,
  threshold: number,
): IntentMatch[] {
  return result.matches.filter((match) => match.confidence >= threshold);
}
