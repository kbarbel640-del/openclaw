
type ErrorCategory =
  | "network"
  | "authentication"
  | "rate_limit"
  | "timeout"
  | "context_overflow"
  | "billing"
  | "permission"
  | "validation"
  | "unknown";

type HealingAction =
  | "retry"
  | "fallback"
  | "reduce_context"
  | "refresh_auth"
  | "check_billing"
  | "request_permission"
  | "fix_validation"
  | "manual_intervention";

interface HealingStrategy {
  category: ErrorCategory;
  confidence: number;
  actions: HealingAction[];
  message: string;
  canAutoHeal: boolean;
}

interface ErrorContext {
  errorMessage: string;
  errorCode?: string;
  httpStatus?: number;
  provider?: string;
  model?: string;
  retryCount?: number;
  lastSuccessTime?: number;
  operationType?: string;
}

interface HealingResult {
  success: boolean;
  action: HealingAction | null;
  category: ErrorCategory;
  message: string;
  shouldRetry: boolean;
  retryDelayMs?: number;
  metadata?: Record<string, unknown>;
}

const ERROR_PATTERNS: Record<
  ErrorCategory,
  Array<{ pattern: RegExp | string; action: HealingAction }>
> = {
  network: [
    { pattern: /ECONNRESET|ECONNREFUSED|ETIMEDOUT|ENOTFOUND/i, action: "retry" },
    { pattern: /network error|connection failed/i, action: "retry" },
    { pattern: /fetch failed|request failed/i, action: "fallback" },
    { pattern: /socket hang up/i, action: "retry" },
    { pattern: /\b5[0-9]{2}\b(?!.*(?:timeout|401|403))/i, action: "fallback" },
  ],
  authentication: [
    { pattern: /invalid.*api.*key|incorrect.*api.*key/i, action: "refresh_auth" },
    { pattern: /unauthorized|401|authentication failed/i, action: "refresh_auth" },
    { pattern: /forbidden|403|access denied/i, action: "check_billing" },
    { pattern: /token expired|token has expired/i, action: "refresh_auth" },
    { pattern: /invalid.*token|oauth.*error|oauth.*refresh.*failed/i, action: "refresh_auth" },
  ],
  rate_limit: [
    { pattern: /rate limit|too many requests|429/i, action: "retry" },
    { pattern: /quota exceeded|usage limit/i, action: "retry" },
    { pattern: /throttl/i, action: "retry" },
    { pattern: /requests per (?:minute|hour|day)/i, action: "retry" },
  ],
  timeout: [
    { pattern: /timeout|timed out|deadline exceeded/i, action: "retry" },
    { pattern: /request timeout|read timeout/i, action: "retry" },
    { pattern: /504|gateway timeout/i, action: "fallback" },
    { pattern: /\b504\b/i, action: "fallback" },
  ],
  context_overflow: [
    { pattern: /context (?:window|length) (?:exceeded|too large)/i, action: "reduce_context" },
    { pattern: /prompt is too long|request size exceeds/i, action: "reduce_context" },
    { pattern: /maximum context length|context overflow/i, action: "reduce_context" },
  ],
  billing: [
    { pattern: /billing|payment required|402/i, action: "check_billing" },
    { pattern: /insufficient credits?|credit balance/i, action: "check_billing" },
    { pattern: /upgrade.*plan|subscription/i, action: "check_billing" },
  ],
  permission: [
    { pattern: /permission denied|insufficient permissions/i, action: "request_permission" },
    { pattern: /not authorized to access|access restricted/i, action: "request_permission" },
  ],
  validation: [
    { pattern: /invalid.*format|validation error/i, action: "fix_validation" },
    { pattern: /bad request|400/i, action: "fix_validation" },
    { pattern: /missing.*parameter|required.*field/i, action: "fix_validation" },
  ],
  unknown: [
    { pattern: /.*/, action: "manual_intervention" },
  ],
};

const RETRY_DELAYS: Record<HealingAction, number> = {
  retry: 1000,
  fallback: 500,
  reduce_context: 0,
  refresh_auth: 2000,
  check_billing: 0,
  request_permission: 0,
  fix_validation: 0,
  manual_intervention: 0,
};

