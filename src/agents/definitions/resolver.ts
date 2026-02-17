/**
 * Agent definition resolver.
 *
 * Bridges markdown-defined agent types into the existing
 * OpenClaw agent config and system prompt system.
 */

import os from "node:os";
import path from "node:path";
import type { OpenClawConfig } from "../../config/config.js";
import { resolveStateDir } from "../../config/paths.js";
import type { AgentConfig } from "../../config/types.agents.js";
import { resolveAgentDir } from "../agent-scope.js";
import { loadAgentDefinitions, loadAgentDefinitionsFromDir } from "./loader.js";
import type { AgentDefinition } from "./types.js";

/** Cache for loaded definitions keyed by agentDir. */
const definitionCache = new Map<string, AgentDefinition[]>();

/**
 * Load and cache agent definitions for a given agent.
 */
export function resolveAgentDefinitions(cfg: OpenClawConfig, agentId: string): AgentDefinition[] {
  const agentDir = resolveAgentDir(cfg, agentId);
  const cached = definitionCache.get(agentDir);
  if (cached) {
    return cached;
  }

  const stateDir = resolveStateDir(process.env, os.homedir);
  const result = loadAgentDefinitions({ stateDir, agentDir });

  if (result.errors.length > 0) {
    for (const err of result.errors) {
      console.warn(`Agent definition error in ${err.filePath}: ${err.error}`);
    }
  }

  definitionCache.set(agentDir, result.definitions);
  return result.definitions;
}

/**
 * List all globally available agent definitions (from ~/.openclaw/definitions).
 * Used for discovery of agents that are not explicitly configured in openclaw.json.
 */
export function listGlobalAgentDefinitions(): AgentDefinition[] {
  const stateDir = resolveStateDir(process.env, os.homedir);
  const globalDir = path.join(stateDir, "definitions");
  // We don't cache global-only lookups strictly, or we rely on fs speed.
  // Since this is for discovery/listing, freshness > cache.
  const result = loadAgentDefinitionsFromDir(globalDir);
  return result.definitions;
}

/**
 * Look up a specific agent definition by id.
 */
export function findAgentDefinition(
  cfg: OpenClawConfig,
  agentId: string,
  definitionId: string,
): AgentDefinition | undefined {
  const definitions = resolveAgentDefinitions(cfg, agentId);
  return definitions.find((d) => d.id === definitionId);
}

/**
 * List all available agent definition ids for an agent.
 */
export function listAgentDefinitionIds(cfg: OpenClawConfig, agentId: string): string[] {
  return resolveAgentDefinitions(cfg, agentId).map((d) => d.id);
}

/**
 * Convert an AgentDefinition into an AgentConfig overlay.
 *
 * This produces a partial AgentConfig that can be merged with the
 * existing config-based agent entry, with the definition taking
 * lower priority (config always wins).
 */
export function definitionToAgentConfig(definition: AgentDefinition): Partial<AgentConfig> {
  const config: Partial<AgentConfig> = {
    name: definition.name,
    role: definition.role,
  };

  if (definition.model) {
    config.model = definition.model;
  }
  if (definition.capabilities) {
    config.capabilities = definition.capabilities;
  }
  if (definition.expertise) {
    config.expertise = definition.expertise;
  }
  if (definition.skills) {
    config.skills = definition.skills;
  }
  if (definition.tools && definition.tools.length > 0) {
    config.tools = {
      allow: definition.tools,
    };
  }

  return config;
}

/**
 * Build a system prompt prefix from an agent definition.
 *
 * Returns the definition's markdown body (system prompt) or undefined
 * if the definition has no body content.
 */
export function resolveDefinitionSystemPrompt(definition: AgentDefinition): string | undefined {
  if (!definition.systemPrompt) {
    return undefined;
  }
  return definition.systemPrompt;
}

/**
 * Clear the definition cache (for testing or reload).
 */
export function clearAgentDefinitionCache(): void {
  definitionCache.clear();
}
