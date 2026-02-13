import type { AccessTier } from '../../core/types/access-tier.js';
import { isTierAtLeast } from '../../core/types/access-tier.js';
import type { Result } from '../../core/types/result.js';
import { ok, err } from '../../core/types/result.js';
import { ToolAccessDeniedError } from '../domain/errors.js';
import type { ToolDefinition } from '../domain/types.js';
import { createLogger } from '../../core/infra/logger.js';

const logger = createLogger('ToolAccessGuard');

/**
 * Enforces tier-based access control for tool invocations
 */
export class ToolAccessGuard {
  /**
   * Check if a tenant has access to a tool based on their tier
   * @param tenantTier - The tenant's access tier
   * @param tool - The tool being accessed
   * @returns Ok if access granted, Err with ToolAccessDeniedError if denied
   */
  checkAccess(
    tenantTier: AccessTier,
    tool: ToolDefinition
  ): Result<void, ToolAccessDeniedError> {
    if (isTierAtLeast(tenantTier, tool.requiredTier)) {
      return ok(undefined);
    }

    const error = new ToolAccessDeniedError(
      tool.name,
      tool.requiredTier,
      tenantTier
    );

    this.logDeniedAttempt(tool, tenantTier);

    return err(error);
  }

  /**
   * Log denied access attempts for security monitoring
   */
  private logDeniedAttempt(tool: ToolDefinition, attemptedTier: AccessTier): void {
    logger.warn(
      { tool: tool.name, requiredTier: tool.requiredTier, attemptedTier },
      'Access denied'
    );
  }
}
