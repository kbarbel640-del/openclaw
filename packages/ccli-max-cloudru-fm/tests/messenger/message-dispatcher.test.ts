/**
 * Tests for MessageDispatcher.
 *
 * Verifies dispatching to platforms, error handling for invalid tenant IDs,
 * unregistered adapters, adapter failures, and event emission.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MessageDispatcher } from '../../src/messenger/application/message-dispatcher.js';
import type { IMessengerPort } from '../../src/messenger/ports/messenger-port.js';
import type { OutgoingMessage, SendResult } from '../../src/messenger/domain/types.js';
import type { DomainEventBus } from '../../src/core/types/domain-events.js';
import type { TenantIdString } from '../../src/core/types/tenant-id.js';
import { ok, err } from '../../src/core/types/result.js';
import { MessageDeliveryError } from '../../src/messenger/domain/errors.js';

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
 * Creates a mock DomainEventBus.
 */
function createMockEventBus(): DomainEventBus {
  return {
    publish: vi.fn(),
    subscribe: vi.fn(),
    subscribeAll: vi.fn(),
  };
}

/**
 * Creates a test OutgoingMessage.
 */
function createOutgoingMessage(overrides?: Partial<OutgoingMessage>): OutgoingMessage {
  return {
    chatId: 'chat-123',
    text: 'Hello from the bot',
    ...overrides,
  };
}

/**
 * Creates a test SendResult for a given platform.
 */
function createSendResult(platform: 'telegram' | 'max' | 'web' | 'api'): SendResult {
  return {
    messageId: 'sent-msg-001',
    platform,
    sentAt: new Date('2025-01-01T12:00:00Z'),
  };
}

