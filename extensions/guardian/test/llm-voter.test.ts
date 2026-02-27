import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { initLlm, singleVote, multiVote, readRecentContext } from "../src/llm-voter.js";

// ── Mock fetch globally ────────────────────────────────────────────

const originalFetch = globalThis.fetch;

function mockFetchResponse(confirmed: boolean, reason: string) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      content: [{ text: JSON.stringify({ confirmed, reason }) }],
    }),
  });
}

function mockFetchError(status = 500) {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: async () => ({}),
  });
}

function mockFetchTimeout() {
  return vi.fn().mockImplementation(
    () => new Promise((_, reject) => setTimeout(() => reject(new Error("aborted")), 50)),
  );
}

// ── Mock config for initLlm ────────────────────────────────────────

const mockConfig = {
  models: {
    providers: {
      anthropic: {
        baseUrl: "https://api.anthropic.com",
        apiKey: "test-key",
        api: "anthropic-messages",
        models: [
          { id: "claude-haiku-4-5-20251001", name: "Claude Haiku" },
          { id: "claude-3-opus", name: "Claude Opus" },
        ],
      },
    },
  },
};

const mockConfigOpenAI = {
  models: {
    providers: {
      openai: {
        baseUrl: "https://api.openai.com",
        apiKey: "test-key-openai",
        api: "openai-completions",
        models: [{ id: "gpt-4o-mini", name: "GPT-4o Mini" }],
      },
    },
  },
};

const mockConfigEmpty = {
  models: {
    providers: {},
  },
};

const mockConfigNoProviders = {};

// ── Tests ──────────────────────────────────────────────────────────

describe("initLlm", () => {
  it("initializes with preferred model (Haiku)", () => {
    // Should not throw
    expect(() => initLlm(mockConfig)).not.toThrow();
  });

  it("handles empty providers gracefully", () => {
    expect(() => initLlm(mockConfigEmpty)).not.toThrow();
  });

  it("handles missing providers key gracefully", () => {
    expect(() => initLlm(mockConfigNoProviders)).not.toThrow();
  });

  it("handles null config gracefully", () => {
    expect(() => initLlm(null as any)).not.toThrow();
  });
});

describe("singleVote", () => {
  beforeEach(() => {
    initLlm(mockConfig);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns confirmed=true when LLM confirms", async () => {
    globalThis.fetch = mockFetchResponse(true, "User asked for this") as any;
    const result = await singleVote("exec", { command: "rm -rf /tmp/old" });
    expect(result.confirmed).toBe(true);
    expect(result.reason).toContain("User asked for this");
  });

  it("returns confirmed=false when LLM denies", async () => {
    globalThis.fetch = mockFetchResponse(false, "No user intent found") as any;
    const result = await singleVote("exec", { command: "rm -rf /tmp/old" });
    expect(result.confirmed).toBe(false);
    expect(result.reason).toContain("No user intent found");
  });

  it("returns confirmed=false when LLM is unavailable (fail-safe)", async () => {
    globalThis.fetch = mockFetchError(500) as any;
    const result = await singleVote("exec", { command: "rm -rf /tmp/old" });
    expect(result.confirmed).toBe(false);
    expect(result.reason).toContain("LLM");
  });

  it("returns confirmed=false on timeout (fail-safe)", async () => {
    globalThis.fetch = mockFetchTimeout() as any;
    const result = await singleVote("exec", { command: "rm -rf /tmp/old" });
    expect(result.confirmed).toBe(false);
  });
});

