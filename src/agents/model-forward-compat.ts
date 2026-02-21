import type { Api, Model } from "@mariozechner/pi-ai";
import { DEFAULT_CONTEXT_TOKENS } from "./defaults.js";
import { normalizeModelCompat } from "./model-compat.js";
import { normalizeProviderId } from "./model-selection.js";
import { normalizeGoogleModelId } from "./models-config.providers.js";
import type { ModelRegistry } from "./pi-model-discovery.js";

const OPENAI_CODEX_GPT_53_MODEL_ID = "gpt-5.3-codex";
const OPENAI_CODEX_TEMPLATE_MODEL_IDS = ["gpt-5.2-codex"] as const;

const ANTHROPIC_OPUS_46_MODEL_ID = "claude-opus-4-6";
const ANTHROPIC_OPUS_46_DOT_MODEL_ID = "claude-opus-4.6";
const ANTHROPIC_OPUS_TEMPLATE_MODEL_IDS = ["claude-opus-4-5", "claude-opus-4.5"] as const;
const ANTHROPIC_SONNET_46_MODEL_ID = "claude-sonnet-4-6";
const ANTHROPIC_SONNET_46_DOT_MODEL_ID = "claude-sonnet-4.6";
const ANTHROPIC_SONNET_TEMPLATE_MODEL_IDS = ["claude-sonnet-4-5", "claude-sonnet-4.5"] as const;

const ZAI_GLM5_MODEL_ID = "glm-5";
const ZAI_GLM5_TEMPLATE_MODEL_IDS = ["glm-4.7"] as const;

const ANTIGRAVITY_OPUS_46_MODEL_ID = "claude-opus-4-6";
const ANTIGRAVITY_OPUS_46_DOT_MODEL_ID = "claude-opus-4.6";
const ANTIGRAVITY_OPUS_TEMPLATE_MODEL_IDS = ["claude-opus-4-5", "claude-opus-4.5"] as const;
const ANTIGRAVITY_OPUS_46_THINKING_MODEL_ID = "claude-opus-4-6-thinking";
const ANTIGRAVITY_OPUS_46_DOT_THINKING_MODEL_ID = "claude-opus-4.6-thinking";
const ANTIGRAVITY_OPUS_THINKING_TEMPLATE_MODEL_IDS = [
  "claude-opus-4-5-thinking",
  "claude-opus-4.5-thinking",
] as const;

export const ANTIGRAVITY_OPUS_46_FORWARD_COMPAT_CANDIDATES = [
  {
    id: ANTIGRAVITY_OPUS_46_THINKING_MODEL_ID,
    templatePrefixes: [
      "google-antigravity/claude-opus-4-5-thinking",
      "google-antigravity/claude-opus-4.5-thinking",
    ],
  },
  {
    id: ANTIGRAVITY_OPUS_46_MODEL_ID,
    templatePrefixes: ["google-antigravity/claude-opus-4-5", "google-antigravity/claude-opus-4.5"],
  },
] as const;

function cloneFirstTemplateModel(params: {
  normalizedProvider: string;
  trimmedModelId: string;
  templateIds: string[];
  modelRegistry: ModelRegistry;
  patch?: Partial<Model<Api>>;
}): Model<Api> | undefined {
  const { normalizedProvider, trimmedModelId, templateIds, modelRegistry } = params;
  for (const templateId of [...new Set(templateIds)].filter(Boolean)) {
    const template = modelRegistry.find(normalizedProvider, templateId) as Model<Api> | null;
    if (!template) {
      continue;
    }
    return normalizeModelCompat({
      ...template,
      id: trimmedModelId,
      name: trimmedModelId,
      ...params.patch,
    } as Model<Api>);
  }
  return undefined;
}

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

