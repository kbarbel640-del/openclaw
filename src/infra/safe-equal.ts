import { timingSafeEqual } from "node:crypto";

/** Timing-safe string comparison. Returns false for different-length inputs without leaking length via timing. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}
