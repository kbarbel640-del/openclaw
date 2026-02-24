import type { OpenClawConfig } from "../../config/config.js";
import { resolveAgentModelFallbackValues } from "../../config/model-input.js";
import { resolveAgentModelFallbacksOverride } from "../agent-scope.js";

/**
 * Whether *model* fallback is configured for a given agent.
 *
 * Important: agent-level model config can override (or disable) global fallbacks.
 * We treat an explicit empty array override as "no fallbacks".
 */
export function isModelFallbackConfiguredForAgent(cfg: OpenClawConfig, agentId: string): boolean {
  const override = resolveAgentModelFallbacksOverride(cfg, agentId);
  const effective = override ?? resolveAgentModelFallbackValues(cfg.agents?.defaults?.model);
  return effective.length > 0;
}
