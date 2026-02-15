/**
 * MCP (Model Context Protocol) integration types.
 *
 * Defines types for connecting to MCP servers and exposing
 * their tools to the Pi-AI agent runtime.
 */

/**
 * Configuration for a single MCP server.
 */
export type McpServerConfig = {
  /** Executable command (e.g., "npx", "python"). */
  command: string;
  /** Arguments to pass to the command. */
  args?: string[];
  /** Environment variables for the server process. Supports ${VAR} references. */
  env?: Record<string, string>;
};

/**
 * MCP configuration file (mcp.json).
 */
export type McpConfig = {
  servers: Record<string, McpServerConfig>;
};

/**
 * Represents an MCP tool definition as received from a server.
 */
export type McpToolDefinition = {
  /** Tool name as reported by the MCP server. */
  name: string;
  /** Tool description. */
  description?: string;
  /** JSON Schema for the tool's input parameters. */
  inputSchema: Record<string, unknown>;
};

/**
 * Result of an MCP tool call.
 */
export type McpToolCallResult = {
  content: Array<
    { type: "text"; text: string } | { type: "image"; data: string; mimeType: string }
  >;
  isError?: boolean;
};

/**
 * State of an active MCP server connection.
 */
export type McpServerState = {
  /** Server name from config. */
  name: string;
  /** Available tools from this server. */
  tools: McpToolDefinition[];
  /** Whether the server is connected and ready. */
  connected: boolean;
  /** Last error message, if any. */
  error?: string;
};
