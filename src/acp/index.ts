/**
 * ACP (Agent Client Protocol) module for Clawdis.
 *
 * Enables Clawd to run as an ACP-compatible coding agent,
 * allowing any ACP client (Zed, VS Code, etc.) to connect.
 */

export { ClawdisAgent } from "./agent.js";
export { serveAcp } from "./server.js";
export { AcpSessionAdapter } from "./session.js";
export {
  type AcpServerOptions,
  type AcpSessionState,
  CLAWDIS_AGENT_INFO,
  mapToolKind,
} from "./types.js";
