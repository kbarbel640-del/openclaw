import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  clearAllCaches,
  createMoonshotCacheWrapper,
  getOrCreateCache,
  injectCacheRole,
  isMoonshotCacheEnabled,
  needsExplicitCacheApi,
} from "./moonshot-cache.js";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("moonshot-cache", () => {
  beforeEach(() => {
    clearAllCaches();
    mockFetch.mockReset();
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

  describe("needsExplicitCacheApi", () => {
    it("returns true for moonshot-v1-* (requires explicit cache API)", () => {
      expect(needsExplicitCacheApi("moonshot-v1-8k")).toBe(true);
      expect(needsExplicitCacheApi("moonshot-v1-32k")).toBe(true);
      expect(needsExplicitCacheApi("moonshot-v1-128k")).toBe(true);
      expect(needsExplicitCacheApi("moonshot-v1-auto")).toBe(true);
      expect(needsExplicitCacheApi("moonshot-v1-128k-vision-preview")).toBe(true);
    });

    it("returns false for kimi-k2 models (uses automatic prefix caching)", () => {
      expect(needsExplicitCacheApi("kimi-k2-0711-preview")).toBe(false);
      expect(needsExplicitCacheApi("kimi-k2-0905-preview")).toBe(false);
      expect(needsExplicitCacheApi("kimi-k2-thinking")).toBe(false);
      expect(needsExplicitCacheApi("kimi-k2-thinking-turbo")).toBe(false);
      expect(needsExplicitCacheApi("kimi-k2-turbo-preview")).toBe(false);
      expect(needsExplicitCacheApi("kimi-k2.5")).toBe(false);
      expect(needsExplicitCacheApi("kimi-latest")).toBe(false);
    });

    it("strips provider prefix from model id", () => {
      expect(needsExplicitCacheApi("moonshot/moonshot-v1-32k")).toBe(true);
      expect(needsExplicitCacheApi("moonshotai/kimi-k2-turbo-preview")).toBe(false);
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

  describe("createMoonshotCacheWrapper integration", () => {
    it("injects cache role when sessionKey is provided", async () => {
      // Mock successful cache creation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "cache-integration-test", tokens: 50 }),
      });

      // Track what the underlying streamFn receives
      let receivedContext: unknown;
      const mockStreamFn = vi.fn().mockImplementation((_model, context, _options) => {
        receivedContext = context;
        return Promise.resolve({ async *[Symbol.asyncIterator]() {} });
      });

      // Create wrapper with sessionKey
      const wrapper = createMoonshotCacheWrapper(
        mockStreamFn,
        { enabled: true, ttl: 3600 },
        "moonshot-v1-32k",
        "test-session-key", // sessionKey passed via closure
      );

      // Call the wrapper
      // Cast to satisfy StreamFn types - only provider/baseUrl and messages are used
      const model = { provider: "moonshot", baseUrl: "https://api.moonshot.cn/v1" } as Parameters<
        typeof wrapper
      >[0];
      const context = {
        messages: [
          { role: "system", content: "You are helpful." },
          { role: "user", content: "Hello" },
        ],
      } as unknown as Parameters<typeof wrapper>[1];
      const options = { apiKey: "sk-test" };

      await wrapper(model, context, options);

      // Verify cache was created
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.moonshot.cn/v1/caching",
        expect.objectContaining({ method: "POST" }),
      );

      // Verify the context was modified with cache role
      expect(receivedContext).toBeDefined();
      const modifiedMessages = (receivedContext as { messages: unknown[] }).messages;
      expect(modifiedMessages[0]).toEqual({
        role: "cache",
        content: "cache_id=cache-integration-test;reset_ttl=3600",
      });
      // System message should be removed, user message preserved
      expect(modifiedMessages[1]).toEqual({ role: "user", content: "Hello" });
      expect(modifiedMessages).toHaveLength(2);
    });

    it("skips caching when apiKey is missing", async () => {
      const mockStreamFn = vi
        .fn()
        .mockReturnValue(Promise.resolve({ async *[Symbol.asyncIterator]() {} }));

      const wrapper = createMoonshotCacheWrapper(
        mockStreamFn,
        { enabled: true },
        "moonshot-v1-32k",
        "test-session",
      );

      const model = { provider: "moonshot" } as Parameters<typeof wrapper>[0];
      const context = {
        messages: [{ role: "system", content: "System" }],
      } as unknown as Parameters<typeof wrapper>[1];

      // No apiKey provided
      await wrapper(model, context, {});

      // Should not call cache API
      expect(mockFetch).not.toHaveBeenCalled();
      // Should still call underlying streamFn
      expect(mockStreamFn).toHaveBeenCalled();
    });

    it("falls back gracefully on cache creation error", async () => {
      // Mock cache creation failure
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => "Internal Server Error",
      });

      let receivedContext: unknown;
      const mockStreamFn = vi.fn().mockImplementation((_model, context, _options) => {
        receivedContext = context;
        return Promise.resolve({ async *[Symbol.asyncIterator]() {} });
      });

      const wrapper = createMoonshotCacheWrapper(
        mockStreamFn,
        { enabled: true },
        "moonshot-v1-32k",
        "test-session",
      );

      const context = {
        messages: [
          { role: "system", content: "System" },
          { role: "user", content: "Hello" },
        ],
      } as unknown as Parameters<typeof wrapper>[1];

      // Should not throw
      await wrapper({ provider: "moonshot" } as Parameters<typeof wrapper>[0], context, {
        apiKey: "sk-test",
      });

      // Should call underlying streamFn with original context (no cache injection)
      expect(mockStreamFn).toHaveBeenCalled();
      const messages = (receivedContext as { messages: unknown[] }).messages;
      // Original messages preserved on error
      expect(messages[0]).toEqual({ role: "system", content: "System" });
    });
  });
});
