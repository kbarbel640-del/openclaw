/**
 * Transactional config changes with automatic rollback on startup failure.
 *
 * When a config change is applied with `rollbackOnFail: true`, a pending marker
 * is written before the change. On next startup, if the marker exists and the
 * gateway crashed quickly (within timeoutMs), the previous config is restored.
 */

import * as fs from "fs/promises";
import * as path from "path";
import { getLogger } from "../logging/logger.js";
import { CONFIG_PATH, STATE_DIR } from "./paths.js";

const log = getLogger();
const CONFIG_DIR = STATE_DIR;

const PENDING_MARKER_PATH = path.join(CONFIG_DIR, "config-pending.json");
const BACKUP_PATH = path.join(CONFIG_DIR, "openclaw.json.bak");

export interface ConfigPendingMarker {
  /** ISO timestamp when config change was applied */
  appliedAt: string;
  /** Path to backup file */
  rollbackTo: string;
  /** Crash detection window in ms */
  timeoutMs: number;
  /** What triggered the change */
  reason?: string;
  /** Session to notify on rollback */
  sessionKey?: string;
}

export interface PendingMarkerOptions {
  timeoutMs?: number;
  reason?: string;
  sessionKey?: string;
}

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Write a pending marker before applying a config change.
 * Also backs up the current config to .bak.
 */
export async function writePendingMarker(opts: PendingMarkerOptions = {}): Promise<void> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  // Backup current config
  try {
    await fs.copyFile(CONFIG_PATH, BACKUP_PATH);
    log.debug(`config-pending: backed up config to ${BACKUP_PATH}`);
  } catch (err) {
    log.warn(`config-pending: failed to backup config: ${err}`);
    // Continue anyway - we'll still write the marker
  }

  const marker: ConfigPendingMarker = {
    appliedAt: new Date().toISOString(),
    rollbackTo: BACKUP_PATH,
    timeoutMs,
    reason: opts.reason,
    sessionKey: opts.sessionKey,
  };

  await fs.writeFile(PENDING_MARKER_PATH, JSON.stringify(marker, null, 2), "utf-8");
  log.debug(`config-pending: wrote pending marker (timeout=${timeoutMs}ms)`);
}

/**
 * Clear the pending marker (called after successful startup or rollback).
 */
export async function clearPendingMarker(): Promise<void> {
  try {
    await fs.unlink(PENDING_MARKER_PATH);
    log.debug("config-pending: cleared pending marker");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      log.warn(`config-pending: failed to clear pending marker: ${err}`);
    }
  }
}

export interface RollbackResult {
  /** Whether a rollback was performed */
  rolledBack: boolean;
  /** Error message if rollback occurred */
  error?: string;
  /** Session key to notify */
  sessionKey?: string;
  /** Reason from the original change */
  reason?: string;
}

/**
 * Check for pending marker on startup and rollback if needed.
 * Should be called early in gateway startup, before loading config.
 *
 * Returns info about whether rollback occurred (for error injection).
 */
export async function checkPendingOnStartup(): Promise<RollbackResult> {
  let marker: ConfigPendingMarker;

  // Try to read the pending marker
  try {
    const content = await fs.readFile(PENDING_MARKER_PATH, "utf-8");
    marker = JSON.parse(content) as ConfigPendingMarker;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      // No pending marker - normal startup
      return { rolledBack: false };
    }
    log.warn(`config-pending: failed to read pending marker: ${err}`);
    return { rolledBack: false };
  }

  // Check if we crashed within the timeout window
  const appliedAt = new Date(marker.appliedAt).getTime();
  const now = Date.now();
  const elapsed = now - appliedAt;

  if (elapsed >= marker.timeoutMs) {
    // Config change succeeded - clear marker and continue
    log.info(
      `config-pending: config change successful (ran for ${Math.round(elapsed / 1000)}s), clearing marker`,
    );
    await clearPendingMarker();
    return { rolledBack: false };
  }

  // We crashed too quickly - rollback needed
  log.warn(
    `config-pending: startup crash detected (elapsed=${elapsed}ms < timeout=${marker.timeoutMs}ms), rolling back`,
  );

  // Capture error from logs if possible
  let capturedError: string | undefined;
  try {
    // Try to read last few lines of the log file for context
    const logDir = process.env.OPENCLAW_LOG_DIR ?? "/tmp/openclaw";
    const today = new Date().toISOString().split("T")[0];
    const logPath = path.join(logDir, `openclaw-${today}.log`);
    const logContent = await fs.readFile(logPath, "utf-8").catch(() => "");
    const lines = logContent.split("\n").slice(-50);
    const errorLines = lines.filter(
      (line) => line.includes("error") || line.includes("Error") || line.includes("FATAL"),
    );
    if (errorLines.length > 0) {
      capturedError = errorLines.slice(-3).join("\n");
    }
  } catch {
    // Ignore log capture errors
  }

  // Perform rollback
  try {
    await fs.copyFile(marker.rollbackTo, CONFIG_PATH);
    log.info(`config-pending: restored config from ${marker.rollbackTo}`);
  } catch (err) {
    log.error(`config-pending: CRITICAL - failed to restore config: ${err}`);
    // Clear marker anyway to prevent rollback loop
    await clearPendingMarker();
    return {
      rolledBack: false,
      error: `Failed to restore config: ${err}`,
    };
  }

  await clearPendingMarker();

  const errorMsg = capturedError
    ? `Startup failed within ${marker.timeoutMs}ms of config change.\nLast errors:\n${capturedError}`
    : `Startup failed within ${marker.timeoutMs}ms of config change (reason: ${marker.reason ?? "unknown"}).`;

  return {
    rolledBack: true,
    error: errorMsg,
    sessionKey: marker.sessionKey,
    reason: marker.reason,
  };
}

/**
 * Schedule clearing the pending marker after successful startup.
 * Call this once the gateway is confirmed running.
 */
export function schedulePendingMarkerClear(delayMs: number = 5000): void {
  setTimeout(async () => {
    try {
      const exists = await fs
        .access(PENDING_MARKER_PATH)
        .then(() => true)
        .catch(() => false);
      if (exists) {
        await clearPendingMarker();
        log.info("config-pending: startup confirmed successful, marker cleared");
      }
    } catch (err) {
      log.warn(`config-pending: failed to clear marker after startup: ${err}`);
    }
  }, delayMs);
}
