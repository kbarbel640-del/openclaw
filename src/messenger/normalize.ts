/**
 * Messenger target normalization utilities.
 *
 * Handles PSID (Page-Scoped User ID) normalization and validation.
 */

const MESSENGER_PSID_RE = /^\d{10,20}$/;

/**
 * Strip Messenger target prefixes (e.g., "messenger:", "fb:").
 */
function stripMessengerTargetPrefixes(value: string): string {
  let candidate = value.trim();
  for (;;) {
    const before = candidate;
    candidate = candidate.replace(/^(messenger|fb|facebook):/i, "").trim();
    if (candidate === before) {
      return candidate;
    }
  }
}

/**
 * Check if value looks like a valid PSID (Page-Scoped User ID).
 * PSIDs are numeric strings, typically 15-20 digits.
 */
export function isMessengerPsid(value: string): boolean {
  const candidate = stripMessengerTargetPrefixes(value);
  return MESSENGER_PSID_RE.test(candidate);
}

/**
 * Normalize a Messenger target to a canonical PSID format.
 * Returns null if the value is not a valid Messenger target.
 *
 * Accepts:
 * - Raw PSID: "1234567890123456"
 * - Prefixed: "messenger:1234567890123456"
 * - Prefixed: "fb:1234567890123456"
 */
export function normalizeMessengerTarget(value: string): string | null {
  const candidate = stripMessengerTargetPrefixes(value);
  if (!candidate) {
    return null;
  }
  if (!isMessengerPsid(candidate)) {
    return null;
  }
  return candidate;
}

/**
 * Check if value looks like a Messenger target (with or without prefix).
 */
export function looksLikeMessengerTarget(value: string): boolean {
  const lower = value.toLowerCase().trim();
  if (lower.startsWith("messenger:") || lower.startsWith("fb:") || lower.startsWith("facebook:")) {
    return true;
  }
  return isMessengerPsid(value);
}

/**
 * Format a PSID for display.
 */
export function formatMessengerTarget(psid: string): string {
  return `messenger:${psid}`;
}

/**
 * Normalize an allowFrom entry (strip prefixes, validate).
 */
export function normalizeMessengerAllowFromEntry(value: string | number): string {
  const raw = String(value).trim();
  if (raw === "*") {
    return "*";
  }
  const normalized = normalizeMessengerTarget(raw);
  return normalized ?? raw;
}
