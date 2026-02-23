import type { OpenClawConfig } from "../../config/config.js";
import type { AgentModelRoutingConfig } from "../../config/types.agent-defaults.js";
import type { MsgContext } from "../templating.js";
import type { ModelRoutingStrategy, RoutingResult } from "./model-router-strategies/types.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import { dynamicTieredStrategy } from "./model-router-strategies/dynamic-tiered.js";
import { passthroughStrategy } from "./model-router-strategies/passthrough.js";

const routingLog = createSubsystemLogger("auto-reply/routing");

export type { RoutingResult, ModelRoutingStrategy } from "./model-router-strategies/types.js";

// ---------------------------------------------------------------------------
// Strategy registry
// ---------------------------------------------------------------------------

const strategies = new Map<string, ModelRoutingStrategy>();

export function registerRoutingStrategy(strategy: ModelRoutingStrategy): void {
  strategies.set(strategy.name, strategy);
}

export function getRoutingStrategy(name: string): ModelRoutingStrategy | undefined {
  return strategies.get(name);
}

export function listRoutingStrategies(): string[] {
  return [...strategies.keys()];
}

// Register built-in strategies.
registerRoutingStrategy(passthroughStrategy);
registerRoutingStrategy(dynamicTieredStrategy);

// ---------------------------------------------------------------------------
// Config resolution
// ---------------------------------------------------------------------------

export function resolveRoutingConfig(cfg: OpenClawConfig): AgentModelRoutingConfig | null {
  const routing = cfg.agents?.defaults?.model?.routing;
  if (!routing?.strategy) {
    return null;
  }
  if (routing.strategy === "passthrough") {
    return null;
  }
  return routing;
}

// ---------------------------------------------------------------------------
// Core dispatcher
// ---------------------------------------------------------------------------

export async function routeModel(params: {
  ctx: MsgContext;
  config: OpenClawConfig;
  routing: AgentModelRoutingConfig;
  primaryProvider: string;
  primaryModel: string;
  recentContext?: string;
}): Promise<RoutingResult> {
  const { ctx, config, routing, primaryProvider, primaryModel, recentContext } = params;
  const strategy = strategies.get(routing.strategy);

  if (!strategy) {
    routingLog.warn(`unknown routing strategy "${routing.strategy}"; using primary model`);
    return {
      tier: "primary",
      provider: primaryProvider,
      model: primaryModel,
      latencyMs: 0,
      reason: `fallback:unknown-strategy:${routing.strategy}`,
    };
  }

  return strategy.route({
    ctx,
    config,
    options: routing.options ?? {},
    primaryProvider,
    primaryModel,
    recentContext,
  });
}
