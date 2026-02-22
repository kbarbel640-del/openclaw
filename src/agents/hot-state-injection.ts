import type { HotState } from "./hot-state.js";
import { enforceHotStateTokenCap } from "./hot-state.js";

/**
 * Hot State is a small, structured JSON blob that should be included on every turn.
 * This helper appends capped hot state JSON to any existing extra system prompt.
 */
export function buildExtraSystemPromptWithHotState(params: {
  extraSystemPrompt?: string;
  hotState: HotState;
  /** Max tokens for hot state JSON. Defaults to 1000 per perf spec. */
  maxHotStateTokens?: number;
}): {
  extraSystemPrompt: string;
  capped: ReturnType<typeof enforceHotStateTokenCap>;
} {
  const capped = enforceHotStateTokenCap({
    hotState: params.hotState,
    maxTokens: params.maxHotStateTokens ?? 1000,
  });

  const extraSystemPrompt = [params.extraSystemPrompt, capped.json]
    .filter((s) => typeof s === "string" && s.trim().length > 0)
    .join("\n\n");

  return { extraSystemPrompt, capped };
}
