/**
 * Shared helpers for detecting sensitive config keys.
 *
 * Keep this aligned across:
 * - config schema UI hints (marking fields as `sensitive`)
 * - config snapshot redaction logic
 */

export const DEFAULT_SENSITIVE_KEY_PATTERNS: RegExp[] = [
  /token/i,
  /password/i,
  /secret/i,
  /api.?key/i,
];

export function isSensitiveKey(
  key: string,
  patterns: readonly RegExp[] = DEFAULT_SENSITIVE_KEY_PATTERNS,
): boolean {
  return patterns.some((pattern) => pattern.test(key));
}
