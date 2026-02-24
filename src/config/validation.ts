import path from "node:path";
import { resolveAgentWorkspaceDir, resolveDefaultAgentId } from "../agents/agent-scope.js";
import { CHANNEL_IDS, normalizeChatChannelId } from "../channels/registry.js";
import {
  normalizePluginsConfig,
  resolveEffectiveEnableState,
  resolveMemorySlotDecision,
} from "../plugins/config-state.js";
import { loadPluginManifestRegistry } from "../plugins/manifest-registry.js";
import { validateJsonSchemaValue } from "../plugins/schema-validator.js";
import {
  hasAvatarUriScheme,
  isAvatarDataUrl,
  isAvatarHttpUrl,
  isPathWithinRoot,
  isWindowsAbsolutePath,
} from "../shared/avatar-policy.js";
import { isRecord } from "../utils.js";
import { findDuplicateAgentDirs, formatDuplicateAgentDirError } from "./agent-dirs.js";
import { applyAgentDefaults, applyModelDefaults, applySessionDefaults } from "./defaults.js";
import { findLegacyConfigIssues } from "./legacy.js";
import type { OpenClawConfig, ConfigValidationIssue } from "./types.js";
import { OpenClawSchema } from "./zod-schema.js";

function isWorkspaceAvatarPath(value: string, workspaceDir: string): boolean {
  const workspaceRoot = path.resolve(workspaceDir);
  const resolved = path.resolve(workspaceRoot, value);
  return isPathWithinRoot(workspaceRoot, resolved);
}

function validateIdentityAvatar(config: OpenClawConfig): ConfigValidationIssue[] {
  const agents = config.agents?.list;
  if (!Array.isArray(agents) || agents.length === 0) {
    return [];
  }
  const issues: ConfigValidationIssue[] = [];
  for (const [index, entry] of agents.entries()) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const avatarRaw = entry.identity?.avatar;
    if (typeof avatarRaw !== "string") {
      continue;
    }
    const avatar = avatarRaw.trim();
    if (!avatar) {
      continue;
    }
    if (isAvatarDataUrl(avatar) || isAvatarHttpUrl(avatar)) {
      continue;
    }
    if (avatar.startsWith("~")) {
      issues.push({
        path: `agents.list.${index}.identity.avatar`,
        message: "identity.avatar must be a workspace-relative path, http(s) URL, or data URI.",
      });
      continue;
    }
    const hasScheme = hasAvatarUriScheme(avatar);
    if (hasScheme && !isWindowsAbsolutePath(avatar)) {
      issues.push({
        path: `agents.list.${index}.identity.avatar`,
        message: "identity.avatar must be a workspace-relative path, http(s) URL, or data URI.",
      });
      continue;
    }
    const workspaceDir = resolveAgentWorkspaceDir(
      config,
      entry.id ?? resolveDefaultAgentId(config),
    );
    if (!isWorkspaceAvatarPath(avatar, workspaceDir)) {
      issues.push({
        path: `agents.list.${index}.identity.avatar`,
        message: "identity.avatar must stay within the agent workspace.",
      });
    }
  }
  return issues;
}

function parseFiniteNumericString(value: unknown): number | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Older onboarding/config editor flows can persist model numeric fields as strings.
 * Normalize these known fields before schema validation so local model setup does
 * not fail with a generic "invalid config".
 */
