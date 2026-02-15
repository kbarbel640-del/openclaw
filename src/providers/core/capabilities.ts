/**
 * Provider and model capabilities tracking.
 * Centralizes capability definitions and validation.
 */

import type {
  ModelCapabilities,
  ModelCatalogEntry,
  ProviderCapability,
  ProviderId,
} from "./types.js";

/**
 * Provider capability matrix.
 * Defines capabilities for each known provider.
 */
export const PROVIDER_CAPABILITIES: Record<ProviderId, ProviderCapability[]> = {
  anthropic: [
    "text",
    "vision",
    "tools",
    "reasoning",
    "streaming",
    "caching",
    "system-prompt",
    "extended-thinking",
  ],
  openai: ["text", "vision", "tools", "streaming", "system-prompt"],
  "openai-codex": ["text", "tools", "streaming", "system-prompt"],
  google: ["text", "vision", "tools", "streaming", "system-prompt"],
  "google-gemini-cli": ["text", "vision", "tools", "streaming", "system-prompt"],
  "google-antigravity": ["text", "vision", "tools", "reasoning", "streaming", "system-prompt"],
  "amazon-bedrock": ["text", "tools", "streaming", "system-prompt"],
  mistral: ["text", "tools", "streaming", "system-prompt"],
  groq: ["text", "tools", "streaming", "system-prompt"],
  cerebras: ["text", "tools", "streaming", "system-prompt"],
  openrouter: ["text", "vision", "tools", "streaming", "system-prompt"],
  "github-copilot": ["text", "tools", "streaming", "system-prompt"],
  ollama: ["text", "tools", "streaming", "system-prompt"],
  minimax: ["text", "vision", "tools", "streaming", "system-prompt"],
  xiaomi: ["text", "tools", "streaming", "system-prompt"],
  moonshot: ["text", "tools", "streaming", "system-prompt"],
  "qwen-portal": ["text", "tools", "streaming", "system-prompt"],
  zai: ["text", "tools", "streaming", "system-prompt"],
  venice: ["text", "tools", "streaming", "system-prompt"],
  xai: ["text", "tools", "streaming", "system-prompt"],
};

/**
 * Check if a provider supports a specific capability.
 *
 * @param providerId - Provider ID
 * @param capability - Capability to check
 * @returns True if provider supports the capability
 */
export function providerSupports(providerId: ProviderId, capability: ProviderCapability): boolean {
  const capabilities = PROVIDER_CAPABILITIES[providerId];
  return capabilities?.includes(capability) ?? false;
}

/**
 * Get all capabilities for a provider.
 *
 * @param providerId - Provider ID
 * @returns Array of supported capabilities
 */
export function getProviderCapabilities(providerId: ProviderId): ProviderCapability[] {
  return PROVIDER_CAPABILITIES[providerId] ?? [];
}

/**
 * Infer model capabilities from catalog entry.
 * Combines provider capabilities with model-specific info.
 *
 * @param entry - Model catalog entry
 * @returns Full model capabilities
 */
export function inferModelCapabilities(entry: ModelCatalogEntry): ModelCapabilities {
  const provider = entry.provider;

  return {
    contextWindow: entry.contextWindow ?? 128000,
    maxTokens: undefined,
    vision: entry.input?.includes("image") ?? providerSupports(provider, "vision"),
    tools: providerSupports(provider, "tools"),
    reasoning: entry.reasoning ?? providerSupports(provider, "reasoning"),
    streaming: providerSupports(provider, "streaming"),
    caching: providerSupports(provider, "caching"),
    input: entry.input ?? ["text"],
    output: ["text"],
  };
}

/**
 * Validate that a model supports required capabilities.
 *
 * @param capabilities - Model capabilities
 * @param required - Required capabilities
 * @returns True if all required capabilities are supported
 */