const MAX_RETRIES: Record<ErrorCategory, number> = {
  network: 3,
  authentication: 2,
  rate_limit: 5,
  timeout: 3,
  context_overflow: 1,
  billing: 0,
  permission: 0,
  validation: 1,
  unknown: 0,
};

function categorizeError(context: ErrorContext): ErrorCategory {
  const { errorMessage, errorCode, httpStatus } = context;
  const searchText = `${errorMessage} ${errorCode || ""} ${httpStatus || ""}`;

  const priorityCategories: ErrorCategory[] = [
    "authentication",
    "rate_limit",
    "timeout",
    "context_overflow",
    "billing",
    "permission",
    "validation",
  ];

  for (const category of priorityCategories) {
    const patterns = ERROR_PATTERNS[category];
    for (const { pattern } of patterns) {
      const matches =
        pattern instanceof RegExp ? pattern.test(searchText) : searchText.includes(pattern);
      if (matches) {
        return category;
      }
    }
  }

  const networkPatterns = ERROR_PATTERNS.network;
  for (const { pattern } of networkPatterns) {
    const matches =
      pattern instanceof RegExp ? pattern.test(searchText) : searchText.includes(pattern);
    if (matches) {
      return "network";
    }
  }

  return "unknown";
}

function determineHealingStrategy(
  category: ErrorCategory,
  context: ErrorContext,
): HealingStrategy {
  const patterns = ERROR_PATTERNS[category] || ERROR_PATTERNS.unknown;
  const searchText = `${context.errorMessage} ${context.errorCode || ""} ${context.httpStatus || ""}`;

  const matchedAction = patterns.find(({ pattern }) =>
    pattern instanceof RegExp ? pattern.test(searchText) : searchText.includes(pattern),
  )?.action;

  const actions: HealingAction[] = matchedAction ? [matchedAction] : ["manual_intervention"];
  const canAutoHeal = ["retry", "fallback", "reduce_context"].includes(actions[0]);

  let message = "";
  const primaryAction = actions[0];
  switch (primaryAction) {
    case "retry":
      message = `Transient ${category} error detected. Will retry with exponential backoff.`;
      break;
    case "fallback":
      message = `${category} error detected. Will attempt fallback to alternative provider.`;
      break;
    case "reduce_context":
      message = "Context overflow detected. Will reduce context size and retry.";
      break;
    case "refresh_auth":
      message = "Authentication error detected. Will refresh credentials.";
      break;
    case "check_billing":
      message = "Billing/subscription issue detected. Please check your account status.";
      break;
    case "request_permission":
      message = "Permission denied. Additional authorization required.";
      break;
    case "fix_validation":
      message = "Validation error detected. Will attempt to fix request format.";
      break;
    case "manual_intervention":
      message = "Unknown error. Manual intervention required.";
      break;
  }

  return {
    category,
    confidence: category === "unknown" ? 0.3 : 0.8,
    actions,
    message,
    canAutoHeal,
  };
}

export class ErrorHealingSystem {
  private errorHistory: Map<string, ErrorContext[]> = new Map();
  private readonly maxHistorySize = 10;

  categorize(context: ErrorContext): ErrorCategory {
    return categorizeError(context);
  }

  analyze(context: ErrorContext): HealingStrategy {
    const category = this.categorize(context);
    this.trackError(context);
    return determineHealingStrategy(category, context);
  }

