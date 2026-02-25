import { QIANFAN_BASE_URL, QIANFAN_DEFAULT_MODEL_ID } from "../agents/models-config.providers.js";
import type { ModelDefinitionConfig } from "../config/types.js";
import {
  KILOCODE_DEFAULT_CONTEXT_WINDOW,
  KILOCODE_DEFAULT_COST,
  KILOCODE_DEFAULT_MAX_TOKENS,
  KILOCODE_DEFAULT_MODEL_ID,
  KILOCODE_DEFAULT_MODEL_NAME,
} from "../providers/kilocode-shared.js";
export {
  KILOCODE_DEFAULT_CONTEXT_WINDOW,
  KILOCODE_DEFAULT_COST,
  KILOCODE_DEFAULT_MAX_TOKENS,
  KILOCODE_DEFAULT_MODEL_ID,
};

export const DEFAULT_MINIMAX_BASE_URL = "https://api.minimax.io/v1";
export const MINIMAX_API_BASE_URL = "https://api.minimax.io/anthropic";
export const MINIMAX_CN_API_BASE_URL = "https://api.minimaxi.com/anthropic";
export const MINIMAX_HOSTED_MODEL_ID = "MiniMax-M2.1";
export const MINIMAX_HOSTED_MODEL_REF = `minimax/${MINIMAX_HOSTED_MODEL_ID}`;
export const DEFAULT_MINIMAX_CONTEXT_WINDOW = 200000;
export const DEFAULT_MINIMAX_MAX_TOKENS = 8192;

export const MOONSHOT_BASE_URL = "https://api.moonshot.ai/v1";
export const MOONSHOT_CN_BASE_URL = "https://api.moonshot.cn/v1";
export const MOONSHOT_DEFAULT_MODEL_ID = "kimi-k2.5";
export const MOONSHOT_DEFAULT_MODEL_REF = `moonshot/${MOONSHOT_DEFAULT_MODEL_ID}`;
export const MOONSHOT_DEFAULT_CONTEXT_WINDOW = 256000;
export const MOONSHOT_DEFAULT_MAX_TOKENS = 8192;
export const KIMI_CODING_MODEL_ID = "k2p5";
export const KIMI_CODING_MODEL_REF = `kimi-coding/${KIMI_CODING_MODEL_ID}`;

export { QIANFAN_BASE_URL, QIANFAN_DEFAULT_MODEL_ID };
export const QIANFAN_DEFAULT_MODEL_REF = `qianfan/${QIANFAN_DEFAULT_MODEL_ID}`;

export const ZAI_CODING_GLOBAL_BASE_URL = "https://api.z.ai/api/coding/paas/v4";
export const ZAI_CODING_CN_BASE_URL = "https://open.bigmodel.cn/api/coding/paas/v4";
export const ZAI_GLOBAL_BASE_URL = "https://api.z.ai/api/paas/v4";
export const ZAI_CN_BASE_URL = "https://open.bigmodel.cn/api/paas/v4";
export const ZAI_DEFAULT_MODEL_ID = "glm-5";

export function resolveZaiBaseUrl(endpoint?: string): string {
  switch (endpoint) {
    case "coding-cn":
      return ZAI_CODING_CN_BASE_URL;
    case "global":
      return ZAI_GLOBAL_BASE_URL;
    case "cn":
      return ZAI_CN_BASE_URL;
    case "coding-global":
      return ZAI_CODING_GLOBAL_BASE_URL;
    default:
      return ZAI_GLOBAL_BASE_URL;
  }
}

// Pricing per 1M tokens (USD) — https://platform.minimaxi.com/document/Price
export const MINIMAX_API_COST = {
  input: 0.3,
  output: 1.2,
  cacheRead: 0.03,
  cacheWrite: 0.12,
};
export const MINIMAX_HOSTED_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};
export const MINIMAX_LM_STUDIO_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};
export const MOONSHOT_DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

export const ZAI_DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

