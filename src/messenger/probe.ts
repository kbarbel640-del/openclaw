/**
 * Messenger probe for checking page access token validity.
 *
 * Validates the token by calling the Graph API /me endpoint
 * to retrieve page information.
 */

const GRAPH_API_BASE = "https://graph.facebook.com/v19.0";

export type MessengerProbe = {
  ok: boolean;
  status?: number | null;
  error?: string | null;
  elapsedMs: number;
  page?: {
    id?: string | null;
    name?: string | null;
  };
};

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Probe a Messenger page access token.
 *
 * Calls the Graph API /me endpoint to validate the token
 * and retrieve page information.
 */
export async function probeMessenger(
  pageAccessToken: string,
  timeoutMs: number,
): Promise<MessengerProbe> {
  const started = Date.now();

  const result: MessengerProbe = {
    ok: false,
    status: null,
    error: null,
    elapsedMs: 0,
  };

  if (!pageAccessToken?.trim()) {
    return {
      ...result,
      error: "page access token not configured",
      elapsedMs: Date.now() - started,
    };
  }

  try {
    const url = `${GRAPH_API_BASE}/me?access_token=${encodeURIComponent(pageAccessToken)}`;
    const res = await fetchWithTimeout(url, timeoutMs);
    const json = (await res.json()) as {
      id?: string;
      name?: string;
      error?: {
        message?: string;
        code?: number;
        type?: string;
      };
    };

    if (!res.ok || json.error) {
      result.status = res.status;
      result.error = json.error?.message ?? `API call failed (${res.status})`;
      return { ...result, elapsedMs: Date.now() - started };
    }

    result.ok = true;
    result.status = null;
    result.error = null;
    result.page = {
      id: json.id ?? null,
      name: json.name ?? null,
    };
    result.elapsedMs = Date.now() - started;
    return result;
  } catch (err) {
    return {
      ...result,
      status: err instanceof Response ? err.status : result.status,
      error: err instanceof Error ? err.message : String(err),
      elapsedMs: Date.now() - started,
    };
  }
}
