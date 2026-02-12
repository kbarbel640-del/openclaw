import { filterModelsByOperationalHealth } from "../agents/model-availability.js";
import {
  getCapabilityTags,
  getModelCapabilitiesFromCatalog,
} from "../agents/model-capabilities.js";
import {
  loadAvailableModels,
  type ModelCatalogEntry,
  resetModelCatalogCacheForTest,
} from "../agents/model-catalog.js";
import { loadConfig } from "../config/config.js";

export type GatewayModelChoice = ModelCatalogEntry & {
  capabilities?: ReturnType<typeof getModelCapabilitiesFromCatalog>;
  tags?: string[];
};

// Test-only escape hatch: model catalog is cached at module scope for the
// process lifetime, which is fine for the real gateway daemon, but makes
// isolated unit tests harder. Keep this intentionally obscure.
export function __resetModelCatalogCacheForTest() {
  resetModelCatalogCacheForTest();
}

export async function loadGatewayModelCatalog(): Promise<GatewayModelChoice[]> {
  const cfg = loadConfig();
  // Use loadAvailableModels to filter by detected providers only.
  // This ensures users only see models they can actually use.
  const models = await loadAvailableModels({ config: cfg });
  const healthyModels = filterModelsByOperationalHealth({
    models,
    cfg,
  });
  return healthyModels.map((m) => ({
    ...m,
    capabilities: getModelCapabilitiesFromCatalog(m),
    tags: getCapabilityTags(m),
  }));
}
