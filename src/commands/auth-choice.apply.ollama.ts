import { resolveEnvApiKey } from "../agents/model-auth.js";
import type { ClawdbotConfig } from "../config/config.js";
import { formatApiKeyPreview } from "./auth-choice.api-key.js";
import type { ApplyAuthChoiceParams, ApplyAuthChoiceResult } from "./auth-choice.apply.js";
import { applyDefaultModelChoice } from "./auth-choice.default-model.js";
import {
  applyAuthProfileConfig,
  OLLAMA_DEFAULT_MODEL_REF,
  setOllamaApiKey,
} from "./onboard-auth.js";

const OLLAMA_PLACEHOLDER_KEY = "ollama";
const OLLAMA_DEFAULT_BASE_URL = "http://127.0.0.1:11434";
const OLLAMA_TIMEOUT_MS = 8000;

function isValidHttpUrl(value: string | undefined): string | undefined {
  if (!value?.trim()) return "URL is required";
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:"
      ? undefined
      : "Only HTTP and HTTPS URLs are supported";
  } catch {
    return "Invalid URL format";
  }
}

async function checkOllamaReachable(
  baseUrl: string,
): Promise<{ reachable: boolean; models: string[] }> {
  try {
    const res = await fetch(`${baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(OLLAMA_TIMEOUT_MS),
    });
    if (!res.ok) return { reachable: false, models: [] };

    const data: { models?: unknown } = await res.json();
    if (!Array.isArray(data.models)) return { reachable: true, models: [] };

    const models = data.models
      .map((m: { name?: string }) => m?.name)
      .filter((name): name is string => typeof name === "string");
    return { reachable: true, models };
  } catch {
    return { reachable: false, models: [] };
  }
}

export async function applyAuthChoiceOllama(
  params: ApplyAuthChoiceParams,
): Promise<ApplyAuthChoiceResult | null> {
  if (params.authChoice !== "ollama") return null;

  const { prompter, agentDir, setDefaultModel, agentId } = params;

  // Prompt for custom endpoint
  const useCustomEndpoint = await prompter.confirm({
    message: `Use a custom Ollama endpoint? (default: ${OLLAMA_DEFAULT_BASE_URL})`,
    initialValue: false,
  });

  let baseUrl = OLLAMA_DEFAULT_BASE_URL;
  if (useCustomEndpoint) {
    const input = await prompter.text({
      message: "Enter Ollama endpoint URL",
      initialValue: OLLAMA_DEFAULT_BASE_URL,
      validate: isValidHttpUrl,
    });
    baseUrl = typeof input === "string" && input.trim() ? input.trim() : OLLAMA_DEFAULT_BASE_URL;
  }

  const { reachable, models } = await checkOllamaReachable(baseUrl);

  if (!reachable) {
    await prompter.note(
      `Ollama is not reachable at ${baseUrl}

Please ensure Ollama is running:
  1. Install Ollama: https://ollama.ai
  2. Start Ollama: ollama serve
  3. Pull a model: ollama pull llama3.3

Then re-run the onboarding wizard.`,
      "Ollama not detected",
    );
    return { config: params.config };
  }

  // Show available models
  if (models.length > 0) {
    const truncate = (s: string) => (s.length > 40 ? `${s.slice(0, 37)}...` : s);
    const preview = models.slice(0, 5).map(truncate).join(", ");
    await prompter.note(
      `Found ${models.length} model(s): ${preview}${models.length > 5 ? ", ..." : ""}`,
      "Ollama",
    );
  } else {
    await prompter.note("No models found. Pull a model first:\n  ollama pull llama3.3", "Ollama");
  }

  // Check for existing OLLAMA_API_KEY
  let apiKey = OLLAMA_PLACEHOLDER_KEY;
  const envKey = resolveEnvApiKey("ollama");
  if (envKey) {
    const useExisting = await prompter.confirm({
      message: `Use existing OLLAMA_API_KEY (${envKey.source}, ${formatApiKeyPreview(envKey.apiKey)})?`,
      initialValue: true,
    });
    if (useExisting) apiKey = envKey.apiKey;
  }

  await setOllamaApiKey(apiKey, agentDir);

  let config = applyAuthProfileConfig(params.config, {
    profileId: "ollama:default",
    provider: "ollama",
    mode: "api_key",
  });

  const defaultModel = models.length > 0 ? `ollama/${models[0]}` : OLLAMA_DEFAULT_MODEL_REF;

  const applied = await applyDefaultModelChoice({
    config,
    setDefaultModel,
    defaultModel,
    applyDefaultConfig: (cfg) => applyOllamaConfig(cfg, defaultModel, baseUrl),
    applyProviderConfig: (cfg) => applyOllamaProviderConfig(cfg, baseUrl),
    noteDefault: defaultModel,
    noteAgentModel: async (model) => {
      if (agentId) {
        await prompter.note(
          `Default model set to ${model} for agent "${agentId}".`,
          "Model configured",
        );
      }
    },
    prompter,
  });

  return { config: applied.config, agentModelOverride: applied.agentModelOverride };
}

function applyOllamaProviderConfig(cfg: ClawdbotConfig, baseUrl: string): ClawdbotConfig {
  if (baseUrl === OLLAMA_DEFAULT_BASE_URL) {
    return {
      ...cfg,
      models: { mode: cfg.models?.mode ?? "merge", providers: cfg.models?.providers },
    };
  }

  return {
    ...cfg,
    models: {
      mode: cfg.models?.mode ?? "merge",
      providers: {
        ...cfg.models?.providers,
        ollama: {
          baseUrl: `${baseUrl}/v1`,
          api: "openai-completions" as const,
          models: [],
        },
      },
    },
  };
}

function applyOllamaConfig(cfg: ClawdbotConfig, modelRef: string, baseUrl: string): ClawdbotConfig {
  const next = applyOllamaProviderConfig(cfg, baseUrl);
  const existing = next.agents?.defaults?.model;
  const fallbacks =
    existing && typeof existing === "object" && "fallbacks" in existing
      ? (existing as { fallbacks?: string[] }).fallbacks
      : undefined;

  return {
    ...next,
    agents: {
      ...next.agents,
      defaults: {
        ...next.agents?.defaults,
        model: { ...(fallbacks && { fallbacks }), primary: modelRef },
      },
    },
  };
}
