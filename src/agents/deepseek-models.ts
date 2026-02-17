import type { ModelDefinitionConfig } from "../config/types.js";

export const DEEPSEEK_BASE_URL = "https://api.deepseek.com";
export const DEEPSEEK_DEFAULT_MODEL_ID = "deepseek-chat";
export const DEEPSEEK_DEFAULT_MODEL_REF = `deepseek/${DEEPSEEK_DEFAULT_MODEL_ID}`;

// DeepSeek pricing (as of Feb 2026)
// Using standard input/output pricing. Cache pricing is model dependent but we use defaults.
export const DEEPSEEK_DEFAULT_COST = {
  input: 0.14, // $0.14 / 1M input tokens (cache miss)
  output: 0.28, // $0.28 / 1M output tokens
  cacheRead: 0.014, // $0.014 / 1M input tokens (cache hit)
  cacheWrite: 0.14,
};

// R1 pricing is slightly different but for simplicity using base costs or 0 if preferred for OpenClaw convention
// OpenClaw convention for many providers seems to be 0 if variable or credit based, but DeepSeek has clear token pricing.
// However, to match `venice` and `synthetic` defaults which use 0, we can stick to 0 or use actuals.
// Given `venice-models.ts` uses 0, let's use 0 for consistency unless user asked for specific pricing.
// Actually, `venice` uses 0 because of credit pricing. DeepSeek is token based.
// Let's stick to 0 for now to avoid maintenance burden, or use a placeholder.
export const DEEPSEEK_ZERO_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

export const DEEPSEEK_MODEL_CATALOG = [
  {
    id: "deepseek-chat",
    name: "DeepSeek V3",
    reasoning: false,
    input: ["text"],
    contextWindow: 64000,
    maxTokens: 8192,
  },
  {
    id: "deepseek-reasoner",
    name: "DeepSeek R1",
    reasoning: true,
    input: ["text"],
    contextWindow: 64000,
    maxTokens: 8192,
  },
] as const;

export type DeepSeekCatalogEntry = (typeof DEEPSEEK_MODEL_CATALOG)[number];

export function buildDeepSeekModelDefinition(entry: DeepSeekCatalogEntry): ModelDefinitionConfig {
  return {
    id: entry.id,
    name: entry.name,
    reasoning: entry.reasoning,
    input: [...entry.input],
    cost: DEEPSEEK_ZERO_COST,
    contextWindow: entry.contextWindow,
    maxTokens: entry.maxTokens,
  };
}
