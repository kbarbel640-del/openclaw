/**
 * Pattern-based capability inference for models not in the hardcoded registry.
 * Derives ModelCapabilities from model ID patterns, provider, and catalog metadata.
 */

import type { CostTier, ModelCapabilities, PerformanceTier } from "./model-capabilities.js";
import type { ModelCatalogEntry } from "./model-catalog.js";

// ── Dynamic Pattern Registry ──

/**
 * Dynamic registry for custom model patterns.
 * Takes precedence over hardcoded patterns.
 */
const DYNAMIC_PATTERNS = new Map<string, Partial<ModelCapabilities>>();

/**
 * Register a custom model pattern with specific capabilities.
 * Dynamic patterns override hardcoded inference logic.
 *
 * @param pattern - Model ID pattern (case-insensitive substring match)
 * @param capabilities - Partial capabilities to apply when pattern matches
 *
 * @example
 * registerModelPattern("gemini-4-turbo", { coding: true, performanceTier: "balanced" });
 * registerModelPattern("custom-llm-pro", { performanceTier: "powerful", costTier: "expensive" });
 */
export function registerModelPattern(
  pattern: string,
  capabilities: Partial<ModelCapabilities>,
): void {
  DYNAMIC_PATTERNS.set(pattern.toLowerCase(), capabilities);
}

/**
 * Clear all dynamic patterns (useful for testing).
 */
export function clearDynamicPatterns(): void {
  DYNAMIC_PATTERNS.clear();
}

/**
 * Get all registered dynamic patterns (for debugging/inspection).
 */
export function getDynamicPatterns(): ReadonlyMap<string, Partial<ModelCapabilities>> {
  return DYNAMIC_PATTERNS;
}

// ── Pattern lists (derived from MODEL_CAPABILITIES_REGISTRY) ──

const POWERFUL_PATTERNS = [
  "opus",
  "pro-2",
  "ultra",
  "gpt-5.2",
  "gpt-5.1",
  "gpt-5.0",
  "405b",
  "grok-4",
  "gemini-3-pro",
  "deepseek-r1",
];

const BALANCED_PATTERNS = [
  "sonnet",
  "gpt-4o",
  "gpt-4.1",
  "70b",
  "72b",
  "32b",
  "qwen2.5-coder",
  "gemini-3-flash",
  "glm-4",
  "mistral-large",
  "mistral-medium",
];

const FAST_PATTERNS = [
  "haiku",
  "mini",
  "nano",
  "flash",
  "small",
  "lite",
  "tiny",
  "8b",
  "7b",
  "3b",
  "1b",
  "0.5b",
  "gpt-4o-mini",
  "gpt-4.1-mini",
  "gpt-4.1-nano",
];

const CODING_PATTERNS = [
  "coder",
  "codex",
  "codestral",
  "deepseek-coder",
  "starcoder",
  "code-",
  "-code",
  "qwen2.5-coder",
];

const CREATIVE_PATTERNS = ["opus", "pro-2", "ultra"];

// Providers where all models are free/cheap
const FREE_PROVIDERS = new Set(["ollama", "lmstudio"]);
const CHEAP_PROVIDERS = new Set(["groq", "cerebras", "sambanova"]);
const EXPENSIVE_PROVIDERS = new Set<string>();

// ── Helpers ──

function matchesAnyPattern(id: string, patterns: string[]): boolean {
  const lower = id.toLowerCase();
  return patterns.some((p) => lower.includes(p));
}

function inferPerformanceTier(id: string): PerformanceTier {
  // Check fast first — size suffixes (mini, nano, small) override family patterns
  if (matchesAnyPattern(id, FAST_PATTERNS)) {
    return "fast";
  }
  if (matchesAnyPattern(id, POWERFUL_PATTERNS)) {
    return "powerful";
  }
  if (matchesAnyPattern(id, BALANCED_PATTERNS)) {
    return "balanced";
  }
  return "balanced";
}

function inferCostTier(id: string, provider?: string): CostTier {
  const p = provider?.toLowerCase() ?? "";
  if (FREE_PROVIDERS.has(p)) {
    return "free";
  }
  if (CHEAP_PROVIDERS.has(p)) {
    return "cheap";
  }
  if (EXPENSIVE_PROVIDERS.has(p)) {
    return "expensive";
  }

  // Infer from model size/tier
  if (matchesAnyPattern(id, POWERFUL_PATTERNS)) {
    return "expensive";
  }
  if (matchesAnyPattern(id, FAST_PATTERNS)) {
    return "cheap";
  }
  return "moderate";
}

function inferCoding(id: string, performanceTier: PerformanceTier): boolean {
  // Explicit coding models
  if (matchesAnyPattern(id, CODING_PATTERNS)) {
    return true;
  }
  // Powerful and balanced models are generally good at coding
  if (performanceTier === "powerful") {
    return true;
  }
  // Well-known balanced coding-capable families
  if (matchesAnyPattern(id, ["sonnet", "gpt-4", "gpt-5", "gemini-3", "deepseek"])) {
    return true;
  }
  return false;
}

/**
 * Check if model matches any dynamic pattern and return merged capabilities.
 * Returns null if no match found.
 */
function checkDynamicPatterns(modelId: string): Partial<ModelCapabilities> | null {
  const lower = modelId.toLowerCase();

  // Check all registered patterns
  for (const [pattern, caps] of DYNAMIC_PATTERNS.entries()) {
    if (lower.includes(pattern)) {
      return caps;
    }
  }

  return null;
}

// ── Public API ──

/**
 * Infer capabilities from model ID patterns and optional catalog metadata.
 * Used as fallback when a model is not in the hardcoded registry.
 *
 * Dynamic patterns (registered via registerModelPattern) take precedence
 * over hardcoded inference logic.
 */
export function inferModelCapabilities(
  modelId: string,
  catalogEntry?: Pick<ModelCatalogEntry, "provider" | "reasoning" | "input">,
): ModelCapabilities {
  // Check dynamic patterns first (highest priority)
  const dynamicCaps = checkDynamicPatterns(modelId);

  // Infer baseline capabilities from hardcoded patterns
  const performanceTier = inferPerformanceTier(modelId);
  const costTier = inferCostTier(modelId, catalogEntry?.provider);
  const coding = inferCoding(modelId, performanceTier);
  const reasoning =
    catalogEntry?.reasoning ?? matchesAnyPattern(modelId, ["deepseek-r1", "o1", "o3", "o4"]);
  const vision =
    catalogEntry?.input?.includes("image") ??
    matchesAnyPattern(modelId, ["vision", "gpt-4o", "gpt-4.1", "gpt-5"]);
  const fast = performanceTier === "fast";
  const creative = matchesAnyPattern(modelId, CREATIVE_PATTERNS) || performanceTier === "powerful";

  const baseCapabilities: ModelCapabilities = {
    coding,
    reasoning,
    vision,
    general: true,
    fast,
    creative,
    performanceTier,
    costTier,
    primary: undefined,
  };

  // Merge dynamic patterns on top of base capabilities (dynamic overrides base)
  if (dynamicCaps) {
    return {
      ...baseCapabilities,
      ...dynamicCaps,
      // Ensure primary stays undefined unless explicitly set
      primary: dynamicCaps.primary ?? undefined,
    };
  }

  return baseCapabilities;
}
