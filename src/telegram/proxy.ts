import { ProxyAgent, fetch as undiciFetch } from "undici";

/**
 * Resolve a proxy URL from the environment.
 * Node.js fetch() does not honour HTTP_PROXY / HTTPS_PROXY / ALL_PROXY
 * automatically, so callers must explicitly build a ProxyAgent. This helper
 * surfaces those standard variables so users don't need to duplicate them in
 * channels.telegram.proxy config. (#20870)
 */
export function resolveProxyUrlFromEnv(): string | undefined {
  const raw =
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy ||
    process.env.ALL_PROXY ||
    process.env.all_proxy;
  const trimmed = raw?.trim();
  return trimmed || undefined;
}

export function makeProxyFetch(proxyUrl: string): typeof fetch {
  const agent = new ProxyAgent(proxyUrl);
  // undici's fetch is runtime-compatible with global fetch but the types diverge
  // on stream/body internals. Single cast at the boundary keeps the rest type-safe.
  const fetcher = ((input: RequestInfo | URL, init?: RequestInit) =>
    undiciFetch(input as string | URL, {
      ...(init as Record<string, unknown>),
      dispatcher: agent,
    }) as unknown as Promise<Response>) as typeof fetch;
  // Return raw proxy fetch; call sites that need AbortSignal normalization
  // should opt into resolveFetch/wrapFetchWithAbortSignal once at the edge.
  return fetcher;
}
