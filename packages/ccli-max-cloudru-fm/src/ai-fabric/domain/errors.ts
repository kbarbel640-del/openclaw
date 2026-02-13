import { OpenClawError } from '../../core/types/errors.js';

export class AiFabricError extends OpenClawError {
  readonly code = 'AI_FABRIC_ERROR' as const;
  readonly recoverable = true;

  toUserMessage(): string {
    return 'AI processing error. Please try again.';
  }
}

export class ModelNotFoundError extends OpenClawError {
  readonly code = 'MODEL_NOT_FOUND' as const;
  readonly recoverable = true;

  constructor(public readonly modelId: string) {
    super(`Model not found: ${modelId}`);
  }

  toUserMessage(): string {
    return `The requested AI model is not available.`;
  }
}

export class ModelOverloadedError extends OpenClawError {
  readonly code = 'MODEL_OVERLOADED' as const;
  readonly recoverable = true;

  constructor(public readonly modelId: string) {
    super(`Model overloaded: ${modelId}`);
  }

  toUserMessage(): string {
    return 'The AI service is currently busy. Please try again in a moment.';
  }
}

export class AllModelsFailedError extends OpenClawError {
  readonly code = 'ALL_MODELS_FAILED' as const;
  readonly recoverable = false;

  constructor(public readonly attempts: number) {
    super(`All models failed after ${attempts} attempts`);
  }

  toUserMessage(): string {
    return 'Unable to process your request. All AI services are currently unavailable.';
  }
}

export class RateLimitExceededError extends OpenClawError {
  readonly code = 'RATE_LIMIT_EXCEEDED' as const;
  readonly recoverable = true;

  constructor(public readonly providerId: string, public readonly retryAfterMs?: number) {
    super(`Rate limit exceeded for provider: ${providerId}`);
  }

  toUserMessage(): string {
    return 'Rate limit exceeded. Please try again in a few moments.';
  }
}

export class TokenBudgetExceededError extends OpenClawError {
  readonly code = 'TOKEN_BUDGET_EXCEEDED' as const;
  readonly recoverable = true;

  constructor(public readonly tenantId: string, public readonly used: number, public readonly limit: number) {
    super(`Token budget exceeded for tenant ${tenantId}: ${used}/${limit}`);
  }

  toUserMessage(): string {
    return 'Your token budget has been exceeded. Please upgrade your plan or wait for the next billing cycle.';
  }
}
