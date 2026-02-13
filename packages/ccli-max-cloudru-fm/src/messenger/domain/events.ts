import type { DomainEvent } from '../../core/types/domain-events.js';
import type { IncomingMessage, OutgoingMessage, SendResult } from './types.js';
import type { MessengerPlatform } from '../../core/types/messenger-platform.js';

/**
 * Emitted when a message is received from a messenger platform
 */
export interface MessageReceived extends DomainEvent {
  readonly type: 'messenger.message.received';
  readonly payload: {
    readonly message: IncomingMessage;
  };
}

/**
 * Emitted when a message is successfully sent through a messenger platform
 */
export interface MessageSent extends DomainEvent {
  readonly type: 'messenger.message.sent';
  readonly payload: {
    readonly message: OutgoingMessage;
    readonly result: SendResult;
  };
}

/**
 * Emitted when message delivery fails
 */
export interface MessageDeliveryFailed extends DomainEvent {
  readonly type: 'messenger.message.delivery_failed';
  readonly payload: {
    readonly message: OutgoingMessage;
    readonly error: string;
    readonly platform: MessengerPlatform;
  };
}

/**
 * Emitted when a webhook is received (before parsing)
 */
export interface WebhookReceived extends DomainEvent {
  readonly type: 'messenger.webhook.received';
  readonly payload: {
    readonly platform: MessengerPlatform;
    readonly receivedAt: Date;
  };
}

/**
 * Emitted when webhook validation fails
 */
export interface WebhookValidationFailed extends DomainEvent {
  readonly type: 'messenger.webhook.validation_failed';
  readonly payload: {
    readonly platform: MessengerPlatform;
    readonly reason: string;
  };
}
