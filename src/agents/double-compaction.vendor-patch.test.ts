import { describe, expect, it, vi } from "vitest";

const compactionModulePath = new URL(
  "../../node_modules/@mariozechner/pi-coding-agent/dist/core/compaction/compaction.js",
  import.meta.url,
);
const agentSessionModulePath = new URL(
  "../../node_modules/@mariozechner/pi-coding-agent/dist/core/agent-session.js",
  import.meta.url,
);

function makeEntry(id: string, type: string, extra: Record<string, unknown> = {}) {
  return { id, type, timestamp: Date.now(), ...extra };
}

describe("pi-coding-agent vendor patch", () => {
  it("prepareCompaction ignores trailing custom entries", async () => {
    const { prepareCompaction } = await import(compactionModulePath.href);
    const pathEntries = [
      makeEntry("m1", "message", { message: { role: "user", content: "hi", timestamp: 1 } }),
      makeEntry("c1", "compaction", { summary: "ok", tokensBefore: 100, timestamp: 2 }),
      makeEntry("x1", "custom", { customType: "openclaw.cache-ttl", data: { timestamp: 3 } }),
    ];

    const result = prepareCompaction(pathEntries, { keepRecentTokens: 1000 });
    expect(result).toBeUndefined();
  });

  it("skips threshold compaction when last assistant predates latest compaction", async () => {
    const { AgentSession } = await import(agentSessionModulePath.href);

    const branchEntries = [
      makeEntry("m1", "message", {
        message: {
          role: "assistant",
          usage: { totalTokens: 120_000, input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          stopReason: "stop",
          provider: "test",
          model: "test",
          timestamp: 1,
        },
      }),
      makeEntry("c1", "compaction", { summary: "ok", tokensBefore: 120_000, timestamp: 2 }),
      makeEntry("x1", "custom", { customType: "openclaw.cache-ttl", data: { timestamp: 3 } }),
    ];

    const agentState = {
      model: { provider: "test", id: "test", contextWindow: 50_000 },
      messages: [],
      isStreaming: false,
      tools: [],
      systemPrompt: "",
      thinkingLevel: "medium",
    };

    const agent = {
      state: agentState,
      subscribe: () => () => {},
      setTools: () => {},
      setSystemPrompt: () => {},
      getSteeringMode: () => "off",
      getFollowUpMode: () => "off",
    };

    const sessionManager = {
      getBranch: () => branchEntries,
      getSessionFile: () => undefined,
      appendCustomMessageEntry: () => {},
      appendMessage: () => {},
    };

    const settingsManager = {
      getCompactionSettings: () => ({ enabled: true, reserveTokens: 0, keepRecentTokens: 0 }),
    };

    const modelRegistry = {
      getApiKey: async () => "key",
      isUsingOAuth: () => false,
    };

    const session = new AgentSession({
      agent,
      sessionManager,
      settingsManager,
      modelRegistry,
    });

    const runAutoCompaction = vi
      .spyOn(session as any, "_runAutoCompaction")
      .mockResolvedValue(undefined);

    await (session as any)._checkCompaction(branchEntries[0]?.message, false);

    expect(runAutoCompaction).not.toHaveBeenCalled();
    session.dispose();
  });
});