function normalizeModelDefinitionNumericStrings(raw: unknown): unknown {
  if (!isRecord(raw)) {
    return raw;
  }
  const models = raw.models;
  if (!isRecord(models)) {
    return raw;
  }
  const providers = models.providers;
  if (!isRecord(providers)) {
    return raw;
  }

  let providersChanged = false;
  const nextProviders: Record<string, unknown> = { ...providers };

  for (const [providerId, providerValue] of Object.entries(providers)) {
    if (!isRecord(providerValue)) {
      continue;
    }
    const modelEntries = providerValue.models;
    if (!Array.isArray(modelEntries)) {
      continue;
    }

    let entryChanged = false;
    const nextModelEntries = modelEntries.map((entry) => {
      if (!isRecord(entry)) {
        return entry;
      }

      let modelChanged = false;
      let nextEntry: Record<string, unknown> = entry;
      for (const key of ["contextWindow", "maxTokens"] as const) {
        const parsed = parseFiniteNumericString(nextEntry[key]);
        if (parsed === undefined || nextEntry[key] === parsed) {
          continue;
        }
        if (!modelChanged) {
          nextEntry = { ...nextEntry };
          modelChanged = true;
        }
        nextEntry[key] = parsed;
      }

      const costValue = nextEntry.cost;
      if (isRecord(costValue)) {
        let costChanged = false;
        let nextCost: Record<string, unknown> = costValue;
        for (const key of ["input", "output", "cacheRead", "cacheWrite"] as const) {
          const parsed = parseFiniteNumericString(nextCost[key]);
          if (parsed === undefined || nextCost[key] === parsed) {
            continue;
          }
          if (!costChanged) {
            nextCost = { ...nextCost };
            costChanged = true;
          }
          nextCost[key] = parsed;
        }
        if (costChanged) {
          if (!modelChanged) {
            nextEntry = { ...nextEntry };
            modelChanged = true;
          }
          nextEntry.cost = nextCost;
        }
      }

      if (modelChanged) {
        entryChanged = true;
      }
      return nextEntry;
    });

    if (!entryChanged) {
      continue;
    }
    nextProviders[providerId] = { ...providerValue, models: nextModelEntries };
    providersChanged = true;
  }

  if (!providersChanged) {
    return raw;
  }
  return {
    ...raw,
    models: {
      ...models,
      providers: nextProviders,
    },
  };
}

/**
 * Validates config without applying runtime defaults.
 * Use this when you need the raw validated config (e.g., for writing back to file).
 */
export function validateConfigObjectRaw(
  raw: unknown,
): { ok: true; config: OpenClawConfig } | { ok: false; issues: ConfigValidationIssue[] } {
  const normalized = normalizeModelDefinitionNumericStrings(raw);
  const legacyIssues = findLegacyConfigIssues(normalized);
  if (legacyIssues.length > 0) {
    return {
      ok: false,
      issues: legacyIssues.map((iss) => ({
        path: iss.path,
        message: iss.message,
      })),
    };
  }
  const validated = OpenClawSchema.safeParse(normalized);
  if (!validated.success) {
    return {
      ok: false,
      issues: validated.error.issues.map((iss) => ({
        path: iss.path.join("."),
        message: iss.message,
      })),
    };
  }
  const duplicates = findDuplicateAgentDirs(validated.data as OpenClawConfig);
  if (duplicates.length > 0) {
    return {
      ok: false,
      issues: [
        {
          path: "agents.list",
          message: formatDuplicateAgentDirError(duplicates),
        },
      ],
    };
  }
  const avatarIssues = validateIdentityAvatar(validated.data as OpenClawConfig);
  if (avatarIssues.length > 0) {
    return { ok: false, issues: avatarIssues };
  }
  return {
    ok: true,
    config: validated.data as OpenClawConfig,
  };
}

export function validateConfigObject(
  raw: unknown,
): { ok: true; config: OpenClawConfig } | { ok: false; issues: ConfigValidationIssue[] } {
  const result = validateConfigObjectRaw(raw);
  if (!result.ok) {
    return result;
  }
  return {
    ok: true,
    config: applyModelDefaults(applyAgentDefaults(applySessionDefaults(result.config))),
  };
}

export function validateConfigObjectWithPlugins(raw: unknown):
  | {
      ok: true;
      config: OpenClawConfig;
      warnings: ConfigValidationIssue[];
    }
  | {
      ok: false;
      issues: ConfigValidationIssue[];
      warnings: ConfigValidationIssue[];
    } {
  return validateConfigObjectWithPluginsBase(raw, { applyDefaults: true });
}

export function validateConfigObjectRawWithPlugins(raw: unknown):
  | {
      ok: true;
      config: OpenClawConfig;
      warnings: ConfigValidationIssue[];
    }
  | {
      ok: false;
      issues: ConfigValidationIssue[];
      warnings: ConfigValidationIssue[];
    } {
  return validateConfigObjectWithPluginsBase(raw, { applyDefaults: false });
}

