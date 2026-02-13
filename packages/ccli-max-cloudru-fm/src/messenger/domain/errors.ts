import { OpenClawError } from '../../core/types/errors.js';

/**
 * Base error for messenger-related failures
 */
export class MessengerError extends OpenClawError {
  readonly code = 'MESSENGER_ERROR';
  readonly recoverable = true;

  toUserMessage(): string {
    return 'Messenger error. Please try again.';
  }
}

/**
 * Webhook validation failed (signature mismatch, malformed payload)
 */
export class WebhookValidationError extends MessengerError {
  toUserMessage(): string {
    return 'Invalid webhook payload received.';
  }
}

/**
 * Failed to deliver message to messenger platform
 */
export class MessageDeliveryError extends MessengerError {
  toUserMessage(): string {
    return 'Failed to send message. Please try again.';
  }
}

/**
 * Rate limit exceeded for messenger platform
 */
export class RateLimitError extends MessengerError {
  toUserMessage(): string {
    return 'Too many requests. Please wait a moment and try again.';
  }
}

/**
 * Messenger platform is unavailable or unreachable
 */
export class PlatformUnavailableError extends MessengerError {
  toUserMessage(): string {
    return 'Messenger platform is currently unavailable. Please try again later.';
  }
}
