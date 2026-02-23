const RELAY_TOKEN_CONTEXT = "openclaw-extension-relay-v1";

export function reconnectDelayMs(
  attempt,
  opts = { baseMs: 1000, maxMs: 30000, jitterMs: 1000, random: Math.random },
) {
  const baseMs = Number.isFinite(opts.baseMs) ? opts.baseMs : 1000;
  const maxMs = Number.isFinite(opts.maxMs) ? opts.maxMs : 30000;
  const jitterMs = Number.isFinite(opts.jitterMs) ? opts.jitterMs : 1000;
  const random = typeof opts.random === "function" ? opts.random : Math.random;
  const safeAttempt = Math.max(0, Number.isFinite(attempt) ? attempt : 0);
  const backoff = Math.min(baseMs * 2 ** safeAttempt, maxMs);
  return backoff + Math.max(0, jitterMs) * random();
}

/**
 * Derive the relay auth token from the raw gateway token using HMAC-SHA256,
 * matching the server-side `deriveRelayAuthToken` in extension-relay-auth.ts.
 * Uses the Web Crypto API (available in Chrome extension service workers).
 */
export async function deriveRelayToken(gatewayToken, port) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(gatewayToken),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    keyMaterial,
    enc.encode(`${RELAY_TOKEN_CONTEXT}:${port}`),
  );
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Build the relay WebSocket URL. The raw gateway token is HMAC-derived before
 * being included in the URL so it matches the server-side relay auth check.
 */
export async function buildRelayWsUrl(port, gatewayToken) {
  const token = String(gatewayToken || "").trim();
  if (!token) {
    throw new Error(
      "Missing gatewayToken in extension settings (chrome.storage.local.gatewayToken)",
    );
  }
  const derived = await deriveRelayToken(token, port);
  return `ws://127.0.0.1:${port}/extension?token=${encodeURIComponent(derived)}`;
}

export function isRetryableReconnectError(err) {
  const message = err instanceof Error ? err.message : String(err || "");
  if (message.includes("Missing gatewayToken")) {
    return false;
  }
  return true;
}