function validateConfigObjectWithPluginsBase(
  raw: unknown,
  opts: { applyDefaults: boolean },
):
  | {
      ok: true;
      config: OpenClawConfig;
      warnings: ConfigValidationIssue[];
    }
  | {
      ok: false;
      issues: ConfigValidationIssue[];
      warnings: ConfigValidationIssue[];
    } {
  const base = opts.applyDefaults ? validateConfigObject(raw) : validateConfigObjectRaw(raw);
  if (!base.ok) {
    return { ok: false, issues: base.issues, warnings: [] };
  }

  const config = base.config;
  const issues: ConfigValidationIssue[] = [];
  const warnings: ConfigValidationIssue[] = [];
  const hasExplicitPluginsConfig =
    isRecord(raw) && Object.prototype.hasOwnProperty.call(raw, "plugins");

  type RegistryInfo = {
    registry: ReturnType<typeof loadPluginManifestRegistry>;
    knownIds: Set<string>;
    normalizedPlugins: ReturnType<typeof normalizePluginsConfig>;
  };

  let registryInfo: RegistryInfo | null = null;

  const ensureRegistry = (): RegistryInfo => {
    if (registryInfo) {
      return registryInfo;
    }

    const workspaceDir = resolveAgentWorkspaceDir(config, resolveDefaultAgentId(config));
    const registry = loadPluginManifestRegistry({
      config,
      workspaceDir: workspaceDir ?? undefined,
    });
    const knownIds = new Set(registry.plugins.map((record) => record.id));
    const normalizedPlugins = normalizePluginsConfig(config.plugins);

    for (const diag of registry.diagnostics) {
      let path = diag.pluginId ? `plugins.entries.${diag.pluginId}` : "plugins";
      if (!diag.pluginId && diag.message.includes("plugin path not found")) {
        path = "plugins.load.paths";
      }
      const pluginLabel = diag.pluginId ? `plugin ${diag.pluginId}` : "plugin";
      const message = `${pluginLabel}: ${diag.message}`;
      if (diag.level === "error") {
        issues.push({ path, message });
      } else {
        warnings.push({ path, message });
      }
    }

    registryInfo = { registry, knownIds, normalizedPlugins };
    return registryInfo;
  };

  const allowedChannels = new Set<string>(["defaults", "modelByChannel", ...CHANNEL_IDS]);

  if (config.channels && isRecord(config.channels)) {
    for (const key of Object.keys(config.channels)) {
      const trimmed = key.trim();
      if (!trimmed) {
        continue;
      }
      if (!allowedChannels.has(trimmed)) {
        const { registry } = ensureRegistry();
        for (const record of registry.plugins) {
          for (const channelId of record.channels) {
            allowedChannels.add(channelId);
          }
        }
      }
      if (!allowedChannels.has(trimmed)) {
        issues.push({
          path: `channels.${trimmed}`,
          message: `unknown channel id: ${trimmed}`,
        });
      }
    }
  }

  const heartbeatChannelIds = new Set<string>();
  for (const channelId of CHANNEL_IDS) {
    heartbeatChannelIds.add(channelId.toLowerCase());
  }

  const validateHeartbeatTarget = (target: string | undefined, path: string) => {
    if (typeof target !== "string") {
      return;
    }
    const trimmed = target.trim();
    if (!trimmed) {
      issues.push({ path, message: "heartbeat target must not be empty" });
      return;
    }
    const normalized = trimmed.toLowerCase();
    if (normalized === "last" || normalized === "none") {
      return;
    }
    if (normalizeChatChannelId(trimmed)) {
      return;
    }
    if (!heartbeatChannelIds.has(normalized)) {
      const { registry } = ensureRegistry();
      for (const record of registry.plugins) {
        for (const channelId of record.channels) {
          const pluginChannel = channelId.trim();
          if (pluginChannel) {
            heartbeatChannelIds.add(pluginChannel.toLowerCase());
          }
        }
      }
    }
    if (heartbeatChannelIds.has(normalized)) {
      return;
    }
    issues.push({ path, message: `unknown heartbeat target: ${target}` });
  };

  validateHeartbeatTarget(
    config.agents?.defaults?.heartbeat?.target,
    "agents.defaults.heartbeat.target",
  );
  if (Array.isArray(config.agents?.list)) {
    for (const [index, entry] of config.agents.list.entries()) {
      validateHeartbeatTarget(entry?.heartbeat?.target, `agents.list.${index}.heartbeat.target`);
    }
  }

  if (!hasExplicitPluginsConfig) {
    if (issues.length > 0) {
      return { ok: false, issues, warnings };
    }
    return { ok: true, config, warnings };
  }

  const { registry, knownIds, normalizedPlugins } = ensureRegistry();

  const pluginsConfig = config.plugins;

  const entries = pluginsConfig?.entries;
  if (entries && isRecord(entries)) {
    for (const pluginId of Object.keys(entries)) {
      if (!knownIds.has(pluginId)) {
        issues.push({
          path: `plugins.entries.${pluginId}`,
          message: `plugin not found: ${pluginId}`,
        });
      }
    }
  }

  const allow = pluginsConfig?.allow ?? [];
  for (const pluginId of allow) {
    if (typeof pluginId !== "string" || !pluginId.trim()) {
      continue;
    }
    if (!knownIds.has(pluginId)) {
      issues.push({
        path: "plugins.allow",
        message: `plugin not found: ${pluginId}`,
      });
    }
  }

  const deny = pluginsConfig?.deny ?? [];
  for (const pluginId of deny) {
    if (typeof pluginId !== "string" || !pluginId.trim()) {
      continue;
    }
    if (!knownIds.has(pluginId)) {
      issues.push({
        path: "plugins.deny",
        message: `plugin not found: ${pluginId}`,
      });
    }
  }

  const memorySlot = normalizedPlugins.slots.memory;
  if (typeof memorySlot === "string" && memorySlot.trim() && !knownIds.has(memorySlot)) {
    issues.push({
      path: "plugins.slots.memory",
      message: `plugin not found: ${memorySlot}`,
    });
  }

  let selectedMemoryPluginId: string | null = null;
  const seenPlugins = new Set<string>();
  for (const record of registry.plugins) {
    const pluginId = record.id;
    if (seenPlugins.has(pluginId)) {
      continue;
    }
    seenPlugins.add(pluginId);
    const entry = normalizedPlugins.entries[pluginId];
    const entryHasConfig = Boolean(entry?.config);

    const enableState = resolveEffectiveEnableState({
      id: pluginId,
      origin: record.origin,
      config: normalizedPlugins,
      rootConfig: config,
    });
    let enabled = enableState.enabled;
    let reason = enableState.reason;

    if (enabled) {
      const memoryDecision = resolveMemorySlotDecision({
        id: pluginId,
        kind: record.kind,
        slot: memorySlot,
        selectedId: selectedMemoryPluginId,
      });
      if (!memoryDecision.enabled) {
        enabled = false;
        reason = memoryDecision.reason;
      }
      if (memoryDecision.selected && record.kind === "memory") {
        selectedMemoryPluginId = pluginId;
      }
    }

    const shouldValidate = enabled || entryHasConfig;
    if (shouldValidate) {
      if (record.configSchema) {
        const res = validateJsonSchemaValue({
          schema: record.configSchema,
          cacheKey: record.schemaCacheKey ?? record.manifestPath ?? pluginId,
          value: entry?.config ?? {},
        });
        if (!res.ok) {
          for (const error of res.errors) {
            issues.push({
              path: `plugins.entries.${pluginId}.config`,
              message: `invalid config: ${error}`,
            });
          }
        }
      } else {
        issues.push({
          path: `plugins.entries.${pluginId}`,
          message: `plugin schema missing for ${pluginId}`,
        });
      }
    }

    if (!enabled && entryHasConfig) {
      warnings.push({
        path: `plugins.entries.${pluginId}`,
        message: `plugin disabled (${reason ?? "disabled"}) but config is present`,
      });
    }
  }

  if (issues.length > 0) {
    return { ok: false, issues, warnings };
  }

  return { ok: true, config, warnings };
}
