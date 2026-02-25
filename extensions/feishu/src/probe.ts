import { createFeishuClient, type FeishuClientCredentials } from "./client.js";
import type { FeishuProbeResult } from "./types.js";

/**
 * Default cache TTL: 1 minute (matches the health check interval).
 * Set probeCacheTtlMinutes in config to increase cache duration and reduce API calls.
 */
const DEFAULT_PROBE_CACHE_TTL_MS = 1 * 60 * 1000;

/**
 * Cache for probe results to avoid excessive API calls.
 * Keyed by appId to support multi-account scenarios.
 */
const probeCache = new Map<
  string,
  { result: FeishuProbeResult; timestamp: number; ttlMs: number }
>();

/**
 * Extended options for probeFeishu including cache configuration.
 */
export type ProbeFeishuOptions = FeishuClientCredentials & {
  /** Cache TTL in minutes (default: 1) */
  probeCacheTtlMinutes?: number;
};

/**
 * Probe Feishu bot information using the bot/v3/info API.
 * Results are cached to reduce API quota usage.
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

  // Get cache TTL from config or use default
  const ttlMs = creds.probeCacheTtlMinutes
    ? creds.probeCacheTtlMinutes * 60 * 1000
    : DEFAULT_PROBE_CACHE_TTL_MS;

  // Check cache first
  const cacheKey = creds.appId;
  const cached = probeCache.get(cacheKey);
  const now = Date.now();

  if (cached && now - cached.timestamp < cached.ttlMs) {
    // Return cached result (clone to avoid mutation)
    return { ...cached.result };
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
      probeCache.set(cacheKey, { result, timestamp: now, ttlMs });
      return result;
    }

    const bot = response.bot || response.data?.bot;
    const result: FeishuProbeResult = {
      ok: true,
      appId: creds.appId,
      botName: bot?.bot_name,
      botOpenId: bot?.open_id,
    };

    probeCache.set(cacheKey, { result, timestamp: now, ttlMs });
    return result;
  } catch (err) {
    const result: FeishuProbeResult = {
      ok: false,
      appId: creds.appId,
      error: err instanceof Error ? err.message : String(err),
    };
    probeCache.set(cacheKey, { result, timestamp: now, ttlMs });
    return result;
  }
}
