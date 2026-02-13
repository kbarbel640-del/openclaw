import type { MessengerPlatform } from '../../core/types/messenger-platform.js';

/**
 * Represents an incoming message from any messenger platform
 */
export interface IncomingMessage {
  readonly platform: MessengerPlatform;
  readonly chatId: string;
  readonly userId: string;
  readonly text: string;
  readonly messageId: string;
  readonly timestamp: Date;
  readonly replyToMessageId?: string;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Represents an outgoing message to be sent through a messenger platform
 */
export interface OutgoingMessage {
  readonly chatId: string;
  readonly text: string;
  readonly replyToMessageId?: string;
  readonly parseMode?: 'plain' | 'markdown' | 'html';
}

/**
 * Result of successfully sending a message
 */
export interface SendResult {
  readonly messageId: string;
  readonly platform: MessengerPlatform;
  readonly sentAt: Date;
}

/**
 * Raw webhook payload received from a messenger platform
 */
export interface WebhookPayload {
  readonly platform: MessengerPlatform;
  readonly rawBody: string;
  readonly headers: Record<string, string>;
  readonly receivedAt: Date;
}

/**
 * Configuration for platform-specific rate limits
 */
export interface RateLimitConfig {
  readonly requestsPerSecond: number;
  readonly burstSize: number;
}

/**
 * Rate limit configurations by platform
 */
export const PLATFORM_RATE_LIMITS: Record<MessengerPlatform, RateLimitConfig> = {
  telegram: { requestsPerSecond: 30, burstSize: 30 },
  max: { requestsPerSecond: 20, burstSize: 20 },
  web: { requestsPerSecond: 100, burstSize: 100 },
  api: { requestsPerSecond: 100, burstSize: 100 },
};
