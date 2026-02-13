/**
 * SessionId type and utilities.
 *
 * SessionId is derived deterministically from TenantId.
 * Format: session:{tenantId}
 */

import { type Branded, brand } from './branded.js';
import { type TenantIdString } from './tenant-id.js';
import { ValidationError } from './errors.js';

/**
 * Branded string type for SessionId.
 * Ensures type safety and prevents mixing with regular strings.
 */
export type SessionIdString = Branded<string, 'SessionId'>;

/**
 * Creates a SessionId from a TenantId.
 * The mapping is deterministic: the same TenantId always produces the same SessionId.
 *
 * @param tenantId - The TenantIdString to create a session for
 * @returns A branded SessionIdString
 *
 * @example
 * const tenantId = createTenantId({ platform: 'telegram', userId: '123', chatId: '456' });
 * const sessionId = createSessionId(tenantId);
 * // Result: 'session:telegram:123:456'
 */
export function createSessionId(tenantId: TenantIdString): SessionIdString {
  return brand<string, 'SessionId'>(`session:${tenantId}`);
}

/**
 * Parses a SessionId to extract the TenantId.
 *
 * @param id - The SessionIdString to parse
 * @returns An object containing the extracted TenantId
 * @throws {Error} If the id format is invalid
 *
 * @example
 * const { tenantId } = parseSessionId(sessionId);
 */
export function parseSessionId(id: SessionIdString): { tenantId: TenantIdString } {
  const prefix = 'session:';
  const idStr = id as string;

  if (idStr.substring(0, prefix.length) !== prefix) {
    throw new ValidationError(
      `Invalid SessionId format: must start with '${prefix}'`
    );
  }

  const tenantId = idStr.substring(prefix.length);

  if (!tenantId) {
    throw new ValidationError('Invalid SessionId: missing TenantId');
  }

  return { tenantId: brand<string, 'TenantId'>(tenantId) };
}