export function validateCapabilities(
  capabilities: Partial<ModelCapabilities>,
  required: Partial<Record<keyof ModelCapabilities, boolean | string[]>>,
): { valid: boolean; missing: string[] } {
  const missing: string[] = [];

  // Check boolean capabilities
  const booleanCaps: Array<keyof ModelCapabilities> = [
    "vision",
    "tools",
    "reasoning",
    "streaming",
    "caching",
  ];

  for (const cap of booleanCaps) {
    if (required[cap] === true && !capabilities[cap]) {
      missing.push(cap);
    }
  }

  // Check input modalities
  if (Array.isArray(required.input)) {
    const supportedInput = capabilities.input ?? [];
    for (const modality of required.input) {
      if (!(supportedInput as string[]).includes(modality)) {
        missing.push(`input:${modality}`);
      }
    }
  }

  // Check output modalities
  if (Array.isArray(required.output)) {
    const supportedOutput = capabilities.output ?? [];
    for (const modality of required.output) {
      if (!(supportedOutput as string[]).includes(modality)) {
        missing.push(`output:${modality}`);
      }
    }
  }

  // Check context window
  if (typeof required.contextWindow === "number") {
    const available = capabilities.contextWindow ?? 0;
    const requiredWindow = required.contextWindow;
    if (available < requiredWindow) {
      missing.push(`contextWindow:${String(requiredWindow)}`);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Find models in catalog that support required capabilities.
 *
 * @param catalog - Model catalog
 * @param required - Required capabilities
 * @returns Models that meet requirements
 */
export function findCapableModels(
  catalog: ModelCatalogEntry[],
  required: Partial<Record<keyof ModelCapabilities, boolean | string[]>>,
): ModelCatalogEntry[] {
  return catalog.filter((entry) => {
    const caps = inferModelCapabilities(entry);
    const validation = validateCapabilities(caps, required);
    return validation.valid;
  });
}

/**
 * Score a model based on how well it matches required capabilities.
 * Higher score = better match.
 *
 * @param capabilities - Model capabilities
 * @param required - Required capabilities
 * @returns Match score (0-100)
 */
export function scoreCapabilityMatch(
  capabilities: Partial<ModelCapabilities>,
  required: Partial<Record<keyof ModelCapabilities, boolean | string[]>>,
): number {
  let score = 0;
  let maxScore = 0;

  // Boolean capabilities: 10 points each
  const booleanCaps: Array<keyof ModelCapabilities> = [
    "vision",
    "tools",
    "reasoning",
    "streaming",
    "caching",
  ];

  for (const cap of booleanCaps) {
    if (required[cap] === true) {
      maxScore += 10;
      if (capabilities[cap]) {
        score += 10;
      }
    }
  }

  // Input modalities: 5 points each
  if (Array.isArray(required.input)) {
    const supportedInput = capabilities.input ?? [];
    for (const modality of required.input) {
      maxScore += 5;
      if ((supportedInput as string[]).includes(modality)) {
        score += 5;
      }
    }
  }

  // Context window: 20 points if sufficient, proportional if not
  if (typeof required.contextWindow === "number") {
    maxScore += 20;
    const available = capabilities.contextWindow ?? 0;
    if (available >= required.contextWindow) {
      score += 20;
    } else if (available > 0) {
      score += Math.floor((available / required.contextWindow) * 20);
    }
  }

  // Normalize to 0-100 scale
  return maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
}

/**
 * Suggest alternative models when a model doesn't support required capabilities.
 *
 * @param catalog - Model catalog
 * @param original - Original model that doesn't meet requirements
 * @param required - Required capabilities
 * @returns Top 3 alternative models, sorted by score
 */
export function suggestAlternatives(
  catalog: ModelCatalogEntry[],
  original: ModelCatalogEntry,
  required: Partial<Record<keyof ModelCapabilities, boolean | string[]>>,
): Array<{ model: ModelCatalogEntry; score: number; missing: string[] }> {
  const alternatives = catalog
    .filter((entry) => entry.id !== original.id)
    .map((entry) => {
      const caps = inferModelCapabilities(entry);
      const validation = validateCapabilities(caps, required);
      const score = scoreCapabilityMatch(caps, required);
      return { model: entry, score, missing: validation.missing };
    })
    .filter((alt) => alt.score > 0)
    .toSorted((a, b) => b.score - a.score)
    .slice(0, 3);

  return alternatives;
}
