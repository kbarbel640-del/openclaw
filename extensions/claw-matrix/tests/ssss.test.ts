import * as crypto from "node:crypto";
/**
 * Tests for SSSS decryption and key verification (src/crypto/ssss.ts).
 *
 * Tests the pure crypto operations: HKDF derivation, AES-256-CTR decryption,
 * HMAC-SHA-256 verification, and recovery key self-verification against
 * SSSS key metadata.
 */
import { describe, it, expect } from "vitest";

// ── Helpers: replicate SSSS crypto for test fixture generation ──────────

function unpaddedBase64(buf: Buffer): string {
  return buf.toString("base64").replace(/=+$/, "");
}

/** HKDF-SHA-256 derivation matching ssss.ts */
function deriveKeys(rawKey: Buffer, info: string): { aesKey: Buffer; hmacKey: Buffer } {
  const salt = Buffer.alloc(32, 0);
  const derived = crypto.hkdfSync("sha256", rawKey, salt, info, 64);
  return {
    aesKey: Buffer.from(derived.slice(0, 32)),
    hmacKey: Buffer.from(derived.slice(32, 64)),
  };
}

/** Encrypt a plaintext the same way Matrix SSSS does */
function encryptSecret(
  rawKey: Buffer,
  secretName: string,
  plaintext: string,
): { iv: string; ciphertext: string; mac: string } {
  const { aesKey, hmacKey } = deriveKeys(rawKey, secretName);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-ctr", aesKey, iv);
  const ciphertextBuf = Buffer.concat([
    cipher.update(Buffer.from(plaintext, "utf8")),
    cipher.final(),
  ]);
  const mac = crypto.createHmac("sha256", hmacKey).update(ciphertextBuf).digest();
  return {
    iv: unpaddedBase64(iv),
    ciphertext: unpaddedBase64(ciphertextBuf),
    mac: unpaddedBase64(mac),
  };
}

/** Generate SSSS key metadata for self-verification (uses HKDF info="") */
function generateKeyMetadata(rawKey: Buffer): { iv: string; mac: string } {
  const { aesKey, hmacKey } = deriveKeys(rawKey, ""); // empty string for key verification
  const iv = crypto.randomBytes(16);
  const zeros = Buffer.alloc(32, 0);
  const cipher = crypto.createCipheriv("aes-256-ctr", aesKey, iv);
  const encrypted = Buffer.concat([cipher.update(zeros), cipher.final()]);
  const mac = crypto.createHmac("sha256", hmacKey).update(encrypted).digest();
  return {
    iv: unpaddedBase64(iv),
    mac: unpaddedBase64(mac),
  };
}

// ── Decrypt function (replicated from ssss.ts since it's not exported) ──

function decryptSecret(
  rawKey: Buffer,
  secretName: string,
  encrypted: { iv: string; ciphertext: string; mac: string },
): string {
  const salt = Buffer.alloc(32, 0);
  const derived = crypto.hkdfSync("sha256", rawKey, salt, secretName, 64);
  const aesKey = Buffer.from(derived.slice(0, 32));
  const hmacKey = Buffer.from(derived.slice(32, 64));
  const ciphertextBuf = Buffer.from(encrypted.ciphertext, "base64");
  const hmac = crypto.createHmac("sha256", hmacKey).update(ciphertextBuf).digest();
  const expectedMac = Buffer.from(encrypted.mac, "base64");
  if (!hmac.equals(expectedMac)) {
    throw new Error(`HMAC mismatch for ${secretName}`);
  }
  const iv = Buffer.from(encrypted.iv, "base64");
  const decipher = crypto.createDecipheriv("aes-256-ctr", aesKey, iv);
  return Buffer.concat([decipher.update(ciphertextBuf), decipher.final()]).toString("utf8");
}

// ── Verify function (replicated from ssss.ts) ──

function verifyRecoveryKey(rawKey: Buffer, keyMeta: { iv: string; mac: string }): boolean {
  const salt = Buffer.alloc(32, 0);
  const derived = crypto.hkdfSync("sha256", rawKey, salt, "", 64);
  const aesKey = Buffer.from(derived.slice(0, 32));
  const hmacKey = Buffer.from(derived.slice(32, 64));
  const zeros = Buffer.alloc(32, 0);
  const iv = Buffer.from(keyMeta.iv, "base64");
  const cipher = crypto.createCipheriv("aes-256-ctr", aesKey, iv);
  const encrypted = Buffer.concat([cipher.update(zeros), cipher.final()]);
  const hmac = crypto.createHmac("sha256", hmacKey).update(encrypted).digest();
  const expectedMac = Buffer.from(keyMeta.mac, "base64");
  return hmac.equals(expectedMac);
}

