/**
 * WorkspaceManager application service.
 *
 * Manages workspace provisioning, cleanup, and path validation.
 */

import type { TenantIdString } from '../../core/types/tenant-id.js';
import type { Result } from '../../core/types/result.js';
import { ok, err } from '../../core/types/result.js';
import type { OpenClawError } from '../../core/types/errors.js';
import { SecurityError } from '../../core/types/errors.js';
import type { WorkspacePath } from '../domain/workspace-path.js';
import { validateWorkspacePath } from '../domain/workspace-path.js';

/**
 * Interface for file system operations.
 * Allows dependency injection and testing.
 */
export interface IFileSystem {
  /**
   * Creates a directory and all parent directories.
   */
  mkdir(path: string): Promise<Result<void, OpenClawError>>;

  /**
   * Writes content to a file.
   */
  writeFile(path: string, content: string): Promise<Result<void, OpenClawError>>;

  /**
   * Removes a directory and all its contents.
   */
  rmdir(path: string): Promise<Result<void, OpenClawError>>;

  /**
   * Checks if a path exists.
   */
  exists(path: string): Promise<boolean>;
}

/**
 * WorkspaceManager handles tenant workspace lifecycle.
 */
export class WorkspaceManager {
  constructor(private readonly fs: IFileSystem) {}

  /**
   * Provisions a new workspace for a tenant.
   *
   * Creates the workspace directory and initializes it with default files.
   *
   * @param tenantId - The tenant to provision for
   * @returns Result with workspace path or error
   */
  async provisionWorkspace(tenantId: TenantIdString): Promise<Result<WorkspacePath, OpenClawError>> {
    const workspacePath = `/workspaces/${tenantId}`;
    const validationResult = validateWorkspacePath(workspacePath);

    if (!validationResult.ok) {
      return validationResult;
    }

    const validPath = validationResult.value;

    // Create workspace directory
    const mkdirResult = await this.fs.mkdir(workspacePath);
    if (!mkdirResult.ok) {
      return mkdirResult;
    }

    // Create initial CLAUDE.md configuration
    const claudeMd = this.generateClaudeMd(tenantId);
    const writeResult = await this.fs.writeFile(`${workspacePath}/CLAUDE.md`, claudeMd);

    if (!writeResult.ok) {
      return writeResult;
    }

    return ok(validPath);
  }

  /**
   * Cleans up a tenant's workspace.
   *
   * @param tenantId - The tenant whose workspace to clean
   * @returns Result indicating success or error
   */
  async cleanWorkspace(tenantId: TenantIdString): Promise<Result<void, OpenClawError>> {
    const workspacePath = `/workspaces/${tenantId}`;
    return await this.fs.rmdir(workspacePath);
  }

  /**
   * Validates that a requested path is within the tenant's workspace.
   *
   * @param requestedPath - The path to validate
   * @param tenantId - The tenant making the request
   * @returns Result with validated path or SecurityError
   */
  validatePath(requestedPath: string, tenantId: TenantIdString): Result<string, SecurityError> {
    const workspaceRoot = `/workspaces/${tenantId}`;

    if (!requestedPath.startsWith(workspaceRoot)) {
      return err(
        new SecurityError(
          `Path ${requestedPath} is outside workspace ${workspaceRoot}`
        )
      );
    }

    if (requestedPath.includes('..')) {
      return err(new SecurityError('Path contains directory traversal sequence (..)'));
    }

    return ok(requestedPath);
  }

  /**
   * Generates initial CLAUDE.md content for a workspace.
   */
  private generateClaudeMd(tenantId: TenantIdString): string {
    return `# Workspace for ${tenantId}

This is your isolated workspace. All file operations are restricted to this directory.

## Rules
- You can only access files within this workspace
- No directory traversal (..) is allowed
- Workspace is automatically cleaned on session end
`;
  }
}
