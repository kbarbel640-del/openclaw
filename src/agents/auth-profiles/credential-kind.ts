import type { AuthProfileCredential } from "./types.js";

/**
 * High-level credential kind that distinguishes billing context.
 *
 * - `oauth`   – OAuth credential (e.g. Anthropic Max subscription)
 * - `token`   – Static bearer / PAT token, often from an OAuth flow but not
 *               refreshable by OpenClaw
 * - `api_key` – Traditional pay-per-use API key
 */
export type CredentialKind = "oauth" | "token" | "api_key";

/**
 * Returns a short, human-readable label for the credential kind that clarifies
 * billing context.
 *
 * Examples:
 *   "OAuth"    – for oauth credentials (e.g. Anthropic Max subscription)
 *   "Token"    – for static bearer tokens
 *   "API Key"  – for traditional API keys (pay-per-use)
 */
export function credentialKindLabel(type: CredentialKind): string {
  switch (type) {
    case "oauth":
      return "OAuth";
    case "token":
      return "Token";
    case "api_key":
      return "API Key";
  }
}

/**
 * Resolves a billing-context hint for a credential.
 *
 * For Anthropic OAuth credentials this returns "Max" because the Anthropic
 * OAuth flow is exclusively available through the Max subscription plan.
 * For other providers the hint is `undefined` (we can't reliably determine
 * the subscription tier from the token alone).
 */
export function credentialBillingHint(credential: AuthProfileCredential): string | undefined {
  if (credential.provider === "anthropic" && credential.type === "oauth") {
    return "Max";
  }
  // Anthropic tokens obtained via ANTHROPIC_OAUTH_TOKEN env var are also
  // typically Max-subscription tokens.
  if (credential.provider === "anthropic" && credential.type === "token") {
    return "Max";
  }
  return undefined;
}

/**
 * Returns a display label that includes billing context when available.
 *
 * Examples:
 *   "OAuth (Max)"  – Anthropic OAuth / Max subscription
 *   "Token (Max)"  – Anthropic static token from Max
 *   "OAuth"        – generic OAuth (non-Anthropic)
 *   "API Key"      – pay-per-use
 */
export function credentialKindDisplayLabel(credential: AuthProfileCredential): string {
  const base = credentialKindLabel(credential.type);
  const hint = credentialBillingHint(credential);
  return hint ? `${base} (${hint})` : base;
}

/**
 * Detects the credential kind from a raw API key string and provider name.
 *
 * This is used when only a key string is available (e.g. from env vars) and
 * there is no profile credential object.
 *
 * Anthropic OAuth access tokens have the prefix `sk-ant-oat` while API keys
 * use `sk-ant-api`.
 */
export function detectCredentialKindFromKey(
  provider: string,
  key: string,
): { kind: CredentialKind; billingHint?: string } {
  const trimmed = key.trim();

  if (provider === "anthropic") {
    if (trimmed.startsWith("sk-ant-oat")) {
      return { kind: "oauth", billingHint: "Max" };
    }
    // Anthropic refresh tokens shouldn't normally be used as API keys, but if
    // someone sets ANTHROPIC_OAUTH_TOKEN to an access token we detect it here.
    if (trimmed.startsWith("sk-ant-ort")) {
      return { kind: "oauth", billingHint: "Max" };
    }
    return { kind: "api_key" };
  }

  // For other providers we can't reliably distinguish token formats, so we
  // fall back to the generic api_key kind.
  return { kind: "api_key" };
}
