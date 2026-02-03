import type { GatewayBrowserClient } from "../gateway";
import type { ConfigSchemaResponse, ConfigSnapshot, ConfigUiHints } from "../types";
import {
  cloneConfigObject,
  removePathValue,
  serializeConfigForm,
  setPathValue,
} from "./config/form-utils";

export type ConfigState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  applySessionKey: string;
  configLoading: boolean;
  configRaw: string;
  configRawOriginal: string;
  configValid: boolean | null;
  configIssues: unknown[];
  configSaving: boolean;
  configApplying: boolean;
  updateRunning: boolean;
  configSnapshot: ConfigSnapshot | null;
  configSchema: unknown | null;
  configSchemaVersion: string | null;
  configSchemaLoading: boolean;
  configUiHints: ConfigUiHints;
  configForm: Record<string, unknown> | null;
  configFormOriginal: Record<string, unknown> | null;
  configFormDirty: boolean;
  configFormMode: "form" | "raw";
  configSearchQuery: string;
  configActiveSection: string | null;
  configActiveSubsection: string | null;
  lastError: string | null;
};

export async function loadConfig(state: ConfigState) {
  if (!state.client || !state.connected) return;
  state.configLoading = true;
  state.lastError = null;
  try {
    const res = (await state.client.request("config.get", {})) as ConfigSnapshot;
    applyConfigSnapshot(state, res);
  } catch (err) {
    state.lastError = String(err);
  } finally {
    state.configLoading = false;
  }
}

// Local storage key for persisted schema cache
const SCHEMA_CACHE_KEY = "openclaw:config-schema-cache";

type PersistedSchemaCache = {
  schema: unknown;
  uiHints: ConfigUiHints;
  version: string;
  generatedAt: string;
  cachedAt: number;
};

/**
 * Load schema from localStorage if available.
 */
