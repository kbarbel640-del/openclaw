import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Constant-time secret comparison via double-HMAC.
 *
 * Naive timingSafeEqual leaks token length when an early-return is needed for
 * differing buffer sizes. The double-HMAC pattern eliminates this by hashing
 * both inputs to a fixed 32-byte digest before comparison: regardless of the
 * input lengths, the comparison always operates on equal-length buffers.
 *
 * Reference: https://cwe.mitre.org/data/definitions/208.html
 */
export function safeEqualSecret(
  provided: string | undefined | null,
  expected: string | undefined | null,
): boolean {
  if (typeof provided !== "string" || typeof expected !== "string") {
    return false;
  }
  const key = randomBytes(32);
  const hmacProvided = createHmac("sha256", key).update(provided).digest();
  const hmacExpected = createHmac("sha256", key).update(expected).digest();
  return timingSafeEqual(hmacProvided, hmacExpected);
}
