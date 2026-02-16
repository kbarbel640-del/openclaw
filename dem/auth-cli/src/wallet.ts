import * as ed25519 from "@noble/ed25519";
import { sha512 } from "@noble/hashes/sha512";
import { writeFileSync, readFileSync, chmodSync } from "node:fs";

// Configure noble/ed25519 to use the synchronous sha512 hasher.
ed25519.etc.sha512Sync = (...messages: Uint8Array[]): Uint8Array => {
  const merged = concatBytes(...messages);
  return sha512(merged);
};

/** Concatenate multiple Uint8Arrays into one. */
function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  let totalLength = 0;
  for (const arr of arrays) totalLength += arr.length;
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

/** Convert a Uint8Array to a hex string. */
export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Convert a hex string to a Uint8Array. */
export function fromHex(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error("Invalid hex string: odd length");
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    const byte = parseInt(hex.slice(i, i + 2), 16);
    if (Number.isNaN(byte)) {
      throw new Error(`Invalid hex character at position ${i}`);
    }
    bytes[i / 2] = byte;
  }
  return bytes;
}

/** Generate a new Ed25519 keypair. */
export function generateKeypair(): {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
} {
  const privateKey = ed25519.utils.randomPrivateKey();
  const publicKey = ed25519.getPublicKey(privateKey);
  return { privateKey, publicKey };
}

/** Derive the public key from a private key. */
export function getPublicKey(privateKey: Uint8Array): Uint8Array {
  return ed25519.getPublicKey(privateKey);
}

/** Sign a message with a private key (synchronous). */
export function sign(
  message: Uint8Array,
  privateKey: Uint8Array,
): Uint8Array {
  return ed25519.sign(message, privateKey);
}

/** Verify a signature against a message and public key (synchronous). */
export function verify(
  message: Uint8Array,
  signature: Uint8Array,
  publicKey: Uint8Array,
): boolean {
  return ed25519.verify(signature, message, publicKey);
}

/**
 * Save a private key to disk as hex-encoded text.
 * The file is written with mode 0o600 (owner read/write only).
 */
export function savePrivateKey(key: Uint8Array, path: string): void {
  const hex = toHex(key);
  writeFileSync(path, hex + "\n", { encoding: "utf-8", mode: 0o600 });
  // Ensure permissions even if the file already existed.
  chmodSync(path, 0o600);
}

/** Load a hex-encoded private key from disk. */
export function loadPrivateKey(path: string): Uint8Array {
  const contents = readFileSync(path, "utf-8").trim();
  if (contents.length === 0) {
    throw new Error(`Private key file is empty: ${path}`);
  }
  return fromHex(contents);
}
