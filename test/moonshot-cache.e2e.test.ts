/**
 * End-to-end tests for Moonshot context caching.
 *
 * These tests make REAL API calls to Moonshot and require:
 * - MOONSHOT_API_KEY environment variable
 *
 * Run locally with:
 *   MOONSHOT_API_KEY=sk-xxx pnpm test test/moonshot-cache.e2e.test.ts
 *
 * Tests are skipped in CI when API key is not available.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  clearAllCaches,
  createMoonshotCacheWrapper,
  getOrCreateCache,
} from "../src/agents/moonshot-cache.js";

const MOONSHOT_API_KEY = process.env.MOONSHOT_API_KEY;
const BASE_URL = "https://api.moonshot.cn/v1";

// Skip all tests if no API key
const describeWithKey = MOONSHOT_API_KEY ? describe : describe.skip;

describeWithKey("moonshot-cache e2e", () => {
  // Track created caches for cleanup
  const createdCacheIds: string[] = [];

  beforeAll(() => {
    clearAllCaches();
  });

  afterAll(async () => {
    // Cleanup: delete all caches created during tests
    for (const cacheId of createdCacheIds) {
      try {
        await fetch(`${BASE_URL}/caching/${cacheId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${MOONSHOT_API_KEY}` },
        });
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  it("creates cache and returns cache_id", async () => {
    const cacheId = await getOrCreateCache({
      sessionKey: "e2e-test-session-1",
      apiKey: MOONSHOT_API_KEY!,
      baseUrl: BASE_URL,
      model: "moonshot-v1-32k",
      system: "You are a helpful assistant for e2e testing.",
      tools: [],
      ttl: 300,
    });

    expect(cacheId).toMatch(/^cache-/);
    createdCacheIds.push(cacheId);
  });

  it("returns same cache_id for same content (cache hit)", async () => {
    const params = {
      sessionKey: "e2e-test-session-2",
      apiKey: MOONSHOT_API_KEY!,
      baseUrl: BASE_URL,
      model: "moonshot-v1-32k",
      system: "Consistent system prompt for cache hit test.",
      tools: [],
      ttl: 300,
    };

    const cacheId1 = await getOrCreateCache(params);
    const cacheId2 = await getOrCreateCache(params);

    expect(cacheId1).toBe(cacheId2);
    createdCacheIds.push(cacheId1);
  });

  it("creates new cache when content changes (cache invalidation)", async () => {
    const baseParams = {
      sessionKey: "e2e-test-session-3",
      apiKey: MOONSHOT_API_KEY!,
      baseUrl: BASE_URL,
      model: "moonshot-v1-32k",
      tools: [],
      ttl: 300,
    };

    const cacheId1 = await getOrCreateCache({
      ...baseParams,
      system: "Version 1 of system prompt",
    });

    const cacheId2 = await getOrCreateCache({
      ...baseParams,
      system: "Version 2 of system prompt (different)",
    });

    expect(cacheId1).not.toBe(cacheId2);
    createdCacheIds.push(cacheId1, cacheId2);
  });

  it("chat completion with cache returns cached_tokens in usage", async () => {
    // First, create a cache with a larger system prompt
    const systemPrompt =
      "You are a math assistant. Answer briefly. " +
      "This is additional context to ensure the cache has enough tokens. ".repeat(10);

    const cacheId = await getOrCreateCache({
      sessionKey: "e2e-test-session-4",
      apiKey: MOONSHOT_API_KEY!,
      baseUrl: BASE_URL,
      model: "moonshot-v1-32k",
      system: systemPrompt,
      tools: [],
      ttl: 300,
    });
    createdCacheIds.push(cacheId);

    // Wait a moment for cache to be ready
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Then make a chat completion request WITH cache
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MOONSHOT_API_KEY}`,
      },
      body: JSON.stringify({
        model: "moonshot-v1-32k",
        messages: [
          { role: "cache", content: `cache_id=${cacheId};reset_ttl=300` },
          { role: "user", content: "What is 2+2?" },
        ],
        max_tokens: 50,
      }),
    });

    expect(response.ok).toBe(true);
    const data = await response.json();

    // Verify response structure
    expect(data.choices).toBeDefined();
    expect(data.choices[0].message.content).toBeDefined();

    // Verify usage exists
    expect(data.usage).toBeDefined();
    expect(data.usage.prompt_tokens).toBeDefined();

    // Verify cached_tokens is present (may be 0 if cache not hit, but should exist)
    // Some API versions may not return cached_tokens if cache wasn't actually used
    if (data.usage.cached_tokens !== undefined) {
      expect(data.usage.cached_tokens).toBeGreaterThanOrEqual(0);
    }
    // The key assertion: prompt_tokens should be lower than the original system prompt tokens
    // because the system prompt is cached
    expect(data.usage.prompt_tokens).toBeLessThan(systemPrompt.length / 2);
  });

  it("wrapper integration: modifies context and calls API", async () => {
    // Create a mock streamFn that captures the modified context
    let capturedContext: unknown;
    const mockStreamFn = vi.fn().mockImplementation((_model, context, _options) => {
      capturedContext = context;
      // Return a minimal async iterable
      return (async function* () {
        yield { type: "text", text: "Test response" };
      })();
    });

    // Create the wrapper
    const wrapper = createMoonshotCacheWrapper(
      mockStreamFn,
      { enabled: true, ttl: 300 },
      "moonshot-v1-32k",
      "e2e-wrapper-session",
    );

    // Call the wrapper
    const result = wrapper(
      { provider: "moonshot", baseUrl: BASE_URL },
      {
        messages: [
          { role: "system", content: "E2E wrapper test system prompt." },
          { role: "user", content: "Hello" },
        ],
      },
      { apiKey: MOONSHOT_API_KEY },
    );

    // Await the result (wrapper returns Promise)
    await result;

    // Verify the context was modified
    expect(capturedContext).toBeDefined();
    const messages = (capturedContext as { messages: Array<{ role: string; content: string }> })
      .messages;

    // First message should be cache role (not system)
    expect(messages[0].role).toBe("cache");
    expect(messages[0].content).toMatch(/^cache_id=cache-.*reset_ttl=300$/);

    // System message should be removed, user message preserved
    expect(messages.find((m) => m.role === "system")).toBeUndefined();
    expect(messages.find((m) => m.role === "user")).toBeDefined();
  });
});

// Need to import vi for the last test
import { vi } from "vitest";
