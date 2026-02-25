import { bindAbortRelay } from "../utils/fetch-timeout.js";

type FetchWithPreconnect = typeof fetch & {
  preconnect: (url: string, init?: { credentials?: RequestCredentials }) => void;
};

type RequestInitWithDuplex = RequestInit & { duplex?: "half" };

const wrapFetchWithAbortSignalMarker = Symbol.for("openclaw.fetch.abort-signal-wrapped");

type FetchWithAbortSignalMarker = typeof fetch & {
  [wrapFetchWithAbortSignalMarker]?: true;
};

/**
 * Sanitize an HTTP header value to prevent ByteString crashes in Node's undici fetch.
 * Characters above U+00FF are replaced with '?' since HTTP headers are Latin-1 only.
 */
function sanitizeHeaderValue(value: string): string {
  for (let i = 0; i < value.length; i++) {
    if (value.charCodeAt(i) > 255) {
      return value.replace(/[^\u0000-\u00ff]/g, "?"); // eslint-disable-line no-control-regex
    }
  }
  return value;
}

function sanitizeHeaders(init?: RequestInit): RequestInit | undefined {
  if (!init?.headers) {
    return init;
  }
  if (typeof Headers !== "undefined" && init.headers instanceof Headers) {
    const dirty: [string, string][] = [];
    init.headers.forEach((value, key) => {
      const s = sanitizeHeaderValue(value);
      if (s !== value) {
        dirty.push([key, s]);
      }
    });
    if (dirty.length === 0) {
      return init;
    }
    const h = new Headers(init.headers);
    for (const [k, v] of dirty) {
      h.set(k, v);
    }
    return { ...init, headers: h };
  }
  if (Array.isArray(init.headers)) {
    let changed = false;
    const next = init.headers.map((entry) => {
      if (entry.length >= 2) {
        const s = sanitizeHeaderValue(entry[1]);
        if (s !== entry[1]) {
          changed = true;
          return [entry[0], s];
        }
      }
      return entry;
    });
    return changed ? { ...init, headers: next as HeadersInit } : init;
  }
  const rec = init.headers as Record<string, string>;
  let nextRec: Record<string, string> | undefined;
  for (const k in rec) {
    if (typeof rec[k] === "string") {
      const s = sanitizeHeaderValue(rec[k]);
      if (s !== rec[k]) {
        if (!nextRec) {
          nextRec = { ...rec };
        }
        nextRec[k] = s;
      }
    }
  }
  return nextRec ? { ...init, headers: nextRec } : init;
}

function withDuplex(
  init: RequestInit | undefined,
  input: RequestInfo | URL,
): RequestInit | undefined {
  const hasInitBody = init?.body != null;
  const hasRequestBody =
    !hasInitBody &&
    typeof Request !== "undefined" &&
    input instanceof Request &&
    input.body != null;
  if (!hasInitBody && !hasRequestBody) {
    return init;
  }
  if (init && "duplex" in (init as Record<string, unknown>)) {
    return init;
  }
  return init
    ? ({ ...init, duplex: "half" as const } as RequestInitWithDuplex)
    : ({ duplex: "half" as const } as RequestInitWithDuplex);
}

export function wrapFetchWithAbortSignal(fetchImpl: typeof fetch): typeof fetch {
  if ((fetchImpl as FetchWithAbortSignalMarker)[wrapFetchWithAbortSignalMarker]) {
    return fetchImpl;
  }

  const wrapped = ((input: RequestInfo | URL, init?: RequestInit) => {
    const patchedInit = withDuplex(sanitizeHeaders(init), input);
    const signal = patchedInit?.signal;
    if (!signal) {
      return fetchImpl(input, patchedInit);
    }
    if (typeof AbortSignal !== "undefined" && signal instanceof AbortSignal) {
      return fetchImpl(input, patchedInit);
    }
    if (typeof AbortController === "undefined") {
      return fetchImpl(input, patchedInit);
    }
    if (typeof signal.addEventListener !== "function") {
      return fetchImpl(input, patchedInit);
    }
    const controller = new AbortController();
    const onAbort = bindAbortRelay(controller);
    let listenerAttached = false;
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener("abort", onAbort, { once: true });
      listenerAttached = true;
    }
    const cleanup = () => {
      if (!listenerAttached || typeof signal.removeEventListener !== "function") {
        return;
      }
      listenerAttached = false;
      try {
        signal.removeEventListener("abort", onAbort);
      } catch {
        // Foreign/custom AbortSignal implementations may throw here.
        // Never let cleanup mask the original fetch result/error.
      }
    };
    try {
      const response = fetchImpl(input, { ...patchedInit, signal: controller.signal });
      return response.finally(cleanup);
    } catch (error) {
      cleanup();
      throw error;
    }
  }) as FetchWithPreconnect;

  const wrappedFetch = Object.assign(wrapped, fetchImpl) as FetchWithPreconnect;
  const fetchWithPreconnect = fetchImpl as FetchWithPreconnect;
  wrappedFetch.preconnect =
    typeof fetchWithPreconnect.preconnect === "function"
      ? fetchWithPreconnect.preconnect.bind(fetchWithPreconnect)
      : () => {};

  Object.defineProperty(wrappedFetch, wrapFetchWithAbortSignalMarker, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });

  return wrappedFetch;
}

export function resolveFetch(fetchImpl?: typeof fetch): typeof fetch | undefined {
  const resolved = fetchImpl ?? globalThis.fetch;
  if (!resolved) {
    return undefined;
  }
  return wrapFetchWithAbortSignal(resolved);
}
