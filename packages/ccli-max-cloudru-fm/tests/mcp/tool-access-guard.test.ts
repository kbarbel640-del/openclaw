/**
 * Tests for ToolAccessGuard.
 *
 * Verifies tier-based access control logic: access granted when tenant
 * tier meets or exceeds the tool requirement, and denied otherwise.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ToolAccessDeniedError } from '../../src/mcp/domain/errors.js';
import type { ToolDefinition } from '../../src/mcp/domain/types.js';
import type { AccessTier } from '../../src/core/types/access-tier.js';

const mockWarn = vi.fn();
vi.mock('../../src/core/infra/logger.js', () => ({
  createLogger: () => ({ warn: mockWarn }),
}));

// Import after mock setup
const { ToolAccessGuard } = await import('../../src/mcp/application/tool-access-guard.js');

/**
 * Factory helper to create a ToolDefinition with a specific required tier.
 */
function createTool(requiredTier: AccessTier, name?: string): ToolDefinition {
  return {
    name: name ?? `tool-${requiredTier}`,
    description: `A tool requiring ${requiredTier} tier`,
    inputSchema: { type: 'object' },
    requiredTier,
    category: 'code',
    timeout: 5000,
  };
}

describe('ToolAccessGuard', () => {
  let guard: InstanceType<typeof ToolAccessGuard>;

  beforeEach(() => {
    guard = new ToolAccessGuard();
  });

  describe('checkAccess', () => {
    describe('when tenant tier meets the required tier exactly', () => {
      it('should grant access for free tier tool to free tenant', () => {
        const result = guard.checkAccess('free', createTool('free'));
        expect(result.ok).toBe(true);
      });

      it('should grant access for standard tier tool to standard tenant', () => {
        const result = guard.checkAccess('standard', createTool('standard'));
        expect(result.ok).toBe(true);
      });

      it('should grant access for premium tier tool to premium tenant', () => {
        const result = guard.checkAccess('premium', createTool('premium'));
        expect(result.ok).toBe(true);
      });

      it('should grant access for admin tier tool to admin tenant', () => {
        const result = guard.checkAccess('admin', createTool('admin'));
        expect(result.ok).toBe(true);
      });
    });

    describe('when tenant tier exceeds the required tier', () => {
      it('should grant access for free tool to standard tenant', () => {
        const result = guard.checkAccess('standard', createTool('free'));
        expect(result.ok).toBe(true);
      });

      it('should grant access for free tool to premium tenant', () => {
        const result = guard.checkAccess('premium', createTool('free'));
        expect(result.ok).toBe(true);
      });

      it('should grant access for free tool to admin tenant', () => {
        const result = guard.checkAccess('admin', createTool('free'));
        expect(result.ok).toBe(true);
      });

      it('should grant access for standard tool to premium tenant', () => {
        const result = guard.checkAccess('premium', createTool('standard'));
        expect(result.ok).toBe(true);
      });

      it('should grant access for standard tool to admin tenant', () => {
        const result = guard.checkAccess('admin', createTool('standard'));
        expect(result.ok).toBe(true);
      });

      it('should grant access for premium tool to admin tenant', () => {
        const result = guard.checkAccess('admin', createTool('premium'));
        expect(result.ok).toBe(true);
      });
    });

    describe('when tenant tier is below the required tier', () => {
      it('should deny access for standard tool to free tenant', () => {
        const result = guard.checkAccess('free', createTool('standard'));
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error).toBeInstanceOf(ToolAccessDeniedError);
          expect(result.error.code).toBe('TOOL_ACCESS_DENIED');
        }
      });

      it('should deny access for premium tool to free tenant', () => {
        const result = guard.checkAccess('free', createTool('premium'));
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error).toBeInstanceOf(ToolAccessDeniedError);
        }
      });

      it('should deny access for admin tool to free tenant', () => {
        const result = guard.checkAccess('free', createTool('admin'));
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error).toBeInstanceOf(ToolAccessDeniedError);
        }
      });

      it('should deny access for premium tool to standard tenant', () => {
        const result = guard.checkAccess('standard', createTool('premium'));
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error).toBeInstanceOf(ToolAccessDeniedError);
        }
      });

      it('should deny access for admin tool to standard tenant', () => {
        const result = guard.checkAccess('standard', createTool('admin'));
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error).toBeInstanceOf(ToolAccessDeniedError);
        }
      });

      it('should deny access for admin tool to premium tenant', () => {
        const result = guard.checkAccess('premium', createTool('admin'));
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error).toBeInstanceOf(ToolAccessDeniedError);
        }
      });
    });

    describe('error details', () => {
      it('should include the tool name in the error message', () => {
        const tool = createTool('admin', 'secret-admin-tool');
        const result = guard.checkAccess('free', tool);

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.message).toContain('secret-admin-tool');
        }
      });

      it('should include the required tier in the error message', () => {
        const result = guard.checkAccess('free', createTool('premium'));

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.message).toContain('premium');
        }
      });

      it('should include the actual tier in the error message', () => {
        const result = guard.checkAccess('free', createTool('admin'));

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.message).toContain('free');
        }
      });

      it('should mark the error as non-recoverable', () => {
        const result = guard.checkAccess('free', createTool('premium'));

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.recoverable).toBe(false);
        }
      });

      it('should provide a user-safe message', () => {
        const result = guard.checkAccess('free', createTool('premium'));

        expect(result.ok).toBe(false);
        if (!result.ok) {
          const userMsg = result.error.toUserMessage();
          expect(userMsg).toBeTruthy();
          expect(userMsg).not.toContain('free');
          expect(userMsg).not.toContain('premium');
        }
      });
    });

    describe('logging', () => {
      beforeEach(() => {
        mockWarn.mockClear();
      });

      it('should log a warning when access is denied', () => {
        guard.checkAccess('free', createTool('admin', 'restricted-tool'));

        expect(mockWarn).toHaveBeenCalledTimes(1);
        expect(mockWarn).toHaveBeenCalledWith(
          expect.objectContaining({ tool: 'restricted-tool' }),
          expect.any(String)
        );
      });

      it('should not log when access is granted', () => {
        guard.checkAccess('admin', createTool('free'));

        expect(mockWarn).not.toHaveBeenCalled();
      });
    });

    describe('full tier matrix', () => {
      const tiers: AccessTier[] = ['free', 'standard', 'premium', 'admin'];

      /**
       * Build and assert the complete access matrix.
       * For each (tenantTier, requiredTier) pair, access should be granted
       * if and only if tenantTier >= requiredTier in the hierarchy.
       */
      for (const tenantTier of tiers) {
        for (const requiredTier of tiers) {
          const tierIndex = (t: AccessTier) => tiers.indexOf(t);
          const shouldAllow = tierIndex(tenantTier) >= tierIndex(requiredTier);
          const label = shouldAllow ? 'grants' : 'denies';

          it(`${label} access for ${tenantTier} tenant to ${requiredTier} tool`, () => {
            const result = guard.checkAccess(tenantTier, createTool(requiredTier));
            expect(result.ok).toBe(shouldAllow);
          });
        }
      }
    });
  });
});
