import * as crypto from "node:crypto";
/**
 * Tests for media encryption/decryption round-trip.
 *
 * Tests encryptAttachment and decryptAttachment from client/media.ts.
 * Since encryptAttachment is not exported, we test it indirectly through
 * the exported helpers and by reimplementing the encrypt logic using the
 * same crypto primitives to validate decryptAttachment.
 *
 * We also test the exported utility functions: mimeToMsgtype, isValidMxcUrl.
 */
import { describe, it, expect } from "vitest";
import {
  decryptAttachment,
  mimeToMsgtype,
  isValidMxcUrl,
  type EncryptedFile,
} from "../src/client/media.js";

// ── Helper: replicate encryptAttachment logic for testing ────────────
// encryptAttachment is not exported, so we replicate its logic here
// to create test fixtures for decryptAttachment.

function toBase64Url(buf: Buffer): string {
  return buf.toString("base64url");
}

function toUnpaddedBase64(buf: Buffer): string {
  return buf.toString("base64").replace(/=+$/, "");
}

function testEncryptAttachment(plaintext: Buffer): {
  ciphertext: Buffer;
  file: EncryptedFile;
} {
  const key = crypto.randomBytes(32);
  const ivBytes = Buffer.alloc(16);
  crypto.randomBytes(8).copy(ivBytes, 0);

  const cipher = crypto.createCipheriv("aes-256-ctr", key, ivBytes);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);

  const hash = crypto.createHash("sha256").update(ciphertext).digest();

  return {
    ciphertext,
    file: {
      url: "mxc://example.com/test",
      key: {
        kty: "oct",
        key_ops: ["encrypt", "decrypt"],
        alg: "A256CTR",
        k: toBase64Url(key),
        ext: true,
      },
      iv: toUnpaddedBase64(ivBytes),
      hashes: { sha256: toUnpaddedBase64(hash) },
      v: "v2",
    },
  };
}

describe("media encryption", () => {
  describe("encrypt/decrypt round-trip", () => {
    it("should round-trip small data", () => {
      const plaintext = Buffer.from("Hello, Matrix!");
      const { ciphertext, file } = testEncryptAttachment(plaintext);
      const decrypted = decryptAttachment(ciphertext, file);
      expect(decrypted).toEqual(plaintext);
    });

    it("should round-trip empty buffer", () => {
      const plaintext = Buffer.alloc(0);
      const { ciphertext, file } = testEncryptAttachment(plaintext);
      const decrypted = decryptAttachment(ciphertext, file);
      expect(decrypted).toEqual(plaintext);
    });

    it("should round-trip large data (1MB)", () => {
      const plaintext = crypto.randomBytes(1024 * 1024);
      const { ciphertext, file } = testEncryptAttachment(plaintext);
      const decrypted = decryptAttachment(ciphertext, file);
      expect(decrypted).toEqual(plaintext);
    });

    it("should round-trip binary data with all byte values", () => {
      const plaintext = Buffer.alloc(256);
      for (let i = 0; i < 256; i++) plaintext[i] = i;
      const { ciphertext, file } = testEncryptAttachment(plaintext);
      const decrypted = decryptAttachment(ciphertext, file);
      expect(decrypted).toEqual(plaintext);
    });

    it("should produce different ciphertext for same plaintext (random key/IV)", () => {
      const plaintext = Buffer.from("same content");
      const { ciphertext: ct1 } = testEncryptAttachment(plaintext);
      const { ciphertext: ct2 } = testEncryptAttachment(plaintext);
      // Extremely unlikely to be equal with random key+IV
      expect(ct1).not.toEqual(ct2);
    });
  });

  describe("hash validation", () => {
    it("should reject tampered ciphertext", () => {
      const plaintext = Buffer.from("secret data");
      const { ciphertext, file } = testEncryptAttachment(plaintext);
      // Tamper with ciphertext
      const tampered = Buffer.from(ciphertext);
      tampered[0] ^= 0xff;
      expect(() => decryptAttachment(tampered, file)).toThrow(/hash mismatch/);
    });

    it("should reject wrong hash in metadata", () => {
      const plaintext = Buffer.from("data");
      const { ciphertext, file } = testEncryptAttachment(plaintext);
      // Corrupt the hash
      const badFile = {
        ...file,
        hashes: { sha256: toUnpaddedBase64(crypto.randomBytes(32)) },
      };
      expect(() => decryptAttachment(ciphertext, badFile)).toThrow(/hash mismatch/);
    });
  });

  describe("algorithm validation", () => {
    it("should reject unsupported algorithm", () => {
      const plaintext = Buffer.from("data");
      const { ciphertext, file } = testEncryptAttachment(plaintext);
      const badFile = {
        ...file,
        key: { ...file.key, alg: "A128CTR" as any },
      };
      expect(() => decryptAttachment(ciphertext, badFile)).toThrow(
        /Unsupported encryption algorithm/,
      );
    });
  });

  describe("base64url conversion", () => {
    it("should handle key with padding-free base64url", () => {
      // Create a valid encrypted file and verify it decrypts
      const plaintext = Buffer.from("base64url test");
      const { ciphertext, file } = testEncryptAttachment(plaintext);
      // The key should be base64url (no padding, no + or /)
      expect(file.key.k.includes("=")).toBe(false);
      expect(file.key.k.includes("+")).toBe(false);
      expect(file.key.k.includes("/")).toBe(false);
      const decrypted = decryptAttachment(ciphertext, file);
      expect(decrypted).toEqual(plaintext);
    });

    it("should handle IV with unpadded base64", () => {
      const plaintext = Buffer.from("iv test");
      const { ciphertext, file } = testEncryptAttachment(plaintext);
      // IV should be unpadded base64
      expect(file.iv.includes("=")).toBe(false);
      const decrypted = decryptAttachment(ciphertext, file);
      expect(decrypted).toEqual(plaintext);
    });
  });
});

describe("mimeToMsgtype", () => {
  it("should map image MIME types", () => {
    expect(mimeToMsgtype("image/png")).toBe("m.image");
    expect(mimeToMsgtype("image/jpeg")).toBe("m.image");
    expect(mimeToMsgtype("image/gif")).toBe("m.image");
  });

  it("should map audio MIME types", () => {
    expect(mimeToMsgtype("audio/ogg")).toBe("m.audio");
    expect(mimeToMsgtype("audio/mp3")).toBe("m.audio");
  });

  it("should map video MIME types", () => {
    expect(mimeToMsgtype("video/mp4")).toBe("m.video");
    expect(mimeToMsgtype("video/webm")).toBe("m.video");
  });

  it("should default to m.file for unknown types", () => {
    expect(mimeToMsgtype("application/pdf")).toBe("m.file");
    expect(mimeToMsgtype("text/plain")).toBe("m.file");
    expect(mimeToMsgtype("")).toBe("m.file");
  });
});

describe("isValidMxcUrl", () => {
  it("should accept valid mxc URLs", () => {
    expect(isValidMxcUrl("mxc://matrix.org/abcdef123")).toBeTruthy();
    expect(isValidMxcUrl("mxc://example.com/media_id")).toBeTruthy();
    expect(isValidMxcUrl("mxc://localhost/1234")).toBeTruthy();
  });

  it("should reject invalid URLs", () => {
    expect(isValidMxcUrl("https://matrix.org/media")).toBe(false);
    expect(isValidMxcUrl("mxc://")).toBe(false);
    expect(isValidMxcUrl("mxc://server/")).toBe(false);
    expect(isValidMxcUrl("")).toBe(false);
    expect(isValidMxcUrl("mxc:///mediaId")).toBe(false);
  });
});
