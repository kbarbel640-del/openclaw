/**
 * BudgetGovernor - Enforces resource limits on agent workflows.
 *
 * Tracks usage of tool calls, LLM calls, tokens, cost, and runtime.
 * Detects retry loops and enforces hard caps.
 */

import type {
  BudgetCheckResult,
  BudgetEvent,
  BudgetGovernorOptions,
  BudgetLimits,
  BudgetProfileId,
  BudgetStatus,
  BudgetUsage,
  DeepArmOptions,
} from "./types.js";
import { getBudgetProfile, getDefaultProfileId, getProfileLimits } from "./profiles.js";
import { DEEP_MODE_DEFAULT_EXPIRY_MS } from "./types.js";

/** Threshold for warning (percentage of limit). */
const WARNING_THRESHOLD = 0.8;

/** Number of identical errors to trigger loop detection. */
const ERROR_LOOP_THRESHOLD = 3;

/**
 * Create a fresh usage object with zero values.
 */
function createEmptyUsage(): BudgetUsage {
  return {
    toolCalls: 0,
    llmCalls: 0,
    tokensInput: 0,
    tokensOutput: 0,
    tokensCacheRead: 0,
    tokensCacheWrite: 0,
    estimatedCostUsd: 0,
    runtimeMs: 0,
    retryAttempts: 0,
    webSearchCalls: 0,
    webFetchCalls: 0,
    subagentSpawns: 0,
    errorSignatures: new Map(),
  };
}

/**
 * Generate a signature for an error to detect loops.
 */
function generateErrorSignature(error: unknown): string {
  if (error instanceof Error) {
    // Use error name and first line of message
    const firstLine = error.message.split("\n")[0]?.slice(0, 100) ?? "";
    return `${error.name}:${firstLine}`;
  }
  if (typeof error === "string") {
    return `string:${error.slice(0, 100)}`;
  }
  return `unknown:${String(error).slice(0, 100)}`;
}

/**
 * BudgetGovernor class for enforcing workflow resource limits.
 */
export class BudgetGovernor {
  private readonly profileId: BudgetProfileId;
  private readonly limits: BudgetLimits;
  private readonly usage: BudgetUsage;
  private readonly startedAt: number;
  private readonly deepArmed: boolean;
  private readonly deepArmOptions: DeepArmOptions;
  private readonly deepExpiresAt: number | undefined;
  private readonly onLimitExceeded?: (result: BudgetCheckResult) => void;
  private readonly onUsageUpdate?: (usage: BudgetUsage) => void;
  private readonly onDeepReverted?: () => void;
  private readonly eventListeners: Set<(event: BudgetEvent) => void> = new Set();
  private stopped: boolean = false;
  private stopReason?: BudgetCheckResult;
  private deepReverted: boolean = false;

  constructor(options: BudgetGovernorOptions = {}) {
    this.profileId = options.profileId ?? getDefaultProfileId();
    this.limits = getProfileLimits(this.profileId, options.limitOverrides);
    this.usage = createEmptyUsage();
    this.startedAt = Date.now();
    this.deepArmed = options.deepArmed ?? false;
    this.deepArmOptions = options.deepArmOptions ?? {};
    this.onLimitExceeded = options.onLimitExceeded;
    this.onUsageUpdate = options.onUsageUpdate;
    this.onDeepReverted = options.onDeepReverted;

    // Set up deep mode expiry if armed
    if (this.deepArmed && this.profileId === "deep") {
      const expiresInMs = this.deepArmOptions.expiresInMs ?? DEEP_MODE_DEFAULT_EXPIRY_MS;
      this.deepExpiresAt = this.startedAt + expiresInMs;
    }

    // Validate deep profile requires arming
    const profile = getBudgetProfile(this.profileId);
    if (profile.requiresArming && !this.deepArmed) {
      throw new Error(`Budget profile "${this.profileId}" requires explicit arming`);
    }
  }

