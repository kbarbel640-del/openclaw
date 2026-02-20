/** Per-engine settings for the Dolt bounded context engine. */
export type DoltContextEngineSettings = {
  /** Provider for the summarizer model (e.g. "anthropic"). Falls back to the system default. */
  summarizerProvider?: string;
  /** Model id for the summarizer (e.g. "claude-sonnet-4-5-20241022"). Falls back to the system default. */
  summarizerModel?: string;
};

export type ContextEnginesConfig = {
  dolt?: DoltContextEngineSettings;
};
