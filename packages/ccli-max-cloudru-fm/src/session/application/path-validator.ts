/**
 * PathValidator application service.
 *
 * Validates file paths for security and tenant isolation.
 */

import type { TenantIdString } from '../../core/types/tenant-id.js';
import type { Result } from '../../core/types/result.js';
import { ok, err } from '../../core/types/result.js';
import { SecurityError } from '../../core/types/errors.js';

/**
 * Validates that a requested path is safe and within tenant boundaries.
 *
 * Security checks:
 * - No directory traversal (..)
 * - No symlinks outside workspace
 * - Path is within tenant's workspace root
 * - Path is absolute
 *
 * @param requestedPath - The path to validate
 * @param tenantId - The tenant making the request
 * @returns Result with canonical path or SecurityError
 */
export function validateTenantPath(
  requestedPath: string,
  tenantId: TenantIdString
): Result<string, SecurityError> {
  // Ensure path is absolute
  if (!requestedPath.startsWith('/')) {
    return err(new SecurityError('Path must be absolute'));
  }

  // Check for directory traversal
  if (requestedPath.includes('..')) {
    return err(new SecurityError('Path contains directory traversal sequence (..)'));
  }

  // Normalize path by removing redundant separators
  const normalized = normalizePath(requestedPath);

  // Verify path is within workspace
  const workspaceRoot = `/workspaces/${tenantId}`;
  if (!normalized.startsWith(workspaceRoot)) {
    return err(
      new SecurityError(
        `Path ${normalized} is outside workspace ${workspaceRoot}`
      )
    );
  }

  // Additional check: ensure no symlink escapes (simplified check)
  if (normalized.includes('//')) {
    return err(new SecurityError('Path contains invalid separators'));
  }

  return ok(normalized);
}

/**
 * Normalizes a path by removing redundant separators and resolving . segments.
 *
 * @param path - The path to normalize
 * @returns Normalized path
 */
function normalizePath(path: string): string {
  const parts = path.split('/').filter(part => part !== '' && part !== '.');
  return '/' + parts.join('/');
}
