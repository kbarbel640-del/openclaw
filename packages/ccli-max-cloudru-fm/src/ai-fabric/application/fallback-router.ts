import { err, type Result } from '../../core/types/result.js';
import { AllModelsFailedError, type AiFabricError } from '../domain/errors.js';
import type { ModelRequest, ModelResponse, FallbackChain } from '../domain/types.js';
import type { IModelPort } from './model-port.js';
import { createEvent, type DomainEventBus } from '../../core/types/domain-events.js';
import * as crypto from 'crypto';

export class FallbackRouter {
  constructor(
    private readonly modelPort: IModelPort,
    private readonly eventBus?: DomainEventBus
  ) {}

  async route(
    request: ModelRequest,
    chain: FallbackChain
  ): Promise<Result<ModelResponse, AiFabricError>> {
    const modelsToTry = [chain.primaryModel, ...chain.fallbacks];
    let attempts = 0;

    for (const modelId of modelsToTry) {
      attempts++;
      const modelRequest = { ...request, modelId };

      const result = await this.tryModel(modelRequest, chain.maxRetries, chain.retryDelayMs);

      if (result.ok) {
        return result;
      }

      // Emit fallback event if not on last model
      const nextIndex = modelsToTry.indexOf(modelId) + 1;
      if (nextIndex < modelsToTry.length) {
        const nextModel = modelsToTry[nextIndex];
        if (nextModel) {
          this.emitFallbackTriggered(request, modelId, nextModel, result.error.message);
        }
      }
    }

    return err(new AllModelsFailedError(attempts)) as Result<ModelResponse, AiFabricError>;
  }

  private async tryModel(
    request: ModelRequest,
    maxRetries: number,
    retryDelayMs: number
  ): Promise<Result<ModelResponse, AiFabricError>> {
    for (let retry = 0; retry <= maxRetries; retry++) {
      if (retry > 0) {
        await this.delay(retryDelayMs * Math.pow(2, retry - 1)); // Exponential backoff
      }

      const result = await this.modelPort.sendRequest(request);

      if (result.ok) {
        return result;
      }

      // Don't retry on non-recoverable errors
      if (!result.error.recoverable) {
        return result;
      }
    }

    // This shouldn't be reached, but TypeScript needs it
    const lastAttempt = await this.modelPort.sendRequest(request);
    return lastAttempt;
  }

  private emitFallbackTriggered(
    request: ModelRequest,
    primaryModel: string,
    fallbackModel: string,
    reason: string
  ): void {
    if (!this.eventBus) return;

    const event = createEvent(
      'ai-fabric.fallback.triggered',
      {
        tenantId: request.tenantId,
        primaryModel,
        fallbackModel,
        requestId: this.generateRequestId(),
        reason
      },
      'ai-fabric'
    );

    this.eventBus.publish(event);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${crypto.randomUUID()}`;
  }
}