describe("multiVote", () => {
  beforeEach(() => {
    initLlm(mockConfig);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns confirmed=true when all 3 votes confirm (3/3)", async () => {
    globalThis.fetch = mockFetchResponse(true, "User confirmed") as any;
    const result = await multiVote("exec", { command: "rm -rf /" }, undefined, 3, 3);
    expect(result.confirmed).toBe(true);
    expect(result.votes).toHaveLength(3);
    expect(result.votes.every((v) => v.confirmed)).toBe(true);
  });

  it("returns confirmed=false when not all votes confirm (2/3)", async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      callCount++;
      const confirmed = callCount <= 2; // first 2 confirm, 3rd denies
      return {
        ok: true,
        json: async () => ({
          content: [{ text: JSON.stringify({ confirmed, reason: confirmed ? "yes" : "no" }) }],
        }),
      };
    }) as any;

    const result = await multiVote("exec", { command: "rm -rf /" }, undefined, 3, 3);
    expect(result.confirmed).toBe(false);
    expect(result.votes).toHaveLength(3);
    expect(result.reason).toContain("2/3");
  });

  it("returns confirmed=false when all votes fail (LLM down, fail-safe)", async () => {
    globalThis.fetch = mockFetchError(503) as any;
    const result = await multiVote("exec", { command: "rm -rf /" }, undefined, 3, 3);
    expect(result.confirmed).toBe(false);
    expect(result.votes).toHaveLength(3);
    expect(result.votes.every((v) => !v.confirmed)).toBe(true);
  });

  it("runs votes concurrently (all 3 calls made in parallel)", async () => {
    const callTimes: number[] = [];
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      callTimes.push(Date.now());
      await new Promise((r) => setTimeout(r, 50));
      return {
        ok: true,
        json: async () => ({
          content: [{ text: JSON.stringify({ confirmed: true, reason: "ok" }) }],
        }),
      };
    }) as any;

    const start = Date.now();
    await multiVote("exec", { command: "test" }, undefined, 3, 3);
    const elapsed = Date.now() - start;

    // If sequential, would take ~150ms. Parallel should be ~50-80ms.
    expect(callTimes).toHaveLength(3);
    // All calls should start within 20ms of each other (parallel)
    const spread = Math.max(...callTimes) - Math.min(...callTimes);
    expect(spread).toBeLessThan(30);
  });

  it("handles mixed success/failure votes gracefully", async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 2) throw new Error("network error");
      return {
        ok: true,
        json: async () => ({
          content: [{ text: JSON.stringify({ confirmed: true, reason: "ok" }) }],
        }),
      };
    }) as any;

    const result = await multiVote("exec", { command: "test" }, undefined, 3, 3);
    // 2 confirmed + 1 error = 2/3, not enough for threshold 3
    expect(result.confirmed).toBe(false);
    expect(result.votes).toHaveLength(3);
  });
});

describe("readRecentContext", () => {
  it("returns a string (even if no session files exist)", () => {
    const ctx = readRecentContext();
    expect(typeof ctx).toBe("string");
    expect(ctx.length).toBeGreaterThan(0);
  });

  it("handles undefined sessionKey", () => {
    expect(() => readRecentContext(undefined)).not.toThrow();
  });

  it("handles empty string sessionKey", () => {
    expect(() => readRecentContext("")).not.toThrow();
  });
});

// ── Concurrent tool call simulation ────────────────────────────────

describe("concurrent tool calls", () => {
  beforeEach(() => {
    initLlm(mockConfig);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("handles multiple concurrent singleVote calls", async () => {
    globalThis.fetch = mockFetchResponse(true, "confirmed") as any;

    const results = await Promise.all([
      singleVote("exec", { command: "sudo apt update" }),
      singleVote("exec", { command: "chmod 777 /tmp/x" }),
      singleVote("write", { path: "/etc/nginx.conf" }),
    ]);

    expect(results).toHaveLength(3);
    results.forEach((r) => {
      expect(r.confirmed).toBe(true);
    });
  });

  it("handles concurrent multiVote + singleVote", async () => {
    globalThis.fetch = mockFetchResponse(false, "denied") as any;

    const [multi, single] = await Promise.all([
      multiVote("exec", { command: "rm -rf /" }, undefined, 3, 3),
      singleVote("exec", { command: "sudo rm file" }),
    ]);

    expect(multi.confirmed).toBe(false);
    expect(single.confirmed).toBe(false);
  });
});
