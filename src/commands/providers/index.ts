/**
 * Providers commands barrel export.
 */

// Types
export type {
  AuthMode,
  AuthSource,
  ProviderCostRates,
  ProviderDefinition,
  ProviderStatus,
  ProviderUsage,
  TokenValidity,
  UsageEntry,
  UsagePeriod,
  UsageStore,
  UsageTotals,
} from "./types.js";

// Registry
export {
  PROVIDER_REGISTRY,
  MODEL_COST_RATES,
  getAllProviderEnvVars,
  getAllProviderIds,
  getModelCostRates,
  getProviderById,
  calculateCost,
} from "./registry.js";

// Detection
export {
  detectProvider,
  detectProviders,
  getDetectedProviderIds,
  getDetectionSummary,
  isProviderDetected,
  type DetectionOptions,
} from "./detection.js";

// Usage
export { formatUsageForDisplay, getUsage, isUsageTrackingAvailable, trackUsage } from "./usage.js";

// Usage Store
export {
  deleteOldUsage,
  getUsageByProvider,
  getUsageTotals,
  queryUsage,
  recordUsage,
} from "./usage-store.js";

// Commands
export { providersListCommand, type ProvidersListOptions } from "./list.js";

export { providersStatusCommand, type ProvidersStatusOptions } from "./status.js";

export { providersUsageCommand, type ProvidersUsageOptions } from "./usage-cmd.js";
