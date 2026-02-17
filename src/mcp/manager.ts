/**
 * MCP manager — lifecycle orchestrator for MCP server connections.
 *
 * Provides a singleton-like manager that:
 * - Reads the MCP config section from OpenClawConfig
 * - Spawns and connects to all enabled MCP servers
 * - Exposes resolved MCP tools for inclusion in the agent tool set
 * - Handles graceful shutdown and disconnect
 */

import { defaultRuntime } from "../runtime.js";
import { connectMcpServer } from "./client.js";
import { getMcpHealthMonitor, stopGlobalHealthMonitor } from "./health.js";
import { createMcpToolsFromConnections } from "./tools.js";
import type { McpConfig, McpServerConfig, McpServerConnection } from "./types.js";
import type { AnyAgentTool } from "../agents/tools/common.js";

const log = {
  info: (...args: unknown[]) => defaultRuntime.log("[mcp]", ...args),
  error: (...args: unknown[]) => defaultRuntime.error("[mcp]", ...args),
};

// ---------------------------------------------------------------------------
// Manager state
// ---------------------------------------------------------------------------

let activeConnections: McpServerConnection[] = [];
let initialized = false;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialize all MCP server connections from the config.
 * Idempotent — if already initialized, this is a no-op.
 *
 * @param mcpConfig - The `mcp` section from OpenClawConfig.
 * @returns Array of established connections (may include errored ones).
 */
export async function initializeMcpServers(
  mcpConfig: McpConfig | undefined,
): Promise<McpServerConnection[]> {
  if (initialized) {
    return activeConnections;
  }

  if (!mcpConfig?.servers || Object.keys(mcpConfig.servers).length === 0) {
    initialized = true;
    return [];
  }

  if (mcpConfig.enabled === false) {
    log.info("MCP integration disabled by config");
    initialized = true;
    return [];
  }

  const entries = Object.entries(mcpConfig.servers).filter(
    ([, config]) => config.enabled !== false,
  );

  if (entries.length === 0) {
    initialized = true;
    return [];
  }

  log.info(`Connecting to ${entries.length} MCP server(s)...`);

  const connections = await Promise.allSettled(
    entries.map(([name, config]: [string, McpServerConfig]) => connectMcpServer(name, config)),
  );

  activeConnections = connections
    .filter(
      (result): result is PromiseFulfilledResult<McpServerConnection> =>
        result.status === "fulfilled",
    )
    .map((result) => result.value);

  // Log rejected connections.
  for (let i = 0; i < connections.length; i++) {
    const result = connections[i];
    if (result && result.status === "rejected") {
      const [name] = entries[i] ?? ["unknown"];
      log.error(`MCP server "${name}" failed to start: ${String(result.reason)}`);
    }
  }

  const connectedCount = activeConnections.filter((c) => c.status === "connected").length;
  log.info(
    `MCP: ${connectedCount}/${entries.length} server(s) connected, ` +
      `${activeConnections.reduce((sum, c) => sum + c.tools.length, 0)} total tool(s)`,
  );

  // Register connected servers for health monitoring.
  const monitor = getMcpHealthMonitor();
  for (const conn of activeConnections) {
    if (conn.status === "connected" && conn.config.healthCheckIntervalMs && conn.config.healthCheckIntervalMs > 0) {
      monitor.register(conn);
    }
  }

  initialized = true;
  return activeConnections;
}

/**
 * Create OpenClaw AgentTool objects from all active MCP connections.
 *
 * @param existingToolNames - Set of already-registered tool names for conflict detection.
 * @returns Array of MCP-backed AgentTool objects.
 */
export function resolveMcpTools(existingToolNames?: Set<string>): AnyAgentTool[] {
  if (!initialized || activeConnections.length === 0) {
    return [];
  }

  return createMcpToolsFromConnections(activeConnections, existingToolNames);
}

/**
 * Disconnect all MCP servers and reset manager state.
 */
export async function shutdownMcpServers(): Promise<void> {
  // Stop health monitoring before disconnecting.
  stopGlobalHealthMonitor();

  if (activeConnections.length === 0) {
    initialized = false;
    return;
  }

  log.info(`Disconnecting ${activeConnections.length} MCP server(s)...`);

  await Promise.allSettled(activeConnections.map((conn) => conn.disconnect()));

  activeConnections = [];
  initialized = false;

  log.info("MCP: all servers disconnected");
}

/**
 * Get the current list of active MCP server connections.
 */
export function getMcpConnections(): readonly McpServerConnection[] {
  return activeConnections;
}

/**
 * Check if MCP has been initialized.
 */
export function isMcpInitialized(): boolean {
  return initialized;
}

/**
 * Re-initialize MCP connections. Useful when config changes.
 *
 * @param mcpConfig - The updated `mcp` section from OpenClawConfig.
 * @returns Fresh array of connections.
 */
export async function reinitializeMcpServers(
  mcpConfig: McpConfig | undefined,
): Promise<McpServerConnection[]> {
  await shutdownMcpServers();
  return initializeMcpServers(mcpConfig);
}
