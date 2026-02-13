/**
 * Messenger platform types and utilities.
 *
 * Defines the supported messenger platforms for multi-channel support.
 */

/**
 * Supported messenger platforms.
 *
 * - telegram: Telegram messenger
 * - max: Max messenger
 * - web: Web-based interface
 * - api: Direct API access
 */
export type MessengerPlatform = 'telegram' | 'max' | 'web' | 'api';

/**
 * Type guard to check if a string is a valid MessengerPlatform.
 *
 * @param value - The value to check
 * @returns True if value is a valid MessengerPlatform
 *
 * @example
 * const platform = 'telegram';
 * if (isMessengerPlatform(platform)) {
 *   // platform is now typed as MessengerPlatform
 * }
 */
export function isMessengerPlatform(value: string): value is MessengerPlatform {
  const platforms: readonly string[] = ['telegram', 'max', 'web', 'api'];
  return platforms.indexOf(value) !== -1;
}
