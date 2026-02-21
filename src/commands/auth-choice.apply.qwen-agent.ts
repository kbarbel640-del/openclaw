import type { ApplyAuthChoiceParams, ApplyAuthChoiceResult } from "./auth-choice.apply.js";
import { applyAuthChoicePluginProvider } from "./auth-choice.apply.plugin-provider.js";

export async function applyAuthChoiceQwenAgent(
  params: ApplyAuthChoiceParams,
): Promise<ApplyAuthChoiceResult | null> {
  return await applyAuthChoicePluginProvider(params, {
    authChoice: "qwen-agent",
    pluginId: "qwen-agent-auth",
    providerId: "qwen-agent",
    methodId: "device",
    label: "Qwen Agent",
  });
}
