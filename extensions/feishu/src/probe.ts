import { createFeishuClient, type FeishuClientCredentials } from "./client.js";
import type { FeishuProbeResult } from "./types.js";

// --- Probe cache (24h TTL) to reduce /bot/v3/info API calls ---
const PROBE_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const probeCache = new Map<string, { result: FeishuProbeResult; cachedAt: number }>();

function getCachedProbe(key: string): FeishuProbeResult | null {
  const entry = probeCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > PROBE_CACHE_TTL_MS) {
    probeCache.delete(key); // lazy eviction
    return null;
  }
  return entry.result;
}

function setCachedProbe(key: string, result: FeishuProbeResult): void {
  probeCache.set(key, { result, cachedAt: Date.now() });
}

export async function probeFeishu(
  creds?: FeishuClientCredentials,
  opts?: { force?: boolean },
): Promise<FeishuProbeResult> {
  if (!creds?.appId || !creds?.appSecret) {
    return {
      ok: false,
      error: "missing credentials (appId, appSecret)",
    };
  }

  const cacheKey = creds.appId;

  // Return cached result unless force refresh is requested
  if (!opts?.force) {
    const cached = getCachedProbe(cacheKey);
    if (cached) return cached;
  }

  try {
    const client = createFeishuClient(creds);
    // Use bot/v3/info API to get bot information
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SDK generic request method
    const response = await (client as any).request({
      method: "GET",
      url: "/open-apis/bot/v3/info",
      data: {},
    });

    if (response.code !== 0) {
      const result: FeishuProbeResult = {
        ok: false,
        appId: creds.appId,
        error: `API error: ${response.msg || `code ${response.code}`}`,
      };
      // Cache errors too to prevent request storms on failing endpoints
      setCachedProbe(cacheKey, result);
      return result;
    }

    const bot = response.bot || response.data?.bot;
    const result: FeishuProbeResult = {
      ok: true,
      appId: creds.appId,
      botName: bot?.bot_name,
      botOpenId: bot?.open_id,
    };
    setCachedProbe(cacheKey, result);
    return result;
  } catch (err) {
    const result: FeishuProbeResult = {
      ok: false,
      appId: creds.appId,
      error: err instanceof Error ? err.message : String(err),
    };
    // Cache errors too to prevent request storms on failing endpoints
    setCachedProbe(cacheKey, result);
    return result;
  }
}
