/**
 * Cloud.ru AI Fabric — Public API
 *
 * Barrel exports for the ai-fabric module.
 * Usage: import { CloudruClient, CloudruAgentsClient, ... } from "./ai-fabric/index.js";
 */

// Constants
export {
  CLOUDRU_AI_AGENTS_BASE_URL,
  CLOUDRU_IAM_TOKEN_URL,
  CLOUDRU_DEFAULT_TIMEOUT_MS,
  CLOUDRU_TOKEN_REFRESH_MARGIN_MS,
  CLOUDRU_RETRY_DEFAULTS,
  CLOUDRU_DEFAULT_PAGE_SIZE,
} from "./constants.js";

// Types
export type {
  CloudruAuthConfig,
  CloudruTokenResponse,
  ResolvedToken,
  CloudruClientConfig,
  PaginationParams,
  PaginatedResult,
  AgentStatus,
  Agent,
  AgentToolDefinition,
  AgentOptions,
  AgentScalingConfig,
  AgentIntegrationOptions,
  CreateAgentParams,
  UpdateAgentParams,
  ListAgentsParams,
  AgentSystemStatus,
  AgentSystem,
  OrchestratorOptions,
  AgentSystemMember,
  CreateAgentSystemParams,
  UpdateAgentSystemParams,
  ListAgentSystemsParams,
  McpServerStatus,
  McpTool,
  McpServer,
  ListMcpServersParams,
  InstanceType,
  CloudruApiErrorPayload,
} from "./types.js";

// Auth
export { CloudruTokenProvider, CloudruAuthError } from "./cloudru-auth.js";
export type { CloudruAuthOptions } from "./cloudru-auth.js";

// Client
export { CloudruClient, CloudruApiError } from "./cloudru-client.js";

// Domain clients
export { CloudruAgentsClient } from "./cloudru-agents-client.js";
export { CloudruAgentSystemsClient } from "./cloudru-agent-systems-client.js";
export { CloudruMcpClient } from "./cloudru-mcp-client.js";