const MINIMAX_MODEL_CATALOG = {
  "MiniMax-M2.1": { name: "MiniMax M2.1", reasoning: false },
  "MiniMax-M2.1-lightning": {
    name: "MiniMax M2.1 Lightning",
    reasoning: false,
  },
  "MiniMax-M2.5": { name: "MiniMax M2.5", reasoning: true },
  "MiniMax-M2.5-Lightning": { name: "MiniMax M2.5 Lightning", reasoning: true },
} as const;

type MinimaxCatalogId = keyof typeof MINIMAX_MODEL_CATALOG;

const ZAI_MODEL_CATALOG = {
  "glm-5": { name: "GLM-5", reasoning: true },
  "glm-4.7": { name: "GLM-4.7", reasoning: true },
  "glm-4.7-flash": { name: "GLM-4.7 Flash", reasoning: true },
  "glm-4.7-flashx": { name: "GLM-4.7 FlashX", reasoning: true },
} as const;

type ZaiCatalogId = keyof typeof ZAI_MODEL_CATALOG;

export function buildMinimaxModelDefinition(params: {
  id: string;
  name?: string;
  reasoning?: boolean;
  cost: ModelDefinitionConfig["cost"];
  contextWindow: number;
  maxTokens: number;
}): ModelDefinitionConfig {
  const catalog = MINIMAX_MODEL_CATALOG[params.id as MinimaxCatalogId];
  return {
    id: params.id,
    name: params.name ?? catalog?.name ?? `MiniMax ${params.id}`,
    reasoning: params.reasoning ?? catalog?.reasoning ?? false,
    input: ["text"],
    cost: params.cost,
    contextWindow: params.contextWindow,
    maxTokens: params.maxTokens,
  };
}

export function buildMinimaxApiModelDefinition(modelId: string): ModelDefinitionConfig {
  return buildMinimaxModelDefinition({
    id: modelId,
    cost: MINIMAX_API_COST,
    contextWindow: DEFAULT_MINIMAX_CONTEXT_WINDOW,
    maxTokens: DEFAULT_MINIMAX_MAX_TOKENS,
  });
}

export function buildMoonshotModelDefinition(): ModelDefinitionConfig {
  return {
    id: MOONSHOT_DEFAULT_MODEL_ID,
    name: "Kimi K2.5",
    reasoning: false,
    input: ["text", "image"],
    cost: MOONSHOT_DEFAULT_COST,
    contextWindow: MOONSHOT_DEFAULT_CONTEXT_WINDOW,
    maxTokens: MOONSHOT_DEFAULT_MAX_TOKENS,
  };
}

export const MISTRAL_BASE_URL = "https://api.mistral.ai/v1";
export const MISTRAL_DEFAULT_MODEL_ID = "mistral-large-latest";
export const MISTRAL_DEFAULT_MODEL_REF = `mistral/${MISTRAL_DEFAULT_MODEL_ID}`;
export const MISTRAL_DEFAULT_CONTEXT_WINDOW = 262144;
export const MISTRAL_DEFAULT_MAX_TOKENS = 262144;
export const MISTRAL_DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

export function buildMistralModelDefinition(): ModelDefinitionConfig {
  return {
    id: MISTRAL_DEFAULT_MODEL_ID,
    name: "Mistral Large",
    reasoning: false,
    input: ["text", "image"],
    cost: MISTRAL_DEFAULT_COST,
    contextWindow: MISTRAL_DEFAULT_CONTEXT_WINDOW,
    maxTokens: MISTRAL_DEFAULT_MAX_TOKENS,
  };
}

export function buildZaiModelDefinition(params: {
  id: string;
  name?: string;
  reasoning?: boolean;
  cost?: ModelDefinitionConfig["cost"];
  contextWindow?: number;
  maxTokens?: number;
}): ModelDefinitionConfig {
  const catalog = ZAI_MODEL_CATALOG[params.id as ZaiCatalogId];
  return {
    id: params.id,
    name: params.name ?? catalog?.name ?? `GLM ${params.id}`,
    reasoning: params.reasoning ?? catalog?.reasoning ?? true,
    input: ["text"],
    cost: params.cost ?? ZAI_DEFAULT_COST,
    contextWindow: params.contextWindow ?? 204800,
    maxTokens: params.maxTokens ?? 131072,
  };
}