describe('MessageDispatcher', () => {
  let dispatcher: MessageDispatcher;
  let eventBus: DomainEventBus;
  let telegramAdapter: IMessengerPort;
  let webAdapter: IMessengerPort;

  const telegramTenantId = 'telegram:user1:chat1' as TenantIdString;
  const webTenantId = 'web:user2:chat2' as TenantIdString;

  beforeEach(() => {
    eventBus = createMockEventBus();
    dispatcher = new MessageDispatcher(eventBus);
    telegramAdapter = createMockAdapter('telegram');
    webAdapter = createMockAdapter('web');
  });

  describe('register', () => {
    it('should register an adapter for a platform', () => {
      expect(() => {
        dispatcher.register('telegram', telegramAdapter);
      }).not.toThrow();
    });

    it('should allow registering multiple adapters for different platforms', () => {
      expect(() => {
        dispatcher.register('telegram', telegramAdapter);
        dispatcher.register('web', webAdapter);
      }).not.toThrow();
    });
  });

  describe('dispatch', () => {
    describe('successful dispatch', () => {
      it('should dispatch a message through the correct platform adapter', async () => {
        const msg = createOutgoingMessage();
        const sendResult = createSendResult('telegram');

        (telegramAdapter.sendMessage as ReturnType<typeof vi.fn>).mockResolvedValue(ok(sendResult));

        dispatcher.register('telegram', telegramAdapter);
        const result = await dispatcher.dispatch(telegramTenantId, msg);

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).toEqual(sendResult);
          expect(result.value.platform).toBe('telegram');
          expect(result.value.messageId).toBe('sent-msg-001');
        }
      });

      it('should dispatch to web adapter based on tenant ID platform', async () => {
        const msg = createOutgoingMessage();
        const sendResult = createSendResult('web');

        (webAdapter.sendMessage as ReturnType<typeof vi.fn>).mockResolvedValue(ok(sendResult));

        dispatcher.register('web', webAdapter);
        const result = await dispatcher.dispatch(webTenantId, msg);

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value.platform).toBe('web');
        }
      });

      it('should pass the outgoing message to the adapter sendMessage', async () => {
        const msg = createOutgoingMessage({
          chatId: 'chat-999',
          text: 'Custom message',
          replyToMessageId: 'reply-to-1',
          parseMode: 'markdown',
        });
        const sendResult = createSendResult('telegram');

        (telegramAdapter.sendMessage as ReturnType<typeof vi.fn>).mockResolvedValue(ok(sendResult));

        dispatcher.register('telegram', telegramAdapter);
        await dispatcher.dispatch(telegramTenantId, msg);

        expect(telegramAdapter.sendMessage).toHaveBeenCalledWith(msg);
      });
    });

    describe('error handling', () => {
      it('should return error for an invalid tenant ID format', async () => {
        const msg = createOutgoingMessage();
        const invalidTenantId = 'invalid-format' as TenantIdString;

        const result = await dispatcher.dispatch(invalidTenantId, msg);

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error).toBeInstanceOf(MessageDeliveryError);
          expect(result.error.message).toContain('Invalid tenant ID');
        }
      });

      it('should return error for a tenant ID with invalid platform', async () => {
        const msg = createOutgoingMessage();
        const badPlatformTenantId = 'unknown:user1:chat1' as TenantIdString;

        const result = await dispatcher.dispatch(badPlatformTenantId, msg);

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error).toBeInstanceOf(MessageDeliveryError);
          expect(result.error.message).toContain('Invalid tenant ID');
        }
      });

      it('should return error when no adapter is registered for the platform', async () => {
        const msg = createOutgoingMessage();
        // Do not register telegram adapter

        const result = await dispatcher.dispatch(telegramTenantId, msg);

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error).toBeInstanceOf(MessageDeliveryError);
          expect(result.error.message).toContain('No adapter registered for platform');
          expect(result.error.message).toContain('telegram');
        }
      });

      it('should propagate adapter sendMessage errors', async () => {
        const msg = createOutgoingMessage();
        const deliveryError = new MessageDeliveryError('Telegram API down');

        (telegramAdapter.sendMessage as ReturnType<typeof vi.fn>).mockResolvedValue(err(deliveryError));

        dispatcher.register('telegram', telegramAdapter);
        const result = await dispatcher.dispatch(telegramTenantId, msg);

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error).toBeInstanceOf(MessageDeliveryError);
          expect(result.error.message).toBe('Telegram API down');
        }
      });

      it('should provide a user-friendly error message from MessageDeliveryError', () => {
        const error = new MessageDeliveryError('Internal: connection reset');
        expect(error.toUserMessage()).toBe('Failed to send message. Please try again.');
      });
    });

    describe('event emission', () => {
      it('should emit message.sent event on successful dispatch', async () => {
        const msg = createOutgoingMessage();
        const sendResult = createSendResult('telegram');

        (telegramAdapter.sendMessage as ReturnType<typeof vi.fn>).mockResolvedValue(ok(sendResult));

        dispatcher.register('telegram', telegramAdapter);
        await dispatcher.dispatch(telegramTenantId, msg);

        expect(eventBus.publish).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'messenger.message.sent',
            payload: expect.objectContaining({
              message: msg,
              result: sendResult,
            }),
          })
        );
      });

      it('should emit message.delivery_failed event when adapter returns error', async () => {
        const msg = createOutgoingMessage();
        const deliveryError = new MessageDeliveryError('Connection timeout');

        (telegramAdapter.sendMessage as ReturnType<typeof vi.fn>).mockResolvedValue(err(deliveryError));

        dispatcher.register('telegram', telegramAdapter);
        await dispatcher.dispatch(telegramTenantId, msg);

        expect(eventBus.publish).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'messenger.message.delivery_failed',
            payload: expect.objectContaining({
              message: msg,
              platform: 'telegram',
              error: 'Connection timeout',
            }),
          })
        );
      });

      it('should emit message.delivery_failed event when no adapter is registered', async () => {
        const msg = createOutgoingMessage();

        await dispatcher.dispatch(telegramTenantId, msg);

        expect(eventBus.publish).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'messenger.message.delivery_failed',
            payload: expect.objectContaining({
              platform: 'telegram',
            }),
          })
        );
      });

      it('should not emit message.sent event when dispatch fails', async () => {
        const msg = createOutgoingMessage();
        const deliveryError = new MessageDeliveryError('Failure');

        (telegramAdapter.sendMessage as ReturnType<typeof vi.fn>).mockResolvedValue(err(deliveryError));

        dispatcher.register('telegram', telegramAdapter);
        await dispatcher.dispatch(telegramTenantId, msg);

        const publishCalls = (eventBus.publish as ReturnType<typeof vi.fn>).mock.calls;
        const sentEvents = publishCalls.filter(
          (call: unknown[]) => (call[0] as { type: string }).type === 'messenger.message.sent'
        );
        expect(sentEvents).toHaveLength(0);
      });

      it('should not emit any delivery_failed event for invalid tenant ID', async () => {
        const msg = createOutgoingMessage();
        const invalidTenantId = 'bad' as TenantIdString;

        await dispatcher.dispatch(invalidTenantId, msg);

        // Invalid tenant ID triggers early return before adapter lookup,
        // so no delivery_failed event is emitted (platform is unknown)
        const publishCalls = (eventBus.publish as ReturnType<typeof vi.fn>).mock.calls;
        const failedEvents = publishCalls.filter(
          (call: unknown[]) => (call[0] as { type: string }).type === 'messenger.message.delivery_failed'
        );
        expect(failedEvents).toHaveLength(0);
      });
    });

    describe('without event bus', () => {
      it('should dispatch successfully without an event bus', async () => {
        const dispatcherNoEvents = new MessageDispatcher();
        const msg = createOutgoingMessage();
        const sendResult = createSendResult('telegram');

        (telegramAdapter.sendMessage as ReturnType<typeof vi.fn>).mockResolvedValue(ok(sendResult));

        dispatcherNoEvents.register('telegram', telegramAdapter);
        const result = await dispatcherNoEvents.dispatch(telegramTenantId, msg);

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).toEqual(sendResult);
        }
      });

      it('should return error gracefully without an event bus when adapter fails', async () => {
        const dispatcherNoEvents = new MessageDispatcher();
        const msg = createOutgoingMessage();
        const deliveryError = new MessageDeliveryError('Fail');

        (telegramAdapter.sendMessage as ReturnType<typeof vi.fn>).mockResolvedValue(err(deliveryError));

        dispatcherNoEvents.register('telegram', telegramAdapter);
        const result = await dispatcherNoEvents.dispatch(telegramTenantId, msg);

        expect(result.ok).toBe(false);
      });
    });

    describe('routing with multiple adapters', () => {
      it('should dispatch to the correct adapter based on tenant ID', async () => {
        const msg = createOutgoingMessage();
        const tgResult = createSendResult('telegram');
        const webResult = createSendResult('web');

        (telegramAdapter.sendMessage as ReturnType<typeof vi.fn>).mockResolvedValue(ok(tgResult));
        (webAdapter.sendMessage as ReturnType<typeof vi.fn>).mockResolvedValue(ok(webResult));

        dispatcher.register('telegram', telegramAdapter);
        dispatcher.register('web', webAdapter);

        const telegramDispatch = await dispatcher.dispatch(telegramTenantId, msg);
        const webDispatch = await dispatcher.dispatch(webTenantId, msg);

        expect(telegramDispatch.ok).toBe(true);
        if (telegramDispatch.ok) {
          expect(telegramDispatch.value.platform).toBe('telegram');
        }

        expect(webDispatch.ok).toBe(true);
        if (webDispatch.ok) {
          expect(webDispatch.value.platform).toBe('web');
        }

        expect(telegramAdapter.sendMessage).toHaveBeenCalledTimes(1);
        expect(webAdapter.sendMessage).toHaveBeenCalledTimes(1);
      });
    });
  });
});
