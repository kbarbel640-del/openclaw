/**
 * Access tier types and utilities.
 *
 * Defines the 4-tier canonical access system and maps to 3-tier sandbox access.
 */

/**
 * Canonical 4-tier access levels.
 *
 * - free: Basic access with restrictions
 * - standard: Standard access for regular users
 * - premium: Enhanced access with additional features
 * - admin: Administrative access with full privileges
 */
export type AccessTier = 'free' | 'standard' | 'premium' | 'admin';

/**
 * 3-tier sandbox access levels.
 *
 * - restricted: Limited sandbox capabilities
 * - standard: Standard sandbox access
 * - full: Full sandbox access without restrictions
 */
export type SandboxTier = 'restricted' | 'standard' | 'full';

/**
 * Maps a canonical AccessTier to its corresponding SandboxTier.
 *
 * Mapping:
 * - free -> restricted
 * - standard -> standard
 * - premium -> full
 * - admin -> full
 *
 * @param tier - The canonical access tier
 * @returns The corresponding sandbox tier
 *
 * @example
 * const sandbox = mapToSandboxTier('premium'); // 'full'
 */
export function mapToSandboxTier(tier: AccessTier): SandboxTier {
  switch (tier) {
    case 'free':
      return 'restricted';
    case 'standard':
      return 'standard';
    case 'premium':
    case 'admin':
      return 'full';
  }
}

/**
 * Checks if a tier meets or exceeds a required tier level.
 *
 * Tier hierarchy: free < standard < premium < admin
 *
 * @param current - The current access tier
 * @param required - The required minimum tier
 * @returns True if current tier meets or exceeds required tier
 *
 * @example
 * isTierAtLeast('premium', 'standard'); // true
 * isTierAtLeast('free', 'premium'); // false
 */
export function isTierAtLeast(current: AccessTier, required: AccessTier): boolean {
  const tierOrder: AccessTier[] = ['free', 'standard', 'premium', 'admin'];
  const currentIndex = tierOrder.indexOf(current);
  const requiredIndex = tierOrder.indexOf(required);

  return currentIndex >= requiredIndex;
}
