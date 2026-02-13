/**
 * Tests for TokenBudget.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TokenBudget } from '../../src/ai-fabric/application/token-budget.js';
import type { TenantIdString } from '../../src/core/types/tenant-id.js';
import type { AccessTier } from '../../src/core/types/access-tier.js';
import type { TokenUsage } from '../../src/ai-fabric/domain/types.js';

describe('TokenBudget', () => {
  const tenantId: TenantIdString = 'telegram:123:456' as TenantIdString;

  let budget: TokenBudget;

  beforeEach(() => {
    budget = new TokenBudget();
  });

  describe('checkBudget', () => {
    it('should allow requests within budget', () => {
      budget.setTenantTier(tenantId, 'free');

      const result = budget.checkBudget(tenantId, 5000);

      expect(result.ok).toBe(true);
    });

    it('should reject over-budget requests', () => {
      budget.setTenantTier(tenantId, 'free');

      const result = budget.checkBudget(tenantId, 15000);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.name).toBe('TokenBudgetExceededError');
      }
    });

    it('should use free tier by default', () => {
      // Don't set tier - should default to free (10,000 tokens)
      const resultUnder = budget.checkBudget(tenantId, 9000);
      const resultOver = budget.checkBudget(tenantId, 11000);

      expect(resultUnder.ok).toBe(true);
      expect(resultOver.ok).toBe(false);
    });
  });

  describe('recordUsage', () => {
    it('should track usage correctly', () => {
      budget.setTenantTier(tenantId, 'free');

      const usage: TokenUsage = {
        inputTokens: 100,
        outputTokens: 200,
        totalTokens: 300,
      };

      budget.recordUsage(tenantId, usage);

      const stats = budget.getUsage(tenantId);
      expect(stats.used).toBe(300);
      expect(stats.limit).toBe(10000);
      expect(stats.remaining).toBe(9700);
    });

    it('should accumulate usage across multiple requests', () => {
      budget.setTenantTier(tenantId, 'free');

      budget.recordUsage(tenantId, { inputTokens: 100, outputTokens: 200, totalTokens: 300 });
      budget.recordUsage(tenantId, { inputTokens: 50, outputTokens: 100, totalTokens: 150 });
      budget.recordUsage(tenantId, { inputTokens: 25, outputTokens: 50, totalTokens: 75 });

      const stats = budget.getUsage(tenantId);
      expect(stats.used).toBe(525);
    });

    it('should prevent requests after budget exceeded', () => {
      budget.setTenantTier(tenantId, 'free');

      // Use up most of the budget
      budget.recordUsage(tenantId, { inputTokens: 4000, outputTokens: 5000, totalTokens: 9000 });

      // Try to use more than remaining
      const result = budget.checkBudget(tenantId, 2000);

      expect(result.ok).toBe(false);
    });
  });

  describe('tier limits', () => {
    it('should enforce tier limits', () => {
      const tiers: Array<{ tier: AccessTier; limit: number }> = [
        { tier: 'free', limit: 10_000 },
        { tier: 'standard', limit: 100_000 },
        { tier: 'premium', limit: 1_000_000 },
      ];

      tiers.forEach(({ tier, limit }) => {
        const tid = `telegram:${tier}:123` as TenantIdString;
        budget.setTenantTier(tid, tier);

        const resultUnder = budget.checkBudget(tid, limit - 1);
        const resultOver = budget.checkBudget(tid, limit + 1);

        expect(resultUnder.ok).toBe(true);
        expect(resultOver.ok).toBe(false);
      });
    });

    it('should allow unlimited usage for admin tier', () => {
      const adminId = 'telegram:admin:123' as TenantIdString;
      budget.setTenantTier(adminId, 'admin');

      const result = budget.checkBudget(adminId, 10_000_000);

      expect(result.ok).toBe(true);
    });
  });

  describe('getUsage', () => {
    it('should return correct usage stats', () => {
      budget.setTenantTier(tenantId, 'standard');
      budget.recordUsage(tenantId, { inputTokens: 1000, outputTokens: 2000, totalTokens: 3000 });

      const stats = budget.getUsage(tenantId);

      expect(stats.used).toBe(3000);
      expect(stats.limit).toBe(100_000);
      expect(stats.remaining).toBe(97_000);
    });

    it('should return zero remaining when over budget', () => {
      budget.setTenantTier(tenantId, 'free');
      budget.recordUsage(tenantId, { inputTokens: 5000, outputTokens: 6000, totalTokens: 11000 });

      const stats = budget.getUsage(tenantId);

      expect(stats.used).toBe(11000);
      expect(stats.limit).toBe(10000);
      expect(stats.remaining).toBe(0);
    });
  });
});
