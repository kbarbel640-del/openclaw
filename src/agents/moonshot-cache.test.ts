import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  clearAllCaches,
  extractSystemMessage,
  getOrCreateCache,
  injectCacheRole,
  isMoonshotCacheEnabled,
} from "./moonshot-cache.js";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("moonshot-cache", () => {
  beforeEach(() => {
    clearAllCaches();
    mockFetch.mockReset();
  });

  describe("extractSystemMessage", () => {
    it("extracts string content from system message", () => {
      const messages = [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Hello" },
      ];
      expect(extractSystemMessage(messages)).toBe("You are a helpful assistant.");
    });

    it("extracts array content from system message", () => {
      const messages = [
        {
          role: "system",
          content: [
            { type: "text", text: "Part 1" },
            { type: "text", text: "Part 2" },
          ],
        },
      ];
      expect(extractSystemMessage(messages)).toBe("Part 1\nPart 2");
    });

    it("returns undefined when no system message", () => {
      const messages = [{ role: "user", content: "Hello" }];
      expect(extractSystemMessage(messages)).toBeUndefined();
    });
  });

  describe("injectCacheRole", () => {
    it("replaces system message with cache role", () => {
      const messages = [
        { role: "system", content: "System prompt" },
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi!" },
      ];
      const result = injectCacheRole(messages, "cache-123", 3600);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        role: "cache",
        content: "cache_id=cache-123;reset_ttl=3600",
      });
      expect(result[1]).toEqual({ role: "user", content: "Hello" });
      expect(result[2]).toEqual({ role: "assistant", content: "Hi!" });
    });

    it("handles messages without system message", () => {
      const messages = [{ role: "user", content: "Hello" }];
      const result = injectCacheRole(messages, "cache-123", 1800);

      expect(result).toHaveLength(2);
      expect(result[0].role).toBe("cache");
      expect(result[1]).toEqual({ role: "user", content: "Hello" });
    });
  });

  describe("isMoonshotCacheEnabled", () => {
    it("returns true for moonshot provider with enabled config", () => {
      expect(isMoonshotCacheEnabled("moonshot", { enabled: true })).toBe(true);
    });

    it("returns false for non-moonshot provider", () => {
      expect(isMoonshotCacheEnabled("openai", { enabled: true })).toBe(false);
    });

    it("returns false when config is undefined", () => {
      expect(isMoonshotCacheEnabled("moonshot", undefined)).toBe(false);
    });

    it("returns false when enabled is false", () => {
      expect(isMoonshotCacheEnabled("moonshot", { enabled: false })).toBe(false);
    });
  });

  describe("getOrCreateCache", () => {
    it("creates a new cache on first call", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "cache-abc123", tokens: 100 }),
      });

      const cacheId = await getOrCreateCache({
        sessionKey: "session-1",
        apiKey: "sk-test",
        baseUrl: "https://api.moonshot.ai/v1",
        model: "moonshot-v1-32k",
        system: "You are helpful.",
        tools: [],
        ttl: 3600,
      });

      expect(cacheId).toBe("cache-abc123");
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.moonshot.ai/v1/caching",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer sk-test",
          }),
        }),
      );
    });

    it("returns cached id on subsequent calls with same content", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "cache-abc123", tokens: 100 }),
      });

      const params = {
        sessionKey: "session-2",
        apiKey: "sk-test",
        baseUrl: "https://api.moonshot.ai/v1",
        model: "moonshot-v1-32k",
        system: "You are helpful.",
        tools: [],
        ttl: 3600,
      };

      const cacheId1 = await getOrCreateCache(params);
      const cacheId2 = await getOrCreateCache(params);

      expect(cacheId1).toBe("cache-abc123");
      expect(cacheId2).toBe("cache-abc123");
      // Should only call API once
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("creates new cache when system content changes", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: "cache-first", tokens: 100 }),
        })
        .mockResolvedValueOnce({ ok: true }) // DELETE call
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: "cache-second", tokens: 150 }),
        });

      const baseParams = {
        sessionKey: "session-3",
        apiKey: "sk-test",
        baseUrl: "https://api.moonshot.ai/v1",
        model: "moonshot-v1-32k",
        tools: [],
        ttl: 3600,
      };

      const cacheId1 = await getOrCreateCache({
        ...baseParams,
        system: "Version 1",
      });

      const cacheId2 = await getOrCreateCache({
        ...baseParams,
        system: "Version 2",
      });

      expect(cacheId1).toBe("cache-first");
      expect(cacheId2).toBe("cache-second");
    });

    it("coalesces concurrent requests", async () => {
      let resolvePromise: (value: unknown) => void;
      const slowPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      mockFetch.mockImplementationOnce(async () => {
        await slowPromise;
        return {
          ok: true,
          json: async () => ({ id: "cache-concurrent", tokens: 100 }),
        };
      });

      const params = {
        sessionKey: "session-4",
        apiKey: "sk-test",
        baseUrl: "https://api.moonshot.ai/v1",
        model: "moonshot-v1-32k",
        system: "Concurrent test",
        tools: [],
        ttl: 3600,
      };

      // Start two concurrent requests
      const promise1 = getOrCreateCache(params);
      const promise2 = getOrCreateCache(params);

      // Resolve the slow promise
      resolvePromise!(undefined);

      const [cacheId1, cacheId2] = await Promise.all([promise1, promise2]);

      expect(cacheId1).toBe("cache-concurrent");
      expect(cacheId2).toBe("cache-concurrent");
      // Should only call API once due to coalescing
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("throws on API error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => "Unauthorized",
      });

      await expect(
        getOrCreateCache({
          sessionKey: "session-5",
          apiKey: "invalid-key",
          baseUrl: "https://api.moonshot.ai/v1",
          model: "moonshot-v1-32k",
          system: "Test",
          tools: [],
          ttl: 3600,
        }),
      ).rejects.toThrow("Moonshot cache creation failed (401)");
    });
  });
});
