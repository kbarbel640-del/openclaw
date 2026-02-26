import { createFeishuClient, type FeishuClientCredentials } from "./client.js";
import type { FeishuProbeResult } from "./types.js";

/** Per-appId exponential backoff state for 429 rate limits. */
const rateLimitState = new Map<string, { cooldownUntil: number; consecutive: number }>();
const BASE_COOLDOWN_MS = 60_000; // 1 minute
const MAX_COOLDOWN_MS = 30 * 60_000; // 30 minutes cap

export async function probeFeishu(creds?: FeishuClientCredentials): Promise<FeishuProbeResult> {
  if (!creds?.appId || !creds?.appSecret) {
    return {
      ok: false,
      error: "missing credentials (appId, appSecret)",
    };
  }

  // Skip probe if in exponential backoff cooldown
  const state = rateLimitState.get(creds.appId);
  if (state && Date.now() < state.cooldownUntil) {
    const remainingSec = Math.ceil((state.cooldownUntil - Date.now()) / 1000);
    return {
      ok: false,
      appId: creds.appId,
      error: `rate-limited, retry in ${remainingSec}s (attempt ${state.consecutive})`,
    };
  }

  try {
    const client = createFeishuClient(creds);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SDK generic request method
    const response = await (client as any).request({
      method: "GET",
      url: "/open-apis/bot/v3/info",
      data: {},
    });

    if (response.code !== 0) {
      return {
        ok: false,
        appId: creds.appId,
        error: `API error: ${response.msg || `code ${response.code}`}`,
      };
    }

    // Success — clear backoff state
    rateLimitState.delete(creds.appId);
    const bot = response.bot || response.data?.bot;
    return {
      ok: true,
      appId: creds.appId,
      botName: bot?.bot_name,
      botOpenId: bot?.open_id,
    };
  } catch (err) {
    const status = (err as any)?.response?.status ?? (err as any)?.status;
    if (status === 429) {
      const prev = rateLimitState.get(creds.appId);
      const consecutive = (prev?.consecutive ?? 0) + 1;
      // Exponential backoff: 1m, 2m, 4m, 8m, 16m, capped at 30m
      const cooldownMs = Math.min(BASE_COOLDOWN_MS * 2 ** (consecutive - 1), MAX_COOLDOWN_MS);
      rateLimitState.set(creds.appId, {
        cooldownUntil: Date.now() + cooldownMs,
        consecutive,
      });
    }
    return {
      ok: false,
      appId: creds.appId,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
