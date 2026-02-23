import type { OpenClawConfig } from "../../../config/config.js";
import type { MsgContext } from "../../templating.js";

export type RoutingResult = {
  /** Strategy-specific tier label (e.g., "fast", "standard", "deep", or "primary" for passthrough). */
  tier: string;
  provider: string;
  model: string;
  /** Time spent in the strategy's route() call. */
  latencyMs: number;
  /** Why this model was chosen (e.g., "classifier", "passthrough", "fallback:timeout"). */
  reason: string;
  /** Classifier reasoning detail (e.g., "simple greeting"). */
  detail?: string;
};

/**
 * A model routing strategy determines which model should handle a given message.
 * Strategies are registered by name and selected via `agents.defaults.model.routing.strategy`.
 */
export interface ModelRoutingStrategy {
  readonly name: string;
  route(params: {
    ctx: MsgContext;
    config: OpenClawConfig;
    /** Strategy-specific options from `agents.defaults.model.routing.options`. */
    options: Record<string, unknown>;
    /** The primary model that would be used without routing. */
    primaryProvider: string;
    primaryModel: string;
    /** Recent conversation context for classifier awareness (pre-formatted string). */
    recentContext?: string;
  }): Promise<RoutingResult>;
}
