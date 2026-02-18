/**
 * DO-001: Encrypted credential storage using AES-256-GCM.
 * Provides a simple key-value store that encrypts values at rest.
 * The master key is hashed via SHA-256 to produce a 32-byte AES key.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const ALGORITHM = "aes-256-gcm";
const KEY_LEN = 32; // 256 bits
const IV_LEN = 12;  // 96 bits for GCM
const DEFAULT_STORE_DIR = path.join(os.homedir(), ".openclaw", "secure");

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
}

/** Hash a string master key to exactly KEY_LEN bytes via SHA-256. */
function keyFromString(masterKey: string): Buffer {
  return crypto.createHash("sha256").update(masterKey, "utf8").digest();
}

interface StoreEntry {
  iv: string;   // hex
  tag: string;  // hex
  ct: string;   // hex (ciphertext)
}

type StoreData = Record<string, StoreEntry>;

/**
 * AES-256-GCM encrypted key-value store.
 *
 * @example
 * ```ts
 * const store = new EncryptedStore("/tmp/mystore", "my-master-key");
 * store.set("openai", "sk-...");
 * const key = store.get("openai");
 * ```
 */
export class EncryptedStore {
  private readonly key: Buffer;
  private readonly filePath: string;

  /**
   * @param storeDir   Directory to persist the encrypted store file.
   * @param masterKey  Passphrase used to derive the AES-256 key (hashed via SHA-256).
   */
  constructor(storeDir: string, masterKey: string) {
    this.key = keyFromString(masterKey);
    const dir = storeDir ?? DEFAULT_STORE_DIR;
    ensureDir(dir);
    this.filePath = path.join(dir, "store.enc.json");
  }

  /** Encrypt and store a value. */
  set(name: string, value: string): void {
    const data = this.load();
    const iv = crypto.randomBytes(IV_LEN);
    const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv);
    const ct = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    data[name] = {
      iv: iv.toString("hex"),
      tag: tag.toString("hex"),
      ct: ct.toString("hex"),
    };
    this.save(data);
  }

  /** Decrypt and return a stored value, or undefined if not found. */
  get(name: string): string | undefined {
    const data = this.load();
    const entry = data[name];
    if (!entry) return undefined;
    try {
      const iv = Buffer.from(entry.iv, "hex");
      const tag = Buffer.from(entry.tag, "hex");
      const ct = Buffer.from(entry.ct, "hex");
      const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv);
      decipher.setAuthTag(tag);
      return decipher.update(ct) + decipher.final("utf8");
    } catch {
      return undefined;
    }
  }

  /** Remove a stored entry. */
  delete(name: string): void {
    const data = this.load();
    delete data[name];
    this.save(data);
  }

  /** Check whether a key exists. */
  has(name: string): boolean {
    return name in this.load();
  }

  /** List all stored key names (not values). */
  keys(): string[] {
    return Object.keys(this.load());
  }

  private load(): StoreData {
    if (!fs.existsSync(this.filePath)) return {};
    try {
      const raw = fs.readFileSync(this.filePath, "utf8");
      return JSON.parse(raw) as StoreData;
    } catch {
      return {};
    }
  }

  private save(data: StoreData): void {
    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), {
      mode: 0o600,
      encoding: "utf8",
    });
  }
}
