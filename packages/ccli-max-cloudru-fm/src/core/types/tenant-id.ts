/**
 * TenantId type and utilities.
 * Format: {platform}:{userId}:{chatId}
 */

import { type Branded, brand } from './branded.js';
import { type MessengerPlatform, isMessengerPlatform } from './messenger-platform.js';
import { ValidationError } from './errors.js';

/** Branded string type for TenantId */
export type TenantIdString = Branded<string, 'TenantId'>;

/** Components that make up a TenantId */
export interface TenantIdComponents {
  platform: MessengerPlatform;
  userId: string;
  chatId: string;
}

/**
 * Creates a TenantId from its components.
 * @example createTenantId({ platform: 'telegram', userId: '123', chatId: '456' })
 * // Returns: 'telegram:123:456'
 */
export function createTenantId(components: TenantIdComponents): TenantIdString {
  const { platform, userId, chatId } = components;
  return brand<string, 'TenantId'>(`${platform}:${userId}:${chatId}`);
}

/**
 * Parses a TenantId string into its components.
 * @throws {ValidationError} If the id format is invalid
 */
export function parseTenantId(id: TenantIdString): TenantIdComponents {
  const parts = id.split(':');

  if (parts.length !== 3) {
    throw new ValidationError(`Invalid TenantId: expected 3 parts, got ${parts.length}`);
  }

  const platform = parts[0]!;
  const userId = parts[1]!;
  const chatId = parts[2]!;

  if (!isMessengerPlatform(platform)) {
    throw new ValidationError(`Invalid platform in TenantId: ${platform}`);
  }

  if (!userId || !chatId) {
    throw new ValidationError('TenantId userId and chatId cannot be empty');
  }

  return { platform, userId, chatId };
}

// Re-export ValidationError from errors.ts for consumers that import from this module
export { ValidationError } from './errors.js';
