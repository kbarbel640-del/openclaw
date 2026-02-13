/**
 * Tests for FallbackRouter.
 */

import { describe, it, expect, vi } from 'vitest';
import { FallbackRouter } from '../../src/ai-fabric/application/fallback-router.js';
import type { IModelPort } from '../../src/ai-fabric/application/model-port.js';
import type { ModelRequest, ModelResponse, FallbackChain } from '../../src/ai-fabric/domain/types.js';
import type { TenantIdString } from '../../src/core/types/tenant-id.js';
import { ok, err } from '../../src/core/types/result.js';
import { ModelNotFoundError, AllModelsFailedError } from '../../src/ai-fabric/domain/errors.js';
import type { DomainEventBus } from '../../src/core/types/domain-events.js';

describe('FallbackRouter', () => {
  const tenantId: TenantIdString = 'telegram:123:456' as TenantIdString;

  const createRequest = (): ModelRequest => ({
    tenantId,
    modelId: 'primary-model',
    messages: [{ role: 'user', content: 'Hello' }],
  });

  const createResponse = (modelId: string): ModelResponse => ({
    modelId,
    content: 'Response',
    usage: {
      inputTokens: 10,
      outputTokens: 20,
      totalTokens: 30,
    },
    finishReason: 'stop',
    latencyMs: 100,
  });

  const createFallbackChain = (): FallbackChain => ({
    primaryModel: 'primary-model',
    fallbacks: ['fallback-1', 'fallback-2'],
    maxRetries: 0,
    retryDelayMs: 100,
  });

  describe('route', () => {
    it('should route to primary model on success', async () => {
      const modelPort: IModelPort = {
        sendRequest: vi.fn().mockResolvedValue(ok(createResponse('primary-model'))),
        streamRequest: vi.fn(),
        healthCheck: vi.fn(),
      };

      const router = new FallbackRouter(modelPort);
      const result = await router.route(createRequest(), createFallbackChain());

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.modelId).toBe('primary-model');
      }

      expect(modelPort.sendRequest).toHaveBeenCalledTimes(1);
    });

    it('should fall back on primary failure', async () => {
      const primaryError = new ModelNotFoundError('primary-model');
      const modelPort: IModelPort = {
        sendRequest: vi.fn()
          // Primary model: first attempt fails
          .mockResolvedValueOnce(err(primaryError))
          // Primary model: retry also fails
          .mockResolvedValueOnce(err(primaryError))
          // Fallback-1: succeeds
          .mockResolvedValueOnce(ok(createResponse('fallback-1'))),
        streamRequest: vi.fn(),
        healthCheck: vi.fn(),
      };

      const eventBus: DomainEventBus = {
        publish: vi.fn(),
        subscribe: vi.fn(),
        subscribeAll: vi.fn(),
      };

      const router = new FallbackRouter(modelPort, eventBus);
      const result = await router.route(createRequest(), createFallbackChain());

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.modelId).toBe('fallback-1');
      }

      expect(modelPort.sendRequest).toHaveBeenCalledTimes(3);
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ai-fabric.fallback.triggered',
        })
      );
    });

    it('should return error when all models fail', async () => {
      const error1 = new ModelNotFoundError('primary-model');
      const error2 = new ModelNotFoundError('fallback-1');
      const error3 = new ModelNotFoundError('fallback-2');

      const modelPort: IModelPort = {
        sendRequest: vi.fn()
          // Primary: 2 attempts
          .mockResolvedValueOnce(err(error1))
          .mockResolvedValueOnce(err(error1))
          // Fallback-1: 2 attempts
          .mockResolvedValueOnce(err(error2))
          .mockResolvedValueOnce(err(error2))
          // Fallback-2: 2 attempts
          .mockResolvedValueOnce(err(error3))
          .mockResolvedValueOnce(err(error3)),
        streamRequest: vi.fn(),
        healthCheck: vi.fn(),
      };

      const router = new FallbackRouter(modelPort);
      const result = await router.route(createRequest(), createFallbackChain());

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(AllModelsFailedError);
        const error = result.error as unknown as AllModelsFailedError;
        expect(error.attempts).toBe(3);
      }

      expect(modelPort.sendRequest).toHaveBeenCalledTimes(6);
    });

    it('should try fallbacks in order', async () => {
      const error1 = new ModelNotFoundError('primary-model');
      const error2 = new ModelNotFoundError('fallback-1');

      const modelPort: IModelPort = {
        sendRequest: vi.fn()
          // Primary: 2 attempts
          .mockResolvedValueOnce(err(error1))
          .mockResolvedValueOnce(err(error1))
          // Fallback-1: 2 attempts
          .mockResolvedValueOnce(err(error2))
          .mockResolvedValueOnce(err(error2))
          // Fallback-2: succeeds on first attempt
          .mockResolvedValueOnce(ok(createResponse('fallback-2'))),
        streamRequest: vi.fn(),
        healthCheck: vi.fn(),
      };

      const router = new FallbackRouter(modelPort);
      const result = await router.route(createRequest(), createFallbackChain());

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.modelId).toBe('fallback-2');
      }

      const calls = (modelPort.sendRequest as any).mock.calls;
      expect(calls[0][0].modelId).toBe('primary-model');
      expect(calls[1][0].modelId).toBe('primary-model');
      expect(calls[2][0].modelId).toBe('fallback-1');
      expect(calls[3][0].modelId).toBe('fallback-1');
      expect(calls[4][0].modelId).toBe('fallback-2');
    });

    it('should emit fallback events', async () => {
      const error1 = new ModelNotFoundError('primary-model');

      const modelPort: IModelPort = {
        sendRequest: vi.fn()
          // Primary: 2 attempts fail
          .mockResolvedValueOnce(err(error1))
          .mockResolvedValueOnce(err(error1))
          // Fallback-1: succeeds
          .mockResolvedValueOnce(ok(createResponse('fallback-1'))),
        streamRequest: vi.fn(),
        healthCheck: vi.fn(),
      };

      const eventBus: DomainEventBus = {
        publish: vi.fn(),
        subscribe: vi.fn(),
        subscribeAll: vi.fn(),
      };

      const router = new FallbackRouter(modelPort, eventBus);
      await router.route(createRequest(), createFallbackChain());

      expect(eventBus.publish).toHaveBeenCalledTimes(1);
      const event = (eventBus.publish as any).mock.calls[0][0];
      expect(event.type).toBe('ai-fabric.fallback.triggered');
      expect(event.payload.primaryModel).toBe('primary-model');
      expect(event.payload.fallbackModel).toBe('fallback-1');
    });
  });
});
