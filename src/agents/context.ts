// Lazy-load pi-coding-agent model metadata so we can infer context windows when
// the agent reports a model id. This includes custom models.json entries.

import { loadConfig } from "../config/config.js";
import { resolveOpenClawAgentDir } from "./agent-paths.js";
import { ensureOpenClawModelsJson } from "./models-config.js";

type ModelEntry = { id: string; provider?: string; contextWindow?: number };

const MODEL_CACHE = new Map<string, number>();
const loadPromise = (async () => {
  try {
    const { discoverAuthStorage, discoverModels } = await import("./pi-model-discovery.js");
    const cfg = loadConfig();
    await ensureOpenClawModelsJson(cfg);
    const agentDir = resolveOpenClawAgentDir();
    const authStorage = discoverAuthStorage(agentDir);
    const modelRegistry = discoverModels(authStorage, agentDir);
    const models = modelRegistry.getAll() as ModelEntry[];
    for (const m of models) {
      if (!m?.id) {
        continue;
      }
      if (typeof m.contextWindow === "number" && m.contextWindow > 0) {
        const key = m.provider ? `${m.provider}/${m.id}` : m.id;
        MODEL_CACHE.set(key, m.contextWindow);
        // Also store by bare model ID as fallback for callers without provider info.
        // First-writer-wins: don't overwrite if a provider-qualified entry already set it.
        if (!MODEL_CACHE.has(m.id)) {
          MODEL_CACHE.set(m.id, m.contextWindow);
        }
      }
    }
  } catch {
    // If pi-ai isn't available, leave cache empty; lookup will fall back.
  }
})();

export function lookupContextTokens(modelId?: string, provider?: string): number | undefined {
  if (!modelId) {
    return undefined;
  }
  // Best-effort: kick off loading, but don't block.
  void loadPromise;
  // Prefer provider-qualified key; fall back to bare model ID.
  if (provider) {
    const qualified = MODEL_CACHE.get(`${provider}/${modelId}`);
    if (qualified !== undefined) {
      return qualified;
    }
  }
  return MODEL_CACHE.get(modelId);
}
