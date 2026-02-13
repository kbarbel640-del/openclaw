import type { Result } from '../../core/types/result.js';
import type { McpError } from '../domain/errors.js';
import type { ToolDefinition, ToolInvocation, ToolResult } from '../domain/types.js';

/**
 * Port for interacting with MCP servers
 * Adapters implement connection to actual MCP server processes
 */
export interface IMcpServerPort {
  /**
   * Establish connection to the MCP server
   */
  connect(): Promise<Result<void, McpError>>;

  /**
   * Close connection to the MCP server
   */
  disconnect(): Promise<void>;

  /**
   * List all tools provided by this server
   */
  listTools(): Promise<Result<ToolDefinition[], McpError>>;

  /**
   * Invoke a tool on this server
   */
  invokeTool(invocation: ToolInvocation): Promise<Result<ToolResult, McpError>>;

  /**
   * Check if server is currently connected
   */
  isConnected(): boolean;
}
