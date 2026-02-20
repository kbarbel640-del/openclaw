import type { OpenClawConfig } from "../config/config.js";
import type { ContextEngine } from "./types.js";
import { defaultSlotIdForKey } from "../plugins/slots.js";
import { normalizeAgentId } from "../routing/session-key.js";

/**
 * A factory that creates a ContextEngine instance.
 * Supports async creation for engines that need DB connections etc.
 */
export type ContextEngineFactory = () => ContextEngine | Promise<ContextEngine>;

// ---------------------------------------------------------------------------
// Registry (module-level singleton)
// ---------------------------------------------------------------------------

const _engines = new Map<string, ContextEngineFactory>();

/**
 * Register a context engine implementation under the given id.
 */
export function registerContextEngine(id: string, factory: ContextEngineFactory): void {
  _engines.set(id, factory);
}

/**
 * Return the factory for a registered engine, or undefined.
 */
export function getContextEngineFactory(id: string): ContextEngineFactory | undefined {
  return _engines.get(id);
}

/**
 * List all registered engine ids.
 */
export function listContextEngineIds(): string[] {
  return [..._engines.keys()];
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

export type ResolveContextEngineOptions = {
  agentId?: string;
};

/**
 * Resolve which ContextEngine to use for the active run.
 *
 * Resolution order:
 *   1. `agents.list[].contextEngine` for the selected agent id
 *   2. `agents.defaults.contextEngine`
 *   3. `plugins.slots.contextEngine`
 *   4. Default slot value ("legacy")
 *
 * Throws if the resolved engine id has no registered factory.
 */
export async function resolveContextEngine(
  config?: OpenClawConfig,
  options?: ResolveContextEngineOptions,
): Promise<ContextEngine> {
  const engineId = resolveContextEngineId(config, options);

  const factory = _engines.get(engineId);
  if (!factory) {
    throw new Error(
      `Context engine "${engineId}" is not registered. ` +
        `Available engines: ${listContextEngineIds().join(", ") || "(none)"}`,
    );
  }

  return factory();
}

function resolveContextEngineId(
  config?: OpenClawConfig,
  options?: ResolveContextEngineOptions,
): string {
  return (
    resolvePerAgentContextEngineId(config, options?.agentId) ??
    resolveConfiguredContextEngineId(config?.agents?.defaults?.contextEngine) ??
    resolveConfiguredContextEngineId(config?.plugins?.slots?.contextEngine) ??
    defaultSlotIdForKey("contextEngine")
  );
}

function resolvePerAgentContextEngineId(
  config: OpenClawConfig | undefined,
  agentId: string | undefined,
): string | undefined {
  if (!config || !agentId) {
    return undefined;
  }
  const normalizedAgentId = normalizeAgentId(agentId);
  const agentEntry = config.agents?.list?.find(
    (entry) => normalizeAgentId(entry.id) === normalizedAgentId,
  );
  return resolveConfiguredContextEngineId(agentEntry?.contextEngine);
}

function resolveConfiguredContextEngineId(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}
