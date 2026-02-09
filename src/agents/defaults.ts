// Defaults for agent metadata when upstream does not supply them.
// Model id uses pi-ai's built-in Anthropic catalog.
export const DEFAULT_PROVIDER = "anthropic";
export const DEFAULT_MODEL = "claude-opus-4-6";
// Fallback used when model metadata is unavailable.
// Must stay in sync with DEFAULT_MODEL — currently claude-opus-4-6 (1M context).
export const DEFAULT_CONTEXT_TOKENS = 1_000_000;
