import type { SsrFPolicy } from "../infra/net/ssrf.js";

function normalizeHostnameSuffix(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return "";
  }
  if (trimmed === "*" || trimmed === "*.") {
    return "*";
  }
  const withoutWildcard = trimmed.replace(/^\*\.?/, "");
  const withoutLeadingDot = withoutWildcard.replace(/^\.+/, "");
  return withoutLeadingDot.replace(/\.+$/, "");
}

function isHostnameAllowedBySuffixAllowlist(
  hostname: string,
  allowlist: readonly string[],
): boolean {
  if (allowlist.includes("*")) {
    return true;
  }
  const normalized = hostname.toLowerCase();
  return allowlist.some((entry) => normalized === entry || normalized.endsWith(`.${entry}`));
}

/**
 * @description Normalizes a list of hostname suffix allowlist entries.
 * Wildcards (`"*"`, `"*."`) are collapsed to `"*"`. Duplicate normalized
 * values are deduplicated. When `input` is absent or empty, `defaults` is used
 * instead.
 *
 * @param input - Raw suffix entries to normalize (e.g. `["*.Example.com", "api.example.com"]`).
 * @param defaults - Fallback entries used when `input` is absent or empty.
 * @returns An array of normalized, lowercased suffix strings. Returns `["*"]`
 *   when a wildcard is present; returns `[]` when no entries survive normalization.
 *
 * @example
 * ```ts
 * normalizeHostnameSuffixAllowlist(["*.Example.COM", "  api.example.com "]);
 * // ["example.com", "api.example.com"]
 * ```
 */
export function normalizeHostnameSuffixAllowlist(
  input?: readonly string[],
  defaults?: readonly string[],
): string[] {
  const source = input && input.length > 0 ? input : defaults;
  if (!source || source.length === 0) {
    return [];
  }
  const normalized = source.map(normalizeHostnameSuffix).filter(Boolean);
  if (normalized.includes("*")) {
    return ["*"];
  }
  return Array.from(new Set(normalized));
}

/**
 * @description Checks whether a URL is an HTTPS URL whose hostname is covered
 * by a pre-normalized suffix allowlist. Non-HTTPS URLs and URLs that fail to
 * parse always return `false`.
 *
 * @param url - The URL string to test.
 * @param allowlist - A normalized suffix allowlist (from
 *   {@link normalizeHostnameSuffixAllowlist}).
 * @returns `true` when the URL is HTTPS and its hostname matches a suffix
 *   entry (exact match or subdomain match).
 *
 * @example
 * ```ts
 * isHttpsUrlAllowedByHostnameSuffixAllowlist("https://api.example.com/v1", ["example.com"]);
 * // true
 * isHttpsUrlAllowedByHostnameSuffixAllowlist("http://api.example.com/v1", ["example.com"]);
 * // false (not HTTPS)
 * ```
 */
export function isHttpsUrlAllowedByHostnameSuffixAllowlist(
  url: string,
  allowlist: readonly string[],
): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") {
      return false;
    }
    return isHostnameAllowedBySuffixAllowlist(parsed.hostname, allowlist);
  } catch {
    return false;
  }
}

/**
 * Converts suffix-style host allowlists (for example "example.com") into SSRF
 * hostname allowlist patterns used by the shared fetch guard.
 *
 * Suffix semantics:
 * - "example.com" allows "example.com" and "*.example.com"
 * - "*" disables hostname allowlist restrictions
 */
export function buildHostnameAllowlistPolicyFromSuffixAllowlist(
  allowHosts?: readonly string[],
): SsrFPolicy | undefined {
  const normalizedAllowHosts = normalizeHostnameSuffixAllowlist(allowHosts);
  if (normalizedAllowHosts.length === 0) {
    return undefined;
  }
  const patterns = new Set<string>();
  for (const normalized of normalizedAllowHosts) {
    if (normalized === "*") {
      return undefined;
    }
    patterns.add(normalized);
    patterns.add(`*.${normalized}`);
  }

  if (patterns.size === 0) {
    return undefined;
  }
  return { hostnameAllowlist: Array.from(patterns) };
}
