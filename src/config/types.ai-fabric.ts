/**
 * AI Fabric configuration — stored in openclaw.json under `aiFabric`.
 */
export type AiFabricConfig = {
  /** Whether AI Fabric integration is enabled. */
  enabled?: boolean;
  /** Cloud.ru AI Fabric project ID. */
  projectId?: string;
  /** Path to the generated MCP config file for claude-cli. */
  mcpConfigPath?: string;
};
