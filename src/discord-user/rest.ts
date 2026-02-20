import type { StealthFingerprint } from "./stealth.js";

export type DiscordUserRestClient = {
  fetch: (path: string, init?: RequestInit) => Promise<Response>;
  get: (path: string) => Promise<Response>;
  post: (path: string, body?: unknown) => Promise<Response>;
  put: (path: string, body?: unknown) => Promise<Response>;
  patch: (path: string, body?: unknown) => Promise<Response>;
  delete: (path: string) => Promise<Response>;
};

export type DiscordUserRestOptions = {
  token: string;
  fingerprint: StealthFingerprint;
  fetcher?: typeof fetch;
  baseUrl?: string;
};

const DISCORD_API_BASE = "https://discord.com/api/v10";
const RATE_LIMIT_STATUS = 429;
const RATE_LIMIT_MAX_RETRIES = 5;

function buildBaseHeaders(token: string, fingerprint: StealthFingerprint): Record<string, string> {
  return {
    Authorization: token,
    "X-Super-Properties": fingerprint.superProperties,
    "X-Discord-Locale": "en-US",
    "X-Discord-Timezone": "America/New_York",
    "User-Agent": fingerprint.userAgent,
  };
}

function buildJsonHeaders(token: string, fingerprint: StealthFingerprint): Record<string, string> {
  return {
    ...buildBaseHeaders(token, fingerprint),
    "Content-Type": "application/json",
  };
}

/**
 * Parse rate limit delay from a 429 response.  Prefers the `Retry-After`
 * header (no body consumption) and only falls back to body parsing when the
 * header is absent.  Returns `null` for non-429 responses.
 */
async function handleRateLimit(
  res: Response,
): Promise<{ retryMs: number; consumed: boolean } | null> {
  if (res.status !== RATE_LIMIT_STATUS) {
    return null;
  }
  const retryAfterHeader = res.headers.get("Retry-After");
  if (retryAfterHeader) {
    const parsed = Number.parseFloat(retryAfterHeader);
    if (Number.isFinite(parsed) && parsed > 0) {
      return { retryMs: Math.ceil(parsed * 1000), consumed: false };
    }
  }
  try {
    const body = (await res.json()) as { retry_after?: number };
    if (typeof body.retry_after === "number") {
      return { retryMs: Math.ceil(body.retry_after * 1000), consumed: true };
    }
  } catch {
    // ignore parse errors
  }
  return { retryMs: 1000, consumed: true };
}

export function createDiscordUserRestClient(opts: DiscordUserRestOptions): DiscordUserRestClient {
  const baseUrl = opts.baseUrl ?? DISCORD_API_BASE;
  const baseHeaders = buildBaseHeaders(opts.token, opts.fingerprint);
  const jsonHeaders = buildJsonHeaders(opts.token, opts.fingerprint);
  const fetchImpl = opts.fetcher ?? globalThis.fetch;

  const doFetch = async (
    path: string,
    init?: RequestInit,
    useJsonHeaders = false,
  ): Promise<Response> => {
    const url = `${baseUrl}${path}`;
    const defaultHeaders = useJsonHeaders ? jsonHeaders : baseHeaders;
    let lastResponse: Response | undefined;

    for (let attempt = 0; attempt < RATE_LIMIT_MAX_RETRIES; attempt++) {
      const res = await fetchImpl(url, {
        ...init,
        headers: {
          ...defaultHeaders,
          ...(init?.headers as Record<string, string> | undefined),
        },
      });

      const rateLimit = await handleRateLimit(res);
      if (rateLimit === null) {
        return res;
      }
      lastResponse = res;
      await new Promise((resolve) => setTimeout(resolve, rateLimit.retryMs));
    }

    return lastResponse!;
  };

  return {
    fetch: (path, init) => doFetch(path, init),
    get: (path) => doFetch(path, { method: "GET" }),
    post: (path, body) =>
      doFetch(
        path,
        {
          method: "POST",
          body: body !== undefined ? JSON.stringify(body) : undefined,
        },
        true,
      ),
    put: (path, body) =>
      doFetch(
        path,
        {
          method: "PUT",
          body: body !== undefined ? JSON.stringify(body) : undefined,
        },
        true,
      ),
    patch: (path, body) =>
      doFetch(
        path,
        {
          method: "PATCH",
          body: body !== undefined ? JSON.stringify(body) : undefined,
        },
        true,
      ),
    delete: (path) => doFetch(path, { method: "DELETE" }),
  };
}
