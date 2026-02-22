import type { GatewayBrowserClient } from "../gateway.ts";
import type { HealthSummary } from "../types.ts";

/** Default fallback returned when the gateway is unreachable or returns null. */
const HEALTH_FALLBACK: HealthSummary = {
  ok: false,
  ts: 0,
  durationMs: 0,
  heartbeatSeconds: 0,
  defaultAgentId: "",
  agents: [],
  sessions: { path: "", count: 0, recent: [] },
};

/**
 * Fetch the gateway health summary.
 *
 * Accepts a {@link GatewayBrowserClient} (matching the existing ui/ controller
 * convention).  Returns a fully-typed {@link HealthSummary}; on failure the
 * caller receives a safe fallback with `ok: false` rather than `null`.
 */
export async function loadHealth(client: GatewayBrowserClient): Promise<HealthSummary> {
  try {
    const result = await client.request<HealthSummary>("health", {});
    return result ?? HEALTH_FALLBACK;
  } catch {
    return HEALTH_FALLBACK;
  }
}
