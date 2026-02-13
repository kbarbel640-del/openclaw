/**
 * Tests for WebAdapter.
 *
 * Verifies sendMessage (success, message storage), parseWebhook (valid payload,
 * invalid JSON, missing required fields), validateWebhookSignature (valid API key,
 * invalid key, missing header, Bearer prefix), platform identification,
 * and auxiliary methods (getMessages, clearMessages, editMessage, deleteMessage).
 *
 * London School TDD: WebAdapter is self-contained (no HTTP client dependency)
 * but we still verify its in-memory store behavior through the public API.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { WebAdapter } from '../../../src/messenger/adapters/web-adapter.js';
import type { OutgoingMessage, WebhookPayload } from '../../../src/messenger/domain/types.js';
import { MessageDeliveryError, WebhookValidationError } from '../../../src/messenger/domain/errors.js';

/**
 * Creates a valid OutgoingMessage for testing.
 */
function createOutgoingMessage(overrides?: Partial<OutgoingMessage>): OutgoingMessage {
  return {
    chatId: 'web-chat-1',
    text: 'Hello from web',
    ...overrides,
  };
}

/**
 * Creates a valid web message JSON body string.
 */
function createWebMessageBody(overrides?: Record<string, unknown>): string {
  const message = {
    chatId: 'web-chat-1',
    userId: 'web-user-1',
    text: 'Hello from user',
    messageId: 'msg-001',
    timestamp: '2025-01-01T00:00:00Z',
    ...overrides,
  };
  return JSON.stringify(message);
}

/**
 * Creates a WebhookPayload for the web platform.
 */
function createWebhookPayload(
  rawBody: string,
  headers: Record<string, string> = {}
): WebhookPayload {
  return {
    platform: 'web',
    rawBody,
    headers: { 'content-type': 'application/json', ...headers },
    receivedAt: new Date('2025-01-01T00:00:00Z'),
  };
}

