import type { Result } from '../../core/types/result.js';
import type { IncomingMessage, OutgoingMessage, SendResult, WebhookPayload } from '../domain/types.js';
import type { MessengerError } from '../domain/errors.js';

/**
 * Port for messenger platform operations
 * Implemented by platform-specific adapters (Telegram, Web, etc.)
 */
export interface IMessengerPort {
  /**
   * Send a message through the messenger platform
   */
  sendMessage(msg: OutgoingMessage): Promise<Result<SendResult, MessengerError>>;

  /**
   * Edit an existing message
   */
  editMessage(chatId: string, messageId: string, text: string): Promise<Result<void, MessengerError>>;

  /**
   * Delete a message
   */
  deleteMessage(chatId: string, messageId: string): Promise<Result<void, MessengerError>>;

  /**
   * Send typing indicator to show the bot is processing
   */
  sendTypingIndicator(chatId: string): Promise<Result<void, MessengerError>>;

  /**
   * Parse incoming webhook payload into standardized IncomingMessage
   */
  parseWebhook(payload: WebhookPayload): Result<IncomingMessage, MessengerError>;

  /**
   * Validate webhook signature to ensure authenticity
   */
  validateWebhookSignature(payload: WebhookPayload, secret: string): boolean;

  /**
   * Get the platform this adapter handles
   */
  readonly platform: string;
}
