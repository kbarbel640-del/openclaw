/**
 * Tests for WebhookRouter.
 *
 * Verifies routing to correct adapters, webhook validation,
 * event emission, and error handling for unregistered platforms.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebhookRouter } from '../../src/messenger/application/webhook-router.js';
import type { IMessengerPort } from '../../src/messenger/ports/messenger-port.js';
import type { WebhookPayload, IncomingMessage } from '../../src/messenger/domain/types.js';
import type { DomainEventBus } from '../../src/core/types/domain-events.js';
import type { MessengerPlatform } from '../../src/core/types/messenger-platform.js';
import { ok, err } from '../../src/core/types/result.js';
import { WebhookValidationError } from '../../src/messenger/domain/errors.js';

/**
 * Creates a mock IMessengerPort with all methods stubbed via vi.fn().
 */
function createMockAdapter(platform: string): IMessengerPort {
  return {
    platform,
    sendMessage: vi.fn(),
    editMessage: vi.fn(),
    deleteMessage: vi.fn(),
    sendTypingIndicator: vi.fn(),
    parseWebhook: vi.fn(),
    validateWebhookSignature: vi.fn(),
  };
}

/**
 * Creates a mock DomainEventBus with publish, subscribe, and subscribeAll stubs.
 */
function createMockEventBus(): DomainEventBus {
  return {
    publish: vi.fn(),
    subscribe: vi.fn(),
    subscribeAll: vi.fn(),
  };
}

/**
 * Creates a WebhookPayload for the given platform.
 */
function createPayload(platform: MessengerPlatform, rawBody = '{"test":true}'): WebhookPayload {
  return {
    platform,
    rawBody,
    headers: { 'content-type': 'application/json' },
    receivedAt: new Date('2025-01-01T00:00:00Z'),
  };
}

/**
 * Creates a valid IncomingMessage for test assertions.
 */
function createIncomingMessage(platform: MessengerPlatform): IncomingMessage {
  return {
    platform,
    chatId: 'chat-123',
    userId: 'user-456',
    text: 'Hello world',
    messageId: 'msg-789',
    timestamp: new Date('2025-01-01T00:00:00Z'),
  };
}

