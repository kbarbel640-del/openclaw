import { ProxyAgent, fetch as undiciFetch } from "undici";

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

/**
 * Check if a hostname is bypassed by NO_PROXY.
 * NO_PROXY is a comma-separated list of hostnames or domains.
 * A leading dot matches any subdomain (e.g. ".example.com" matches "sub.example.com").
 * "*" bypasses all hosts.
 */
function isNoProxy(hostname: string): boolean {
  const noProxy = (process.env.NO_PROXY ?? process.env.no_proxy ?? "").trim();
  if (!noProxy) return false;
  if (noProxy === "*") return true;
  const lower = hostname.toLowerCase();
  return noProxy.split(",").some((entry) => {
    const pattern = entry.trim().toLowerCase();
    if (!pattern) return false;
    if (lower === pattern) return true;
    // ".example.com" matches "sub.example.com"
    if (pattern.startsWith(".") && lower.endsWith(pattern)) return true;
    // "example.com" also matches "sub.example.com" (curl/wget convention)
    if (lower.endsWith(`.${pattern}`)) return true;
    return false;
  });
}

/**
 * Resolve proxy URL from standard environment variables.
 * Precedence: HTTPS_PROXY > HTTP_PROXY > ALL_PROXY (case-insensitive).
 * Returns undefined when no proxy is configured or when the target host
 * matches NO_PROXY.
 *
 * @param targetHost - optional hostname to check against NO_PROXY
 */
export function resolveProxyUrlFromEnv(targetHost?: string): string | undefined {
  if (targetHost && isNoProxy(targetHost)) return undefined;
  const candidates = [
    process.env.HTTPS_PROXY,
    process.env.https_proxy,
    process.env.HTTP_PROXY,
    process.env.http_proxy,
    process.env.ALL_PROXY,
    process.env.all_proxy,
  ];
  for (const val of candidates) {
    const trimmed = val?.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}
