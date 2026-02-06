import type { Api, Model } from "@mariozechner/pi-ai";

function isOpenAiCompletionsModel(model: Model<Api>): model is Model<"openai-completions"> {
  return model.api === "openai-completions";
}

function isDashScopeCompatibleEndpoint(baseUrl: string): boolean {
  return (
    baseUrl.includes("dashscope.aliyuncs.com") ||
    baseUrl.includes("dashscope-intl.aliyuncs.com") ||
    baseUrl.includes("dashscope-us.aliyuncs.com")
  );
}

export function normalizeModelCompat(model: Model<Api>): Model<Api> {
  const baseUrl = model.baseUrl ?? "";
  const providerKey = model.provider?.trim().toLowerCase() ?? "";
  const isOpenAiCompletions = isOpenAiCompletionsModel(model);

  const isZai = providerKey === "zai" || baseUrl.includes("api.z.ai");
  const isMoonshot =
    providerKey === "moonshot" ||
    baseUrl.includes("moonshot.ai") ||
    baseUrl.includes("moonshot.cn");
  const isDashScope = providerKey === "dashscope" || isDashScopeCompatibleEndpoint(baseUrl);

  // Qwen OpenAI-compatible endpoints (DashScope / Qwen Portal) use
  // `enable_thinking` instead of `reasoning_effort`.
  //
  // pi-ai exposes this via `compat.thinkingFormat = "qwen"`.
  const isQwenCompat =
    isOpenAiCompletions &&
    (providerKey === "qwen-portal" || isDashScope || baseUrl.includes("portal.qwen.ai"));
  if (isQwenCompat) {
    const compat = model.compat ?? undefined;
    if (!compat?.thinkingFormat) {
      model.compat = compat ? { ...compat, thinkingFormat: "qwen" } : { thinkingFormat: "qwen" };
    }
  }

  if (!isOpenAiCompletions || (!isZai && !isMoonshot && !isDashScope)) {
    return model;
  }

  const openaiModel = model;
  const compat = openaiModel.compat ?? undefined;
  if (compat?.supportsDeveloperRole === false) {
    return model;
  }

  openaiModel.compat = compat
    ? { ...compat, supportsDeveloperRole: false }
    : { supportsDeveloperRole: false };
  return openaiModel;
}
