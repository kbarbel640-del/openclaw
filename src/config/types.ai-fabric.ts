/**
 * AI Fabric configuration — stored in openclaw.json under `aiFabric`.
 */
export type AiFabricConfig = {
  /** Whether AI Fabric integration is enabled. */
  enabled?: boolean;
  /** Cloud.ru AI Fabric project ID. */
  projectId?: string;
  /** IAM key ID for token exchange (secret stored in .env as CLOUDRU_IAM_SECRET). */
  keyId?: string;
  /** Path to the generated MCP config file for claude-cli. */
  mcpConfigPath?: string;
  /** Cloud.ru AI Agents configured for A2A communication. */
  agents?: AiFabricAgentEntry[];
};

export type AiFabricAgentEntry = {
  /** Agent ID in Cloud.ru AI Fabric. */
  id: string;
  /** Human-readable agent name. */
  name: string;
  /** A2A endpoint URL for the agent. */
  endpoint: string;
};
