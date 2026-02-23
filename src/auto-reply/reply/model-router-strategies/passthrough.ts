import type { ModelRoutingStrategy, RoutingResult } from "./types.js";

/**
 * Passthrough strategy: always returns the primary model unchanged.
 * Use this as an explicit "no routing" option, or as the default.
 */
export const passthroughStrategy: ModelRoutingStrategy = {
  name: "passthrough",
  async route(params): Promise<RoutingResult> {
    return {
      tier: "primary",
      provider: params.primaryProvider,
      model: params.primaryModel,
      latencyMs: 0,
      reason: "passthrough",
    };
  },
};
