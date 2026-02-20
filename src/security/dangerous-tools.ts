// Shared tool-risk constants.
// Keep these centralized so gateway HTTP restrictions, security audits, and ACP prompts don't drift.

/**
 * High-risk tools that should never be exposed over HTTP accidentally.
 * These are used by security audits and policy checks.
 */
export const DEFAULT_GATEWAY_HTTP_TOOL_DENY = [
  // Session orchestration — spawning agents remotely is RCE
  "sessions_spawn",
  // Cross-session injection — message injection across sessions
  "sessions_send",
  // Gateway control plane — prevents gateway reconfiguration via HTTP
  "gateway",
  // Interactive setup — requires terminal QR scan, hangs on HTTP
  "whatsapp_login",
] as const;

/**
 * ACP tools that should always require explicit user approval.
 * ACP is an automation surface; we never want "silent yes" for mutating/execution tools.
 */
export const DANGEROUS_ACP_TOOL_NAMES = [
  "exec",
  "spawn",
  "shell",
  "sessions_spawn",
  "sessions_send",
  "gateway",
  "fs_write",
  "fs_delete",
  "fs_move",
  "apply_patch",
] as const;

export const DANGEROUS_ACP_TOOLS = new Set<string>(DANGEROUS_ACP_TOOL_NAMES);