function resolveAnthropic46ForwardCompatModel(params: {
  provider: string;
  modelId: string;
  modelRegistry: ModelRegistry;
  dashModelId: string;
  dotModelId: string;
  dashTemplateId: string;
  dotTemplateId: string;
  fallbackTemplateIds: readonly string[];
}): Model<Api> | undefined {
  const { provider, modelId, modelRegistry, dashModelId, dotModelId } = params;
  const normalizedProvider = normalizeProviderId(provider);
  if (normalizedProvider !== "anthropic") {
    return undefined;
  }

  const trimmedModelId = modelId.trim();
  const lower = trimmedModelId.toLowerCase();
  const is46Model =
    lower === dashModelId ||
    lower === dotModelId ||
    lower.startsWith(`${dashModelId}-`) ||
    lower.startsWith(`${dotModelId}-`);
  if (!is46Model) {
    return undefined;
  }

  const templateIds: string[] = [];
  if (lower.startsWith(dashModelId)) {
    templateIds.push(lower.replace(dashModelId, params.dashTemplateId));
  }
  if (lower.startsWith(dotModelId)) {
    templateIds.push(lower.replace(dotModelId, params.dotTemplateId));
  }
  templateIds.push(...params.fallbackTemplateIds);

  return cloneFirstTemplateModel({
    normalizedProvider,
    trimmedModelId,
    templateIds,
    modelRegistry,
  });
}

function resolveAnthropicOpus46ForwardCompatModel(
  provider: string,
  modelId: string,
  modelRegistry: ModelRegistry,
): Model<Api> | undefined {
  return resolveAnthropic46ForwardCompatModel({
    provider,
    modelId,
    modelRegistry,
    dashModelId: ANTHROPIC_OPUS_46_MODEL_ID,
    dotModelId: ANTHROPIC_OPUS_46_DOT_MODEL_ID,
    dashTemplateId: "claude-opus-4-5",
    dotTemplateId: "claude-opus-4.5",
    fallbackTemplateIds: ANTHROPIC_OPUS_TEMPLATE_MODEL_IDS,
  });
}

function resolveAnthropicSonnet46ForwardCompatModel(
  provider: string,
  modelId: string,
  modelRegistry: ModelRegistry,
): Model<Api> | undefined {
  return resolveAnthropic46ForwardCompatModel({
    provider,
    modelId,
    modelRegistry,
    dashModelId: ANTHROPIC_SONNET_46_MODEL_ID,
    dotModelId: ANTHROPIC_SONNET_46_DOT_MODEL_ID,
    dashTemplateId: "claude-sonnet-4-5",
    dotTemplateId: "claude-sonnet-4.5",
    fallbackTemplateIds: ANTHROPIC_SONNET_TEMPLATE_MODEL_IDS,
  });
}

// Z.ai's GLM-5 may not be present in pi-ai's built-in model catalog yet.
// When a user configures zai/glm-5 without a models.json entry, clone glm-4.7 as a forward-compat fallback.
function resolveZaiGlm5ForwardCompatModel(
  provider: string,
  modelId: string,
  modelRegistry: ModelRegistry,
): Model<Api> | undefined {
  if (normalizeProviderId(provider) !== "zai") {
    return undefined;
  }
  const trimmed = modelId.trim();
  const lower = trimmed.toLowerCase();
  if (lower !== ZAI_GLM5_MODEL_ID && !lower.startsWith(`${ZAI_GLM5_MODEL_ID}-`)) {
    return undefined;
  }

  for (const templateId of ZAI_GLM5_TEMPLATE_MODEL_IDS) {
    const template = modelRegistry.find("zai", templateId) as Model<Api> | null;
    if (!template) {
      continue;
    }
    return normalizeModelCompat({
      ...template,
      id: trimmed,
      name: trimmed,
      reasoning: true,
    } as Model<Api>);
  }

  return normalizeModelCompat({
    id: trimmed,
    name: trimmed,
    api: "openai-completions",
    provider: "zai",
    reasoning: true,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: DEFAULT_CONTEXT_TOKENS,
    maxTokens: DEFAULT_CONTEXT_TOKENS,
  } as Model<Api>);
}

