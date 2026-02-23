import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock resolveModel before importing the module under test.
const mockResolveModel = vi.fn();
vi.mock("../pi-embedded-runner/model.js", () => ({
  resolveModel: (...args: unknown[]) => mockResolveModel(...args),
}));

// Mock getContextHooksRuntime.
const mockContextHooksRuntime: {
  modelId: string;
  provider: string;
  contextWindowTokens: number;
  pendingModelOverride?: string;
  pendingProviderOverride?: string;
} = {
  modelId: "",
  provider: "",
  contextWindowTokens: 200000,
};
vi.mock("../pi-extensions/context-hooks/runtime.js", () => ({
  getContextHooksRuntime: () => mockContextHooksRuntime,
}));

import type { Api, Model } from "@mariozechner/pi-ai";
import { installDynamicModelRouter } from "./index.js";

function makeModel(id: string, provider = "anthropic", contextWindow = 200000): Model<Api> {
  return {
    id,
    name: id,
    provider,
    api: "anthropic",
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow,
    maxTokens: contextWindow,
  } as Model<Api>;
}

const cheapModel = makeModel("claude-haiku-4-5");
const midModel = makeModel("claude-sonnet-4-6");
const complexModel = makeModel("claude-opus-4-6");

function makeSession() {
  const calls: Array<{ model: Model<Api>; messages: unknown[] }> = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const originalStreamFn: any = vi.fn((model: Model<Api>, context: { messages: unknown[] }) => {
    calls.push({ model, messages: context.messages });
    return "stream-result";
  });
  return {
    activeSession: { agent: { streamFn: originalStreamFn } },
    sessionManager: {},
    calls,
    originalStreamFn,
  };
}

