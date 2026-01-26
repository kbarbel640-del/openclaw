/**
 * Credential extraction from kiro-cli SQLite database.
 *
 * kiro-cli stores OAuth tokens in a SQLite database at:
 * - Primary: ~/.local/share/kiro-cli/data.sqlite3
 * - Fallback: ~/.local/share/amazon-q/data.sqlite3
 *
 * Tokens are stored in the `auth_kv` table with keys:
 * - Primary: kirocli:odic:token
 * - Fallback: codewhisperer:odic:token
 */

import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { join } from "node:path";

const require = createRequire(import.meta.url);

/**
 * Dynamically imports node:sqlite to avoid experimental warning at module load time.
 */
function getNodeSqlite(): typeof import("node:sqlite") {
  return require("node:sqlite") as typeof import("node:sqlite");
}

/**
 * Token structure stored in kiro-cli database.
 *
 * This matches the JSON format stored in the auth_kv table:
 * ```json
 * {
 *   "access_token": "aoaAAAAAGl31Hk7Q...",
 *   "expires_at": "2026-01-26T20:54:18.4194651Z",
 *   "refresh_token": "aorAAAAAGnubV8kF...",
 *   "region": "eu-central-1",
 *   "start_url": "https://d-99672d8019.awsapps.com/start",
 *   "oauth_flow": "DeviceCode",
 *   "scopes": ["codewhisperer:completions", "codewhisperer:analysis", "codewhisperer:conversations"]
 * }
 * ```
 */
export type KiroCliToken = {
  /** Bearer token for API calls */
  access_token: string;
  /** Token for refreshing access */
  refresh_token: string;
  /** ISO 8601 expiration timestamp */
  expires_at: string;
  /** AWS region (e.g., "eu-central-1") */
  region: string;
  /** SSO start URL */
  start_url: string;
  /** OAuth flow type (e.g., "DeviceCode") */
  oauth_flow: string;
  /** Granted OAuth scopes */
  scopes: string[];
};

/**
 * Database paths to check, in order of precedence.
 * - Primary: kiro-cli's own database
 * - Fallback: Legacy Amazon Q / CodeWhisperer database
 */
const KIRO_CLI_DB_PATHS = [
  ".local/share/kiro-cli/data.sqlite3",
  ".local/share/amazon-q/data.sqlite3",
] as const;

/**
 * Token keys to check in the auth_kv table, in order of precedence.
 * - Primary: kirocli:odic:token (kiro-cli's own key)
 * - Fallback: codewhisperer:odic:token (legacy Amazon Q key)
 */
const TOKEN_KEYS = ["kirocli:odic:token", "codewhisperer:odic:token"] as const;

/**
 * Finds the kiro-cli SQLite database path.
 * Checks primary and fallback locations.
 *
 * @returns Database path or null if not found
 *
 * @example
 * ```ts
 * const dbPath = findKiroCliDatabase();
 * if (dbPath) {
 *   console.log(`Found database at: ${dbPath}`);
 * } else {
 *   console.log("kiro-cli database not found");
 * }
 * ```
 */
export function findKiroCliDatabase(): string | null {
  const home = homedir();

  for (const relativePath of KIRO_CLI_DB_PATHS) {
    const fullPath = join(home, relativePath);
    if (existsSync(fullPath)) {
      return fullPath;
    }
  }

  return null;
}

/**
 * Extracts OAuth token from kiro-cli database.
 * Tries primary key first, then fallback key.
 *
 * @returns Parsed token or null if not found
 *
 * @example
 * ```ts
 * const token = extractKiroCliToken();
 * if (token) {
 *   console.log(`Token expires at: ${token.expires_at}`);
 *   console.log(`Region: ${token.region}`);
 * } else {
 *   console.log("No kiro-cli token found");
 * }
 * ```
 */
export function extractKiroCliToken(): KiroCliToken | null {
  const dbPath = findKiroCliDatabase();
  if (!dbPath) {
    return null;
  }

  let db: import("node:sqlite").DatabaseSync | null = null;
  try {
    const { DatabaseSync } = getNodeSqlite();
    db = new DatabaseSync(dbPath, { readOnly: true });

    // Try each token key in order of precedence
    for (const key of TOKEN_KEYS) {
      const stmt = db.prepare("SELECT value FROM auth_kv WHERE key = ?");
      const row = stmt.get(key) as { value: string } | undefined;

      if (row?.value) {
        const parsed = JSON.parse(row.value) as KiroCliToken;
        // Validate required fields are present
        if (
          parsed.access_token &&
          parsed.refresh_token &&
          parsed.expires_at &&
          parsed.region
        ) {
          return parsed;
        }
      }
    }

    return null;
  } catch {
    // Database read or JSON parse error - treat as no token found
    return null;
  } finally {
    // Always close the database connection
    if (db) {
      try {
        db.close();
      } catch {
        // Ignore close errors
      }
    }
  }
}

/** Default buffer time before expiration: 5 minutes in milliseconds */
const DEFAULT_EXPIRATION_BUFFER_MS = 5 * 60 * 1000;

/**
 * Checks if a token is expired or about to expire.
 *
 * Note: This checks the access_token expiration. Even if the access token
 * is expired, kiro-cli can still work if the refresh_token is valid.
 * We use this primarily for informational purposes - kiro-cli handles
 * the actual token refresh internally.
 *
 * @param token The token to check
 * @param bufferMs Buffer time before expiration (default: 5 minutes / 300000ms)
 * @returns true if token is expired or expires within buffer
 */
export function isTokenExpired(
  token: KiroCliToken,
  bufferMs: number = DEFAULT_EXPIRATION_BUFFER_MS,
): boolean {
  const expirationTime = new Date(token.expires_at).getTime();
  const currentTime = Date.now();

  // Handle invalid date parsing (NaN)
  if (Number.isNaN(expirationTime)) {
    // If we can't parse the expiration, assume token is valid
    // and let kiro-cli handle the actual validation
    return false;
  }

  // Token is expired if current time + buffer >= expiration time
  return currentTime + bufferMs >= expirationTime;
}

/**
 * Checks if a token has a valid refresh token that kiro-cli can use.
 * Even if the access token is expired, kiro-cli can refresh it.
 *
 * @param token The token to check
 * @returns true if the token has a refresh token
 */
export function hasValidRefreshToken(token: KiroCliToken): boolean {
  return Boolean(token.refresh_token && token.refresh_token.length > 0);
}
