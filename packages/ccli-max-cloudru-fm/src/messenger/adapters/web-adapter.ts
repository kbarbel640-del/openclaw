import type { IMessengerPort } from '../ports/messenger-port.js';
import type { Result } from '../../core/types/result.js';
import type { IncomingMessage, OutgoingMessage, SendResult, WebhookPayload } from '../domain/types.js';
import type { MessengerError } from '../domain/errors.js';
import { ok, err } from '../../core/types/result.js';
import { MessageDeliveryError, WebhookValidationError } from '../domain/errors.js';
import * as crypto from 'crypto';

interface WebMessage {
  chatId: string;
  userId: string;
  text: string;
  messageId?: string;
  timestamp?: string;
  replyToMessageId?: string;
}

/**
 * Web/API messenger adapter for browser-based and REST API clients
 * Stores messages in-memory for WebSocket push or polling
 */
export class WebAdapter implements IMessengerPort {
  readonly platform = 'web';
  private messageStore = new Map<string, OutgoingMessage[]>();
  private messageCounter = 0;

  async sendMessage(msg: OutgoingMessage): Promise<Result<SendResult, MessengerError>> {
    const messageId = `web-${++this.messageCounter}-${Date.now()}`;

    if (!this.messageStore.has(msg.chatId)) {
      this.messageStore.set(msg.chatId, []);
    }

    this.messageStore.get(msg.chatId)!.push(msg);

    return ok({
      messageId,
      platform: 'web',
      sentAt: new Date(),
    });
  }

  async editMessage(_chatId: string, _messageId: string, _text: string): Promise<Result<void, MessengerError>> {
    return err(new MessageDeliveryError('Edit not supported for web platform')) as Result<never, MessengerError>;
  }

  async deleteMessage(_chatId: string, _messageId: string): Promise<Result<void, MessengerError>> {
    return err(new MessageDeliveryError('Delete not supported for web platform')) as Result<never, MessengerError>;
  }

  async sendTypingIndicator(_chatId: string): Promise<Result<void, MessengerError>> {
    return ok(undefined);
  }

  parseWebhook(payload: WebhookPayload): Result<IncomingMessage, MessengerError> {
    try {
      const message: WebMessage = JSON.parse(payload.rawBody);

      if (!message.chatId || !message.userId || !message.text) {
        return err(new WebhookValidationError('Missing required fields in web message')) as Result<never, MessengerError>;
      }

      return ok({
        platform: 'web',
        chatId: message.chatId,
        userId: message.userId,
        text: message.text,
        messageId: message.messageId || `web-${Date.now()}`,
        timestamp: message.timestamp ? new Date(message.timestamp) : new Date(),
        replyToMessageId: message.replyToMessageId,
      });
    } catch (error) {
      return err(new WebhookValidationError(`Failed to parse web message: ${error}`)) as Result<never, MessengerError>;
    }
  }

  validateWebhookSignature(payload: WebhookPayload, secret: string): boolean {
    const apiKey = payload.headers['x-api-key'] || payload.headers['authorization'];
    if (!apiKey) {
      return false;
    }

    const cleanApiKey = apiKey.replace(/^Bearer\s+/i, '');

    // Use constant-time comparison to prevent timing attacks
    const keyBuffer = Buffer.from(cleanApiKey);
    const secretBuffer = Buffer.from(secret);

    if (keyBuffer.length !== secretBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(keyBuffer, secretBuffer);
  }

  /**
   * Get pending messages for a chat (for polling or WebSocket push)
   */
  getMessages(chatId: string): OutgoingMessage[] {
    return this.messageStore.get(chatId) || [];
  }

  /**
   * Clear messages for a chat after delivery
   */
  clearMessages(chatId: string): void {
    this.messageStore.delete(chatId);
  }
}