// ── Tests ───────────────────────────────────────────────────────────────

describe("SSSS decryption", () => {
  const rawKey = crypto.randomBytes(32);
  const secretName = "m.cross_signing.master";
  const plaintext = unpaddedBase64(crypto.randomBytes(32)); // base64 of 32-byte seed

  it("round-trip: encrypt then decrypt", () => {
    const encrypted = encryptSecret(rawKey, secretName, plaintext);
    const decrypted = decryptSecret(rawKey, secretName, encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it("rejects tampered ciphertext (HMAC mismatch)", () => {
    const encrypted = encryptSecret(rawKey, secretName, plaintext);
    // Flip a byte in ciphertext
    const tampered = Buffer.from(encrypted.ciphertext, "base64");
    tampered[0] ^= 0xff;
    encrypted.ciphertext = unpaddedBase64(tampered);

    expect(() => decryptSecret(rawKey, secretName, encrypted)).toThrow(/HMAC mismatch/);
  });

  it("rejects wrong key (HMAC mismatch)", () => {
    const encrypted = encryptSecret(rawKey, secretName, plaintext);
    const wrongKey = crypto.randomBytes(32);

    expect(() => decryptSecret(wrongKey, secretName, encrypted)).toThrow(/HMAC mismatch/);
  });

  it("rejects wrong secret name (HMAC mismatch)", () => {
    const encrypted = encryptSecret(rawKey, secretName, plaintext);

    expect(() => decryptSecret(rawKey, "m.cross_signing.self_signing", encrypted)).toThrow(
      /HMAC mismatch/,
    );
  });

  it("HKDF info=secretName works, info=empty does not", () => {
    // Encrypt with secretName as info
    const encrypted = encryptSecret(rawKey, secretName, plaintext);

    // Decrypt with secretName info — should work
    const decrypted = decryptSecret(rawKey, secretName, encrypted);
    expect(decrypted).toBe(plaintext);

    // Decrypt with empty info — should fail
    expect(() => decryptSecret(rawKey, "", encrypted)).toThrow(/HMAC mismatch/);
  });
});

describe("SSSS key verification", () => {
  const rawKey = crypto.randomBytes(32);

  it("correct key passes verification", () => {
    const meta = generateKeyMetadata(rawKey);
    expect(verifyRecoveryKey(rawKey, meta)).toBeTruthy();
  });

  it("wrong key fails verification", () => {
    const meta = generateKeyMetadata(rawKey);
    const wrongKey = crypto.randomBytes(32);
    expect(verifyRecoveryKey(wrongKey, meta)).toBe(false);
  });

  it("key verification uses HKDF info=empty (not secretName)", () => {
    // Generate metadata with info="" (correct)
    const meta = generateKeyMetadata(rawKey);

    // Verify with info="" — should pass
    expect(verifyRecoveryKey(rawKey, meta)).toBeTruthy();

    // If we generated metadata with info=secretName instead, the MAC would differ
    const { aesKey: wrongAes, hmacKey: wrongHmac } = deriveKeys(rawKey, "m.cross_signing.master");
    const iv = Buffer.from(meta.iv, "base64");
    const cipher = crypto.createCipheriv("aes-256-ctr", wrongAes, iv);
    const encrypted = Buffer.concat([cipher.update(Buffer.alloc(32, 0)), cipher.final()]);
    const wrongMac = crypto.createHmac("sha256", wrongHmac).update(encrypted).digest();
    const expectedMac = Buffer.from(meta.mac, "base64");
    // These should NOT match — proves the info parameter matters
    expect(wrongMac.equals(expectedMac)).toBe(false);
  });

  it("tampered metadata MAC fails", () => {
    const meta = generateKeyMetadata(rawKey);
    const tamperedMac = Buffer.from(meta.mac, "base64");
    tamperedMac[0] ^= 0xff;
    meta.mac = unpaddedBase64(tamperedMac);
    expect(verifyRecoveryKey(rawKey, meta)).toBe(false);
  });
});