export const XAI_BASE_URL = "https://api.x.ai/v1";
export const XAI_DEFAULT_MODEL_ID = "grok-4";
export const XAI_DEFAULT_MODEL_REF = `xai/${XAI_DEFAULT_MODEL_ID}`;
export const XAI_DEFAULT_CONTEXT_WINDOW = 131072;
export const XAI_DEFAULT_MAX_TOKENS = 8192;
export const XAI_DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

export function buildXaiModelDefinition(): ModelDefinitionConfig {
  return {
    id: XAI_DEFAULT_MODEL_ID,
    name: "Grok 4",
    reasoning: false,
    input: ["text"],
    cost: XAI_DEFAULT_COST,
    contextWindow: XAI_DEFAULT_CONTEXT_WINDOW,
    maxTokens: XAI_DEFAULT_MAX_TOKENS,
  };
}

export function buildKilocodeModelDefinition(): ModelDefinitionConfig {
  return {
    id: KILOCODE_DEFAULT_MODEL_ID,
    name: KILOCODE_DEFAULT_MODEL_NAME,
    reasoning: true,
    input: ["text", "image"],
    cost: KILOCODE_DEFAULT_COST,
    contextWindow: KILOCODE_DEFAULT_CONTEXT_WINDOW,
    maxTokens: KILOCODE_DEFAULT_MAX_TOKENS,
  };
}

// 新增：OpenAI兼容供应商默认配置（基础URL与模型ID）
// 硅基流动：官方提供OpenAI兼容API，常见基地址如下
export const SILICONFLOW_BASE_URL = "https://api.siliconflow.cn/v1";
// 采用在中文环境中更常见且可用的Qwen 2.5指令模型作为默认
export const SILICONFLOW_DEFAULT_MODEL_ID = "Qwen/Qwen2.5-32B-Instruct";
export const SILICONFLOW_DEFAULT_MODEL_REF = `siliconflow/${SILICONFLOW_DEFAULT_MODEL_ID}`;
export const SILICONFLOW_DEFAULT_CONTEXT_WINDOW = 128000;
export const SILICONFLOW_DEFAULT_MAX_TOKENS = 8192;
export const SILICONFLOW_DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

// 阿里云百炼（DashScope）：OpenAI兼容模式端点
export const DASHSCOPE_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1";
export const DASHSCOPE_DEFAULT_MODEL_ID = "qwen-plus";
export const DASHSCOPE_DEFAULT_MODEL_REF = `dashscope/${DASHSCOPE_DEFAULT_MODEL_ID}`;
export const DASHSCOPE_DEFAULT_CONTEXT_WINDOW = 128000;
export const DASHSCOPE_DEFAULT_MAX_TOKENS = 8192;
export const DASHSCOPE_DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

// DeepSeek：官方OpenAI兼容API
export const DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1";
export const DEEPSEEK_DEFAULT_MODEL_ID = "deepseek-chat";
export const DEEPSEEK_DEFAULT_MODEL_REF = `deepseek/${DEEPSEEK_DEFAULT_MODEL_ID}`;
export const DEEPSEEK_DEFAULT_CONTEXT_WINDOW = 128000;
export const DEEPSEEK_DEFAULT_MAX_TOKENS = 8192;
export const DEEPSEEK_DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

const MINIMAX_MODEL_CATALOG = {
  "MiniMax-M2.5": { name: "MiniMax M2.5", reasoning: false },
  "MiniMax-M2.5-highspeed": {
    name: "MiniMax M2.5 Highspeed",
    reasoning: false,
  },
  "MiniMax-M2.1": { name: "MiniMax M2.1", reasoning: false },
  "MiniMax-M2.1-highspeed": {
    name: "MiniMax M2.1 Highspeed",
    reasoning: false,
  },
  "MiniMax-M2.1-lightning": {
    name: "MiniMax M2.1 Lightning",
    reasoning: false,
  },
  "MiniMax-M2": { name: "MiniMax M2", reasoning: false },
} as const;

type MinimaxCatalogId = keyof typeof MINIMAX_MODEL_CATALOG;

