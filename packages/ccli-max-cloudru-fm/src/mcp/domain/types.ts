import type { TenantIdString } from '../../core/types/tenant-id.js';
import type { AccessTier } from '../../core/types/access-tier.js';
import type { JsonSchema } from '../../core/types/json-schema.js';

export interface ToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: JsonSchema;
  readonly requiredTier: AccessTier;
  readonly category: ToolCategory;
  readonly timeout: number;
}

export type ToolCategory = 'file' | 'shell' | 'web' | 'code' | 'system' | 'custom';

export interface ToolInvocation {
  readonly toolName: string;
  readonly arguments: Record<string, unknown>;
  readonly tenantId: TenantIdString;
  readonly sessionId: string;
  readonly invocationId: string;
  readonly timestamp: Date;
}

export interface ToolResult {
  readonly invocationId: string;
  readonly toolName: string;
  readonly content: string;
  readonly isError: boolean;
  readonly durationMs: number;
}

export interface McpServerConfig {
  readonly serverId: string;
  readonly name: string;
  readonly command: string;
  readonly args: string[];
  readonly env: Record<string, string>;
  readonly tools: ToolDefinition[];
}

export interface ConversationTurn {
  readonly tenantId: TenantIdString;
  readonly userMessage: string;
  readonly assistantResponse?: string;
  readonly toolInvocations: ToolInvocation[];
  readonly toolResults: ToolResult[];
  readonly startedAt: Date;
  readonly completedAt?: Date;
}