describe("installDynamicModelRouter", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    mockResolveModel.mockReset();
    mockContextHooksRuntime.modelId = "";
    mockContextHooksRuntime.provider = "";
    mockContextHooksRuntime.contextWindowTokens = 200000;
    mockContextHooksRuntime.pendingModelOverride = undefined;
    mockContextHooksRuntime.pendingProviderOverride = undefined;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns installed: false when OC_ROUTER_ENABLED is not set", async () => {
    const { activeSession, sessionManager } = makeSession();
    const result = await installDynamicModelRouter({
      activeSession,
      sessionManager,
      provider: "anthropic",
      modelId: "claude-sonnet-4-6",
    });
    expect(result.installed).toBe(false);
    expect(result.tiers).toBeUndefined();
  });

  it("returns installed: false when all tiers resolve to the same model", async () => {
    process.env.OC_ROUTER_ENABLED = "true";
    // All tiers resolve to the same model.
    mockResolveModel.mockReturnValue({ model: midModel });

    const { activeSession, sessionManager } = makeSession();
    const result = await installDynamicModelRouter({
      activeSession,
      sessionManager,
      provider: "anthropic",
      modelId: "claude-sonnet-4-6",
    });
    expect(result.installed).toBe(false);
  });

  it("installs wrapper when enabled with distinct tiers", async () => {
    process.env.OC_ROUTER_ENABLED = "true";
    mockResolveModel.mockImplementation((_provider: string, modelId: string) => {
      if (modelId === "claude-haiku-4-5") {
        return { model: cheapModel };
      }
      if (modelId === "claude-sonnet-4-6") {
        return { model: midModel };
      }
      if (modelId === "claude-opus-4-6") {
        return { model: complexModel };
      }
      return { model: midModel };
    });

    const { activeSession, sessionManager } = makeSession();
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const result = await installDynamicModelRouter({
      activeSession,
      sessionManager,
      provider: "anthropic",
      modelId: "claude-sonnet-4-6",
    });
    consoleSpy.mockRestore();

    expect(result.installed).toBe(true);
    expect(result.tiers).toBeDefined();
    expect(result.tiers!.cheap.id).toBe("claude-haiku-4-5");
    expect(result.tiers!.mid.id).toBe("claude-sonnet-4-6");
    expect(result.tiers!.complex.id).toBe("claude-opus-4-6");
  });

  describe("routing decisions", () => {
    let wrappedStreamFn: (...args: unknown[]) => unknown;

    beforeEach(async () => {
      process.env.OC_ROUTER_ENABLED = "true";
      mockResolveModel.mockImplementation((_provider: string, modelId: string) => {
        if (modelId === "claude-haiku-4-5") {
          return { model: cheapModel };
        }
        if (modelId === "claude-sonnet-4-6") {
          return { model: midModel };
        }
        if (modelId === "claude-opus-4-6") {
          return { model: complexModel };
        }
        return { model: midModel };
      });

      const { activeSession, sessionManager } = makeSession();
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      await installDynamicModelRouter({
        activeSession,
        sessionManager,
        provider: "anthropic",
        modelId: "claude-sonnet-4-6",
      });
      consoleSpy.mockRestore();
      wrappedStreamFn = activeSession.agent.streamFn;
    });

    it("routes tool continuations to cheap model", () => {
      const messages = [
        { role: "user", content: "hello" },
        { role: "toolResult", content: '{"ok": true}' },
      ];
      wrappedStreamFn(midModel, { messages });
      // The first arg to the underlying streamFn should be the cheap model.
      expect(mockContextHooksRuntime.modelId).toBe("claude-haiku-4-5");
    });

    it("routes complex messages to complex model", () => {
      const messages = [
        {
          role: "user",
          content:
            "First analyze the code then compute complexity:\n```ts\nfunction foo() {}\n```\nStep 1: review.",
        },
      ];
      wrappedStreamFn(midModel, { messages });
      expect(mockContextHooksRuntime.modelId).toBe("claude-opus-4-6");
    });

    it("routes simple messages to cheap model", () => {
      const messages = [{ role: "user", content: "What time is it?" }];
      wrappedStreamFn(midModel, { messages });
      expect(mockContextHooksRuntime.modelId).toBe("claude-haiku-4-5");
    });

    it("routes moderate messages to mid model", () => {
      const messages = [{ role: "user", content: "Calculate the sum of these values." }];
      // MATH_KEYWORDS → score 2 → moderate
      wrappedStreamFn(midModel, { messages });
      expect(mockContextHooksRuntime.modelId).toBe("claude-sonnet-4-6");
    });

    it("keeps complex tool continuation on complex model", () => {
      const messages = [
        {
          role: "user",
          content:
            "First analyze then compute:\n```ts\nclass Foo { }\n```\nDerive the formula step 1.",
        },
        { role: "toolResult", content: '{"data": "result"}' },
      ];
      wrappedStreamFn(midModel, { messages });
      // Tool continuation + complex → stays on complex
      expect(mockContextHooksRuntime.modelId).toBe("claude-opus-4-6");
    });

    it("updates contextHooksRuntime on each call", () => {
      const messages = [{ role: "user", content: "hello" }];
      wrappedStreamFn(midModel, { messages });
      expect(mockContextHooksRuntime.modelId).toBe("claude-haiku-4-5");
      expect(mockContextHooksRuntime.provider).toBe("anthropic");

      const messages2 = [
        {
          role: "user",
          content: "Compute and solve:\n```js\nimport x from 'y';\n```\nStep 2: derive.",
        },
      ];
      wrappedStreamFn(midModel, { messages: messages2 });
      expect(mockContextHooksRuntime.modelId).toBe("claude-opus-4-6");
    });
  });

  it("context window safety: falls back to mid for large contexts", async () => {
    process.env.OC_ROUTER_ENABLED = "true";
    const smallWindowCheap = makeModel("claude-haiku-4-5", "anthropic", 8000);
    mockResolveModel.mockImplementation((_provider: string, modelId: string) => {
      if (modelId === "claude-haiku-4-5") {
        return { model: smallWindowCheap };
      }
      if (modelId === "claude-sonnet-4-6") {
        return { model: midModel };
      }
      if (modelId === "claude-opus-4-6") {
        return { model: complexModel };
      }
      return { model: midModel };
    });

    const { activeSession, sessionManager } = makeSession();
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await installDynamicModelRouter({
      activeSession,
      sessionManager,
      provider: "anthropic",
      modelId: "claude-sonnet-4-6",
    });
    consoleSpy.mockRestore();

    // Create a message that would route to cheap but is too large for the cheap model's window.
    const largeContent = "x".repeat(30000); // ~7500 tokens, > 8000 * 0.85 = 6800
    const messages = [{ role: "user", content: largeContent }];
    activeSession.agent.streamFn(midModel, { messages });
    // Should fall back to mid because cheap window is too small.
    expect(mockContextHooksRuntime.modelId).toBe("claude-sonnet-4-6");
  });

  describe("plugin per-call override", () => {
    let session: ReturnType<typeof makeSession>;

    beforeEach(async () => {
      process.env.OC_ROUTER_ENABLED = "true";
      mockResolveModel.mockImplementation((_provider: string, modelId: string) => {
        if (modelId === "claude-haiku-4-5") {
          return { model: cheapModel };
        }
        if (modelId === "claude-sonnet-4-6") {
          return { model: midModel };
        }
        if (modelId === "claude-opus-4-6") {
          return { model: complexModel };
        }
        return { model: midModel };
      });

      session = makeSession();
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      await installDynamicModelRouter({
        activeSession: session.activeSession,
        sessionManager: session.sessionManager,
        provider: "anthropic",
        modelId: "claude-sonnet-4-6",
      });
      consoleSpy.mockRestore();
    });

    it("plugin override takes precedence over complexity routing", () => {
      // Set a pending override on the runtime.
      mockContextHooksRuntime.pendingModelOverride = "claude-opus-4-6";
      mockContextHooksRuntime.pendingProviderOverride = "anthropic";

      // Simple message that would normally route to cheap tier.
      const messages = [{ role: "user", content: "hello" }];
      session.activeSession.agent.streamFn(midModel, { messages });

      // Should use the plugin override, not the cheap model.
      expect(mockContextHooksRuntime.modelId).toBe("claude-opus-4-6");
    });

    it("pending override cleared after consumption", () => {
      mockContextHooksRuntime.pendingModelOverride = "claude-opus-4-6";
      mockContextHooksRuntime.pendingProviderOverride = "anthropic";

      const messages = [{ role: "user", content: "hello" }];
      session.activeSession.agent.streamFn(midModel, { messages });

      expect(mockContextHooksRuntime.pendingModelOverride).toBeUndefined();
      expect(mockContextHooksRuntime.pendingProviderOverride).toBeUndefined();
    });

    it("falls through to complexity routing when no pending override", () => {
      // No pending override set.
      const messages = [{ role: "user", content: "hello" }];
      session.activeSession.agent.streamFn(midModel, { messages });

      // Simple message → cheap model via complexity routing.
      expect(mockContextHooksRuntime.modelId).toBe("claude-haiku-4-5");
    });

    it("invalid model override falls through gracefully", () => {
      mockResolveModel.mockImplementation((_provider: string, modelId: string) => {
        if (modelId === "nonexistent-model") {
          return { error: "not found" };
        }
        if (modelId === "claude-haiku-4-5") {
          return { model: cheapModel };
        }
        if (modelId === "claude-sonnet-4-6") {
          return { model: midModel };
        }
        if (modelId === "claude-opus-4-6") {
          return { model: complexModel };
        }
        return { model: midModel };
      });

      mockContextHooksRuntime.pendingModelOverride = "nonexistent-model";
      mockContextHooksRuntime.pendingProviderOverride = "anthropic";

      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const messages = [{ role: "user", content: "hello" }];
      session.activeSession.agent.streamFn(midModel, { messages });
      warnSpy.mockRestore();

      // Should fall through to complexity routing (simple → cheap).
      expect(mockContextHooksRuntime.modelId).toBe("claude-haiku-4-5");
      // Override should still be cleared.
      expect(mockContextHooksRuntime.pendingModelOverride).toBeUndefined();
    });
  });

  it("falls back to session model when a tier fails to resolve", async () => {
    process.env.OC_ROUTER_ENABLED = "true";
    mockResolveModel.mockImplementation((_provider: string, modelId: string) => {
      if (modelId === "claude-haiku-4-5") {
        return { error: "not found" };
      }
      if (modelId === "claude-sonnet-4-6") {
        return { model: midModel };
      }
      if (modelId === "claude-opus-4-6") {
        return { model: complexModel };
      }
      return { model: midModel };
    });

    const { activeSession, sessionManager } = makeSession();
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const result = await installDynamicModelRouter({
      activeSession,
      sessionManager,
      provider: "anthropic",
      modelId: "claude-sonnet-4-6",
    });
    consoleSpy.mockRestore();

    expect(result.installed).toBe(true);
    // cheap tier should have fallen back to session model (mid).
    expect(result.tiers!.cheap.id).toBe("claude-sonnet-4-6");
  });
});