  /**
   * Subscribe to budget events.
   */
  subscribe(listener: (event: BudgetEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  private emit(event: BudgetEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch {
        // Ignore listener errors
      }
    }
  }

  /**
   * Check if the workflow has been stopped.
   */
  isStopped(): boolean {
    return this.stopped;
  }

  /**
   * Get the reason the workflow was stopped (if any).
   */
  getStopReason(): BudgetCheckResult | undefined {
    return this.stopReason;
  }

  /**
   * Force stop the workflow.
   */
  forceStop(reason: string): void {
    this.stopped = true;
    this.stopReason = {
      allowed: false,
      message: reason,
      suggestion: "stop",
    };
  }

  /**
   * Check if deep mode has expired (timeout-based).
   */
  isDeepExpired(): boolean {
    if (!this.deepArmed || this.profileId !== "deep") {
      return false;
    }
    if (this.deepExpiresAt && Date.now() >= this.deepExpiresAt) {
      return true;
    }
    return false;
  }

  /**
   * Check if deep mode has been reverted.
   */
  isDeepReverted(): boolean {
    return this.deepReverted;
  }

  /**
   * Manually trigger deep mode revert (for oneRun or timeout).
   */
  revertDeepMode(reason: "timeout" | "oneRun"): void {
    if (!this.deepReverted && this.deepArmed && this.profileId === "deep") {
      this.deepReverted = true;
      this.onDeepReverted?.();
      this.emit({ type: "deep_reverted", reason });
    }
  }

  /**
   * Check deep mode expiry and auto-revert if needed.
   */
  private checkDeepExpiry(): void {
    if (this.isDeepExpired() && !this.deepReverted) {
      this.revertDeepMode("timeout");
    }
  }

  /**
   * Record a tool call and check limits.
   */
  recordToolCall(toolName?: string): BudgetCheckResult {
    if (this.stopped) {
      return this.stopReason ?? { allowed: false, message: "Workflow stopped" };
    }

    this.usage.toolCalls += 1;

    // Track specific tool types
    if (toolName === "web_search") {
      this.usage.webSearchCalls += 1;
    } else if (toolName === "web_fetch") {
      this.usage.webFetchCalls += 1;
    }

    this.notifyUsageUpdate();
    return this.checkLimits();
  }

  /**
   * Record an LLM call with token usage.
   */
  recordLlmCall(tokens?: {
    input?: number;
    output?: number;
    cacheRead?: number;
    cacheWrite?: number;
    costUsd?: number;
  }): BudgetCheckResult {
    if (this.stopped) {
      return this.stopReason ?? { allowed: false, message: "Workflow stopped" };
    }

    this.usage.llmCalls += 1;

    if (tokens) {
      this.usage.tokensInput += tokens.input ?? 0;
      this.usage.tokensOutput += tokens.output ?? 0;
      this.usage.tokensCacheRead += tokens.cacheRead ?? 0;
      this.usage.tokensCacheWrite += tokens.cacheWrite ?? 0;

      if (tokens.costUsd !== undefined) {
        this.usage.estimatedCostUsd += tokens.costUsd;
      }
    }

    this.notifyUsageUpdate();
    return this.checkLimits();
  }

  /**
   * Record a subagent spawn.
   */
  recordSubagentSpawn(): BudgetCheckResult {
    if (this.stopped) {
      return this.stopReason ?? { allowed: false, message: "Workflow stopped" };
    }

    this.usage.subagentSpawns += 1;
    this.notifyUsageUpdate();
    return this.checkLimits();
  }

  /**
   * Record a retry attempt.
   */
  recordRetry(): BudgetCheckResult {
    if (this.stopped) {
      return this.stopReason ?? { allowed: false, message: "Workflow stopped" };
    }

    this.usage.retryAttempts += 1;
    this.notifyUsageUpdate();
    return this.checkLimits();
  }

  /**
   * Record an error and check for loop detection.
   */
  recordError(error: unknown): BudgetCheckResult {
    if (this.stopped) {
      return this.stopReason ?? { allowed: false, message: "Workflow stopped" };
    }

    const signature = generateErrorSignature(error);
    const count = (this.usage.errorSignatures.get(signature) ?? 0) + 1;
    this.usage.errorSignatures.set(signature, count);

    // Check for error loop
    if (count >= ERROR_LOOP_THRESHOLD) {
      const result: BudgetCheckResult = {
        allowed: false,
        exceededLimit: "errorLoopDetected",
        currentValue: count,
        limitValue: ERROR_LOOP_THRESHOLD,
        message: `Detected repeated error (${count}x): ${signature.slice(0, 50)}...`,
        suggestion: "stop",
      };
      this.handleLimitExceeded(result);
      this.emit({ type: "error_loop_detected", signature, count });
      return result;
    }

    return { allowed: true };
  }

  /**
   * Check if browser access is allowed.
   */
  checkBrowserAllowed(): BudgetCheckResult {
    if (!this.limits.browserEnabled) {
      return {
        allowed: false,
        exceededLimit: "browserEnabled",
        message: `Browser access disabled in "${this.profileId}" budget profile`,
        suggestion: "ask_escalate",
      };
    }
    return { allowed: true };
  }

  /**
   * Check all limits and return result.
   */
  checkLimits(): BudgetCheckResult {
    // Check deep mode expiry
    this.checkDeepExpiry();

    // Update runtime
    this.usage.runtimeMs = Date.now() - this.startedAt;

    // Check each limit
    const checks: Array<{
      metric: keyof BudgetLimits;
      current: number;
      limit: number;
      enabled?: boolean;
    }> = [
      { metric: "maxToolCalls", current: this.usage.toolCalls, limit: this.limits.maxToolCalls },
      { metric: "maxLlmCalls", current: this.usage.llmCalls, limit: this.limits.maxLlmCalls },
      { metric: "maxTokens", current: this.getTotalTokens(), limit: this.limits.maxTokens },
      { metric: "maxCostUsd", current: this.usage.estimatedCostUsd, limit: this.limits.maxCostUsd },
      { metric: "maxRuntimeMs", current: this.usage.runtimeMs, limit: this.limits.maxRuntimeMs },
      {
        metric: "maxRetryAttempts",
        current: this.usage.retryAttempts,
        limit: this.limits.maxRetryAttempts,
      },
      {
        metric: "maxWebSearchCalls",
        current: this.usage.webSearchCalls,
        limit: this.limits.maxWebSearchCalls,
      },
      {
        metric: "maxWebFetchCalls",
        current: this.usage.webFetchCalls,
        limit: this.limits.maxWebFetchCalls,
      },
      {
        metric: "maxSubagentSpawns",
        current: this.usage.subagentSpawns,
        limit: this.limits.maxSubagentSpawns,
      },
    ];

    for (const check of checks) {
      const ratio = check.current / check.limit;

      // Emit warning at threshold
      if (ratio >= WARNING_THRESHOLD && ratio < 1) {
        this.emit({
          type: "limit_warning",
          result: {
            allowed: true,
            exceededLimit: check.metric,
            currentValue: check.current,
            limitValue: check.limit,
            message: `Approaching limit for ${check.metric}: ${check.current}/${check.limit}`,
          },
          percentUsed: ratio * 100,
        });
      }

      // Check if exceeded
      // For zero limits, only flag exceeded if something was actually used
      // (zero limit means "disabled", not "already exceeded")
      const isExceeded = check.limit === 0 ? check.current > 0 : check.current >= check.limit;
      if (isExceeded) {
        const result: BudgetCheckResult = {
          allowed: false,
          exceededLimit: check.metric,
          currentValue: check.current,
          limitValue: check.limit,
          message: `Limit exceeded for ${check.metric}: ${check.current} >= ${check.limit}`,
          suggestion: this.profileId === "deep" ? "stop" : "ask_escalate",
        };
        this.handleLimitExceeded(result);
        return result;
      }
    }

    return { allowed: true };
  }

  /**
   * Get total tokens used.
   */
  getTotalTokens(): number {
    return (
      this.usage.tokensInput +
      this.usage.tokensOutput +
      this.usage.tokensCacheRead +
      this.usage.tokensCacheWrite
    );
  }

  /**
   * Get current usage snapshot.
   */
  getUsage(): Readonly<BudgetUsage> {
    // Update runtime before returning
    this.usage.runtimeMs = Date.now() - this.startedAt;
    return { ...this.usage, errorSignatures: new Map(this.usage.errorSignatures) };
  }

  /**
   * Get current budget status.
   */
  getStatus(): BudgetStatus {
    const usage = this.getUsage();
    const totalTokens = this.getTotalTokens();

    return {
      profileId: this.profileId,
      profileName: getBudgetProfile(this.profileId).name,
      usage,
      limits: { ...this.limits },
      percentages: {
        toolCalls: (usage.toolCalls / this.limits.maxToolCalls) * 100,
        llmCalls: (usage.llmCalls / this.limits.maxLlmCalls) * 100,
        tokens: (totalTokens / this.limits.maxTokens) * 100,
        cost: (usage.estimatedCostUsd / this.limits.maxCostUsd) * 100,
        runtime: (usage.runtimeMs / this.limits.maxRuntimeMs) * 100,
      },
      isArmed: this.deepArmed && !this.deepReverted,
      startedAt: this.startedAt,
      deepExpiresAt: this.deepExpiresAt,
      deepOneRun: this.deepArmOptions.oneRun,
    };
  }

  /**
   * Mark workflow as complete.
   */
  complete(): void {
    this.usage.runtimeMs = Date.now() - this.startedAt;
    this.emit({
      type: "workflow_complete",
      usage: this.getUsage(),
      durationMs: this.usage.runtimeMs,
    });

    // Auto-revert deep mode if oneRun is set
    if (this.deepArmOptions.oneRun && this.deepArmed && !this.deepReverted) {
      this.revertDeepMode("oneRun");
    }
  }

  private handleLimitExceeded(result: BudgetCheckResult): void {
    this.stopped = true;
    this.stopReason = result;
    this.onLimitExceeded?.(result);
    this.emit({ type: "limit_exceeded", result });
  }

  private notifyUsageUpdate(): void {
    this.onUsageUpdate?.(this.usage);
    this.emit({ type: "usage_update", usage: this.getUsage() });
  }
}

/**
 * Create a BudgetGovernor with default options.
 */
export function createBudgetGovernor(options?: BudgetGovernorOptions): BudgetGovernor {
  return new BudgetGovernor(options);
}

/**
 * Create a cheap profile governor.
 */
export function createCheapGovernor(overrides?: Partial<BudgetLimits>): BudgetGovernor {
  return new BudgetGovernor({ profileId: "cheap", limitOverrides: overrides });
}

/**
 * Create a normal profile governor.
 */
export function createNormalGovernor(overrides?: Partial<BudgetLimits>): BudgetGovernor {
  return new BudgetGovernor({ profileId: "normal", limitOverrides: overrides });
}

/**
 * Create a deep profile governor (must be armed).
 */
export function createDeepGovernor(overrides?: Partial<BudgetLimits>): BudgetGovernor {
  return new BudgetGovernor({ profileId: "deep", deepArmed: true, limitOverrides: overrides });
}
