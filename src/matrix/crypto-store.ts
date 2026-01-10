import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveStateDir } from "../config/paths.js";

let indexedDBSetup = false;

/**
 * Matrix crypto store directory.
 * Default: ~/.clawdbot/matrix-crypto
 */
export function resolveMatrixCryptoDir(
  env: NodeJS.ProcessEnv = process.env,
  stateDir: string = resolveStateDir(env, os.homedir),
): string {
  const override = env.CLAWDBOT_MATRIX_CRYPTO_DIR?.trim();
  if (override) {
    const trimmed = override.trim();
    if (trimmed.startsWith("~")) {
      const expanded = trimmed.replace(/^~(?=$|[\\/])/, os.homedir());
      return path.resolve(expanded);
    }
    return path.resolve(trimmed);
  }
  return path.join(stateDir, "matrix-crypto");
}

/**
 * Ensure the crypto directory exists.
 */
export function ensureMatrixCryptoDir(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const dir = resolveMatrixCryptoDir(env);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Sanitize a user ID to be safe for use in a database prefix.
 * Removes special characters that could cause issues.
 */
export function sanitizeUserIdForPrefix(userId: string): string {
  // Replace @ and : with underscores for filesystem/db safety
  return userId.replace(/[@:]/g, "_").replace(/[^a-zA-Z0-9._-]/g, "");
}

/**
 * Set up fake-indexeddb for Node.js environment.
 * This must be called BEFORE initRustCrypto to allow the SDK to use IndexedDB.
 *
 * The crypto store will be persisted to ~/.clawdbot/matrix-crypto/.
 */
export async function setupNodeIndexedDB(
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  if (indexedDBSetup) return;

  // Ensure the crypto directory exists
  ensureMatrixCryptoDir(env);

  // Import and set up fake-indexeddb
  const fakeIndexedDB = await import("fake-indexeddb");

  // Set global IndexedDB APIs that matrix-js-sdk will use
  const globalObj = globalThis as typeof globalThis & {
    indexedDB?: IDBFactory;
    IDBKeyRange?: typeof IDBKeyRange;
  };

  globalObj.indexedDB = fakeIndexedDB.default;
  globalObj.IDBKeyRange = fakeIndexedDB.IDBKeyRange;

  indexedDBSetup = true;
}

/**
 * Check if IndexedDB has been set up for Node.js.
 */
export function isNodeIndexedDBSetup(): boolean {
  return indexedDBSetup;
}

/**
 * Reset the IndexedDB setup state (for testing purposes).
 */
export function resetNodeIndexedDBSetup(): void {
  indexedDBSetup = false;
}

/**
 * Bootstrap cross-signing using a recovery key.
 * This verifies the device by fetching cross-signing keys from SSSS.
 *
 * @param client - The Matrix client (already initialized with crypto)
 * @param recoveryKey - The 4x4 recovery key from Element security settings
 */
export async function bootstrapMatrixCrossSigning(
  client: import("matrix-js-sdk").MatrixClient,
  recoveryKey: string,
): Promise<void> {
  const crypto = client.getCrypto();
  if (!crypto) {
    throw new Error("Crypto not initialized - call initRustCrypto first");
  }

  // Import the recovery key decoder
  const { decodeRecoveryKey } = await import(
    "matrix-js-sdk/lib/crypto-api/recovery-key.js"
  );

  // Decode the recovery key to raw bytes
  const recoveryKeyBytes = decodeRecoveryKey(recoveryKey);

  // Check cross-signing status
  const crossSigningStatus = await crypto.getCrossSigningStatus();

  // If we don't have the private keys cached, we need to fetch them from SSSS
  if (!crossSigningStatus.privateKeysCachedLocally.masterKey) {
    // Bootstrap secret storage to fetch keys from SSSS using the recovery key
    // The getSecretStorageKey callback will be called to provide the key
    await crypto.bootstrapSecretStorage({
      createSecretStorageKey: async () => {
        // Return the existing recovery key (don't create new one)
        return {
          privateKey: recoveryKeyBytes,
          encodedPrivateKey: recoveryKey,
          keyInfo: {},
        };
      },
    });
  }

  // Bootstrap cross-signing - this will sign our device if needed
  await crypto.bootstrapCrossSigning({
    // We don't need auth for password login scenarios
    // (the device is already authenticated)
  });
}
