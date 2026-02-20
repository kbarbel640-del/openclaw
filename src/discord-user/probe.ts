import type { BaseProbeResult } from "../channels/plugins/types.js";
import { fetchWithTimeout } from "../utils/fetch-timeout.js";

const DISCORD_API_BASE = "https://discord.com/api/v10";

export type DiscordUserProbe = BaseProbeResult & {
  status?: number | null;
  elapsedMs: number;
  user?: { id?: string | null; username?: string | null };
};

/**
 * Probe a Discord user token by calling GET /users/@me with raw auth (no Bot prefix).
 */
export async function probeDiscordUser(
  token: string,
  timeoutMs: number,
  opts?: { fetcher?: typeof fetch },
): Promise<DiscordUserProbe> {
  const started = Date.now();
  const fetcher = opts?.fetcher ?? fetch;
  const result: DiscordUserProbe = {
    ok: false,
    status: null,
    error: null,
    elapsedMs: 0,
  };

  const trimmed = token?.trim();
  if (!trimmed) {
    return {
      ...result,
      error: "missing token",
      elapsedMs: Date.now() - started,
    };
  }

  try {
    const res = await fetchWithTimeout(
      `${DISCORD_API_BASE}/users/@me`,
      { headers: { Authorization: trimmed } },
      timeoutMs,
      fetcher,
    );
    if (!res.ok) {
      result.status = res.status;
      result.error = `getMe failed (${res.status})`;
      return { ...result, elapsedMs: Date.now() - started };
    }
    const json = (await res.json()) as { id?: string; username?: string };
    result.ok = true;
    result.user = {
      id: json.id ?? null,
      username: json.username ?? null,
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
