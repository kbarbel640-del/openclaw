import type { IMessengerPort } from '../ports/messenger-port.js';
import type { IHttpClient } from './http-client.js';
import type { Result } from '../../core/types/result.js';
import type { IncomingMessage, OutgoingMessage, SendResult, WebhookPayload } from '../domain/types.js';
import type { MessengerError } from '../domain/errors.js';
import { ok, err, isOk } from '../../core/types/result.js';
import { MessageDeliveryError, WebhookValidationError } from '../domain/errors.js';
import * as crypto from 'crypto';

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: { id: number; username?: string };
    chat: { id: number };
    text?: string;
    date: number;
    reply_to_message?: { message_id: number };
  };
}

interface TelegramSendResponse {
  ok: boolean;
  result?: {
    message_id: number;
    date: number;
  };
  description?: string;
}

/**
 * Telegram messenger adapter implementing IMessengerPort
 */
export class TelegramAdapter implements IMessengerPort {
  readonly platform = 'telegram';

  constructor(
    private readonly httpClient: IHttpClient,
    private readonly botToken: string,
    private readonly baseUrl: string = 'https://api.telegram.org'
  ) {}

  private get apiUrl(): string {
    return `${this.baseUrl}/bot${this.botToken}`;
  }

  async sendMessage(msg: OutgoingMessage): Promise<Result<SendResult, MessengerError>> {
    const parseMode = msg.parseMode === 'markdown' ? 'MarkdownV2' : msg.parseMode === 'html' ? 'HTML' : undefined;

    const body: Record<string, unknown> = {
      chat_id: msg.chatId,
      text: msg.text,
    };

    if (parseMode) {
      body.parse_mode = parseMode;
    }

    if (msg.replyToMessageId) {
      body.reply_to_message_id = msg.replyToMessageId;
    }

    const result = await this.httpClient.post<TelegramSendResponse>(
      `${this.apiUrl}/sendMessage`,
      body
    );

    if (!isOk(result)) {
      return result as Result<never, MessengerError>;
    }

    const response = result.value;
    if (!response.ok || !response.result) {
      return err(new MessageDeliveryError(response.description || 'Telegram API returned error')) as Result<never, MessengerError>;
    }

    return ok({
      messageId: String(response.result.message_id),
      platform: 'telegram',
      sentAt: new Date(response.result.date * 1000),
    });
  }

  async editMessage(chatId: string, messageId: string, text: string): Promise<Result<void, MessengerError>> {
    const result = await this.httpClient.post<TelegramSendResponse>(
      `${this.apiUrl}/editMessageText`,
      {
        chat_id: chatId,
        message_id: messageId,
        text,
      }
    );

    if (!isOk(result)) {
      return result as Result<never, MessengerError>;
    }

    if (!result.value.ok) {
      return err(new MessageDeliveryError(result.value.description || 'Failed to edit message')) as Result<never, MessengerError>;
    }

    return ok(undefined);
  }

  async deleteMessage(chatId: string, messageId: string): Promise<Result<void, MessengerError>> {
    const result = await this.httpClient.post<TelegramSendResponse>(
      `${this.apiUrl}/deleteMessage`,
      {
        chat_id: chatId,
        message_id: messageId,
      }
    );

    if (!isOk(result)) {
      return result as Result<never, MessengerError>;
    }

    if (!result.value.ok) {
      return err(new MessageDeliveryError(result.value.description || 'Failed to delete message')) as Result<never, MessengerError>;
    }

    return ok(undefined);
  }

  async sendTypingIndicator(chatId: string): Promise<Result<void, MessengerError>> {
    const result = await this.httpClient.post<TelegramSendResponse>(
      `${this.apiUrl}/sendChatAction`,
      {
        chat_id: chatId,
        action: 'typing',
      }
    );

    if (!isOk(result)) {
      return result as Result<never, MessengerError>;
    }

    return ok(undefined);
  }

  parseWebhook(payload: WebhookPayload): Result<IncomingMessage, MessengerError> {
    try {
      const update: TelegramUpdate = JSON.parse(payload.rawBody);

      if (!update.message?.text) {
        return err(new WebhookValidationError('No message text in Telegram update')) as Result<never, MessengerError>;
      }

      return ok({
        platform: 'telegram',
        chatId: String(update.message.chat.id),
        userId: String(update.message.from.id),
        text: update.message.text,
        messageId: String(update.message.message_id),
        timestamp: new Date(update.message.date * 1000),
        replyToMessageId: update.message.reply_to_message
          ? String(update.message.reply_to_message.message_id)
          : undefined,
        metadata: {
          updateId: update.update_id,
          username: update.message.from.username,
        },
      });
    } catch (error) {
      return err(new WebhookValidationError(`Failed to parse Telegram webhook: ${error}`)) as Result<never, MessengerError>;
    }
  }

  validateWebhookSignature(payload: WebhookPayload, secret: string): boolean {
    const signature = payload.headers['x-telegram-bot-api-secret-token'];
    if (!signature) {
      return false;
    }

    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload.rawBody);
    const expectedSignature = hmac.digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }
}
