import type { Api, Model } from "@mariozechner/pi-ai";
import type { OpenClawConfig } from "../../config/config.js";
import type { ModelDefinitionConfig } from "../../config/types.js";
import { resolveOpenClawAgentDir } from "../agent-paths.js";
import { DEFAULT_CONTEXT_TOKENS } from "../defaults.js";
import { normalizeModelCompat } from "../model-compat.js";
import { normalizeProviderId } from "../model-selection.js";
import {
  discoverAuthStorage,
  discoverModels,
  type AuthStorage,
  type ModelRegistry,
} from "../pi-model-discovery.js";

type InlineModelEntry = ModelDefinitionConfig & { provider: string; baseUrl?: string };
type InlineProviderConfig = {
  baseUrl?: string;
  api?: ModelDefinitionConfig["api"];
  models?: ModelDefinitionConfig[];
};

const OPENAI_CODEX_GPT_53_MODEL_ID = "gpt-5.3-codex";

const OPENAI_CODEX_TEMPLATE_MODEL_IDS = ["gpt-5.2-codex"] as const;

// Z.ai GLM-5 forward-compat: pi-ai's catalog may not include glm-5 yet.
// Clone from glm-4.7 (same API shape, same provider) with updated metadata.
const ZAI_GLM5_MODEL_ID = "glm-5";
const ZAI_GLM5_TEMPLATE_MODEL_IDS = ["glm-4.7", "glm-4.6"] as const;
const ZAI_GLM5_CONTEXT_WINDOW = 200_000;
const ZAI_GLM5_MAX_TOKENS = 131_072;

// pi-ai's built-in Anthropic catalog can lag behind OpenClaw's defaults/docs.
// Add forward-compat fallbacks for known-new IDs by cloning an older template model.
const ANTHROPIC_OPUS_46_MODEL_ID = "claude-opus-4-6";
const ANTHROPIC_OPUS_46_DOT_MODEL_ID = "claude-opus-4.6";
const ANTHROPIC_OPUS_TEMPLATE_MODEL_IDS = ["claude-opus-4-5", "claude-opus-4.5"] as const;

