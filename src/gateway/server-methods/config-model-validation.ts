import type { OpenClawConfig } from "../../config/config.js";
import type { ModelCatalogEntry } from "../../agents/model-catalog.js";

export type ModelValidationIssue = {
  path: string;
  model: string;
  message: string;
  suggestions?: string[];
};

// Known aliases that resolve at runtime (from config/defaults.ts DEFAULT_MODEL_ALIASES)
const KNOWN_ALIASES = new Set([
  "opus",
  "sonnet",
  "gpt",
  "gpt-mini",
  "gemini",
  "gemini-flash",
]);

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isQualifiedModelRef(value: string): boolean {
  return value.includes("/");
}

function isKnownAlias(value: string): boolean {
  return KNOWN_ALIASES.has(value.toLowerCase());
}

function extractModelRefs(cfg: OpenClawConfig): Array<{ path: string; model: string }> {
  const refs: Array<{ path: string; model: string }> = [];

  // agents.defaults.model
  const defaultModel = cfg.agents?.defaults?.model;
  if (defaultModel) {
    if (isNonEmptyString(defaultModel.primary)) {
      refs.push({ path: "agents.defaults.model.primary", model: defaultModel.primary });
    }
    if (Array.isArray(defaultModel.fallbacks)) {
      defaultModel.fallbacks.forEach((m, i) => {
        if (isNonEmptyString(m)) {
          refs.push({ path: `agents.defaults.model.fallbacks[${i}]`, model: m });
        }
      });
    }
  }

  // agents.defaults.imageModel
  const defaultImageModel = cfg.agents?.defaults?.imageModel;
  if (defaultImageModel) {
    if (isNonEmptyString(defaultImageModel.primary)) {
      refs.push({ path: "agents.defaults.imageModel.primary", model: defaultImageModel.primary });
    }
    if (Array.isArray(defaultImageModel.fallbacks)) {
      defaultImageModel.fallbacks.forEach((m, i) => {
        if (isNonEmptyString(m)) {
          refs.push({ path: `agents.defaults.imageModel.fallbacks[${i}]`, model: m });
        }
      });
    }
  }

  // agents.list[].model
  if (Array.isArray(cfg.agents?.list)) {
    cfg.agents.list.forEach((agent, idx) => {
      const agentModel = agent.model;
      if (agentModel) {
        if (isNonEmptyString(agentModel.primary)) {
          refs.push({ path: `agents.list[${idx}].model.primary`, model: agentModel.primary });
        }
        if (Array.isArray(agentModel.fallbacks)) {
          agentModel.fallbacks.forEach((m, i) => {
            if (isNonEmptyString(m)) {
              refs.push({ path: `agents.list[${idx}].model.fallbacks[${i}]`, model: m });
            }
          });
        }
      }
    });
  }

  return refs;
}

function findSuggestions(model: string, catalog: ModelCatalogEntry[]): string[] {
  if (!isQualifiedModelRef(model)) {
    // For unqualified IDs, suggest qualified versions from any provider
    const lowerModel = model.toLowerCase();
    return catalog
      .filter((entry) => entry.id?.toLowerCase().includes(lowerModel))
      .map((entry) => `${entry.provider}/${entry.id}`)
      .slice(0, 3);
  }

  const [provider, modelId] = model.split("/", 2);
  if (!provider || !modelId) return [];

  // Find models from same provider with similar names
  const providerModels = catalog.filter(
    (entry) => entry.provider?.toLowerCase() === provider.toLowerCase(),
  );

  // Simple prefix match for suggestions
  const baseId = modelId.replace(/-\d{8}$/, ""); // Remove date suffix like -20250514
  return providerModels
    .filter((entry) => entry.id?.toLowerCase().startsWith(baseId.toLowerCase().slice(0, 10)))
    .map((entry) => `${entry.provider}/${entry.id}`)
    .slice(0, 3);
}

export type ModelValidationResult = {
  issues: ModelValidationIssue[];
  catalogLoadFailed?: boolean;
  catalogLoadError?: string;
};

export function validateConfigModels(
  cfg: OpenClawConfig,
  catalog: ModelCatalogEntry[],
): ModelValidationIssue[] {
  const refs = extractModelRefs(cfg);
  const issues: ModelValidationIssue[] = [];

  const catalogSet = new Set(
    catalog.map((entry) => `${entry.provider}/${entry.id}`.toLowerCase()),
  );

  for (const ref of refs) {
    const model = ref.model.trim();

    // Skip known aliases - they resolve at runtime
    if (isKnownAlias(model)) {
      continue;
    }

    if (isQualifiedModelRef(model)) {
      // Qualified ref (provider/model) - validate against catalog
      if (!catalogSet.has(model.toLowerCase())) {
        const suggestions = findSuggestions(model, catalog);
        issues.push({
          path: ref.path,
          model: model,
          message: `Unknown model "${model}"`,
          suggestions: suggestions.length > 0 ? suggestions : undefined,
        });
      }
    } else {
      // Unqualified string that's not a known alias - likely missing provider prefix
      const suggestions = findSuggestions(model, catalog);
      issues.push({
        path: ref.path,
        model: model,
        message: `Model "${model}" may need a provider prefix (e.g., "provider/${model}")`,
        suggestions: suggestions.length > 0 ? suggestions : undefined,
      });
    }
  }

  return issues;
}
