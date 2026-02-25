/**
 * Morpheus Inference API - Provider Usage Fetcher
 *
 * The Morpheus Inference API (api.mor.org) provides free, decentralized inference
 * with no usage quotas or billing until billing infrastructure is implemented.
 *
 * This module returns an empty usage snapshot since there's no usage endpoint.
 * Once Morpheus adds a usage/balance API, this can be updated to fetch actual data.
 *
 * @see https://apidocs.mor.org/
 * @see https://api.mor.org/api/v1/models
 */

import { PROVIDER_LABELS } from "./provider-usage.shared.js";
import type { ProviderUsageSnapshot } from "./provider-usage.types.js";

/**
 * Fetch Morpheus usage snapshot.
 *
 * Currently returns empty windows since Morpheus has no usage API.
 * The service provides free inference with no quotas.
 */
export async function fetchMorpheusUsage(): Promise<ProviderUsageSnapshot> {
  // Morpheus provides free inference with no usage quotas or billing.
  // Return empty windows to indicate the provider is available but has no usage tracking.
  return {
    provider: "morpheus",
    displayName: PROVIDER_LABELS.morpheus,
    windows: [],
  };
}
