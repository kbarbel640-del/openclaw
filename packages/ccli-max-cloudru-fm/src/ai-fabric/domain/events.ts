import type { DomainEvent } from '../../core/types/domain-events.js';
import type { TenantIdString } from '../../core/types/tenant-id.js';
import type { TokenUsage } from './types.js';

export type ModelRequested = DomainEvent<{
  tenantId: TenantIdString;
  modelId: string;
  requestId: string;
}>;

export type ModelResponded = DomainEvent<{
  tenantId: TenantIdString;
  modelId: string;
  requestId: string;
  latencyMs: number;
  usage: TokenUsage;
}>;

export type ModelFailed = DomainEvent<{
  tenantId: TenantIdString;
  modelId: string;
  requestId: string;
  errorCode: string;
  errorMessage: string;
}>;

export type FallbackTriggered = DomainEvent<{
  tenantId: TenantIdString;
  primaryModel: string;
  fallbackModel: string;
  requestId: string;
  reason: string;
}>;

export type RateLimitHit = DomainEvent<{
  providerId: string;
  requestsRemaining: number;
  tokensRemaining: number;
}>;

export type TokenBudgetWarning = DomainEvent<{
  tenantId: TenantIdString;
  usedTokens: number;
  limitTokens: number;
  percentUsed: number;
}>;
