/**
 * Platform-specific streaming configurations.
 * Defines different streaming behaviors for Telegram, Max, and Web platforms.
 */

import type { MessengerPlatform } from '../../core/types/messenger-platform.js';
import type { StreamConfig } from '../pipeline/types.js';
import { DEFAULT_STREAM_CONFIG } from '../pipeline/types.js';

/**
 * Get platform-specific streaming configuration.
 * @param platform - The messenger platform
 * @returns StreamConfig optimized for the platform
 */
export function getStreamConfigForPlatform(platform: MessengerPlatform): StreamConfig {
  switch (platform) {
    case 'telegram':
      return {
        ...DEFAULT_STREAM_CONFIG,
        maxMessageLength: 4096,           // Telegram limit
        typingIndicatorIntervalMs: 4000,  // Send typing every 4s
      };

    case 'max':
      return {
        ...DEFAULT_STREAM_CONFIG,
        maxMessageLength: 4096,
        typingIndicatorIntervalMs: 4000,
      };

    case 'web':
      return {
        ...DEFAULT_STREAM_CONFIG,
        maxMessageLength: Number.MAX_SAFE_INTEGER, // No limit for WebSocket
        typingIndicatorIntervalMs: 0,     // No typing indicator needed
        flushTokenThreshold: 20,          // More frequent updates for web
        flushTimeoutMs: 200,              // Faster flush for better UX
      };

    case 'api':
      return {
        ...DEFAULT_STREAM_CONFIG,
        maxMessageLength: Number.MAX_SAFE_INTEGER,
        typingIndicatorIntervalMs: 0,
      };

    default:
      return DEFAULT_STREAM_CONFIG;
  }
}
