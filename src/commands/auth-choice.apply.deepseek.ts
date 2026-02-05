import type { ApplyAuthChoiceParams, ApplyAuthChoiceResult } from "./auth-choice.apply.js";
import {
  formatApiKeyPreview,
  normalizeApiKeyInput,
  validateApiKeyInput,
} from "./auth-choice.api-key.js";
import { applyAuthProfileConfig, applyDeepSeekConfig, setDeepSeekApiKey } from "./onboard-auth.js";

export async function applyAuthChoiceDeepSeek(
  params: ApplyAuthChoiceParams,
): Promise<ApplyAuthChoiceResult | null> {
  if (params.authChoice === "deepseek-api-key") {
    let nextConfig = params.config;
    let hasCredential = false;
    const envKey = process.env.DEEPSEEK_API_KEY?.trim();

    if (params.opts?.deepseekApiKey) {
      await setDeepSeekApiKey(normalizeApiKeyInput(params.opts.deepseekApiKey), params.agentDir);
      hasCredential = true;
    }

    if (!hasCredential && envKey) {
      const useExisting = await params.prompter.confirm({
        message: `Use existing DEEPSEEK_API_KEY (env, ${formatApiKeyPreview(envKey)})?`,
        initialValue: true,
      });
      if (useExisting) {
        await setDeepSeekApiKey(envKey, params.agentDir);
        hasCredential = true;
      }
    }
    if (!hasCredential) {
      const key = await params.prompter.text({
        message: "Enter DeepSeek API key",
        validate: validateApiKeyInput,
      });
      await setDeepSeekApiKey(normalizeApiKeyInput(String(key)), params.agentDir);
    }
    nextConfig = applyAuthProfileConfig(applyDeepSeekConfig(nextConfig), {
      profileId: "deepseek:default",
      provider: "deepseek",
      mode: "api_key",
    });
    return { config: nextConfig };
  }

  return null;
}
