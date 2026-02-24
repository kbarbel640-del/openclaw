/**
 * IPC Auth Guards — session validation helpers for IPC handlers.
 *
 * Extracted from ipc-handlers.ts so they can be unit-tested independently
 * without importing from electron.
 */

import { resolve, isAbsolute } from "node:path";
import type { SessionManager } from "./auth/session-manager.js";
import type { StackConfig } from "./docker/compose-orchestrator.js";

/**
 * Resolves and validates a session token. Throws if absent or expired.
 * Refreshes the idle timeout as a side-effect via SessionManager.resolve().
 */
export function requireSession(token: unknown, sessions: SessionManager): void {
  if (typeof token !== "string" || !sessions.resolve(token)) {
    throw new Error("Unauthorized");
  }
}

/**
 * Like requireSession but also enforces session.elevated === true.
 * Required for destructive writes: ENV_CREATE, ENV_DESTROY.
 */
export function requireElevatedSession(token: unknown, sessions: SessionManager): void {
  if (typeof token !== "string") { throw new Error("Unauthorized"); }
  const session = sessions.resolve(token);
  if (!session) { throw new Error("Unauthorized"); }
  if (!session.elevated) { throw new Error("Elevated session required"); }
}

/**
 * Validate and sanitize the raw ENV_CREATE payload from the renderer.
 *
 * Rules:
 *   - configDir / workspaceDir: non-empty, absolute, no null bytes
 *   - gatewayToken: non-empty string, ≤ 512 chars, no null bytes
 *
 * Returns a well-typed StackConfig with paths normalized via path.resolve().
 * Throws a descriptive Error on any violation.
 */
export function validateStackConfig(raw: unknown): StackConfig {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Invalid environment config: expected object");
  }
  const obj = raw as Record<string, unknown>;

  const { configDir, workspaceDir, gatewayToken } = obj;

  if (typeof configDir !== "string" || !configDir) {
    throw new Error("configDir must be a non-empty string");
  }
  if (!isAbsolute(configDir) || configDir.includes("\0")) {
    throw new Error("configDir must be an absolute path without null bytes");
  }
  if (typeof workspaceDir !== "string" || !workspaceDir) {
    throw new Error("workspaceDir must be a non-empty string");
  }
  if (!isAbsolute(workspaceDir) || workspaceDir.includes("\0")) {
    throw new Error("workspaceDir must be an absolute path without null bytes");
  }
  if (typeof gatewayToken !== "string" || !gatewayToken) {
    throw new Error("gatewayToken must be a non-empty string");
  }
  if (gatewayToken.length > 512 || gatewayToken.includes("\0")) {
    throw new Error("gatewayToken is invalid");
  }

  return {
    configDir: resolve(configDir),    // normalize without changing semantics
    workspaceDir: resolve(workspaceDir),
    gatewayToken,
    gatewayPort: typeof obj.gatewayPort === "number" ? obj.gatewayPort : undefined,
    bridgePort: typeof obj.bridgePort === "number" ? obj.bridgePort : undefined,
    image: typeof obj.image === "string" && obj.image ? obj.image : undefined,
  };
}