function resolveAntigravityOpus46ForwardCompatModel(
  provider: string,
  modelId: string,
  modelRegistry: ModelRegistry,
): Model<Api> | undefined {
  const normalizedProvider = normalizeProviderId(provider);
  if (normalizedProvider !== "google-antigravity") {
    return undefined;
  }

  const trimmedModelId = modelId.trim();
  const lower = trimmedModelId.toLowerCase();
  const isOpus46 =
    lower === ANTIGRAVITY_OPUS_46_MODEL_ID ||
    lower === ANTIGRAVITY_OPUS_46_DOT_MODEL_ID ||
    lower.startsWith(`${ANTIGRAVITY_OPUS_46_MODEL_ID}-`) ||
    lower.startsWith(`${ANTIGRAVITY_OPUS_46_DOT_MODEL_ID}-`);
  const isOpus46Thinking =
    lower === ANTIGRAVITY_OPUS_46_THINKING_MODEL_ID ||
    lower === ANTIGRAVITY_OPUS_46_DOT_THINKING_MODEL_ID ||
    lower.startsWith(`${ANTIGRAVITY_OPUS_46_THINKING_MODEL_ID}-`) ||
    lower.startsWith(`${ANTIGRAVITY_OPUS_46_DOT_THINKING_MODEL_ID}-`);
  if (!isOpus46 && !isOpus46Thinking) {
    return undefined;
  }

  const templateIds: string[] = [];
  if (lower.startsWith(ANTIGRAVITY_OPUS_46_MODEL_ID)) {
    templateIds.push(lower.replace(ANTIGRAVITY_OPUS_46_MODEL_ID, "claude-opus-4-5"));
  }
  if (lower.startsWith(ANTIGRAVITY_OPUS_46_DOT_MODEL_ID)) {
    templateIds.push(lower.replace(ANTIGRAVITY_OPUS_46_DOT_MODEL_ID, "claude-opus-4.5"));
  }
  if (lower.startsWith(ANTIGRAVITY_OPUS_46_THINKING_MODEL_ID)) {
    templateIds.push(
      lower.replace(ANTIGRAVITY_OPUS_46_THINKING_MODEL_ID, "claude-opus-4-5-thinking"),
    );
  }
  if (lower.startsWith(ANTIGRAVITY_OPUS_46_DOT_THINKING_MODEL_ID)) {
    templateIds.push(
      lower.replace(ANTIGRAVITY_OPUS_46_DOT_THINKING_MODEL_ID, "claude-opus-4.5-thinking"),
    );
  }
  templateIds.push(...ANTIGRAVITY_OPUS_TEMPLATE_MODEL_IDS);
  templateIds.push(...ANTIGRAVITY_OPUS_THINKING_TEMPLATE_MODEL_IDS);

  return cloneFirstTemplateModel({
    normalizedProvider,
    trimmedModelId,
    templateIds,
    modelRegistry,
  });
}

const GEMINI_31_CANONICAL_MODEL_IDS = [
  "gemini-3.1-pro",
  "gemini-3.1-pro-low-preview",
  "gemini-3.1-pro-high-preview",
  "gemini-3.1-pro-preview-customtools",
] as const;
const GEMINI_31_ALIAS_MODEL_IDS = [
  "gemini-3.1-pro-low",
  "gemini-3.1-pro-high",
  "gemini-3.1-pro-customtools",
] as const;
const GEMINI_31_PRO_MODEL_IDS: ReadonlySet<string> = new Set([
  ...GEMINI_31_CANONICAL_MODEL_IDS,
  ...GEMINI_31_ALIAS_MODEL_IDS,
]);
const GEMINI_31_GENERIC_TEMPLATE_MODEL_IDS = [
  "gemini-3-pro-preview",
  "gemini-3-pro-high",
  "gemini-3-pro-high-preview",
  "gemini-3-pro-low",
  "gemini-3-pro-low-preview",
  ...GEMINI_31_CANONICAL_MODEL_IDS,
  ...GEMINI_31_ALIAS_MODEL_IDS,
] as const;
const GEMINI_31_HIGH_TEMPLATE_MODEL_IDS = [
  "gemini-3-pro-high",
  "gemini-3-pro-high-preview",
  "gemini-3.1-pro-high",
  "gemini-3.1-pro-high-preview",
] as const;
const GEMINI_31_LOW_TEMPLATE_MODEL_IDS = [
  "gemini-3-pro-low",
  "gemini-3-pro-low-preview",
  "gemini-3.1-pro-low",
  "gemini-3.1-pro-low-preview",
] as const;
const GEMINI_31_CUSTOMTOOLS_TEMPLATE_MODEL_IDS = [
  "gemini-3-pro-preview",
  "gemini-3.1-pro",
  "gemini-3.1-pro-customtools",
  "gemini-3.1-pro-preview-customtools",
] as const;
const GEMINI_31_ANTIGRAVITY_RUNTIME_MODEL_ID_HIGH = "gemini-3.1-pro-high";
const GEMINI_31_ANTIGRAVITY_RUNTIME_MODEL_ID_LOW = "gemini-3.1-pro-low";

