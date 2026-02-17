import type { OpenClawConfig } from "../config/config.js";
import {
  ensureAuthProfileStore,
  getProfileCooldownRemainingMs,
  listProfilesForProvider,
} from "./auth-profiles.js";
import type { ModelCatalogEntry } from "./model-catalog.js";
import { isModelCoolingDown } from "./model-fallback.js";
import { normalizeProviderId, type ModelRef } from "./model-selection.js";

function isProfileTemporarilyUnavailable(
  store: ReturnType<typeof ensureAuthProfileStore>,
  profileId: string,
  now: number,
): boolean {
  const cooldownRemaining = getProfileCooldownRemainingMs(store, profileId);
  if (cooldownRemaining > 0) {
    return true;
  }
  const disabledUntil = store.usageStats?.[profileId]?.disabledUntil;
  return typeof disabledUntil === "number" && Number.isFinite(disabledUntil) && disabledUntil > now;
}

function isProviderOperational(params: {
  provider: string;
  cfg: OpenClawConfig;
  agentDir?: string;
  now: number;
  store: ReturnType<typeof ensureAuthProfileStore>;
}): boolean {
  const provider = normalizeProviderId(params.provider);
  const profileIds = listProfilesForProvider(params.store, provider);
  if (profileIds.length === 0) {
    // No auth profiles tracked here: don't hide the provider preemptively.
    // Env/static credentials may still be valid.
    return true;
  }
  return profileIds.some(
    (profileId) => !isProfileTemporarilyUnavailable(params.store, profileId, params.now),
  );
}

export function isModelOperational(params: {
  provider: string;
  model: string;
  cfg: OpenClawConfig;
  now?: number;
  agentDir?: string;
  store?: ReturnType<typeof ensureAuthProfileStore>;
}): boolean {
  const now = params.now ?? Date.now();
  const provider = normalizeProviderId(params.provider);
  const modelRef: ModelRef = { provider, model: params.model };
  if (isModelCoolingDown(modelRef, now)) {
    return false;
  }

  const store =
    params.store ??
    ensureAuthProfileStore(params.agentDir, {
      allowKeychainPrompt: false,
    });
  return isProviderOperational({
    provider,
    cfg: params.cfg,
    agentDir: params.agentDir,
    now,
    store,
  });
}

export function filterModelsByOperationalHealth(params: {
  models: ModelCatalogEntry[];
  cfg: OpenClawConfig;
  now?: number;
  agentDir?: string;
}): ModelCatalogEntry[] {
  const now = params.now ?? Date.now();
  const store = ensureAuthProfileStore(params.agentDir, {
    allowKeychainPrompt: false,
  });
  const providerAvailability = new Map<string, boolean>();

  return params.models.filter((entry) => {
    const provider = normalizeProviderId(entry.provider);
    if (isModelCoolingDown({ provider, model: entry.id }, now)) {
      return false;
    }
    const cached = providerAvailability.get(provider);
    if (cached !== undefined) {
      return cached;
    }
    const available = isProviderOperational({
      provider,
      cfg: params.cfg,
      agentDir: params.agentDir,
      now,
      store,
    });
    providerAvailability.set(provider, available);
    return available;
  });
}
