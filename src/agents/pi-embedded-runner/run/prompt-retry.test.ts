import { describe, expect, it, vi } from "vitest";
import { runWithPromptRetry, getRetryConfig } from "./prompt-retry.js";

describe("prompt-retry", () => {
  describe("getRetryConfig", () => {
    it("returns undefined when no config", () => {
      expect(getRetryConfig("openai")).toBe(undefined);
      expect(getRetryConfig("openai", {})).toBe(undefined);
    });

    it("returns provider-specific retry config", () => {
      const config = {
        models: {
          providers: {
            openai: {
              retry: {
                attempts: 5,
                minDelayMs: 2000,
                maxDelayMs: 120000,
                jitter: 0.3,
              },
            },
          },
        },
      };
      const result = getRetryConfig("openai", config);
      expect(result).toEqual({
        attempts: 5,
        minDelayMs: 2000,
        maxDelayMs: 120000,
        jitter: 0.3,
      });
    });

    it("returns undefined for unknown provider", () => {
      const config = {
        models: {
          providers: {
            openai: {
              retry: { attempts: 5 },
            },
          },
        },
      };
      expect(getRetryConfig("anthropic", config)).toBe(undefined);
    });
  });

  describe("runWithPromptRetry", () => {
    it("succeeds when function succeeds on first attempt", async () => {
      const mockFn = vi.fn().mockResolvedValue("success");
      const result = await runWithPromptRetry(mockFn, "openai", "gpt-4");
      expect(result).toBe("success");
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it("retries on TPM rate limit error and succeeds", async () => {
      const mockFn = vi
        .fn()
        .mockRejectedValueOnce(new Error("429 TPM limit exceeded"))
        .mockResolvedValueOnce("success");

      const result = await runWithPromptRetry(mockFn, "openai", "gpt-4", {
        attempts: 3,
        minDelayMs: 0,
        maxDelayMs: 1000,
        jitter: 0,
      });

      expect(result).toBe("success");
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it("retries on object-style TPM error", async () => {
      const mockFn = vi
        .fn()
        .mockRejectedValueOnce({ error: "请求额度超限(TPM)" })
        .mockResolvedValueOnce("success");

      const result = await runWithPromptRetry(mockFn, "openai", "gpt-4", {
        attempts: 3,
        minDelayMs: 0,
        maxDelayMs: 1000,
        jitter: 0,
      });

      expect(result).toBe("success");
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it("retries on Anthropic nested error format", async () => {
      const mockFn = vi
        .fn()
        .mockRejectedValueOnce({
          type: "error",
          error: { type: "rate_limit_error", message: "Rate limit exceeded" },
        })
        .mockResolvedValueOnce("success");

      const result = await runWithPromptRetry(mockFn, "anthropic", "claude-sonnet-4", {
        attempts: 3,
        minDelayMs: 0,
        maxDelayMs: 1000,
        jitter: 0,
      });

      expect(result).toBe("success");
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it("exhausts retries and throws on non-retryable error", async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error("Invalid API key"));

      await expect(
        runWithPromptRetry(mockFn, "openai", "gpt-4", {
          attempts: 3,
          minDelayMs: 0,
          maxDelayMs: 1000,
          jitter: 0,
        }),
      ).rejects.toThrow("Invalid API key");

      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it("exhausts all retry attempts and throws", async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error("429: TPM limit exceeded"));

      await expect(
        runWithPromptRetry(mockFn, "openai", "gpt-4", {
          attempts: 3,
          minDelayMs: 0,
          maxDelayMs: 1000,
          jitter: 0,
        }),
      ).rejects.toThrow("429: TPM limit exceeded");

      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    it("uses default retry config when none provided", async () => {
      const mockFn = vi.fn().mockResolvedValue("success");
      const result = await runWithPromptRetry(mockFn, "openai", "gpt-4");
      expect(result).toBe("success");
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });
});
