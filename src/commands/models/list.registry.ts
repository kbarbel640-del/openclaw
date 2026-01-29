import fs from "node:fs/promises";
import path from "node:path";
import type { Api, Model } from "@mariozechner/pi-ai";
import { discoverAuthStorage, discoverModels } from "@mariozechner/pi-coding-agent";

import { resolveMoltbotAgentDir } from "../../agents/agent-paths.js";
import type { AuthProfileStore } from "../../agents/auth-profiles.js";
import { listProfilesForProvider } from "../../agents/auth-profiles.js";
import {
  getCustomProviderApiKey,
  resolveAwsSdkEnvVarName,
  resolveEnvApiKey,
} from "../../agents/model-auth.js";
import { ensureMoltbotModelsJson } from "../../agents/models-config.js";
import { buildInlineProviderModels } from "../../agents/pi-embedded-runner/model.js";
import type { MoltbotConfig } from "../../config/config.js";
import type { ModelRow } from "./list.types.js";
import { modelKey } from "./shared.js";

async function readModelsJsonProviders(
  agentDir: string,
): Promise<
  Record<string, { baseUrl?: string; api?: string; models?: Array<Record<string, unknown>> }>
> {
  try {
    const modelsJsonPath = path.join(agentDir, "models.json");
    const raw = await fs.readFile(modelsJsonPath, "utf8");
    const parsed = JSON.parse(raw) as { providers?: Record<string, unknown> };
    return (parsed.providers ?? {}) as Record<
      string,
      { baseUrl?: string; api?: string; models?: Array<Record<string, unknown>> }
    >;
  } catch {
    return {};
  }
}

const isLocalBaseUrl = (baseUrl: string) => {
  try {
    const url = new URL(baseUrl);
    const host = url.hostname.toLowerCase();
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host === "::1" ||
      host.endsWith(".local")
    );
  } catch {
    return false;
  }
};

const hasAuthForProvider = (provider: string, cfg: MoltbotConfig, authStore: AuthProfileStore) => {
  if (listProfilesForProvider(authStore, provider).length > 0) return true;
  if (provider === "amazon-bedrock" && resolveAwsSdkEnvVarName()) return true;
  if (resolveEnvApiKey(provider)) return true;
  if (getCustomProviderApiKey(cfg, provider)) return true;
  return false;
};

export async function loadModelRegistry(cfg: MoltbotConfig) {
  await ensureMoltbotModelsJson(cfg);
  const agentDir = resolveMoltbotAgentDir();
  const authStorage = discoverAuthStorage(agentDir);
  const registry = discoverModels(authStorage, agentDir);
  const builtInModels = registry.getAll() as Model<Api>[];
  const availableModels = registry.getAvailable() as Model<Api>[];
  const availableKeys = new Set(availableModels.map((model) => modelKey(model.provider, model.id)));

  // Merge custom provider models from models.json into the registry.
  // The pi-ai SDK only returns built-in models; custom providers are written to agentDir/models.json.
  const modelsJsonProviders = await readModelsJsonProviders(agentDir);
  const customModels = buildInlineProviderModels(modelsJsonProviders)
    .filter((entry) => typeof entry.id === "string" && entry.id.length > 0)
    .map((entry) => {
      // Normalize model ID: strip leading "provider/" prefix if present (avoid double-prefixing)
      const normalizedId = entry.id.startsWith(`${entry.provider}/`)
        ? entry.id.slice(entry.provider.length + 1)
        : entry.id;
      return {
        id: normalizedId,
        name: entry.name || normalizedId,
        provider: entry.provider,
        baseUrl: entry.baseUrl ?? "",
        api: entry.api ?? "openai-completions",
        input: entry.input ?? ["text"],
        reasoning: entry.reasoning ?? false,
        cost: entry.cost ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: entry.contextWindow ?? 128000,
        maxTokens: entry.maxTokens ?? 8192,
      } as Model<Api>;
    });

  // Combine built-in and custom models, deduplicating by key (custom overrides built-in)
  const modelsByKey = new Map<string, Model<Api>>();
  for (const model of builtInModels) {
    modelsByKey.set(modelKey(model.provider, model.id), model);
  }
  for (const model of customModels) {
    modelsByKey.set(modelKey(model.provider, model.id), model);
  }
  const models = Array.from(modelsByKey.values());

  // Mark local custom provider models as available (getAvailable() doesn't see them).
  for (const model of customModels) {
    if (model.baseUrl && isLocalBaseUrl(model.baseUrl)) {
      availableKeys.add(modelKey(model.provider, model.id));
    }
  }

  return { registry, models, availableKeys };
}

export function toModelRow(params: {
  model?: Model<Api>;
  key: string;
  tags: string[];
  aliases?: string[];
  availableKeys?: Set<string>;
  cfg?: MoltbotConfig;
  authStore?: AuthProfileStore;
}): ModelRow {
  const { model, key, tags, aliases = [], availableKeys, cfg, authStore } = params;
  if (!model) {
    return {
      key,
      name: key,
      input: "-",
      contextWindow: null,
      local: null,
      available: null,
      tags: [...tags, "missing"],
      missing: true,
    };
  }

  const input = model.input.join("+") || "text";
  const local = isLocalBaseUrl(model.baseUrl);
  const available =
    cfg && authStore
      ? hasAuthForProvider(model.provider, cfg, authStore)
      : (availableKeys?.has(modelKey(model.provider, model.id)) ?? false);
  const aliasTags = aliases.length > 0 ? [`alias:${aliases.join(",")}`] : [];
  const mergedTags = new Set(tags);
  if (aliasTags.length > 0) {
    for (const tag of mergedTags) {
      if (tag === "alias" || tag.startsWith("alias:")) mergedTags.delete(tag);
    }
    for (const tag of aliasTags) mergedTags.add(tag);
  }

  return {
    key,
    name: model.name || model.id,
    input,
    contextWindow: model.contextWindow ?? null,
    local,
    available,
    tags: Array.from(mergedTags),
    missing: false,
  };
}
