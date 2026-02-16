import { randomBytes } from "node:crypto";
import * as ed from "@noble/ed25519";
import { sha512 } from "@noble/hashes/sha512";

// Configure @noble/ed25519 to use the synchronous SHA-512 hasher.
// This avoids the need for a WebCrypto subtle.digest polyfill in Node.
ed.etc.sha512Sync = (...messages: Uint8Array[]): Uint8Array => {
  const merged = new Uint8Array(
    messages.reduce((total, m) => total + m.length, 0),
  );
  let offset = 0;
  for (const m of messages) {
    merged.set(m, offset);
    offset += m.length;
  }
  return sha512(merged);
};

/** Default challenge TTL: 5 minutes. */
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export interface Challenge {
  nonce: string;
  expiresAt: number;
}

/**
 * Generate a cryptographic challenge for the auth handshake.
 *
 * Returns a 32-byte random hex nonce and an expiry timestamp.
 */
export function generateChallenge(): Challenge {
  const nonce = toHex(randomBytes(32));
  const expiresAt = Date.now() + CHALLENGE_TTL_MS;
  return { nonce, expiresAt };
}

/**
 * Verify an Ed25519 signature over a nonce.
 *
 * @param nonce        - The hex-encoded nonce that was signed.
 * @param signatureBase64 - The Base64-encoded Ed25519 signature.
 * @param publicKeyHex    - The hex-encoded 32-byte public key.
 * @returns `true` when the signature is valid.
 */
export function verifySignature(
  nonce: string,
  signatureBase64: string,
  publicKeyHex: string,
): boolean {
  try {
    const message = fromHex(nonce);
    const signature = Uint8Array.from(
      Buffer.from(signatureBase64, "base64"),
    );
    const publicKey = fromHex(publicKeyHex);

    if (signature.length !== 64) {
      return false;
    }
    if (publicKey.length !== 32) {
      return false;
    }

    return ed.verify(signature, message, publicKey);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Hex helpers
// ---------------------------------------------------------------------------

/**
 * Convert a `Uint8Array` (or Node `Buffer`) to a lowercase hex string.
 */
export function toHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex");
}

/**
 * Parse a hex string into a `Uint8Array`.
 *
 * @throws {Error} if the input contains invalid hex characters or has odd length.
 */
export function fromHex(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error("fromHex: input has odd length");
  }
  if (!/^[0-9a-fA-F]*$/.test(hex)) {
    throw new Error("fromHex: input contains non-hex characters");
  }
  return Uint8Array.from(Buffer.from(hex, "hex"));
}