function resolveOpenAICodexGpt53FallbackModel(
  provider: string,
  modelId: string,
  modelRegistry: ModelRegistry,
): Model<Api> | undefined {
  const normalizedProvider = normalizeProviderId(provider);
  const trimmedModelId = modelId.trim();
  if (normalizedProvider !== "openai-codex") {
    return undefined;
  }
  if (trimmedModelId.toLowerCase() !== OPENAI_CODEX_GPT_53_MODEL_ID) {
    return undefined;
  }

  for (const templateId of OPENAI_CODEX_TEMPLATE_MODEL_IDS) {
    const template = modelRegistry.find(normalizedProvider, templateId) as Model<Api> | null;
    if (!template) {
      continue;
    }
    return normalizeModelCompat({
      ...template,
      id: trimmedModelId,
      name: trimmedModelId,
    } as Model<Api>);
  }

  return normalizeModelCompat({
    id: trimmedModelId,
    name: trimmedModelId,
    api: "openai-codex-responses",
    provider: normalizedProvider,
    baseUrl: "https://chatgpt.com/backend-api",
    reasoning: true,
    input: ["text", "image"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: DEFAULT_CONTEXT_TOKENS,
    maxTokens: DEFAULT_CONTEXT_TOKENS,
  } as Model<Api>);
}

function resolveAnthropicOpus46ForwardCompatModel(
  provider: string,
  modelId: string,
  modelRegistry: ModelRegistry,
): Model<Api> | undefined {
  const normalizedProvider = normalizeProviderId(provider);
  if (normalizedProvider !== "anthropic") {
    return undefined;
  }

  const trimmedModelId = modelId.trim();
  const lower = trimmedModelId.toLowerCase();
  const isOpus46 =
    lower === ANTHROPIC_OPUS_46_MODEL_ID ||
    lower === ANTHROPIC_OPUS_46_DOT_MODEL_ID ||
    lower.startsWith(`${ANTHROPIC_OPUS_46_MODEL_ID}-`) ||
    lower.startsWith(`${ANTHROPIC_OPUS_46_DOT_MODEL_ID}-`);
  if (!isOpus46) {
    return undefined;
  }

  const templateIds: string[] = [];
  if (lower.startsWith(ANTHROPIC_OPUS_46_MODEL_ID)) {
    templateIds.push(lower.replace(ANTHROPIC_OPUS_46_MODEL_ID, "claude-opus-4-5"));
  }
  if (lower.startsWith(ANTHROPIC_OPUS_46_DOT_MODEL_ID)) {
    templateIds.push(lower.replace(ANTHROPIC_OPUS_46_DOT_MODEL_ID, "claude-opus-4.5"));
  }
  templateIds.push(...ANTHROPIC_OPUS_TEMPLATE_MODEL_IDS);

  for (const templateId of [...new Set(templateIds)].filter(Boolean)) {
    const template = modelRegistry.find(normalizedProvider, templateId) as Model<Api> | null;
    if (!template) {
      continue;
    }
    return normalizeModelCompat({
      ...template,
      id: trimmedModelId,
      name: trimmedModelId,
    } as Model<Api>);
  }

  return undefined;
}

/**
 * Forward-compat fallback for Z.ai GLM-5.
 *
 * When the pi-ai model catalog hasn't been updated to include glm-5 yet,
 * clone from glm-4.7 (same openai-completions API shape) and override the ID.
 * Works for both direct zai provider and openrouter (where modelId = "z-ai/glm-5").
 */
function resolveZaiGlm5ForwardCompatModel(
  provider: string,
  modelId: string,
  modelRegistry: ModelRegistry,
): Model<Api> | undefined {
  const normalizedProvider = normalizeProviderId(provider);

  // Direct zai provider: modelId is "glm-5"
  if (normalizedProvider === "zai") {
    const trimmedModelId = modelId.trim().toLowerCase();
    if (
      trimmedModelId !== ZAI_GLM5_MODEL_ID &&
      !trimmedModelId.startsWith(`${ZAI_GLM5_MODEL_ID}-`)
    ) {
      return undefined;
    }
    for (const templateId of ZAI_GLM5_TEMPLATE_MODEL_IDS) {
      const template = modelRegistry.find(normalizedProvider, templateId) as Model<Api> | null;
      if (!template) {
        continue;
      }
      return normalizeModelCompat({
        ...template,
        id: modelId.trim(),
        name: modelId.trim(),
        contextWindow: ZAI_GLM5_CONTEXT_WINDOW,
        maxTokens: ZAI_GLM5_MAX_TOKENS,
        reasoning: true,
      } as Model<Api>);
    }

    // Hard fallback: no template found, build from scratch
    return normalizeModelCompat({
      id: modelId.trim(),
      name: modelId.trim(),
      api: "openai-completions",
      provider: normalizedProvider,
      reasoning: true,
      input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: ZAI_GLM5_CONTEXT_WINDOW,
      maxTokens: ZAI_GLM5_MAX_TOKENS,
    } as Model<Api>);
  }

  // OpenRouter provider: modelId is "z-ai/glm-5"
  if (normalizedProvider === "openrouter" || normalizedProvider === "opencode") {
    const trimmedModelId = modelId.trim().toLowerCase();
    const isZaiGlm5 =
      trimmedModelId === "z-ai/glm-5" ||
      trimmedModelId === "zai/glm-5" ||
      trimmedModelId.startsWith("z-ai/glm-5-") ||
      trimmedModelId.startsWith("zai/glm-5-");
    if (!isZaiGlm5) {
      return undefined;
    }
    // Try cloning from existing OpenRouter z-ai model
    for (const templateId of ZAI_GLM5_TEMPLATE_MODEL_IDS) {
      const orTemplateId = `z-ai/${templateId}`;
      const template = modelRegistry.find(normalizedProvider, orTemplateId) as Model<Api> | null;
      if (!template) {
        continue;
      }
      return normalizeModelCompat({
        ...template,
        id: modelId.trim(),
        name: modelId.trim(),
        contextWindow: ZAI_GLM5_CONTEXT_WINDOW,
        maxTokens: ZAI_GLM5_MAX_TOKENS,
        reasoning: true,
      } as Model<Api>);
    }

    // Hard fallback for OpenRouter
    return normalizeModelCompat({
      id: modelId.trim(),
      name: modelId.trim(),
      api: "openai-completions",
      provider: normalizedProvider,
      reasoning: true,
      input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: ZAI_GLM5_CONTEXT_WINDOW,
      maxTokens: ZAI_GLM5_MAX_TOKENS,
    } as Model<Api>);
  }

  return undefined;
}

export function buildInlineProviderModels(
  providers: Record<string, InlineProviderConfig>,
): InlineModelEntry[] {
  return Object.entries(providers).flatMap(([providerId, entry]) => {
    const trimmed = providerId.trim();
    if (!trimmed) {
      return [];
    }
    return (entry?.models ?? []).map((model) => ({
      ...model,
      provider: trimmed,
      baseUrl: entry?.baseUrl,
      api: model.api ?? entry?.api,
    }));
  });
}

export function buildModelAliasLines(cfg?: OpenClawConfig) {
  const models = cfg?.agents?.defaults?.models ?? {};
  const entries: Array<{ alias: string; model: string }> = [];
  for (const [keyRaw, entryRaw] of Object.entries(models)) {
    const model = String(keyRaw ?? "").trim();
    if (!model) {
      continue;
    }
    const alias = String((entryRaw as { alias?: string } | undefined)?.alias ?? "").trim();
    if (!alias) {
      continue;
    }
    entries.push({ alias, model });
  }
  return entries
    .toSorted((a, b) => a.alias.localeCompare(b.alias))
    .map((entry) => `- ${entry.alias}: ${entry.model}`);
}

export function resolveModel(
  provider: string,
  modelId: string,
  agentDir?: string,
  cfg?: OpenClawConfig,
): {
  model?: Model<Api>;
  error?: string;
  authStorage: AuthStorage;
  modelRegistry: ModelRegistry;
} {
  const resolvedAgentDir = agentDir ?? resolveOpenClawAgentDir();
  const authStorage = discoverAuthStorage(resolvedAgentDir);
  const modelRegistry = discoverModels(authStorage, resolvedAgentDir);
  const model = modelRegistry.find(provider, modelId) as Model<Api> | null;
  if (!model) {
    const providers = cfg?.models?.providers ?? {};
    const inlineModels = buildInlineProviderModels(providers);
    const normalizedProvider = normalizeProviderId(provider);
    const inlineMatch = inlineModels.find(
      (entry) => normalizeProviderId(entry.provider) === normalizedProvider && entry.id === modelId,
    );
    if (inlineMatch) {
      const normalized = normalizeModelCompat(inlineMatch as Model<Api>);
      return {
        model: normalized,
        authStorage,
        modelRegistry,
      };
    }
    // Codex gpt-5.3 forward-compat fallback must be checked BEFORE the generic providerCfg fallback.
    // Otherwise, if cfg.models.providers["openai-codex"] is configured, the generic fallback fires
    // with api: "openai-responses" instead of the correct "openai-codex-responses".
    const codexForwardCompat = resolveOpenAICodexGpt53FallbackModel(
      provider,
      modelId,
      modelRegistry,
    );
    if (codexForwardCompat) {
      return { model: codexForwardCompat, authStorage, modelRegistry };
    }
    const anthropicForwardCompat = resolveAnthropicOpus46ForwardCompatModel(
      provider,
      modelId,
      modelRegistry,
    );
    if (anthropicForwardCompat) {
      return { model: anthropicForwardCompat, authStorage, modelRegistry };
    }
    const zaiForwardCompat = resolveZaiGlm5ForwardCompatModel(provider, modelId, modelRegistry);
    if (zaiForwardCompat) {
      return { model: zaiForwardCompat, authStorage, modelRegistry };
    }
    const providerCfg = providers[provider];
    if (providerCfg || modelId.startsWith("mock-")) {
      const fallbackModel: Model<Api> = normalizeModelCompat({
        id: modelId,
        name: modelId,
        api: providerCfg?.api ?? "openai-responses",
        provider,
        baseUrl: providerCfg?.baseUrl,
        reasoning: false,
        input: ["text"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: providerCfg?.models?.[0]?.contextWindow ?? DEFAULT_CONTEXT_TOKENS,
        maxTokens: providerCfg?.models?.[0]?.maxTokens ?? DEFAULT_CONTEXT_TOKENS,
      } as Model<Api>);
      return { model: fallbackModel, authStorage, modelRegistry };
    }
    return {
      error: `Unknown model: ${provider}/${modelId}`,
      authStorage,
      modelRegistry,
    };
  }
  return { model: normalizeModelCompat(model), authStorage, modelRegistry };
}
