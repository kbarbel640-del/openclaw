// Defaults for agent metadata when upstream does not supply them.
// Model id uses pi-ai's built-in Anthropic catalog.
export const DEFAULT_PROVIDER = "anthropic";
export const DEFAULT_MODEL = "claude-opus-4-5";
// Context window: Opus 4.5 supports ~200k tokens (per pi-ai models.generated.ts).
export const DEFAULT_CONTEXT_TOKENS = 200_000;

// Default fallback chain when primary model hits rate limits, quota exhaustion,
// or billing errors. Falls back to progressively cheaper models.
export const DEFAULT_MODEL_FALLBACKS = [
  "anthropic/claude-sonnet-4-5",
  "anthropic/claude-sonnet-4-20250514",
  "anthropic/claude-3-5-haiku-latest",
] as const;
