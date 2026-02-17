/**
 * MCP server lifecycle management.
 *
 * Manages the lifecycle of MCP server processes: start, connect,
 * list tools, call tools, and graceful shutdown.
 */

import type { AnyAgentTool } from "../tools/common.js";
import { McpClient } from "./client.js";
import { mcpToolsToAgentTools } from "./tool-bridge.js";
import type { McpConfig, McpServerState, McpToolCallResult } from "./types.js";

/**
 * Manages a set of MCP server connections for an agent session.
 */
export class McpServerManager {
  private clients = new Map<string, McpClient>();
  private states = new Map<string, McpServerState>();

  /**
   * Start all configured MCP servers and discover their tools.
   */
  async startAll(config: McpConfig): Promise<void> {
    const startPromises = Object.entries(config.servers).map(async ([name, serverConfig]) => {
      const client = new McpClient(name, serverConfig);
      this.clients.set(name, client);
      this.states.set(name, {
        name,
        tools: [],
        connected: false,
      });

      try {
        await client.connect();
        const tools = await client.listTools();
        this.states.set(name, { name, tools, connected: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.states.set(name, {
          name,
          tools: [],
          connected: false,
          error: message,
        });
        console.warn(`MCP server "${name}" failed to start: ${message}`);
      }
    });

    await Promise.allSettled(startPromises);
  }

  /**
   * Get all discovered tools from all connected MCP servers as Pi-AI AgentTools.
   */
  getAgentTools(): AnyAgentTool[] {
    const tools: AnyAgentTool[] = [];
    const callFn = this.callTool.bind(this);

    for (const [name, state] of this.states.entries()) {
      if (!state.connected || state.tools.length === 0) {
        continue;
      }
      tools.push(...mcpToolsToAgentTools(name, state.tools, callFn));
    }

    return tools;
  }

  /**
   * Call a tool on a specific MCP server.
   */
  async callTool(
    serverName: string,
    toolName: string,
    params: Record<string, unknown>,
  ): Promise<McpToolCallResult> {
    const client = this.clients.get(serverName);
    if (!client?.isConnected) {
      return {
        content: [{ type: "text", text: `MCP server "${serverName}" is not connected` }],
        isError: true,
      };
    }

    return client.callTool(toolName, params);
  }

  /**
   * Get the state of all MCP servers.
   */
  getServerStates(): McpServerState[] {
    return Array.from(this.states.values());
  }

  /**
   * Get the state of a specific MCP server.
   */
  getServerState(name: string): McpServerState | undefined {
    return this.states.get(name);
  }

  /**
   * Gracefully shut down all MCP server processes.
   */
  async shutdownAll(): Promise<void> {
    const shutdownPromises = Array.from(this.clients.values()).map(async (client) => {
      try {
        await client.disconnect();
      } catch {
        // Best-effort shutdown
      }
    });

    await Promise.allSettled(shutdownPromises);
    this.clients.clear();
    this.states.clear();
  }

  /**
   * Number of connected servers.
   */
  get connectedCount(): number {
    let count = 0;
    for (const state of this.states.values()) {
      if (state.connected) {
        count++;
      }
    }
    return count;
  }

  /**
   * Total number of available MCP tools across all servers.
   */
  get totalToolCount(): number {
    let count = 0;
    for (const state of this.states.values()) {
      if (state.connected) {
        count += state.tools.length;
      }
    }
    return count;
  }
}
