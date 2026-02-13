/**
 * WorkspacePath branded type and validation.
 *
 * Ensures workspace paths are valid and safe.
 */

import type { Branded } from '../../core/types/branded.js';
import { brand } from '../../core/types/branded.js';
import type { Result } from '../../core/types/result.js';
import { ok, err } from '../../core/types/result.js';
import { ValidationError } from '../../core/types/errors.js';

/**
 * Branded string type for workspace paths.
 * Guarantees the path has been validated for safety.
 */
export type WorkspacePath = Branded<string, 'WorkspacePath'>;

/**
 * Validates a workspace path for security and correctness.
 *
 * Checks:
 * - Path is not empty
 * - Path is absolute
 * - Path does not contain directory traversal sequences (..)
 * - Path is within allowed workspace root
 *
 * @param path - The path to validate
 * @returns Result with branded WorkspacePath or ValidationError
 */
export function validateWorkspacePath(path: string): Result<WorkspacePath, ValidationError> {
  if (!path || path.trim() === '') {
    return err(new ValidationError('Workspace path cannot be empty'));
  }

  if (!path.startsWith('/')) {
    return err(new ValidationError('Workspace path must be absolute'));
  }

  if (path.includes('..')) {
    return err(new ValidationError('Workspace path cannot contain directory traversal (..)'));
  }

  if (!path.startsWith('/workspaces/')) {
    return err(new ValidationError('Workspace path must be within /workspaces/'));
  }

  return ok(brand<string, 'WorkspacePath'>(path));
}
