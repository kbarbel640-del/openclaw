/**
 * ACP (Agent Client Protocol) types for Clawdis.
 *
 * These supplement the types from @agentclientprotocol/sdk with
 * Clawdis-specific session state and mappings.
 */

/**
 * Internal session state tracked by the ACP server.
 */
export type AcpSessionState = {
  sessionId: string;
  cwd: string;
  createdAt: number;
  abortController: AbortController | null;
  /** Maps to Clawdis session key for getReplyFromConfig */
  clawdisSessionKey: string;
};

/**
 * Options for starting the ACP server.
 */
export type AcpServerOptions = {
  /** Working directory override */
  cwd?: string;
  /** Config path override */
  configPath?: string;
  /** Enable verbose logging to stderr */
  verbose?: boolean;
};

/**
 * Tool call kind for ACP (used in ToolCall.kind field).
 */
export type ToolCallKind = "read" | "edit" | "command" | "browser" | "other";

/**
 * Maps Clawdis tool names to ACP tool call kinds.
 */
export function mapToolKind(toolName: string): ToolCallKind {
  const name = toolName.toLowerCase();
  if (name.includes("read") || name === "glob" || name === "grep") {
    return "read";
  }
  if (name.includes("edit") || name.includes("write")) {
    return "edit";
  }
  if (name.includes("bash") || name.includes("exec") || name === "process") {
    return "command";
  }
  return "other";
}

/**
 * Agent info for initialization response.
 */
export type AgentInfo = {
  name: string;
  title: string;
  version: string;
};

/**
 * Agent info returned during initialization.
 */
export const CLAWDIS_AGENT_INFO: AgentInfo = {
  name: "clawd",
  title: "Clawd (Clawdis Agent)",
  version: "1.0.0", // TODO: pull from package.json
};
