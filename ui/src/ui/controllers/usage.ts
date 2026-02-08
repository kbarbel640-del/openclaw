import type { GatewayBrowserClient } from "../gateway";
import type { UsageLifetimeResult } from "../views/usage";

export type UsageState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  usageLifetimeLoading: boolean;
  usageLifetimeResult: UsageLifetimeResult | null;
  usageLifetimeError: string | null;
};

export async function loadUsageLifetime(state: UsageState, days?: number) {
  if (!state.client || !state.connected) return;
  if (state.usageLifetimeLoading) return;
  state.usageLifetimeLoading = true;
  state.usageLifetimeError = null;
  try {
    const params: Record<string, unknown> = {};
    if (days) params.days = days;
    const res = (await state.client.request("usage.lifetime", params)) as
      | UsageLifetimeResult
      | undefined;
    if (res) state.usageLifetimeResult = res;
  } catch (err) {
    state.usageLifetimeError = String(err);
  } finally {
    state.usageLifetimeLoading = false;
  }
}
