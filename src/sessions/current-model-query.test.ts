import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ModelRef } from "../agents/model-selection.js";
import { loadConfig } from "../config/config.js";
import { callGateway } from "../gateway/call.js";
import {
  getCurrentSessionModel,
  getCurrentSessionModelString,
  isSessionActive,
} from "./current-model-query.js";

// Mock dependencies
vi.mock("../gateway/call.js");
vi.mock("../config/config.js");

const mockCallGateway = vi.mocked(callGateway);
const mockLoadConfig = vi.mocked(loadConfig);

describe("current-model-query", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default config mock
    mockLoadConfig.mockReturnValue({
      agents: {
        defaults: {
          model: {
            primary: "anthropic/claude-sonnet-4-5",
          },
        },
      },
    } as any);
  });

  describe("getCurrentSessionModel", () => {
    it("should return model from gateway response", async () => {
      mockCallGateway.mockResolvedValue({
        session: {
          key: "agent:main:main",
          model: "anthropic/claude-opus-4-5",
        },
      });

      const result = await getCurrentSessionModel("agent:main:main");

      expect(result).toEqual({
        provider: "anthropic",
        model: "claude-opus-4-5",
      });
    });

    it("should return model from provider/model overrides", async () => {
      mockCallGateway.mockResolvedValue({
        session: {
          key: "agent:main:main",
          providerOverride: "openai",
          modelOverride: "gpt-4o",
        },
      });

      const result = await getCurrentSessionModel("agent:main:main");

      expect(result).toEqual({
        provider: "openai",
        model: "gpt-4o",
      });
    });

    it("should prioritize explicit model over provider/model overrides", async () => {
      mockCallGateway.mockResolvedValue({
        session: {
          key: "agent:main:main",
          model: "anthropic/claude-opus-4-5",
          providerOverride: "openai",
          modelOverride: "gpt-4o",
        },
      });

      const result = await getCurrentSessionModel("agent:main:main");

      // Should use explicit model, not overrides
      expect(result).toEqual({
        provider: "anthropic",
        model: "claude-opus-4-5",
      });
    });

    it("should fallback to default model when gateway fails", async () => {
      mockCallGateway.mockRejectedValue(new Error("Gateway unavailable"));

      const result = await getCurrentSessionModel("agent:main:main");

      expect(result).toEqual({
        provider: "anthropic",
        model: "claude-sonnet-4-5", // From config default
      });
    });

    it("should fallback to default model when session not found", async () => {
      mockCallGateway.mockResolvedValue({ session: null });

      const result = await getCurrentSessionModel("agent:main:main");

      expect(result).toEqual({
        provider: "anthropic",
        model: "claude-sonnet-4-5", // From config default
      });
    });

    it("should return null when all methods fail", async () => {
      mockCallGateway.mockRejectedValue(new Error("Gateway unavailable"));
      mockLoadConfig.mockImplementation(() => {
        throw new Error("Config unavailable");
      });

      const result = await getCurrentSessionModel("agent:main:main");

      expect(result).toBeNull();
    });

    it("should handle malformed model strings gracefully", async () => {
      mockCallGateway.mockResolvedValue({
        session: {
          key: "agent:main:main",
          model: "invalid-model-format",
        },
      });

      const result = await getCurrentSessionModel("agent:main:main");

      // Should fallback to config default when parsing fails
      expect(result).toEqual({
        provider: "anthropic",
        model: "claude-sonnet-4-5",
      });
    });

    it("should use correct timeout for gateway calls", async () => {
      mockCallGateway.mockResolvedValue({
        session: {
          key: "agent:main:main",
          model: "anthropic/claude-opus-4-5",
        },
      });

      await getCurrentSessionModel("agent:main:main");

      expect(mockCallGateway).toHaveBeenCalledWith({
        method: "sessions.get",
        params: { key: "agent:main:main" },
        timeoutMs: 5_000,
      });
    });
  });

  describe("getCurrentSessionModelString", () => {
    it("should return formatted model string", async () => {
      mockCallGateway.mockResolvedValue({
        session: {
          key: "agent:main:main",
          model: "anthropic/claude-opus-4-5",
        },
      });

      const result = await getCurrentSessionModelString("agent:main:main");

      expect(result).toBe("anthropic/claude-opus-4-5");
    });

    it("should return null when model query fails", async () => {
      mockCallGateway.mockRejectedValue(new Error("Gateway unavailable"));
      mockLoadConfig.mockImplementation(() => {
        throw new Error("Config unavailable");
      });

      const result = await getCurrentSessionModelString("agent:main:main");

      expect(result).toBeNull();
    });
  });

  describe("isSessionActive", () => {
    it("should return true for active sessions", async () => {
      mockCallGateway.mockResolvedValue({
        session: {
          key: "agent:main:main",
          model: "anthropic/claude-opus-4-5",
        },
      });

      const result = await isSessionActive("agent:main:main");

      expect(result).toBe(true);
    });

    it("should return false when session not found", async () => {
      mockCallGateway.mockResolvedValue({ session: null });

      const result = await isSessionActive("agent:main:main");

      expect(result).toBe(false);
    });

    it("should return false when gateway call fails", async () => {
      mockCallGateway.mockRejectedValue(new Error("Gateway unavailable"));

      const result = await isSessionActive("agent:main:main");

      expect(result).toBe(false);
    });
  });

  describe("edge cases and error handling", () => {
    it("should handle empty session keys", async () => {
      const result = await getCurrentSessionModel("");
      expect(result).toEqual({
        provider: "anthropic",
        model: "claude-sonnet-4-5", // Fallback to default
      });
    });

    it("should handle undefined session responses", async () => {
      mockCallGateway.mockResolvedValue(undefined);

      const result = await getCurrentSessionModel("agent:main:main");
      expect(result).toEqual({
        provider: "anthropic",
        model: "claude-sonnet-4-5", // Fallback to default
      });
    });

    it("should handle sessions with partial data", async () => {
      mockCallGateway.mockResolvedValue({
        session: {
          key: "agent:main:main",
          // Missing model, providerOverride, modelOverride
        },
      });

      const result = await getCurrentSessionModel("agent:main:main");
      expect(result).toEqual({
        provider: "anthropic",
        model: "claude-sonnet-4-5", // Fallback to default
      });
    });

    it("should handle provider override without model override", async () => {
      mockCallGateway.mockResolvedValue({
        session: {
          key: "agent:main:main",
          providerOverride: "openai",
          // Missing modelOverride
        },
      });

      const result = await getCurrentSessionModel("agent:main:main");
      expect(result).toEqual({
        provider: "anthropic",
        model: "claude-sonnet-4-5", // Fallback to default
      });
    });

    it("should handle model override without provider override", async () => {
      mockCallGateway.mockResolvedValue({
        session: {
          key: "agent:main:main",
          modelOverride: "gpt-4o",
          // Missing providerOverride
        },
      });

      const result = await getCurrentSessionModel("agent:main:main");
      expect(result).toEqual({
        provider: "anthropic",
        model: "claude-sonnet-4-5", // Fallback to default
      });
    });
  });

  describe("performance and reliability", () => {
    it("should timeout gateway calls appropriately", async () => {
      // Mock a slow gateway response
      mockCallGateway.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve({ session: null }), 10000); // 10s delay
          }),
      );

      const startTime = Date.now();
      await getCurrentSessionModel("agent:main:main");
      const endTime = Date.now();

      // Should timeout before 10s due to 5s timeout setting
      expect(endTime - startTime).toBeLessThan(8000);
    });

    it("should handle concurrent session queries", async () => {
      mockCallGateway.mockResolvedValue({
        session: {
          key: "test-session",
          model: "anthropic/claude-opus-4-5",
        },
      });

      const promises = Array(10)
        .fill(0)
        .map((_, i) => getCurrentSessionModel(`agent:main:session-${i}`));

      const results = await Promise.all(promises);

      // All should succeed
      results.forEach((result) => {
        expect(result).toEqual({
          provider: "anthropic",
          model: "claude-opus-4-5",
        });
      });

      // Should have made 10 gateway calls
      expect(mockCallGateway).toHaveBeenCalledTimes(10);
    });
  });
});
