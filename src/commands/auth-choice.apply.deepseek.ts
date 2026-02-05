import type { ApplyAuthChoiceParams, ApplyAuthChoiceResult } from "./auth-choice.apply.js";
import { resolveEnvApiKey } from "../agents/model-auth.js";
import {
  formatApiKeyPreview,
  normalizeApiKeyInput,
  validateApiKeyInput,
} from "./auth-choice.api-key.js";
import { applyDefaultModelChoice } from "./auth-choice.default-model.js";
import {
  applyAuthProfileConfig,
  applyDeepSeekConfig,
  applyDeepSeekProviderConfig,
  DEEPSEEK_DEFAULT_MODEL_REF,
  setDeepSeekApiKey,
} from "./onboard-auth.js";

export async function applyAuthChoiceDeepSeek(
  params: ApplyAuthChoiceParams,
): Promise<ApplyAuthChoiceResult | null> {
  if (params.authChoice === "deepseek-api-key") {
    let nextConfig = params.config;
    let agentModelOverride: string | undefined;
    const noteAgentModel = async (model: string) => {
      if (!params.agentId) {
        return;
      }
      await params.prompter.note(
        `Default model set to ${model} for agent "${params.agentId}".`,
        "Model configured",
      );
    };
    let hasCredential = false;

    if (params.opts?.deepseekApiKey) {
      await setDeepSeekApiKey(normalizeApiKeyInput(params.opts.deepseekApiKey), params.agentDir);
      hasCredential = true;
    }

    if (!hasCredential) {
      const envKey = resolveEnvApiKey("deepseek");
      if (envKey) {
        const useExisting = await params.prompter.confirm({
          message: `Use existing DEEPSEEK_API_KEY (${envKey.source}, ${formatApiKeyPreview(envKey.apiKey)})?`,
          initialValue: true,
        });
        if (useExisting) {
          await setDeepSeekApiKey(envKey.apiKey, params.agentDir);
          hasCredential = true;
        }
      }
    }

    if (!hasCredential) {
      const key = await params.prompter.text({
        message: "Enter DeepSeek API key",
        validate: validateApiKeyInput,
      });
      await setDeepSeekApiKey(normalizeApiKeyInput(String(key)), params.agentDir);
    }
    nextConfig = applyAuthProfileConfig(nextConfig, {
      profileId: "deepseek:default",
      provider: "deepseek",
      mode: "api_key",
    });
    {
      const applied = await applyDefaultModelChoice({
        config: nextConfig,
        setDefaultModel: params.setDefaultModel,
        defaultModel: DEEPSEEK_DEFAULT_MODEL_REF,
        applyDefaultConfig: applyDeepSeekConfig,
        applyProviderConfig: applyDeepSeekProviderConfig,
        noteDefault: DEEPSEEK_DEFAULT_MODEL_REF,
        noteAgentModel,
        prompter: params.prompter,
      });
      nextConfig = applied.config;
      agentModelOverride = applied.agentModelOverride ?? agentModelOverride;
    }

    return { config: nextConfig, agentModelOverride };
  }

  return null;
}
