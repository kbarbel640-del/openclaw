import type { GatewayBrowserClient } from "../gateway.ts";
import type { ProviderUsageSummary } from "../types.ts";

export type ProviderUsageState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  providerUsageLoading: boolean;
  providerUsageError: string | null;
  providerUsageSummary: ProviderUsageSummary | null;
};

export async function loadProviderUsage(state: ProviderUsageState) {
  if (!state.client || !state.connected) {
    return;
  }
  if (state.providerUsageLoading) {
    return;
  }
  state.providerUsageLoading = true;
  state.providerUsageError = null;
  try {
    const res = await state.client.request<ProviderUsageSummary>("usage.status", {});
    if (res) {
      state.providerUsageSummary = res;
    }
  } catch (err) {
    state.providerUsageError = String(err);
  } finally {
    state.providerUsageLoading = false;
  }
}
