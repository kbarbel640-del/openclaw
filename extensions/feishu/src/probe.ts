import { createFeishuClient, type FeishuClientCredentials } from "./client.js";
import type { FeishuProbeResult } from "./types.js";

/**
 * Cache for probe results to avoid excessive API calls.
 * Keyed by appId to support multi-account scenarios.
 * Only used when probeCacheTtlMinutes is configured.
 */
const probeCache = new Map<
  string,
  { result: FeishuProbeResult; timestamp: number; ttlMs: number }
>();

export type ProbeFeishuOptions = FeishuClientCredentials & {
  /**
   * Cache TTL in minutes. When set, probe results are cached for this duration.
   * When not set (default), no caching is performed - matches original behavior.
   */
  probeCacheTtlMinutes?: number;
};

/**
 * Probe Feishu bot information using the bot/v3/info API.
 *
 * When probeCacheTtlMinutes is configured, results are cached to reduce API quota usage.
 * When not configured (default), no caching is performed.
 *
 * @param creds - Feishu credentials and optional cache TTL
 * @returns Probe result with bot info or error
 */
export async function probeFeishu(creds?: ProbeFeishuOptions): Promise<FeishuProbeResult> {
  if (!creds?.appId || !creds?.appSecret) {
    return {
      ok: false,
      error: "missing credentials (appId, appSecret)",
    };
  }

  const cacheKey = creds.appId;
  const ttlMs = creds.probeCacheTtlMinutes ? creds.probeCacheTtlMinutes * 60 * 1000 : 0;
  const now = Date.now();

  // Check cache if TTL is configured
  if (ttlMs > 0) {
    const cached = probeCache.get(cacheKey);
    if (cached && now - cached.timestamp < cached.ttlMs) {
      // Return cached result (clone to avoid mutation)
      return { ...cached.result };
    }
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
      if (ttlMs > 0) {
        probeCache.set(cacheKey, { result, timestamp: now, ttlMs });
      }
      return result;
    }

    const bot = response.bot || response.data?.bot;
    const result: FeishuProbeResult = {
      ok: true,
      appId: creds.appId,
      botName: bot?.bot_name,
      botOpenId: bot?.open_id,
    };

    // Cache result if TTL is configured
    if (ttlMs > 0) {
      probeCache.set(cacheKey, { result, timestamp: now, ttlMs });
    }
    return result;
  } catch (err) {
    const result: FeishuProbeResult = {
      ok: false,
      appId: creds.appId,
      error: err instanceof Error ? err.message : String(err),
    };
    if (ttlMs > 0) {
      probeCache.set(cacheKey, { result, timestamp: now, ttlMs });
    }
    return result;
  }
}
