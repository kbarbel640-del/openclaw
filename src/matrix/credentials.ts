import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveStateDir } from "../config/paths.js";

/**
 * Stored Matrix credentials after password login.
 * These are cached to avoid re-logging in on every restart.
 */
export type MatrixStoredCredentials = {
  homeserver: string;
  userId: string;
  accessToken: string;
  deviceId: string;
  /** Timestamp when credentials were obtained */
  createdAt: string;
  /** Timestamp when credentials were last used successfully */
  lastUsedAt?: string;
};

const CREDENTIALS_FILENAME = "credentials.json";

/**
 * Resolve the Matrix credentials directory.
 * Default: ~/.clawdbot/credentials/matrix/
 */
export function resolveMatrixCredentialsDir(
  env: NodeJS.ProcessEnv = process.env,
  stateDir: string = resolveStateDir(env, os.homedir)
): string {
  return path.join(stateDir, "credentials", "matrix");
}

/**
 * Resolve the Matrix credentials file path.
 */
export function resolveMatrixCredentialsPath(
  env: NodeJS.ProcessEnv = process.env
): string {
  const dir = resolveMatrixCredentialsDir(env);
  return path.join(dir, CREDENTIALS_FILENAME);
}

/**
 * Load stored Matrix credentials if they exist.
 */
export function loadMatrixCredentials(
  env: NodeJS.ProcessEnv = process.env
): MatrixStoredCredentials | null {
  const credPath = resolveMatrixCredentialsPath(env);
  try {
    if (!fs.existsSync(credPath)) return null;
    const raw = fs.readFileSync(credPath, "utf-8");
    const parsed = JSON.parse(raw) as Partial<MatrixStoredCredentials>;
    // Validate required fields
    if (
      typeof parsed.homeserver !== "string" ||
      typeof parsed.userId !== "string" ||
      typeof parsed.accessToken !== "string" ||
      typeof parsed.deviceId !== "string"
    ) {
      return null;
    }
    return parsed as MatrixStoredCredentials;
  } catch {
    return null;
  }
}

/**
 * Save Matrix credentials after successful login.
 */
export function saveMatrixCredentials(
  credentials: Omit<MatrixStoredCredentials, "createdAt" | "lastUsedAt">,
  env: NodeJS.ProcessEnv = process.env
): void {
  const dir = resolveMatrixCredentialsDir(env);
  fs.mkdirSync(dir, { recursive: true });

  const credPath = resolveMatrixCredentialsPath(env);

  // Check if we have existing credentials to preserve createdAt
  const existing = loadMatrixCredentials(env);
  const now = new Date().toISOString();

  const toSave: MatrixStoredCredentials = {
    ...credentials,
    createdAt: existing?.createdAt ?? now,
    lastUsedAt: now,
  };

  fs.writeFileSync(credPath, JSON.stringify(toSave, null, 2), "utf-8");
}

/**
 * Update the lastUsedAt timestamp for existing credentials.
 */
export function touchMatrixCredentials(
  env: NodeJS.ProcessEnv = process.env
): void {
  const existing = loadMatrixCredentials(env);
  if (!existing) return;

  existing.lastUsedAt = new Date().toISOString();
  const credPath = resolveMatrixCredentialsPath(env);
  fs.writeFileSync(credPath, JSON.stringify(existing, null, 2), "utf-8");
}

/**
 * Clear stored Matrix credentials.
 * Call this when credentials are invalid or user wants to re-authenticate.
 */
export function clearMatrixCredentials(
  env: NodeJS.ProcessEnv = process.env
): void {
  const credPath = resolveMatrixCredentialsPath(env);
  try {
    if (fs.existsSync(credPath)) {
      fs.unlinkSync(credPath);
    }
  } catch {
    // Ignore errors
  }
}

/**
 * Check if stored credentials match the expected configuration.
 * Returns false if homeserver or userId have changed.
 */
export function credentialsMatchConfig(
  stored: MatrixStoredCredentials,
  config: { homeserver: string; userId: string }
): boolean {
  return (
    stored.homeserver === config.homeserver && stored.userId === config.userId
  );
}
