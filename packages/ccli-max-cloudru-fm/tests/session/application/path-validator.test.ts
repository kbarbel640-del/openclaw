/**
 * Tests for PathValidator application service.
 */

import { describe, it, expect } from 'vitest';
import { validateTenantPath } from '../../../src/session/application/path-validator.js';
import type { TenantIdString } from '../../../src/core/types/tenant-id.js';

describe('validateTenantPath', () => {
  const tenantId: TenantIdString = 'telegram:123:456' as TenantIdString;
  const workspaceRoot = `/workspaces/${tenantId}`;

  it('should return ok for valid path within workspace', () => {
    const validPath = `${workspaceRoot}/file.txt`;
    const result = validateTenantPath(validPath, tenantId);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(validPath);
    }
  });

  it('should normalize valid paths with redundant separators', () => {
    const redundantPath = `${workspaceRoot}//subdir//file.txt`;
    const result = validateTenantPath(redundantPath, tenantId);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(`${workspaceRoot}/subdir/file.txt`);
    }
  });

  it('should return security error for path with ".."', () => {
    const traversalPath = `${workspaceRoot}/../other-tenant/file.txt`;
    const result = validateTenantPath(traversalPath, tenantId);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('directory traversal');
    }
  });

  it('should return error for path outside workspace', () => {
    const outsidePath = '/some/other/path/file.txt';
    const result = validateTenantPath(outsidePath, tenantId);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('outside workspace');
    }
  });

  it('should return error for non-absolute path', () => {
    const relativePath = 'relative/path/file.txt';
    const result = validateTenantPath(relativePath, tenantId);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('must be absolute');
    }
  });

  it('should handle paths with dots in filenames', () => {
    const validPath = `${workspaceRoot}/file.backup.txt`;
    const result = validateTenantPath(validPath, tenantId);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(validPath);
    }
  });

  it('should normalize paths with current directory references', () => {
    const pathWithDot = `${workspaceRoot}/./subdir/./file.txt`;
    const result = validateTenantPath(pathWithDot, tenantId);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(`${workspaceRoot}/subdir/file.txt`);
    }
  });
});
