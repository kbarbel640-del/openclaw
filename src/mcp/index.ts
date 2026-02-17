/**
 * MCP (Model Context Protocol) client integration for OpenClaw.
 *
 * Re-exports public API for managing MCP server connections and
 * exposing MCP tools to the agent.
 */

export { connectMcpServer } from "./client.js";
export {
  getMcpHealthMonitor,
  McpHealthMonitor,
  resetHealthMonitorForTest,
  stopGlobalHealthMonitor,
} from "./health.js";
export {
  getMcpConnections,
  initializeMcpServers,
  isMcpInitialized,
  reinitializeMcpServers,
  resolveMcpTools,
  shutdownMcpServers,
} from "./manager.js";
export { createMcpToolsFromConnection, createMcpToolsFromConnections } from "./tools.js";
export {
  getMcpApprovalManager,
  McpApprovalManager,
  requiresMcpApproval,
  resolveApprovalMode,
} from "./approvals.js";
export type {
  McpApprovalDecision,
  McpApprovalHandler,
  McpApprovalRequest,
  McpApprovalResult,
} from "./approvals.js";
export type {
  McpApprovalMode,
  McpConfig,
  McpJsonSchema,
  McpServerConfig,
  McpServerConnection,
  McpToolCallResult,
  McpToolContent,
  McpToolDefinition,
  McpTransport,
} from "./types.js";
