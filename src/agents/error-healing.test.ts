import { describe, expect, it } from "vitest";
import {
  createErrorHealer,
  ErrorHealingSystem,
  categorizeError,
  type ErrorContext,
  type ErrorCategory,
} from "./error-healing.js";

describe("error-healing", () => {
  describe("createErrorHealer", () => {
    it("should create an ErrorHealingSystem instance", () => {
      const healer = createErrorHealer();
      expect(healer).toBeInstanceOf(ErrorHealingSystem);
    });
  });

  describe("categorizeError", () => {
    it("should categorize network errors", () => {
      const context: ErrorContext = {
        errorMessage: "ECONNRESET: connection reset by peer",
      };
      expect(categorizeError(context)).toBe("network");
    });

    it("should categorize authentication errors", () => {
      const context: ErrorContext = {
        errorMessage: "Invalid API key provided",
      };
      expect(categorizeError(context)).toBe("authentication");
    });

    it("should categorize rate limit errors", () => {
      const context: ErrorContext = {
        errorMessage: "Rate limit exceeded. Too many requests",
      };
      expect(categorizeError(context)).toBe("rate_limit");
    });

    it("should categorize timeout errors", () => {
      const context: ErrorContext = {
        errorMessage: "Request timed out after 30 seconds",
      };
      expect(categorizeError(context)).toBe("timeout");
    });

    it("should categorize context overflow errors", () => {
      const context: ErrorContext = {
        errorMessage: "Context window exceeded: prompt is too long",
      };
      expect(categorizeError(context)).toBe("context_overflow");
    });

    it("should categorize billing errors", () => {
      const context: ErrorContext = {
        errorMessage: "Payment required. Insufficient credits",
      };
      expect(categorizeError(context)).toBe("billing");
    });

    it("should categorize permission errors", () => {
      const context: ErrorContext = {
        errorMessage: "Permission denied: insufficient permissions",
      };
      expect(categorizeError(context)).toBe("permission");
    });

    it("should categorize validation errors", () => {
      const context: ErrorContext = {
        errorMessage: "Bad request: invalid format for field 'email'",
      };
      expect(categorizeError(context)).toBe("validation");
    });

    it("should categorize unknown errors as unknown", () => {
      const context: ErrorContext = {
        errorMessage: "Something unexpected happened",
      };
      expect(categorizeError(context)).toBe("unknown");
    });

    it("should use HTTP status codes for categorization", () => {
      const context: ErrorContext = {
        errorMessage: "Request failed",
        httpStatus: 401,
      };
      expect(categorizeError(context)).toBe("authentication");
    });

    it("should use error codes for categorization", () => {
      const context: ErrorContext = {
        errorMessage: "Operation failed",
        errorCode: "ETIMEDOUT",
      };
      expect(categorizeError(context)).toBe("network");
    });
  });

  describe("ErrorHealingSystem", () => {
    const healer = new ErrorHealingSystem();

    describe("analyze", () => {
      it("should analyze network error and suggest retry", () => {
        const context: ErrorContext = {
          errorMessage: "ECONNRESET: connection reset",
          retryCount: 0,
        };
        const strategy = healer.analyze(context);
        expect(strategy.category).toBe("network");
        expect(strategy.canAutoHeal).toBe(true);
        expect(strategy.actions).toContain("retry");
      });

      it("should analyze context overflow and suggest reduction", () => {
        const context: ErrorContext = {
          errorMessage: "Context length exceeded",
        };
        const strategy = healer.analyze(context);
        expect(strategy.category).toBe("context_overflow");
        expect(strategy.actions).toContain("reduce_context");
      });

      it("should mark billing errors as not auto-healable", () => {
        const context: ErrorContext = {
          errorMessage: "Insufficient credits",
        };
        const strategy = healer.analyze(context);
        expect(strategy.category).toBe("billing");
        expect(strategy.canAutoHeal).toBe(false);
      });
    });

    describe("heal", () => {
      it("should successfully heal network errors with retry", async () => {
        const context: ErrorContext = {
          errorMessage: "ECONNRESET",
          retryCount: 0,
        };
        const result = await healer.heal(context);
        expect(result.success).toBe(true);
        expect(result.shouldRetry).toBe(true);
        expect(result.action).toBe("retry");
      });

      it("should fail to heal when max retries exceeded", async () => {
        const context: ErrorContext = {
          errorMessage: "ECONNRESET",
          retryCount: 5,
        };
        const result = await healer.heal(context);
        expect(result.success).toBe(false);
        expect(result.shouldRetry).toBe(false);
      });

      it("should return metadata for context reduction", async () => {
        const context: ErrorContext = {
          errorMessage: "Context window exceeded",
        };
        const result = await healer.heal(context);
        expect(result.metadata).toBeDefined();
        expect(result.metadata?.reductionStrategy).toBe("oldest_first");
      });

      it("should not auto-heal permission errors", async () => {
        const context: ErrorContext = {
          errorMessage: "Permission denied",
        };
        const result = await healer.heal(context);
        expect(result.success).toBe(false);
        expect(result.action).toBe("request_permission");
        expect(result.metadata?.requiresManualIntervention).toBe(true);
      });
    });

    describe("getRecommendedAction", () => {
      it("should recommend retry for transient errors", () => {
        const context: ErrorContext = {
          errorMessage: "Socket hang up",
        };
        expect(healer.getRecommendedAction(context)).toBe("retry");
      });

      it("should recommend refresh_auth for auth errors", () => {
        const context: ErrorContext = {
          errorMessage: "Token expired",
        };
        expect(healer.getRecommendedAction(context)).toBe("refresh_auth");
      });
    });

    describe("shouldRetry", () => {
      it("should allow retry for network errors", () => {
        const context: ErrorContext = {
          errorMessage: "ECONNREFUSED",
          retryCount: 0,
        };
        expect(healer.shouldRetry(context)).toBe(true);
      });

      it("should not allow retry for billing errors", () => {
        const context: ErrorContext = {
          errorMessage: "Insufficient credits",
          retryCount: 0,
        };
        expect(healer.shouldRetry(context)).toBe(false);
      });

      it("should not allow retry when max retries exceeded", () => {
        const context: ErrorContext = {
          errorMessage: "Timeout",
          retryCount: 10,
        };
        expect(healer.shouldRetry(context)).toBe(false);
      });
    });

    describe("getRetryDelay", () => {
      it("should return increasing delays for retries", () => {
        const context1: ErrorContext = {
          errorMessage: "Timeout",
          retryCount: 0,
        };
        const context2: ErrorContext = {
          errorMessage: "Timeout",
          retryCount: 2,
        };

        const delay1 = healer.getRetryDelay(context1);
        const delay2 = healer.getRetryDelay(context2);

        expect(delay1).toBeGreaterThan(0);
        expect(delay2).toBeGreaterThan(delay1);
      });

      it("should cap retry delay at 30 seconds", () => {
        const context: ErrorContext = {
          errorMessage: "Timeout",
          retryCount: 10,
        };
        const delay = healer.getRetryDelay(context);
        expect(delay).toBeLessThanOrEqual(30000);
      });
    });

    describe("getErrorStatistics", () => {
      it("should track error statistics", () => {
        const localHealer = new ErrorHealingSystem();

        const errors: ErrorContext[] = [
          { errorMessage: "ECONNRESET", operationType: "fetch" },
          { errorMessage: "Timeout", operationType: "fetch" },
          { errorMessage: "Invalid API key", operationType: "auth" },
        ];

        errors.forEach((ctx) => localHealer.analyze(ctx));

        const stats = localHealer.getErrorStatistics();
        expect(stats.totalErrors).toBe(3);
        expect(stats.byCategory.network).toBeGreaterThanOrEqual(1);
        expect(stats.byCategory.timeout).toBeGreaterThanOrEqual(1);
        expect(stats.byCategory.authentication).toBeGreaterThanOrEqual(1);
      });

      it("should calculate healing success rate", () => {
        const localHealer = new ErrorHealingSystem();

        localHealer.analyze({ errorMessage: "ECONNRESET" });
        localHealer.analyze({ errorMessage: "Insufficient credits" });

        const stats = localHealer.getErrorStatistics();
        expect(stats.healingSuccessRate).toBeGreaterThan(0);
        expect(stats.healingSuccessRate).toBeLessThanOrEqual(1);
      });

      it("should handle empty history", () => {
        const localHealer = new ErrorHealingSystem();
        const stats = localHealer.getErrorStatistics();
        expect(stats.totalErrors).toBe(0);
        expect(stats.healingSuccessRate).toBe(0);
      });
    });

    describe("clearHistory", () => {
      it("should clear all error history", () => {
        const localHealer = new ErrorHealingSystem();
        localHealer.analyze({ errorMessage: "ECONNRESET" });
        localHealer.analyze({ errorMessage: "Timeout" });

        localHealer.clearHistory();
        const stats = localHealer.getErrorStatistics();
        expect(stats.totalErrors).toBe(0);
      });

      it("should clear specific error key history", () => {
        const localHealer = new ErrorHealingSystem();
        localHealer.analyze({ errorMessage: "ECONNRESET", operationType: "fetch" });
        localHealer.analyze({ errorMessage: "Timeout", operationType: "auth" });

        localHealer.clearHistory("fetch");
        const stats = localHealer.getErrorStatistics();
        expect(stats.totalErrors).toBe(1);
      });
    });
  });

  describe("Error Categories Coverage", () => {
    const testCases: Array<{
      name: string;
      context: ErrorContext;
      expectedCategory: ErrorCategory;
    }> = [
      {
        name: "5xx server errors",
        context: { errorMessage: "Internal Server Error", httpStatus: 500 },
        expectedCategory: "network",
      },
      {
        name: "403 forbidden",
        context: { errorMessage: "Forbidden", httpStatus: 403 },
        expectedCategory: "authentication",
      },
      {
        name: "429 rate limit",
        context: { errorMessage: "Too Many Requests", httpStatus: 429 },
        expectedCategory: "rate_limit",
      },
      {
        name: "Gateway timeout",
        context: { errorMessage: "Gateway Timeout", httpStatus: 504 },
        expectedCategory: "timeout",
      },
      {
        name: "400 bad request",
        context: { errorMessage: "Bad Request", httpStatus: 400 },
        expectedCategory: "validation",
      },
      {
        name: "Quota exceeded",
        context: { errorMessage: "Quota exceeded this hour" },
        expectedCategory: "rate_limit",
      },
      {
        name: "OAuth token refresh failed",
        context: { errorMessage: "OAuth token refresh failed" },
        expectedCategory: "authentication",
      },
    ];

    testCases.forEach(({ name, context, expectedCategory }) => {
      it(`should correctly categorize ${name}`, () => {
        expect(categorizeError(context)).toBe(expectedCategory);
      });
    });
  });
});
