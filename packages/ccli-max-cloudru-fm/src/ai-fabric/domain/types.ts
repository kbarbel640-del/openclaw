import type { TenantIdString } from '../../core/types/tenant-id.js';

export type ModelCapability = 'chat' | 'code' | 'vision' | 'tool_use' | 'streaming' | 'function_calling';

export interface RateLimit {
  readonly requestsPerMinute: number;
  readonly tokensPerMinute: number;
  readonly concurrentRequests: number;
}

export interface ModelDefinition {
  readonly id: string;
  readonly name: string;
  readonly provider: string;
  readonly contextWindow: number;
  readonly maxOutputTokens: number;
  readonly costPer1kInput: number;
  readonly costPer1kOutput: number;
  readonly capabilities: ModelCapability[];
}

export interface ModelProvider {
  readonly id: string;
  readonly name: string;
  readonly baseUrl: string;
  readonly models: ModelDefinition[];
  readonly rateLimit: RateLimit;
  readonly priority: number;
}

export interface ModelRequest {
  readonly tenantId: TenantIdString;
  readonly modelId: string;
  readonly messages: Array<{ role: string; content: string }>;
  readonly maxTokens?: number;
  readonly temperature?: number;
  readonly tools?: unknown[];
  readonly stream?: boolean;
}

export interface TokenUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
}

export interface ModelResponse {
  readonly modelId: string;
  readonly content: string;
  readonly usage: TokenUsage;
  readonly finishReason: 'stop' | 'max_tokens' | 'tool_use';
  readonly latencyMs: number;
}

export interface FallbackChain {
  readonly primaryModel: string;
  readonly fallbacks: string[];
  readonly maxRetries: number;
  readonly retryDelayMs: number;
}
