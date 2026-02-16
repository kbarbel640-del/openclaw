import { makeProxyFetch } from "../telegram/proxy.js";
import { fetchWithTimeout } from "../utils/fetch-timeout.js";

const MAX_API_BASE = "https://platform-api.max.ru";

/**
 * MAX Bot API probe result — returned by GET /me.
 */
export type MaxProbeResult = {
  ok: boolean;
  status?: number | null;
  error?: string | null;
  elapsedMs: number;
  bot?: {
    id?: number | null;
    name?: string | null;
    username?: string | null;
  };
};

/**
 * Probes a MAX bot token by calling GET /me.
 *
 * Retries up to 3 times with 1-second delays.
 * Returns structured result with timing info.
 */
export async function probeMax(
  token: string,
  timeoutMs: number,
  proxyUrl?: string,
): Promise<MaxProbeResult> {
  const started = Date.now();
  const fetcher = proxyUrl ? makeProxyFetch(proxyUrl) : fetch;
  const result: MaxProbeResult = { ok: false, status: null, error: null, elapsedMs: 0 };

  let meRes: Response | null = null;
  let fetchError: unknown = null;

  // MAX Bot API uses raw token in Authorization header (no "Bot" prefix)
  const headers: Record<string, string> = { Authorization: token };

  try {
    // Retry loop: 3 attempts with 1s delay
    for (let i = 0; i < 3; i++) {
      try {
        meRes = await fetchWithTimeout(`${MAX_API_BASE}/me`, { headers }, timeoutMs, fetcher);
        break;
      } catch (err) {
        fetchError = err;
        if (i < 2) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }

    if (!meRes) {
      return {
        ...result,
        error: fetchError instanceof Error ? fetchError.message : String(fetchError),
        elapsedMs: Date.now() - started,
      };
    }

    const meJson = (await meRes.json()) as Record<string, unknown> | null;

    if (!meRes.ok || !meJson) {
      result.status = meRes.status;
      result.error =
        typeof meJson?.message === "string" ? meJson.message : `getMe failed (${meRes.status})`;
      return { ...result, elapsedMs: Date.now() - started };
    }

    // MAX /me response: { user_id, name, username, is_bot, ... }
    result.ok = true;
    result.bot = {
      id: typeof meJson.user_id === "number" ? meJson.user_id : null,
      name: typeof meJson.name === "string" ? meJson.name : null,
      username: typeof meJson.username === "string" ? meJson.username : null,
    };
    return { ...result, elapsedMs: Date.now() - started };
  } catch (err) {
    return {
      ...result,
      status: err instanceof Response ? err.status : result.status,
      error: err instanceof Error ? err.message : String(err),
      elapsedMs: Date.now() - started,
    };
  }
}
