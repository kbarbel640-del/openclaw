/**
 * @description Interface for an object that can vend OAuth access tokens for
 * a given scope. Implement this when integrating with an OAuth provider that
 * supports per-scope token retrieval.
 */
export type ScopeTokenProvider = {
  /**
   * Retrieves an access token for the specified OAuth scope.
   *
   * @param scope - The OAuth scope string (e.g. `"https://www.googleapis.com/auth/drive"`).
   * @returns A promise that resolves to a bearer token string.
   */
  getAccessToken: (scope: string) => Promise<string>;
};

function isAuthFailureStatus(status: number): boolean {
  return status === 401 || status === 403;
}

/**
 * @description Makes an HTTP request and, if it fails with an auth error
 * (401/403 by default), retries with bearer tokens from `tokenProvider` for
 * each configured scope in order. Returns the first successful response, or
 * the original failed response when no retry succeeds.
 *
 * This is useful for OAuth 2.0 API calls where the token source may need to be
 * discovered by attempting multiple scopes.
 *
 * @param params.url - The request URL. Must be HTTPS when `requireHttps` is `true`.
 * @param params.scopes - OAuth scopes to try in order when the initial request
 *   fails with an auth error.
 * @param params.tokenProvider - Optional {@link ScopeTokenProvider} used to
 *   obtain bearer tokens. When absent, no retry is attempted.
 * @param params.fetchFn - Override the global `fetch` implementation (useful
 *   in tests or environments with a custom fetch).
 * @param params.requestInit - Base `RequestInit` options passed on every
 *   fetch call.
 * @param params.requireHttps - When `true`, throws if the URL is not HTTPS.
 * @param params.shouldAttachAuth - Optional predicate called with the URL;
 *   when it returns `false`, no auth retry is attempted for that URL.
 * @param params.shouldRetry - Custom predicate to decide whether to retry
 *   based on the response. Defaults to retrying on 401 or 403.
 * @returns The fetch `Response`.
 * @throws {Error} If the URL is invalid or HTTPS is required but not used.
 *
 * @example
 * ```ts
 * const response = await fetchWithBearerAuthScopeFallback({
 *   url: "https://api.example.com/data",
 *   scopes: ["https://api.example.com/read"],
 *   tokenProvider: myOAuthProvider,
 * });
 * ```
 */
export async function fetchWithBearerAuthScopeFallback(params: {
  url: string;
  scopes: readonly string[];
  tokenProvider?: ScopeTokenProvider;
  fetchFn?: typeof fetch;
  requestInit?: RequestInit;
  requireHttps?: boolean;
  shouldAttachAuth?: (url: string) => boolean;
  shouldRetry?: (response: Response) => boolean;
}): Promise<Response> {
  const fetchFn = params.fetchFn ?? fetch;
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(params.url);
  } catch {
    throw new Error(`Invalid URL: ${params.url}`);
  }
  if (params.requireHttps === true && parsedUrl.protocol !== "https:") {
    throw new Error(`URL must use HTTPS: ${params.url}`);
  }

  const fetchOnce = (headers?: Headers): Promise<Response> =>
    fetchFn(params.url, {
      ...params.requestInit,
      ...(headers ? { headers } : {}),
    });

  const firstAttempt = await fetchOnce();
  if (firstAttempt.ok) {
    return firstAttempt;
  }
  if (!params.tokenProvider) {
    return firstAttempt;
  }

  const shouldRetry =
    params.shouldRetry ?? ((response: Response) => isAuthFailureStatus(response.status));
  if (!shouldRetry(firstAttempt)) {
    return firstAttempt;
  }
  if (params.shouldAttachAuth && !params.shouldAttachAuth(params.url)) {
    return firstAttempt;
  }

  for (const scope of params.scopes) {
    try {
      const token = await params.tokenProvider.getAccessToken(scope);
      const authHeaders = new Headers(params.requestInit?.headers);
      authHeaders.set("Authorization", `Bearer ${token}`);
      const authAttempt = await fetchOnce(authHeaders);
      if (authAttempt.ok) {
        return authAttempt;
      }
      if (!shouldRetry(authAttempt)) {
        continue;
      }
    } catch {
      // Ignore token/fetch errors and continue trying remaining scopes.
    }
  }

  return firstAttempt;
}
