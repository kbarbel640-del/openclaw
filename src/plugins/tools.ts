import type { AnyAgentTool } from "../agents/tools/common.js";
import type { OpenClawPluginToolContext } from "./types.js";
import { normalizeToolName } from "../agents/tool-policy.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { applyTestPluginDefaults, normalizePluginsConfig } from "./config-state.js";
import { loadOpenClawPlugins } from "./loader.js";

const log = createSubsystemLogger("plugins");

type PluginToolMeta = {
  pluginId: string;
  optional: boolean;
};

const pluginToolMeta = new WeakMap<AnyAgentTool, PluginToolMeta>();

export function getPluginToolMeta(tool: AnyAgentTool): PluginToolMeta | undefined {
  return pluginToolMeta.get(tool);
}

function normalizeAllowlist(list?: string[]) {
  return new Set((list ?? []).map(normalizeToolName).filter(Boolean));
}

function isOptionalToolAllowed(params: {
  toolName: string;
  pluginId: string;
  allowlist: Set<string>;
}): boolean {
  if (params.allowlist.size === 0) {
    return false;
  }
  const toolName = normalizeToolName(params.toolName);
  if (params.allowlist.has(toolName)) {
    return true;
  }
  const pluginKey = normalizeToolName(params.pluginId);
  if (params.allowlist.has(pluginKey)) {
    return true;
  }
  return params.allowlist.has("group:plugins");
}

export function resolvePluginTools(params: {
  context: OpenClawPluginToolContext;
  existingToolNames?: Set<string>;
  existingTools?: AnyAgentTool[];
  toolAllowlist?: string[];
}): { tools: AnyAgentTool[]; overriddenNames: ReadonlySet<string> } {
  // Fast path: when plugins are effectively disabled, avoid discovery/jiti entirely.
  // This matters a lot for unit tests and for tool construction hot paths.
  const effectiveConfig = applyTestPluginDefaults(params.context.config ?? {}, process.env);
  const normalized = normalizePluginsConfig(effectiveConfig.plugins);
  if (!normalized.enabled) {
    return { tools: [], overriddenNames: new Set() };
  }
  const overriddenToolNames = new Set<string>();

  const registry = loadOpenClawPlugins({
    config: effectiveConfig,
    workspaceDir: params.context.workspaceDir,
    logger: {
      info: (msg) => log.info(msg),
      warn: (msg) => log.warn(msg),
      error: (msg) => log.error(msg),
      debug: (msg) => log.debug(msg),
    },
  });

  const tools: AnyAgentTool[] = [];
  const existing = params.existingToolNames ?? new Set<string>();
  const existingToolsByName = new Map<string, AnyAgentTool>();
  for (const tool of params.existingTools ?? []) {
    if (tool?.name && !existingToolsByName.has(tool.name)) {
      existingToolsByName.set(tool.name, tool);
    }
  }
  const existingNormalized = new Set(Array.from(existing, (tool) => normalizeToolName(tool)));
  const allowlist = normalizeAllowlist(params.toolAllowlist);
  const blockedPlugins = new Set<string>();

  for (const entry of registry.tools) {
    if (blockedPlugins.has(entry.pluginId)) {
      continue;
    }
    const pluginIdKey = normalizeToolName(entry.pluginId);
    if (existingNormalized.has(pluginIdKey)) {
      const message = `plugin id conflicts with core tool name (${entry.pluginId})`;
      log.error(message);
      registry.diagnostics.push({
        level: "error",
        pluginId: entry.pluginId,
        source: entry.source,
        message,
      });
      blockedPlugins.add(entry.pluginId);
      continue;
    }
    let resolved: AnyAgentTool | AnyAgentTool[] | null | undefined = null;
    try {
      const hintedOriginal =
        entry.override && entry.names.length === 1
          ? (existingToolsByName.get(entry.names[0] ?? "") ?? null)
          : undefined;
      resolved = entry.factory(params.context, hintedOriginal);
    } catch (err) {
      log.error(`plugin tool failed (${entry.pluginId}): ${String(err)}`);
      continue;
    }
    if (!resolved) {
      continue;
    }
    const listRaw = Array.isArray(resolved) ? resolved : [resolved];
    const list = entry.optional
      ? listRaw.filter((tool) =>
          isOptionalToolAllowed({
            toolName: tool.name,
            pluginId: entry.pluginId,
            allowlist,
          }),
        )
      : listRaw;
    if (list.length === 0) {
      continue;
    }
    const nameSet = new Set<string>();
    for (const tool of list) {
      if (nameSet.has(tool.name)) {
        const message = `plugin tool name conflict (${entry.pluginId}): ${tool.name}`;
        log.error(message);
        registry.diagnostics.push({
          level: "error",
          pluginId: entry.pluginId,
          source: entry.source,
          message,
        });
        continue;
      }
      if (existing.has(tool.name)) {
        if (entry.override) {
          overriddenToolNames.add(tool.name);
          existing.delete(tool.name);
          existingNormalized.delete(normalizeToolName(tool.name));
        } else {
          const message = `plugin tool name conflict (${entry.pluginId}): ${tool.name}`;
          log.error(message);
          registry.diagnostics.push({
            level: "error",
            pluginId: entry.pluginId,
            source: entry.source,
            message,
          });
          continue;
        }
      }
      nameSet.add(tool.name);
      existing.add(tool.name);
      existingToolsByName.set(tool.name, tool);
      pluginToolMeta.set(tool, {
        pluginId: entry.pluginId,
        optional: entry.optional,
      });
      tools.push(tool);
    }
  }

  return { tools, overriddenNames: overriddenToolNames };
}
