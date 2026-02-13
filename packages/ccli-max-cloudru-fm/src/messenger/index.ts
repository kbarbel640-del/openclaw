// Domain types
export type {
  IncomingMessage,
  OutgoingMessage,
  SendResult,
  WebhookPayload,
  RateLimitConfig,
} from './domain/types.js';
export { PLATFORM_RATE_LIMITS } from './domain/types.js';

// Domain errors
export {
  MessengerError,
  WebhookValidationError,
  MessageDeliveryError,
  RateLimitError,
  PlatformUnavailableError,
} from './domain/errors.js';

// Domain events
export type {
  MessageReceived,
  MessageSent,
  MessageDeliveryFailed,
  WebhookReceived,
  WebhookValidationFailed,
} from './domain/events.js';

// Ports
export type { IMessengerPort } from './ports/messenger-port.js';

// Adapters
export type { IHttpClient } from './adapters/http-client.js';
export { TelegramAdapter } from './adapters/telegram-adapter.js';
export { WebAdapter } from './adapters/web-adapter.js';

// Application services
export { WebhookRouter } from './application/webhook-router.js';
export { MessageDispatcher } from './application/message-dispatcher.js';
export { RateLimiter } from './application/rate-limiter.js';
