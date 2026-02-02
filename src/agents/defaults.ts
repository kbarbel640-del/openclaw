// Defaults for agent metadata when upstream does not supply them.
// Local-first: default to Ollama for local operation.
export const DEFAULT_PROVIDER = "ollama";
export const DEFAULT_MODEL = "llama3:chat";

// Context window default: conservative 8192 tokens for local models.
// Provider-specific context windows are set during discovery (see local-provider-discovery.ts).
// For cloud models, actual context windows come from the model registry.
export const DEFAULT_CONTEXT_TOKENS = 8192;