function loadPersistedSchemaCache(): PersistedSchemaCache | null {
  try {
    const raw = localStorage.getItem(SCHEMA_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedSchemaCache;
    // Validate shape
    if (!parsed.version || !parsed.schema) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Save schema to localStorage for persistence across sessions.
 */
function savePersistedSchemaCache(cache: PersistedSchemaCache) {
  try {
    localStorage.setItem(SCHEMA_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage might be unavailable or full
  }
}

/**
 * Load config schema with caching support.
 *
 * Uses ifNoneMatch to avoid re-fetching when the cached version matches.
 * The schema is also persisted to localStorage for cross-session caching.
 *
 * @param forceRefresh - If true, bypasses cache and fetches fresh schema
 */
export async function loadConfigSchema(state: ConfigState, forceRefresh = false) {
  if (!state.client || !state.connected) return;
  if (state.configSchemaLoading) return;

  // Try to load from persistent cache first (for fast initial load)
  if (!state.configSchema && !forceRefresh) {
    const persisted = loadPersistedSchemaCache();
    if (persisted) {
      state.configSchema = persisted.schema;
      state.configUiHints = persisted.uiHints;
      state.configSchemaVersion = persisted.version;
    }
  }

  state.configSchemaLoading = true;
  try {
    // Use ifNoneMatch for 304-style caching when we have a cached version
    const params: { ifNoneMatch?: string; full?: boolean } = {};
    if (state.configSchemaVersion && !forceRefresh) {
      params.ifNoneMatch = state.configSchemaVersion;
    }
    // Always request full schema for UI (we need everything for form rendering)
    params.full = true;

    const res = (await state.client.request("config.schema", params)) as
      | ConfigSchemaResponse
      | { notModified: true; version: string };

    // Handle 304-style "not modified" response
    if ("notModified" in res && res.notModified) {
      // Schema hasn't changed, keep using cached version
      return;
    }

    // Apply new schema
    const schemaRes = res as ConfigSchemaResponse;
    applyConfigSchema(state, schemaRes);

    // Persist to localStorage for cross-session caching
    savePersistedSchemaCache({
      schema: schemaRes.schema,
      uiHints: schemaRes.uiHints ?? {},
      version: schemaRes.version,
      generatedAt: schemaRes.generatedAt,
      cachedAt: Date.now(),
    });
  } catch (err) {
    state.lastError = String(err);
  } finally {
    state.configSchemaLoading = false;
  }
}

/**
 * Clear the persisted schema cache.
 * Call this when you need to force a fresh schema fetch (e.g., after plugin changes).
 */
export function clearSchemaCache(state: ConfigState) {
  try {
    localStorage.removeItem(SCHEMA_CACHE_KEY);
  } catch {
    // ignore
  }
  state.configSchema = null;
  state.configSchemaVersion = null;
  state.configUiHints = {};
}

export function applyConfigSchema(state: ConfigState, res: ConfigSchemaResponse) {
  state.configSchema = res.schema ?? null;
  state.configUiHints = res.uiHints ?? {};
  state.configSchemaVersion = res.version ?? null;
}

export function applyConfigSnapshot(state: ConfigState, snapshot: ConfigSnapshot) {
  state.configSnapshot = snapshot;
  const rawFromSnapshot =
    typeof snapshot.raw === "string"
      ? snapshot.raw
      : snapshot.config && typeof snapshot.config === "object"
        ? serializeConfigForm(snapshot.config as Record<string, unknown>)
        : state.configRaw;
  if (!state.configFormDirty || state.configFormMode === "raw") {
    state.configRaw = rawFromSnapshot;
  } else if (state.configForm) {
    state.configRaw = serializeConfigForm(state.configForm);
  } else {
    state.configRaw = rawFromSnapshot;
  }
  state.configValid = typeof snapshot.valid === "boolean" ? snapshot.valid : null;
  state.configIssues = Array.isArray(snapshot.issues) ? snapshot.issues : [];

  if (!state.configFormDirty) {
    state.configForm = cloneConfigObject(snapshot.config ?? {});
    state.configFormOriginal = cloneConfigObject(snapshot.config ?? {});
    state.configRawOriginal = rawFromSnapshot;
  }
}

export async function saveConfig(state: ConfigState) {
  if (!state.client || !state.connected) return;
  state.configSaving = true;
  state.lastError = null;
  try {
    const raw =
      state.configFormMode === "form" && state.configForm
        ? serializeConfigForm(state.configForm)
        : state.configRaw;
    const baseHash = state.configSnapshot?.hash;
    if (!baseHash) {
      state.lastError = "Config hash missing; reload and retry.";
      return;
    }
    await state.client.request("config.set", { raw, baseHash });
    state.configFormDirty = false;
    await loadConfig(state);
  } catch (err) {
    state.lastError = String(err);
  } finally {
    state.configSaving = false;
  }
}

export async function applyConfig(state: ConfigState) {
  if (!state.client || !state.connected) return;
  state.configApplying = true;
  state.lastError = null;
  try {
    const raw =
      state.configFormMode === "form" && state.configForm
        ? serializeConfigForm(state.configForm)
        : state.configRaw;
    const baseHash = state.configSnapshot?.hash;
    if (!baseHash) {
      state.lastError = "Config hash missing; reload and retry.";
      return;
    }
    await state.client.request("config.apply", {
      raw,
      baseHash,
      sessionKey: state.applySessionKey,
    });
    state.configFormDirty = false;
    await loadConfig(state);
  } catch (err) {
    state.lastError = String(err);
  } finally {
    state.configApplying = false;
  }
}

export async function runUpdate(state: ConfigState) {
  if (!state.client || !state.connected) return;
  state.updateRunning = true;
  state.lastError = null;
  try {
    await state.client.request("update.run", {
      sessionKey: state.applySessionKey,
    });
  } catch (err) {
    state.lastError = String(err);
  } finally {
    state.updateRunning = false;
  }
}

export function updateConfigFormValue(
  state: ConfigState,
  path: Array<string | number>,
  value: unknown,
) {
  const base = cloneConfigObject(state.configForm ?? state.configSnapshot?.config ?? {});
  setPathValue(base, path, value);
  state.configForm = base;
  state.configFormDirty = true;
  if (state.configFormMode === "form") {
    state.configRaw = serializeConfigForm(base);
  }
}

export function removeConfigFormValue(state: ConfigState, path: Array<string | number>) {
  const base = cloneConfigObject(state.configForm ?? state.configSnapshot?.config ?? {});
  removePathValue(base, path);
  state.configForm = base;
  state.configFormDirty = true;
  if (state.configFormMode === "form") {
    state.configRaw = serializeConfigForm(base);
  }
}
