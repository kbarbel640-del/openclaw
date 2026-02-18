import type { ModelDefinitionConfig } from "../config/types.js";

const DEFAULT_CONTEXT_WINDOW = 128_000;
const DEFAULT_MAX_TOKENS = 8192;

// Copilot model ids vary by plan/org and can change.
// We keep this list intentionally broad; if a model isn't available Copilot will
// return an error and users can remove it from their config.
const DEFAULT_MODEL_IDS = [
  // GPT models
  "gpt-4o",
  "gpt-4.1",
  "gpt-4.1-mini",
  "gpt-4.1-nano",
  "gpt-5",
  "gpt-5-mini",
  // Reasoning models
  "o1",
  "o1-mini",
  "o3-mini",
  // Claude models
  "claude-sonnet-4.5",
  "claude-sonnet-4.6",
  "claude-opus-4.5",
  "claude-opus-4.6",
  "claude-haiku-4.5",
  // Gemini models
  "gemini-3-flash",
  "gemini-3-pro",
  // Grok models
  "grok-code-fast-1",
] as const;

export function getDefaultCopilotModelIds(): string[] {
  return [...DEFAULT_MODEL_IDS];
}

const REASONING_MODEL_PREFIXES = ["o1", "o3", "o4"];
const CLAUDE_MODEL_PREFIXES = ["claude-"];
const CLAUDE_CONTEXT_WINDOW = 200_000;

export function buildCopilotModelDefinition(modelId: string): ModelDefinitionConfig {
  const id = modelId.trim();
  if (!id) {
    throw new Error("Model id required");
  }
  const isReasoning = REASONING_MODEL_PREFIXES.some((p) => id.startsWith(p));
  const isClaude = CLAUDE_MODEL_PREFIXES.some((p) => id.startsWith(p));
  return {
    id,
    name: id,
    // pi-coding-agent's registry schema doesn't know about a "github-copilot" API.
    // We use OpenAI-compatible responses API, while keeping the provider id as
    // "github-copilot" (pi-ai uses that to attach Copilot-specific headers).
    api: "openai-responses",
    reasoning: isReasoning,
    input: ["text", "image"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: isClaude ? CLAUDE_CONTEXT_WINDOW : DEFAULT_CONTEXT_WINDOW,
    maxTokens: DEFAULT_MAX_TOKENS,
  };
}
