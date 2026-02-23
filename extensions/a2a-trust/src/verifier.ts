import { createHmac, createHash, timingSafeEqual as cryptoTimingSafeEqual } from "node:crypto";

/**
 * Local verification utilities — lets agents verify trust proofs
 * without calling the gateway. Works offline.
 *
 * These verify that a response from the gateway (or from a peer
 * agent who forwarded a release token) is authentic.
 */

/**
 * Verify a release token against its preimage.
 *
 * This confirms that the HMAC was computed correctly, proving
 * the decision (ALLOW/CLAMP/DENY) was actually made by the
 * trust gateway at the claimed epoch.
 *
 * @param releaseToken - The HMAC hex string from the verify response
 * @param preimage - "KEVROSv1|{decision}|{epoch}|{hash_prev}|{record_hash}"
 * @param hmacKey - The gateway HMAC key (hex string, 64+ chars)
 * @returns true if the token is valid
 */
export function verifyReleaseToken(
  releaseToken: string,
  preimage: string,
  hmacKey: string
): boolean {
  // Validate preimage format
  const pattern = /^KEVROSv1\|(ALLOW|CLAMP|DENY)\|\d+\|[0-9a-f]{64}\|[0-9a-f]{64}$/;
  if (!pattern.test(preimage)) {
    return false;
  }

  const keyBytes = Buffer.from(hmacKey, "hex");
  const computed = createHmac("sha256", keyBytes)
    .update(preimage, "utf-8")
    .digest("hex");

  return timingSafeEqual(computed, releaseToken);
}

/**
 * Verify a provenance hash chain.
 *
 * Given an array of records (from a bundle response), verify
 * that each record's hash_curr was correctly computed and that
 * hash_prev links form an unbroken chain.
 *
 * @param records - Array of provenance records with hash_prev and hash_curr
 * @returns { valid, breaks, mismatches }
 */
export function verifyChain(
  records: Array<{
    hash_prev: string;
    hash_curr: string;
    [key: string]: unknown;
  }>
): { valid: boolean; breaks: number; mismatches: number } {
  let breaks = 0;
  let mismatches = 0;

  for (let i = 0; i < records.length; i++) {
    const record = records[i];

    // Check chain linkage (record N's hash_prev should equal record N-1's hash_curr)
    if (i > 0) {
      const prevRecord = records[i - 1];
      if (record.hash_prev !== prevRecord.hash_curr) {
        breaks++;
      }
    }

    // Recompute hash_curr
    const { hash_curr: _, ...recordWithoutHash } = record;
    const canonical = canonicalJson(recordWithoutHash);
    const expected = sha256Hex(
      record.hash_prev + "|" + canonical
    );

    if (expected !== record.hash_curr) {
      mismatches++;
    }
  }

  return {
    valid: breaks === 0 && mismatches === 0,
    breaks,
    mismatches,
  };
}

/**
 * Verify an attestation hash.
 *
 * Confirms that the action_payload_hash in a provenance record
 * matches the SHA-256 of the canonical JSON of the original payload.
 *
 * @param payload - The original action payload
 * @param expectedHash - The hash from the attestation record
 */
export function verifyPayloadHash(
  payload: Record<string, unknown>,
  expectedHash: string
): boolean {
  const canonical = canonicalJson(payload);
  const computed = sha256Hex(canonical);
  return timingSafeEqual(computed, expectedHash);
}

// ── Internal helpers ──────────────────────────────────────────────────

function canonicalJson(obj: unknown): string {
  return JSON.stringify(obj, Object.keys(obj as object).sort());
}

function sha256Hex(data: string): string {
  return createHash("sha256").update(data, "utf-8").digest("hex");
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a, "utf-8");
  const bufB = Buffer.from(b, "utf-8");
  return cryptoTimingSafeEqual(bufA, bufB);
}