export function buildMinimaxModelDefinition(params: {
  id: string;
  name?: string;
  reasoning?: boolean;
  cost: ModelDefinitionConfig["cost"];
  contextWindow: number;
  maxTokens: number;
}): ModelDefinitionConfig {
  const catalog = MINIMAX_MODEL_CATALOG[params.id as MinimaxCatalogId];
  return {
    id: params.id,
    name: params.name ?? catalog?.name ?? `MiniMax ${params.id}`,
    reasoning: params.reasoning ?? catalog?.reasoning ?? false,
    input: ["text"],
    cost: params.cost,
    contextWindow: params.contextWindow,
    maxTokens: params.maxTokens,
  };
}

export function buildMinimaxApiModelDefinition(modelId: string): ModelDefinitionConfig {
  return buildMinimaxModelDefinition({
    id: modelId,
    cost: MINIMAX_API_COST,
    contextWindow: DEFAULT_MINIMAX_CONTEXT_WINDOW,
    maxTokens: DEFAULT_MINIMAX_MAX_TOKENS,
  });
}

export function buildMoonshotModelDefinition(): ModelDefinitionConfig {
  return {
    id: MOONSHOT_DEFAULT_MODEL_ID,
    name: "Kimi K2.5",
    reasoning: false,
    input: ["text"],
    cost: MOONSHOT_DEFAULT_COST,
    contextWindow: MOONSHOT_DEFAULT_CONTEXT_WINDOW,
    maxTokens: MOONSHOT_DEFAULT_MAX_TOKENS,
  };
}

export const XAI_BASE_URL = "https://api.x.ai/v1";
export const XAI_DEFAULT_MODEL_ID = "grok-2-latest";
export const ZAI_DEFAULT_MODEL_REF = `xai/${XAI_DEFAULT_MODEL_ID}`;
export const XAI_DEFAULT_CONTEXT_WINDOW = 131072;
export const XAI_DEFAULT_MAX_TOKENS = 8192;
export const XAI_DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

export function buildXaiModelDefinition(): ModelDefinitionConfig {
  return {
    id: XAI_DEFAULT_MODEL_ID,
    name: "Grok 2",
    reasoning: false,
    input: ["text"],
    cost: XAI_DEFAULT_COST,
    contextWindow: XAI_DEFAULT_CONTEXT_WINDOW,
    maxTokens: XAI_DEFAULT_MAX_TOKENS,
  };
}

// 新增：构建硅基流动默认模型定义（OpenAI兼容）
export function buildSiliconflowModelDefinition(): ModelDefinitionConfig {
  return {
    id: SILICONFLOW_DEFAULT_MODEL_ID,
    name: "SiliconFlow Auto",
    reasoning: false,
    input: ["text"],
    cost: SILICONFLOW_DEFAULT_COST,
    contextWindow: SILICONFLOW_DEFAULT_CONTEXT_WINDOW,
    maxTokens: SILICONFLOW_DEFAULT_MAX_TOKENS,
  };
}

// 新增：构建阿里云百炼（DashScope）默认模型定义（OpenAI兼容）
export function buildDashscopeModelDefinition(): ModelDefinitionConfig {
  return {
    id: DASHSCOPE_DEFAULT_MODEL_ID,
    name: "Qwen Plus",
    reasoning: false,
    input: ["text"],
    cost: DASHSCOPE_DEFAULT_COST,
    contextWindow: DASHSCOPE_DEFAULT_CONTEXT_WINDOW,
    maxTokens: DASHSCOPE_DEFAULT_MAX_TOKENS,
  };
}

// 新增：构建DeepSeek默认模型定义（OpenAI兼容）
export function buildDeepseekModelDefinition(): ModelDefinitionConfig {
  return {
    id: DEEPSEEK_DEFAULT_MODEL_ID,
    name: "DeepSeek Chat",
    reasoning: false,
    input: ["text"],
    cost: DEEPSEEK_DEFAULT_COST,
    contextWindow: DEEPSEEK_DEFAULT_CONTEXT_WINDOW,
    maxTokens: DEEPSEEK_DEFAULT_MAX_TOKENS,
  };
}

