import type { AccessTier } from '../../core/types/access-tier.js';
import type { McpServerConfig, ToolCategory, ToolDefinition } from '../domain/types.js';

interface ToolEntry {
  readonly tool: ToolDefinition;
  readonly server: McpServerConfig;
}

export interface ToolFilter {
  readonly category?: ToolCategory;
  readonly tier?: AccessTier;
}

/**
 * Central registry for all MCP tools across all servers
 */
export class ToolRegistry {
  private readonly tools = new Map<string, ToolEntry>();
  private readonly servers = new Map<string, McpServerConfig>();

  /**
   * Register all tools from an MCP server
   */
  register(server: McpServerConfig): void {
    this.servers.set(server.serverId, server);

    for (const tool of server.tools) {
      this.tools.set(tool.name, { tool, server });
    }
  }

  /**
   * Unregister an MCP server and all its tools
   */
  unregister(serverId: string): void {
    const server = this.servers.get(serverId);
    if (!server) return;

    for (const tool of server.tools) {
      this.tools.delete(tool.name);
    }

    this.servers.delete(serverId);
  }

  /**
   * Find a specific tool by name
   */
  findTool(toolName: string): ToolDefinition | undefined {
    return this.tools.get(toolName)?.tool;
  }

  /**
   * List all tools, optionally filtered
   */
  listTools(filter?: ToolFilter): ToolDefinition[] {
    const allTools = Array.from(this.tools.values()).map(entry => entry.tool);

    if (!filter) return allTools;

    return allTools.filter(tool => {
      if (filter.category && tool.category !== filter.category) return false;
      if (filter.tier && tool.requiredTier !== filter.tier) return false;
      return true;
    });
  }

  /**
   * Get the server that provides a specific tool
   */
  getServer(toolName: string): McpServerConfig | undefined {
    return this.tools.get(toolName)?.server;
  }
}
