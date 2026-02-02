/**
 * Debug logging utility for Matrix monitor.
 * Disabled by default - set MATRIX_DEBUG_LOG env var to enable.
 */
import fs from "node:fs";

const DEBUG_LOG_PATH = process.env.MATRIX_DEBUG_LOG;

export function debugLog(message: string): void {
  if (!DEBUG_LOG_PATH) return;
  
  try {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ${message}\n`;
    fs.appendFileSync(DEBUG_LOG_PATH, line);
  } catch {
    // Ignore errors
  }
}
