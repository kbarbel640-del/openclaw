/**
 * Application-wide constants.
 */

/** App identifier for system-level registration. */
export const APP_ID = "ai.openclaw.command-center";
export const APP_NAME = "OpenClaw Command Center";
export const APP_SHORT_NAME = "OCCC";

/** Default ports used by the OpenClaw gateway/bridge. */
export const DEFAULT_GATEWAY_PORT = 18789;
export const DEFAULT_BRIDGE_PORT = 18790;

/** MCP Bridge server port (host-side, for container→host requests). */
export const DEFAULT_MCP_BRIDGE_PORT = 18791;

/** REST API server port. */
export const DEFAULT_API_PORT = 18800;

/** Auth session timeout in milliseconds (30 minutes). */
export const AUTH_SESSION_TIMEOUT_MS = 30 * 60 * 1000;

/** Container integrity check interval in milliseconds (5 minutes). */
export const INTEGRITY_CHECK_INTERVAL_MS = 5 * 60 * 1000;

/** Backup schedule — daily at 3 AM local time. */
export const BACKUP_CRON = "0 3 * * *";

/** Docker image name used for OpenClaw containers. */
export const OPENCLAW_IMAGE = "openclaw:local";

/** User-facing names (never expose Docker terminology). */
export const USER_FACING = {
  environment: "OpenClaw Environment",
  gateway: "Core Service",
  cli: "Agent Terminal",
  sandbox: "Agent Workspace",
  container: "Service",
  image: "Package",
  volume: "Storage",
} as const;

/** LLM provider priority cascade. */
export const LLM_PRIORITY = [
  "anthropic",
  "google-gemini",
  "openai",
  "ollama",
] as const;

export type LLMProvider = (typeof LLM_PRIORITY)[number];

/** RBAC role hierarchy (higher index = more permissions). */
export const ROLE_HIERARCHY: Record<string, number> = {
  viewer: 0,
  operator: 1,
  admin: 2,
  "super-admin": 3,
};
