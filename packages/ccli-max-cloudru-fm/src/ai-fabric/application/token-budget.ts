import { err, ok, type Result } from '../../core/types/result.js';
import type { TenantIdString } from '../../core/types/tenant-id.js';
import type { AccessTier } from '../../core/types/access-tier.js';
import { TokenBudgetExceededError } from '../domain/errors.js';
import type { TokenUsage } from '../domain/types.js';

const TIER_LIMITS: Record<AccessTier, number> = {
  free: 10_000,
  standard: 100_000,
  premium: 1_000_000,
  admin: Infinity
};

interface TenantUsage {
  used: number;
  lastReset: number;
}

export class TokenBudget {
  private readonly usage = new Map<TenantIdString, TenantUsage>();
  private readonly tierLimits = new Map<TenantIdString, number>();
  private readonly resetIntervalMs = 24 * 60 * 60 * 1000; // 24 hours

  setTenantTier(tenantId: TenantIdString, tier: AccessTier): void {
    this.tierLimits.set(tenantId, TIER_LIMITS[tier]);
  }

  checkBudget(tenantId: TenantIdString, estimatedTokens: number): Result<void, TokenBudgetExceededError> {
    const limit = this.getTenantLimit(tenantId);
    const usage = this.getOrCreateUsage(tenantId);
    this.resetIfNeeded(usage);

    if (usage.used + estimatedTokens > limit) {
      return err(new TokenBudgetExceededError(tenantId, usage.used, limit));
    }

    return ok(undefined);
  }

  recordUsage(tenantId: TenantIdString, usage: TokenUsage): void {
    const tenantUsage = this.getOrCreateUsage(tenantId);
    this.resetIfNeeded(tenantUsage);
    tenantUsage.used += usage.totalTokens;
  }

  getUsage(tenantId: TenantIdString): { used: number; limit: number; remaining: number } {
    const limit = this.getTenantLimit(tenantId);
    const usage = this.getOrCreateUsage(tenantId);
    this.resetIfNeeded(usage);

    return {
      used: usage.used,
      limit,
      remaining: Math.max(0, limit - usage.used)
    };
  }

  private getTenantLimit(tenantId: TenantIdString): number {
    return this.tierLimits.get(tenantId) ?? TIER_LIMITS.free;
  }

  private getOrCreateUsage(tenantId: TenantIdString): TenantUsage {
    let usage = this.usage.get(tenantId);
    if (!usage) {
      usage = { used: 0, lastReset: Date.now() };
      this.usage.set(tenantId, usage);
    }
    return usage;
  }

  private resetIfNeeded(usage: TenantUsage): void {
    const now = Date.now();
    if (now - usage.lastReset >= this.resetIntervalMs) {
      usage.used = 0;
      usage.lastReset = now;
    }
  }
}