describe('WebhookRouter', () => {
  let router: WebhookRouter;
  let eventBus: DomainEventBus;
  let telegramAdapter: IMessengerPort;
  let webAdapter: IMessengerPort;

  beforeEach(() => {
    eventBus = createMockEventBus();
    router = new WebhookRouter(eventBus);
    telegramAdapter = createMockAdapter('telegram');
    webAdapter = createMockAdapter('web');
  });

  describe('register', () => {
    it('should register an adapter for a platform', () => {
      // Registering should not throw
      expect(() => {
        router.register('telegram', telegramAdapter, 'secret-123');
      }).not.toThrow();
    });

    it('should allow registering multiple adapters for different platforms', () => {
      expect(() => {
        router.register('telegram', telegramAdapter, 'telegram-secret');
        router.register('web', webAdapter, 'web-secret');
      }).not.toThrow();
    });
  });

  describe('route', () => {
    describe('successful routing', () => {
      it('should route telegram webhook to telegram adapter', async () => {
        const payload = createPayload('telegram');
        const incomingMsg = createIncomingMessage('telegram');

        (telegramAdapter.validateWebhookSignature as ReturnType<typeof vi.fn>).mockReturnValue(true);
        (telegramAdapter.parseWebhook as ReturnType<typeof vi.fn>).mockReturnValue(ok(incomingMsg));

        router.register('telegram', telegramAdapter, 'telegram-secret');
        const result = await router.route(payload);

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).toEqual(incomingMsg);
          expect(result.value.platform).toBe('telegram');
        }
      });

      it('should route web webhook to web adapter', async () => {
        const payload = createPayload('web');
        const incomingMsg = createIncomingMessage('web');

        (webAdapter.validateWebhookSignature as ReturnType<typeof vi.fn>).mockReturnValue(true);
        (webAdapter.parseWebhook as ReturnType<typeof vi.fn>).mockReturnValue(ok(incomingMsg));

        router.register('web', webAdapter, 'web-secret');
        const result = await router.route(payload);

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value.platform).toBe('web');
        }
      });

      it('should pass the webhook payload to the correct adapter parseWebhook', async () => {
        const payload = createPayload('telegram', '{"update_id":1}');
        const incomingMsg = createIncomingMessage('telegram');

        (telegramAdapter.validateWebhookSignature as ReturnType<typeof vi.fn>).mockReturnValue(true);
        (telegramAdapter.parseWebhook as ReturnType<typeof vi.fn>).mockReturnValue(ok(incomingMsg));

        router.register('telegram', telegramAdapter, 'secret');
        await router.route(payload);

        expect(telegramAdapter.parseWebhook).toHaveBeenCalledWith(payload);
      });

      it('should pass the correct secret to validateWebhookSignature', async () => {
        const payload = createPayload('telegram');
        const incomingMsg = createIncomingMessage('telegram');

        (telegramAdapter.validateWebhookSignature as ReturnType<typeof vi.fn>).mockReturnValue(true);
        (telegramAdapter.parseWebhook as ReturnType<typeof vi.fn>).mockReturnValue(ok(incomingMsg));

        router.register('telegram', telegramAdapter, 'my-secret-token');
        await router.route(payload);

        expect(telegramAdapter.validateWebhookSignature).toHaveBeenCalledWith(payload, 'my-secret-token');
      });
    });

    describe('validation failures', () => {
      it('should return error when no adapter is registered for platform', async () => {
        const payload = createPayload('telegram');
        // Do not register any adapter

        const result = await router.route(payload);

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error).toBeInstanceOf(WebhookValidationError);
          expect(result.error.message).toContain('No adapter registered for platform');
          expect(result.error.message).toContain('telegram');
        }
      });

      it('should return error when webhook signature validation fails', async () => {
        const payload = createPayload('telegram');

        (telegramAdapter.validateWebhookSignature as ReturnType<typeof vi.fn>).mockReturnValue(false);

        router.register('telegram', telegramAdapter, 'secret');
        const result = await router.route(payload);

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error).toBeInstanceOf(WebhookValidationError);
          expect(result.error.message).toContain('Webhook signature validation failed');
        }
      });

      it('should not call parseWebhook when signature validation fails', async () => {
        const payload = createPayload('telegram');

        (telegramAdapter.validateWebhookSignature as ReturnType<typeof vi.fn>).mockReturnValue(false);

        router.register('telegram', telegramAdapter, 'secret');
        await router.route(payload);

        expect(telegramAdapter.parseWebhook).not.toHaveBeenCalled();
      });

      it('should return error when parseWebhook returns an error', async () => {
        const payload = createPayload('telegram');
        const parseError = new WebhookValidationError('Malformed payload');

        (telegramAdapter.validateWebhookSignature as ReturnType<typeof vi.fn>).mockReturnValue(true);
        (telegramAdapter.parseWebhook as ReturnType<typeof vi.fn>).mockReturnValue(err(parseError));

        router.register('telegram', telegramAdapter, 'secret');
        const result = await router.route(payload);

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error).toBeInstanceOf(WebhookValidationError);
          expect(result.error.message).toBe('Malformed payload');
        }
      });
    });

    describe('event emission', () => {
      it('should emit webhook.received event on every route call', async () => {
        const payload = createPayload('telegram');

        // Even if no adapter is registered, the webhook.received event should still fire
        await router.route(payload);

        expect(eventBus.publish).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'messenger.webhook.received',
            payload: expect.objectContaining({
              platform: 'telegram',
              receivedAt: payload.receivedAt,
            }),
          })
        );
      });

      it('should emit message.received event on successful parse', async () => {
        const payload = createPayload('web');
        const incomingMsg = createIncomingMessage('web');

        (webAdapter.validateWebhookSignature as ReturnType<typeof vi.fn>).mockReturnValue(true);
        (webAdapter.parseWebhook as ReturnType<typeof vi.fn>).mockReturnValue(ok(incomingMsg));

        router.register('web', webAdapter, 'secret');
        await router.route(payload);

        expect(eventBus.publish).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'messenger.message.received',
            payload: expect.objectContaining({
              message: incomingMsg,
            }),
          })
        );
      });

      it('should emit webhook.validation_failed when no adapter is registered', async () => {
        const payload = createPayload('telegram');

        await router.route(payload);

        expect(eventBus.publish).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'messenger.webhook.validation_failed',
            payload: expect.objectContaining({
              platform: 'telegram',
            }),
          })
        );
      });

      it('should emit webhook.validation_failed when signature check fails', async () => {
        const payload = createPayload('telegram');

        (telegramAdapter.validateWebhookSignature as ReturnType<typeof vi.fn>).mockReturnValue(false);

        router.register('telegram', telegramAdapter, 'secret');
        await router.route(payload);

        expect(eventBus.publish).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'messenger.webhook.validation_failed',
            payload: expect.objectContaining({
              platform: 'telegram',
              reason: expect.stringContaining('Webhook signature validation failed'),
            }),
          })
        );
      });

      it('should emit webhook.validation_failed when parseWebhook errors', async () => {
        const payload = createPayload('telegram');
        const parseError = new WebhookValidationError('Bad data');

        (telegramAdapter.validateWebhookSignature as ReturnType<typeof vi.fn>).mockReturnValue(true);
        (telegramAdapter.parseWebhook as ReturnType<typeof vi.fn>).mockReturnValue(err(parseError));

        router.register('telegram', telegramAdapter, 'secret');
        await router.route(payload);

        expect(eventBus.publish).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'messenger.webhook.validation_failed',
            payload: expect.objectContaining({
              platform: 'telegram',
              reason: 'Bad data',
            }),
          })
        );
      });

      it('should not emit message.received event when routing fails', async () => {
        const payload = createPayload('telegram');

        (telegramAdapter.validateWebhookSignature as ReturnType<typeof vi.fn>).mockReturnValue(false);

        router.register('telegram', telegramAdapter, 'secret');
        await router.route(payload);

        const publishCalls = (eventBus.publish as ReturnType<typeof vi.fn>).mock.calls;
        const messageReceivedEvents = publishCalls.filter(
          (call: unknown[]) => (call[0] as { type: string }).type === 'messenger.message.received'
        );
        expect(messageReceivedEvents).toHaveLength(0);
      });
    });

    describe('without event bus', () => {
      it('should still route successfully without an event bus', async () => {
        const routerNoEvents = new WebhookRouter();
        const payload = createPayload('telegram');
        const incomingMsg = createIncomingMessage('telegram');

        (telegramAdapter.validateWebhookSignature as ReturnType<typeof vi.fn>).mockReturnValue(true);
        (telegramAdapter.parseWebhook as ReturnType<typeof vi.fn>).mockReturnValue(ok(incomingMsg));

        routerNoEvents.register('telegram', telegramAdapter, 'secret');
        const result = await routerNoEvents.route(payload);

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).toEqual(incomingMsg);
        }
      });

      it('should still return error without an event bus when validation fails', async () => {
        const routerNoEvents = new WebhookRouter();
        const payload = createPayload('telegram');

        const result = await routerNoEvents.route(payload);

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error).toBeInstanceOf(WebhookValidationError);
        }
      });
    });

    describe('routing with multiple adapters', () => {
      it('should route to the correct adapter when multiple are registered', async () => {
        const telegramPayload = createPayload('telegram');
        const webPayload = createPayload('web');

        const telegramMsg = createIncomingMessage('telegram');
        const webMsg = createIncomingMessage('web');

        (telegramAdapter.validateWebhookSignature as ReturnType<typeof vi.fn>).mockReturnValue(true);
        (telegramAdapter.parseWebhook as ReturnType<typeof vi.fn>).mockReturnValue(ok(telegramMsg));

        (webAdapter.validateWebhookSignature as ReturnType<typeof vi.fn>).mockReturnValue(true);
        (webAdapter.parseWebhook as ReturnType<typeof vi.fn>).mockReturnValue(ok(webMsg));

        router.register('telegram', telegramAdapter, 'tg-secret');
        router.register('web', webAdapter, 'web-secret');

        const telegramResult = await router.route(telegramPayload);
        const webResult = await router.route(webPayload);

        expect(telegramResult.ok).toBe(true);
        if (telegramResult.ok) {
          expect(telegramResult.value.platform).toBe('telegram');
        }

        expect(webResult.ok).toBe(true);
        if (webResult.ok) {
          expect(webResult.value.platform).toBe('web');
        }

        // Each adapter should be called once
        expect(telegramAdapter.parseWebhook).toHaveBeenCalledTimes(1);
        expect(webAdapter.parseWebhook).toHaveBeenCalledTimes(1);
      });

      it('should not call web adapter when routing to telegram', async () => {
        const payload = createPayload('telegram');
        const incomingMsg = createIncomingMessage('telegram');

        (telegramAdapter.validateWebhookSignature as ReturnType<typeof vi.fn>).mockReturnValue(true);
        (telegramAdapter.parseWebhook as ReturnType<typeof vi.fn>).mockReturnValue(ok(incomingMsg));

        router.register('telegram', telegramAdapter, 'tg-secret');
        router.register('web', webAdapter, 'web-secret');

        await router.route(payload);

        expect(webAdapter.validateWebhookSignature).not.toHaveBeenCalled();
        expect(webAdapter.parseWebhook).not.toHaveBeenCalled();
      });
    });
  });
});
