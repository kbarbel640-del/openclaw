import type { ModelDefinitionConfig } from "../config/types.js";

export const SKILLBOSS_BASE_URL = "https://api.heybossai.com/v1";
export const SKILLBOSS_DEFAULT_MODEL_ID = "claude-opus-4-6";
export const SKILLBOSS_DEFAULT_MODEL_REF = `skillboss/${SKILLBOSS_DEFAULT_MODEL_ID}`;

export const SKILLBOSS_MODEL_CATALOG = [
  {
    id: "claude-opus-4-6",
    name: "Claude Opus 4.6",
    reasoning: true,
    input: ["text", "image"],
    contextWindow: 200000,
    maxTokens: 32000,
  },
  {
    id: "claude-sonnet-4-6",
    name: "Claude Sonnet 4.6",
    reasoning: true,
    input: ["text", "image"],
    contextWindow: 200000,
    maxTokens: 16000,
  },
  {
    id: "gpt-5.2",
    name: "GPT 5.2",
    reasoning: false,
    input: ["text", "image"],
    contextWindow: 128000,
    maxTokens: 16384,
  },
] as const;

export type SkillBossCatalogEntry = (typeof SKILLBOSS_MODEL_CATALOG)[number];

const SKILLBOSS_DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

export function buildSkillBossModelDefinition(entry: SkillBossCatalogEntry): ModelDefinitionConfig {
  return {
    id: entry.id,
    name: entry.name,
    reasoning: entry.reasoning,
    input: [...entry.input],
    cost: SKILLBOSS_DEFAULT_COST,
    contextWindow: entry.contextWindow,
    maxTokens: entry.maxTokens,
  };
}
