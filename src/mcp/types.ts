/**
 * MCP (Model Context Protocol) client types for OpenClaw.
 *
 * Defines the configuration schema and internal types for managing
 * MCP server connections and exposing MCP tools to the agent.
 */

// ---------------------------------------------------------------------------
// Config types (used in openclaw.json → mcp section)
// ---------------------------------------------------------------------------

/** Transport type for MCP server connections. */
export type McpTransport = "stdio" | "sse";

/** Environment variable map for MCP server processes. */
export type McpServerEnv = Record<string, string>;

/** Approval mode for MCP server tools. */
export type McpApprovalMode = "none" | "always" | "allowlist";

/** Configuration for a single MCP server in openclaw.json. */
export type McpServerConfig = {
  /** Transport type (default: "stdio"). */
  transport?: McpTransport;
  /** Command to spawn the MCP server (stdio transport). */
  command?: string;
  /** Arguments passed to the command. */
  args?: string[];
  /** Environment variables injected into the server process. */
  env?: McpServerEnv;
  /** URL for SSE transport (used when transport="sse"). */
  url?: string;
  /** Optional headers for SSE transport. */
  headers?: Record<string, string>;
  /** Enable or disable this server (default: true). */
  enabled?: boolean;
  /** Tool name prefix override (default: server key). */
  toolPrefix?: string;
  /** Timeout in ms for tool calls (default: 30000). */
  toolTimeoutMs?: number;
  /** Per-tool timeout overrides (ms). Tool names not listed fall back to toolTimeoutMs. */
  toolTimeouts?: Record<string, number>;
  /** Maximum number of retries for failed connections (default: 3). */
  maxRetries?: number;
  /**
   * Health check interval in ms. When set, the manager will periodically
   * ping the server and attempt reconnection if it becomes unresponsive.
   * Set to 0 to disable health checks (default: disabled).
   */
  healthCheckIntervalMs?: number;
  /**
   * Approval mode for tools from this server.
   * - "none": execute without approval (default)
   * - "always": always require approval before execution
   * - "allowlist": require approval unless tool is in `approvedTools`
   */
  approval?: McpApprovalMode;
  /** Tools that skip approval when approval="allowlist". */
  approvedTools?: string[];
};

/** Top-level MCP configuration section. */
export type McpConfig = {
  /** Enable MCP client integration (default: true when servers are configured). */
  enabled?: boolean;
  /** MCP server definitions keyed by server name. */
  servers?: Record<string, McpServerConfig>;
};

// ---------------------------------------------------------------------------
// Internal runtime types
// ---------------------------------------------------------------------------

/** MCP tool definition as returned by the server's tools/list. */
export type McpToolDefinition = {
  name: string;
  description?: string;
  inputSchema: McpJsonSchema;
};

/** JSON Schema subset used by MCP tool input schemas. */
export type McpJsonSchema = {
  type?: string;
  properties?: Record<string, McpJsonSchema>;
  required?: string[];
  description?: string;
  items?: McpJsonSchema;
  enum?: unknown[];
  default?: unknown;
  [key: string]: unknown;
};

/** Represents a running MCP server connection. */
export type McpServerConnection = {
  /** Server name (config key). */
  name: string;
  /** Resolved config. */
  config: McpServerConfig;
  /** Available tools from this server. */
  tools: McpToolDefinition[];
  /** Connection status. */
  status: "connecting" | "connected" | "error" | "closed";
  /** Error message if status is "error". */
  error?: string;
  /** Call a tool on this server. Optional timeoutMs overrides the server default. */
  callTool: (toolName: string, args: Record<string, unknown>, timeoutMs?: number) => Promise<McpToolCallResult>;
  /** Send a JSON-RPC ping to check if the server is responsive. */
  ping: () => Promise<boolean>;
  /** Disconnect and reconnect (re-handshake, re-discover tools). */
  reconnect: () => Promise<void>;
  /** Disconnect and clean up. */
  disconnect: () => Promise<void>;
};

/** Result from an MCP tool call. */
export type McpToolCallResult = {
  content: McpToolContent[];
  isError?: boolean;
};

/** A single content block in an MCP tool result. */
export type McpToolContent = {
  type: "text" | "image" | "resource";
  text?: string;
  data?: string;
  mimeType?: string;
  uri?: string;
};