const GEMINI_31_PROVIDERS = ["google"] as const;

export const GEMINI_31_FORWARD_COMPAT_CANDIDATES = [...GEMINI_31_CANONICAL_MODEL_IDS].map((id) => ({
  id,
  templatePrefixes: GEMINI_31_PROVIDERS.map((p) => `${p}/gemini-3-pro`),
}));

function resolveGemini31ForwardCompatModel(
  provider: string,
  modelId: string,
  modelRegistry: ModelRegistry,
): Model<Api> | undefined {
  const normalizedProvider = normalizeProviderId(provider);
  if (normalizedProvider !== "google" && normalizedProvider !== "google-antigravity") {
    return undefined;
  }

  const trimmedModelId = modelId.trim();
  const resolvedModelId =
    normalizedProvider === "google" ? normalizeGoogleModelId(trimmedModelId) : trimmedModelId;
  const lower = resolvedModelId.toLowerCase();
  if (!GEMINI_31_PRO_MODEL_IDS.has(lower)) {
    return undefined;
  }

  const templateIds = resolveGemini31TemplateIds(lower);

  // Cloud Code Assist expects known model ids in the on-wire payload.
  // For antigravity aliases, use the discovered template metadata but keep
  // execution on Gemini 3.1 ids (3-pro ids are deprecated server-side).
  if (normalizedProvider === "google-antigravity") {
    const resolvedModelId = normalizeGemini31RequestedId(trimmedModelId);
    for (const templateId of [...new Set(templateIds)].filter(Boolean)) {
      const template = modelRegistry.find(normalizedProvider, templateId) as Model<Api> | null;
      if (!template) {
        continue;
      }
      return normalizeModelCompat({
        ...template,
        id: resolvedModelId,
        name: trimmedModelId,
        reasoning: true,
      } as Model<Api>);
    }
    return undefined;
  }

  return cloneFirstTemplateModel({
    normalizedProvider,
    trimmedModelId: resolvedModelId,
    templateIds,
    modelRegistry,
    patch: { reasoning: true },
  });
}

function resolveGemini31TemplateIds(modelId: string): string[] {
  const prioritized = modelId.includes("customtools")
    ? GEMINI_31_CUSTOMTOOLS_TEMPLATE_MODEL_IDS
    : modelId.includes("-high")
      ? GEMINI_31_HIGH_TEMPLATE_MODEL_IDS
      : modelId.includes("-low")
        ? GEMINI_31_LOW_TEMPLATE_MODEL_IDS
        : GEMINI_31_GENERIC_TEMPLATE_MODEL_IDS;
  return [...new Set([...prioritized, ...GEMINI_31_GENERIC_TEMPLATE_MODEL_IDS])];
}

function normalizeGemini31RequestedId(modelId: string): string {
  const lower = modelId.toLowerCase();
  if (lower === "gemini-3.1-pro-low" || lower === "gemini-3.1-pro-low-preview") {
    return GEMINI_31_ANTIGRAVITY_RUNTIME_MODEL_ID_LOW;
  }
  if (lower === "gemini-3.1-pro-high" || lower === "gemini-3.1-pro-high-preview") {
    return GEMINI_31_ANTIGRAVITY_RUNTIME_MODEL_ID_HIGH;
  }
  if (
    lower === "gemini-3.1-pro" ||
    lower === "gemini-3.1-pro-customtools" ||
    lower === "gemini-3.1-pro-preview-customtools"
  ) {
    return GEMINI_31_ANTIGRAVITY_RUNTIME_MODEL_ID_HIGH;
  }
  return modelId;
}

export function resolveForwardCompatModel(
  provider: string,
  modelId: string,
  modelRegistry: ModelRegistry,
): Model<Api> | undefined {
  return (
    resolveOpenAICodexGpt53FallbackModel(provider, modelId, modelRegistry) ??
    resolveAnthropicOpus46ForwardCompatModel(provider, modelId, modelRegistry) ??
    resolveAnthropicSonnet46ForwardCompatModel(provider, modelId, modelRegistry) ??
    resolveZaiGlm5ForwardCompatModel(provider, modelId, modelRegistry) ??
    resolveAntigravityOpus46ForwardCompatModel(provider, modelId, modelRegistry) ??
    resolveGemini31ForwardCompatModel(provider, modelId, modelRegistry)
  );
}