  async heal(context: ErrorContext): Promise<HealingResult> {
    const strategy = this.analyze(context);

    if (!strategy.canAutoHeal) {
      return {
        success: false,
        action: strategy.actions[0],
        category: strategy.category,
        message: strategy.message,
        shouldRetry: false,
        metadata: {
          requiresManualIntervention: true,
          suggestedActions: strategy.actions,
        },
      };
    }

    const retryCount = context.retryCount || 0;
    const maxRetries = MAX_RETRIES[strategy.category] || 0;

    if (retryCount >= maxRetries) {
      return {
        success: false,
        action: strategy.actions[0],
        category: strategy.category,
        message: `Max retries (${maxRetries}) exceeded for ${strategy.category} error.`,
        shouldRetry: false,
        metadata: {
          retryCount,
          maxRetries,
          exhaustionReason: "max_retries_exceeded",
        },
      };
    }

    const action = strategy.actions[0];
    const retryDelay = this.calculateRetryDelay(action, retryCount);

    if (action === "reduce_context") {
      return {
        success: true,
        action,
        category: strategy.category,
        message: strategy.message,
        shouldRetry: true,
        retryDelayMs: 0,
        metadata: {
          reductionStrategy: "oldest_first",
          suggestedReductionPercent: 25,
        },
      };
    }

    if (action === "fallback") {
      return {
        success: true,
        action,
        category: strategy.category,
        message: strategy.message,
        shouldRetry: true,
        retryDelayMs: retryDelay,
        metadata: {
          fallbackType: "provider_switch",
          preserveContext: true,
        },
      };
    }

    return {
      success: true,
      action,
      category: strategy.category,
      message: strategy.message,
      shouldRetry: true,
      retryDelayMs: retryDelay,
      metadata: {
        retryCount: retryCount + 1,
        maxRetries,
      },
    };
  }

  getRecommendedAction(context: ErrorContext): HealingAction {
    const strategy = this.analyze(context);
    return strategy.actions[0];
  }

  shouldRetry(context: ErrorContext): boolean {
    const category = this.categorize(context);
    const retryCount = context.retryCount || 0;
    const maxRetries = MAX_RETRIES[category] || 0;
    return retryCount < maxRetries;
  }

  getRetryDelay(context: ErrorContext): number {
    const action = this.getRecommendedAction(context);
    const retryCount = context.retryCount || 0;
    return this.calculateRetryDelay(action, retryCount);
  }

  getErrorStatistics(errorKey?: string): {
    totalErrors: number;
    byCategory: Record<ErrorCategory, number>;
    healingSuccessRate: number;
  } {
    const allErrors = errorKey
      ? this.errorHistory.get(errorKey) || []
      : Array.from(this.errorHistory.values()).flat();

    const byCategory: Record<ErrorCategory, number> = {
      network: 0,
      authentication: 0,
      rate_limit: 0,
      timeout: 0,
      context_overflow: 0,
      billing: 0,
      permission: 0,
      validation: 0,
      unknown: 0,
    };

    for (const error of allErrors) {
      const category = this.categorize(error);
      byCategory[category]++;
    }

    const totalErrors = allErrors.length;
    const healableErrors = allErrors.filter((e) => {
      const strategy = determineHealingStrategy(this.categorize(e), e);
      return strategy.canAutoHeal;
    }).length;

    return {
      totalErrors,
      byCategory,
      healingSuccessRate: totalErrors > 0 ? healableErrors / totalErrors : 0,
    };
  }

  clearHistory(errorKey?: string): void {
    if (errorKey) {
      this.errorHistory.delete(errorKey);
    } else {
      this.errorHistory.clear();
    }
  }

  private trackError(context: ErrorContext): void {
    const key = this.generateErrorKey(context);
    const history = this.errorHistory.get(key) || [];
    history.push(context);

    if (history.length > this.maxHistorySize) {
      history.shift();
    }

    this.errorHistory.set(key, history);
  }

  private calculateRetryDelay(action: HealingAction, retryCount: number): number {
    const baseDelay = RETRY_DELAYS[action] || 1000;
    const exponentialDelay = baseDelay * Math.pow(2, retryCount);
    const jitter = Math.random() * 0.3 * exponentialDelay;
    return Math.min(exponentialDelay + jitter, 30000);
  }

  private generateErrorKey(context: ErrorContext): string {
    const parts = [context.errorCode, context.httpStatus, context.provider, context.operationType];
    return parts.filter(Boolean).join("-") || "default";
  }
}

export function createErrorHealer(): ErrorHealingSystem {
  return new ErrorHealingSystem();
}

export {
  type ErrorCategory,
  type HealingAction,
  type HealingStrategy,
  type ErrorContext,
  type HealingResult,
  ERROR_PATTERNS,
  RETRY_DELAYS,
  MAX_RETRIES,
  categorizeError,
  determineHealingStrategy,
};