describe('WebAdapter', () => {
  let adapter: WebAdapter;

  beforeEach(() => {
    adapter = new WebAdapter();
  });

  describe('platform', () => {
    it('should identify as web platform', () => {
      expect(adapter.platform).toBe('web');
    });
  });

  describe('sendMessage', () => {
    it('should send a message successfully and return a SendResult', async () => {
      const msg = createOutgoingMessage();

      const result = await adapter.sendMessage(msg);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.messageId).toMatch(/^web-\d+-\d+$/);
        expect(result.value.platform).toBe('web');
        expect(result.value.sentAt).toBeInstanceOf(Date);
      }
    });

    it('should store the message in the internal message store', async () => {
      const msg = createOutgoingMessage({ chatId: 'chat-store-test' });

      await adapter.sendMessage(msg);

      const stored = adapter.getMessages('chat-store-test');
      expect(stored).toHaveLength(1);
      expect(stored[0]!.text).toBe('Hello from web');
    });

    it('should store multiple messages for the same chatId', async () => {
      const msg1 = createOutgoingMessage({ text: 'First message' });
      const msg2 = createOutgoingMessage({ text: 'Second message' });

      await adapter.sendMessage(msg1);
      await adapter.sendMessage(msg2);

      const stored = adapter.getMessages('web-chat-1');
      expect(stored).toHaveLength(2);
      expect(stored[0]!.text).toBe('First message');
      expect(stored[1]!.text).toBe('Second message');
    });

    it('should generate unique message IDs for each send', async () => {
      const msg = createOutgoingMessage();

      const result1 = await adapter.sendMessage(msg);
      const result2 = await adapter.sendMessage(msg);

      expect(result1.ok).toBe(true);
      expect(result2.ok).toBe(true);
      if (result1.ok && result2.ok) {
        expect(result1.value.messageId).not.toBe(result2.value.messageId);
      }
    });

    it('should increment the message counter across sends', async () => {
      const msg = createOutgoingMessage();

      const result1 = await adapter.sendMessage(msg);
      const result2 = await adapter.sendMessage(msg);

      if (result1.ok && result2.ok) {
        // Extract counter from messageId format: web-{counter}-{timestamp}
        const counter1 = parseInt(result1.value.messageId.split('-')[1]!, 10);
        const counter2 = parseInt(result2.value.messageId.split('-')[1]!, 10);
        expect(counter2).toBe(counter1 + 1);
      }
    });
  });

  describe('editMessage', () => {
    it('should return error because edit is not supported', async () => {
      const result = await adapter.editMessage('chat-1', 'msg-1', 'new text');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(MessageDeliveryError);
        expect(result.error.message).toContain('Edit not supported');
      }
    });
  });

  describe('deleteMessage', () => {
    it('should return error because delete is not supported', async () => {
      const result = await adapter.deleteMessage('chat-1', 'msg-1');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(MessageDeliveryError);
        expect(result.error.message).toContain('Delete not supported');
      }
    });
  });

  describe('sendTypingIndicator', () => {
    it('should return ok without side effects', async () => {
      const result = await adapter.sendTypingIndicator('chat-1');

      expect(result.ok).toBe(true);
    });
  });

  describe('parseWebhook', () => {
    it('should parse a valid web message payload into IncomingMessage', () => {
      const rawBody = createWebMessageBody();
      const payload = createWebhookPayload(rawBody);

      const result = adapter.parseWebhook(payload);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.platform).toBe('web');
        expect(result.value.chatId).toBe('web-chat-1');
        expect(result.value.userId).toBe('web-user-1');
        expect(result.value.text).toBe('Hello from user');
        expect(result.value.messageId).toBe('msg-001');
        expect(result.value.timestamp).toEqual(new Date('2025-01-01T00:00:00Z'));
      }
    });

    it('should use provided replyToMessageId when present', () => {
      const rawBody = createWebMessageBody({ replyToMessageId: 'reply-99' });
      const payload = createWebhookPayload(rawBody);

      const result = adapter.parseWebhook(payload);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.replyToMessageId).toBe('reply-99');
      }
    });

    it('should generate a messageId when not provided in payload', () => {
      const body = {
        chatId: 'web-chat-1',
        userId: 'web-user-1',
        text: 'No messageId',
      };
      const payload = createWebhookPayload(JSON.stringify(body));

      const result = adapter.parseWebhook(payload);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.messageId).toMatch(/^web-\d+$/);
      }
    });

    it('should use current date when timestamp is not provided', () => {
      const before = new Date();
      const body = {
        chatId: 'web-chat-1',
        userId: 'web-user-1',
        text: 'No timestamp',
      };
      const payload = createWebhookPayload(JSON.stringify(body));

      const result = adapter.parseWebhook(payload);
      const after = new Date();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.timestamp.getTime()).toBeGreaterThanOrEqual(
          before.getTime()
        );
        expect(result.value.timestamp.getTime()).toBeLessThanOrEqual(
          after.getTime()
        );
      }
    });

    it('should return error for invalid JSON', () => {
      const payload = createWebhookPayload('this is not json!!!');

      const result = adapter.parseWebhook(payload);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(WebhookValidationError);
        expect(result.error.message).toContain('Failed to parse web message');
      }
    });

    it('should return error when chatId is missing', () => {
      const body = { userId: 'web-user-1', text: 'No chatId' };
      const payload = createWebhookPayload(JSON.stringify(body));

      const result = adapter.parseWebhook(payload);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(WebhookValidationError);
        expect(result.error.message).toContain('Missing required fields');
      }
    });

    it('should return error when userId is missing', () => {
      const body = { chatId: 'web-chat-1', text: 'No userId' };
      const payload = createWebhookPayload(JSON.stringify(body));

      const result = adapter.parseWebhook(payload);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(WebhookValidationError);
        expect(result.error.message).toContain('Missing required fields');
      }
    });

    it('should return error when text is missing', () => {
      const body = { chatId: 'web-chat-1', userId: 'web-user-1' };
      const payload = createWebhookPayload(JSON.stringify(body));

      const result = adapter.parseWebhook(payload);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(WebhookValidationError);
        expect(result.error.message).toContain('Missing required fields');
      }
    });

    it('should return error when all required fields are missing', () => {
      const body = { extra: 'some data' };
      const payload = createWebhookPayload(JSON.stringify(body));

      const result = adapter.parseWebhook(payload);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(WebhookValidationError);
        expect(result.error.message).toContain('Missing required fields');
      }
    });

    it('should return error for empty JSON body', () => {
      const payload = createWebhookPayload('{}');

      const result = adapter.parseWebhook(payload);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(WebhookValidationError);
        expect(result.error.message).toContain('Missing required fields');
      }
    });
  });

  describe('validateWebhookSignature', () => {
    it('should return true when x-api-key matches the secret', () => {
      const secret = 'my-api-key-secret';
      const payload = createWebhookPayload('{}', {
        'x-api-key': secret,
      });

      const isValid = adapter.validateWebhookSignature(payload, secret);

      expect(isValid).toBe(true);
    });

    it('should return true when authorization header matches the secret', () => {
      const secret = 'my-api-key-secret';
      const payload = createWebhookPayload('{}', {
        authorization: secret,
      });

      const isValid = adapter.validateWebhookSignature(payload, secret);

      expect(isValid).toBe(true);
    });

    it('should return true when authorization header uses Bearer prefix', () => {
      const secret = 'my-api-key-secret';
      const payload = createWebhookPayload('{}', {
        authorization: `Bearer ${secret}`,
      });

      const isValid = adapter.validateWebhookSignature(payload, secret);

      expect(isValid).toBe(true);
    });

    it('should return true when x-api-key is preferred over authorization', () => {
      const secret = 'correct-key';
      const payload = createWebhookPayload('{}', {
        'x-api-key': secret,
        authorization: 'wrong-key',
      });

      // x-api-key takes precedence due to the || short-circuit
      const isValid = adapter.validateWebhookSignature(payload, secret);

      expect(isValid).toBe(true);
    });

    it('should return false when API key does not match secret', () => {
      const payload = createWebhookPayload('{}', {
        'x-api-key': 'wrong-api-key-value',
      });

      const isValid = adapter.validateWebhookSignature(
        payload,
        'correct-secret'
      );

      expect(isValid).toBe(false);
    });

    it('should return false when keys differ in length', () => {
      const payload = createWebhookPayload('{}', {
        'x-api-key': 'short',
      });

      const isValid = adapter.validateWebhookSignature(
        payload,
        'a-much-longer-secret-value'
      );

      expect(isValid).toBe(false);
    });

    it('should return false when neither x-api-key nor authorization header is present', () => {
      const payload = createWebhookPayload('{}', {});

      const isValid = adapter.validateWebhookSignature(payload, 'my-secret');

      expect(isValid).toBe(false);
    });

    it('should handle Bearer prefix case-insensitively', () => {
      const secret = 'my-api-key-secret';
      const payload = createWebhookPayload('{}', {
        authorization: `bearer ${secret}`,
      });

      const isValid = adapter.validateWebhookSignature(payload, secret);

      expect(isValid).toBe(true);
    });
  });

  describe('getMessages', () => {
    it('should return empty array for chat with no messages', () => {
      const messages = adapter.getMessages('nonexistent-chat');

      expect(messages).toEqual([]);
    });

    it('should return all stored messages for a chat', async () => {
      await adapter.sendMessage(createOutgoingMessage({ text: 'msg 1' }));
      await adapter.sendMessage(createOutgoingMessage({ text: 'msg 2' }));

      const messages = adapter.getMessages('web-chat-1');

      expect(messages).toHaveLength(2);
      expect(messages[0]!.text).toBe('msg 1');
      expect(messages[1]!.text).toBe('msg 2');
    });

    it('should not return messages from different chats', async () => {
      await adapter.sendMessage(
        createOutgoingMessage({ chatId: 'chat-A', text: 'for A' })
      );
      await adapter.sendMessage(
        createOutgoingMessage({ chatId: 'chat-B', text: 'for B' })
      );

      const messagesA = adapter.getMessages('chat-A');
      const messagesB = adapter.getMessages('chat-B');

      expect(messagesA).toHaveLength(1);
      expect(messagesA[0]!.text).toBe('for A');
      expect(messagesB).toHaveLength(1);
      expect(messagesB[0]!.text).toBe('for B');
    });
  });

  describe('clearMessages', () => {
    it('should clear all messages for a chat', async () => {
      await adapter.sendMessage(createOutgoingMessage({ text: 'msg to clear' }));
      expect(adapter.getMessages('web-chat-1')).toHaveLength(1);

      adapter.clearMessages('web-chat-1');

      expect(adapter.getMessages('web-chat-1')).toEqual([]);
    });

    it('should not affect messages for other chats when clearing', async () => {
      await adapter.sendMessage(
        createOutgoingMessage({ chatId: 'chat-A', text: 'keep' })
      );
      await adapter.sendMessage(
        createOutgoingMessage({ chatId: 'chat-B', text: 'clear' })
      );

      adapter.clearMessages('chat-B');

      expect(adapter.getMessages('chat-A')).toHaveLength(1);
      expect(adapter.getMessages('chat-B')).toEqual([]);
    });

    it('should not throw when clearing a nonexistent chat', () => {
      expect(() => adapter.clearMessages('nonexistent')).not.toThrow();
    });
  });
});
