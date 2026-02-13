import type { IMessengerPort } from '../ports/messenger-port.js';
import type { Result } from '../../core/types/result.js';
import type { IncomingMessage, WebhookPayload } from '../domain/types.js';
import type { MessengerError } from '../domain/errors.js';
import type { DomainEventBus } from '../../core/types/domain-events.js';
import type { MessengerPlatform } from '../../core/types/messenger-platform.js';
import { err, isOk, isErr } from '../../core/types/result.js';
import { WebhookValidationError } from '../domain/errors.js';
import { createEvent } from '../../core/types/domain-events.js';
/**
 * Routes incoming webhooks to the correct messenger adapter
 */
export class WebhookRouter {
  private adapters = new Map<MessengerPlatform, IMessengerPort>();
  private secrets = new Map<MessengerPlatform, string>();

  constructor(private readonly eventBus?: DomainEventBus) {}

  /**
   * Register a messenger adapter for a specific platform
   */
  register(platform: MessengerPlatform, adapter: IMessengerPort, webhookSecret: string): void {
    this.adapters.set(platform, adapter);
    this.secrets.set(platform, webhookSecret);
  }

  /**
   * Route incoming webhook to the appropriate adapter
   */
  async route(payload: WebhookPayload): Promise<Result<IncomingMessage, MessengerError>> {
    this.eventBus?.publish(createEvent(
      'messenger.webhook.received',
      {
        platform: payload.platform,
        receivedAt: payload.receivedAt,
      },
      'messenger'
    ));

    const adapter = this.adapters.get(payload.platform);
    if (!adapter) {
      const error = new WebhookValidationError(`No adapter registered for platform: ${payload.platform}`);
      this.emitValidationFailed(payload.platform, error.message);
      return err(error) as Result<never, MessengerError>;
    }

    const secret = this.secrets.get(payload.platform);
    if (!secret) {
      const error = new WebhookValidationError(`No webhook secret configured for platform: ${payload.platform}`);
      this.emitValidationFailed(payload.platform, error.message);
      return err(error) as Result<never, MessengerError>;
    }

    const isValid = adapter.validateWebhookSignature(payload, secret);
    if (!isValid) {
      const error = new WebhookValidationError('Webhook signature validation failed');
      this.emitValidationFailed(payload.platform, error.message);
      return err(error) as Result<never, MessengerError>;
    }

    const result = adapter.parseWebhook(payload);
    if (isErr(result)) {
      this.emitValidationFailed(payload.platform, result.error.message);
      return result;
    }

    if (isOk(result)) {
      this.eventBus?.publish(createEvent(
        'messenger.message.received',
        {
          message: result.value,
        },
        'messenger'
      ));
    }

    return result;
  }

  private emitValidationFailed(platform: MessengerPlatform, reason: string): void {
    this.eventBus?.publish(createEvent(
      'messenger.webhook.validation_failed',
      { platform, reason },
      'messenger'
    ));
  }
}
