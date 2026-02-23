import { completeSimple } from "@mariozechner/pi-ai";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { OpenClawConfig } from "../../../config/config.js";
import type { MsgContext } from "../../templating.js";
import { getApiKeyForModel } from "../../../agents/model-auth.js";
import { resolveModel } from "../../../agents/pi-embedded-runner/model.js";
import { dynamicTieredStrategy } from "./dynamic-tiered.js";

vi.mock("@mariozechner/pi-ai", () => ({
  completeSimple: vi.fn(),
  getOAuthProviders: vi.fn().mockReturnValue([]),
}));

vi.mock("../../../agents/model-auth.js", () => ({
  getApiKeyForModel: vi.fn().mockResolvedValue({ apiKey: "test-key", mode: "api-key" }),
}));

vi.mock("../../../agents/pi-embedded-runner/model.js", () => ({
  resolveModel: vi.fn().mockReturnValue({
    model: {
      id: "claude-haiku-4-5",
      provider: "anthropic",
      api: "anthropic-messages",
    },
    error: undefined,
    authStorage: { setRuntimeApiKey: vi.fn() },
    modelRegistry: {},
  }),
}));

vi.mock("../../../agents/agent-paths.js", () => ({
  resolveOpenClawAgentDir: vi.fn().mockReturnValue("/mock/agent-dir"),
}));

vi.mock("../../../agents/models-config.js", () => ({
  ensureOpenClawModelsJson: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../agents/workspace.js", () => ({
  DEFAULT_AGENT_WORKSPACE_DIR: "/mock/workspace",
}));

vi.mock("../../../utils.js", () => ({
  resolveUserPath: vi.fn((p: string) => p),
}));

vi.mock("node:fs/promises", () => ({
  default: {
    readFile: vi.fn().mockRejectedValue(Object.assign(new Error("ENOENT"), { code: "ENOENT" })),
  },
}));

const mockCompleteSimple = vi.mocked(completeSimple);

const OPTIONS = {
  classifier: {
    model: "anthropic/claude-haiku-4-5",
    timeoutMs: 3000,
  },
  tiers: {
    fast: "anthropic/claude-haiku-4-5",
    standard: "anthropic/claude-sonnet-4-5",
    deep: "anthropic/claude-opus-4-6",
  },
  fallback: "standard",
};

function makeMsgCtx(body: string): MsgContext {
  return { Body: body, CommandBody: body, RawBody: body };
}

function mockClassifierResponse(text: string) {
  mockCompleteSimple.mockResolvedValueOnce({
    role: "assistant",
    content: [{ type: "text", text }],
    stopReason: "stop",
  } as never);
}

describe("dynamic-tiered strategy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("has the correct name", () => {
    expect(dynamicTieredStrategy.name).toBe("dynamic-tiered");
  });

  it("routes FAST messages to the fast tier", async () => {
    mockClassifierResponse("FAST");

    const result = await dynamicTieredStrategy.route({
      ctx: makeMsgCtx("Good morning"),
      config: {} as OpenClawConfig,
      options: OPTIONS,
      primaryProvider: "anthropic",
      primaryModel: "claude-sonnet-4-5",
    });

    expect(result.tier).toBe("fast");
    expect(result.provider).toBe("anthropic");
    expect(result.model).toBe("claude-haiku-4-5");
    expect(result.reason).toBe("classifier");
  });

  it("routes STANDARD messages to the standard tier", async () => {
    mockClassifierResponse("STANDARD");

    const result = await dynamicTieredStrategy.route({
      ctx: makeMsgCtx("How should I structure my API?"),
      config: {} as OpenClawConfig,
      options: OPTIONS,
      primaryProvider: "anthropic",
      primaryModel: "claude-sonnet-4-5",
    });

    expect(result.tier).toBe("standard");
    expect(result.model).toBe("claude-sonnet-4-5");
    expect(result.reason).toBe("classifier");
  });

  it("routes DEEP messages to the deep tier", async () => {
    mockClassifierResponse("DEEP");

    const result = await dynamicTieredStrategy.route({
      ctx: makeMsgCtx("Analyze the architectural tradeoffs"),
      config: {} as OpenClawConfig,
      options: OPTIONS,
      primaryProvider: "anthropic",
      primaryModel: "claude-sonnet-4-5",
    });

    expect(result.tier).toBe("deep");
    expect(result.model).toBe("claude-opus-4-6");
    expect(result.reason).toBe("classifier");
  });

  it("handles classifier returning text with extra whitespace", async () => {
    mockClassifierResponse("FAST\n");

    const result = await dynamicTieredStrategy.route({
      ctx: makeMsgCtx("Hi"),
      config: {} as OpenClawConfig,
      options: OPTIONS,
      primaryProvider: "anthropic",
      primaryModel: "claude-sonnet-4-5",
    });

    expect(result.tier).toBe("fast");
    expect(result.reason).toBe("classifier");
  });

  it("falls back on unparseable response", async () => {
    mockClassifierResponse("I think this is a medium difficulty question");

    const result = await dynamicTieredStrategy.route({
      ctx: makeMsgCtx("test"),
      config: {} as OpenClawConfig,
      options: OPTIONS,
      primaryProvider: "anthropic",
      primaryModel: "claude-sonnet-4-5",
    });

    expect(result.tier).toBe("standard");
    expect(result.reason).toMatch(/^fallback:unparseable:/);
  });

  it("falls back on classifier error", async () => {
    mockCompleteSimple.mockRejectedValueOnce(new Error("API error"));

    const result = await dynamicTieredStrategy.route({
      ctx: makeMsgCtx("test"),
      config: {} as OpenClawConfig,
      options: OPTIONS,
      primaryProvider: "anthropic",
      primaryModel: "claude-sonnet-4-5",
    });

    expect(result.tier).toBe("standard");
    expect(result.reason).toMatch(/^fallback:error:/);
  });

  it("falls back on timeout", async () => {
    mockCompleteSimple.mockRejectedValueOnce(new Error("AbortError: signal timed out"));

    const result = await dynamicTieredStrategy.route({
      ctx: makeMsgCtx("test"),
      config: {} as OpenClawConfig,
      options: OPTIONS,
      primaryProvider: "anthropic",
      primaryModel: "claude-sonnet-4-5",
    });

    expect(result.tier).toBe("standard");
    expect(result.reason).toBe("fallback:timeout");
  });

  it("falls back on model resolution error", async () => {
    vi.mocked(resolveModel).mockReturnValueOnce({
      model: undefined,
      error: "model not found",
      authStorage: {} as never,
      modelRegistry: {} as never,
    });

    const result = await dynamicTieredStrategy.route({
      ctx: makeMsgCtx("test"),
      config: {} as OpenClawConfig,
      options: OPTIONS,
      primaryProvider: "anthropic",
      primaryModel: "claude-sonnet-4-5",
    });

    expect(result.tier).toBe("standard");
    expect(result.reason).toMatch(/^fallback:error:resolve-error:/);
  });

  it("uses configured fallback tier", async () => {
    mockCompleteSimple.mockRejectedValueOnce(new Error("fail"));

    const result = await dynamicTieredStrategy.route({
      ctx: makeMsgCtx("test"),
      config: {} as OpenClawConfig,
      options: { ...OPTIONS, fallback: "fast" },
      primaryProvider: "anthropic",
      primaryModel: "claude-sonnet-4-5",
    });

    expect(result.tier).toBe("fast");
    expect(result.model).toBe("claude-haiku-4-5");
  });

  it("returns primary model on invalid options", async () => {
    const result = await dynamicTieredStrategy.route({
      ctx: makeMsgCtx("test"),
      config: {} as OpenClawConfig,
      options: {},
      primaryProvider: "anthropic",
      primaryModel: "claude-sonnet-4-5",
    });

    expect(result.provider).toBe("anthropic");
    expect(result.model).toBe("claude-sonnet-4-5");
    expect(result.reason).toBe("fallback:invalid-options");
  });

  it("falls back on empty message", async () => {
    const result = await dynamicTieredStrategy.route({
      ctx: makeMsgCtx(""),
      config: {} as OpenClawConfig,
      options: OPTIONS,
      primaryProvider: "anthropic",
      primaryModel: "claude-sonnet-4-5",
    });

    expect(result.tier).toBe("standard");
    expect(result.reason).toBe("fallback:empty-message");
  });

  it("includes latencyMs in result", async () => {
    mockClassifierResponse("FAST");

    const result = await dynamicTieredStrategy.route({
      ctx: makeMsgCtx("hi"),
      config: {} as OpenClawConfig,
      options: OPTIONS,
      primaryProvider: "anthropic",
      primaryModel: "claude-sonnet-4-5",
    });

    expect(typeof result.latencyMs).toBe("number");
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("parses 'TIER: reason' format and populates detail", async () => {
    mockClassifierResponse("FAST: simple greeting");

    const result = await dynamicTieredStrategy.route({
      ctx: makeMsgCtx("Hello!"),
      config: {} as OpenClawConfig,
      options: OPTIONS,
      primaryProvider: "anthropic",
      primaryModel: "claude-sonnet-4-5",
    });

    expect(result.tier).toBe("fast");
    expect(result.reason).toBe("classifier");
    expect(result.detail).toBe("simple greeting");
  });

  it("parses 'TIER - reason' format with dash separator", async () => {
    mockClassifierResponse("DEEP - complex architectural analysis");

    const result = await dynamicTieredStrategy.route({
      ctx: makeMsgCtx("Explain the tradeoffs of microservices vs monolith"),
      config: {} as OpenClawConfig,
      options: OPTIONS,
      primaryProvider: "anthropic",
      primaryModel: "claude-sonnet-4-5",
    });

    expect(result.tier).toBe("deep");
    expect(result.reason).toBe("classifier");
    expect(result.detail).toBe("complex architectural analysis");
  });

  it("bare tier name still works with no detail (backwards compat)", async () => {
    mockClassifierResponse("STANDARD");

    const result = await dynamicTieredStrategy.route({
      ctx: makeMsgCtx("What time is it?"),
      config: {} as OpenClawConfig,
      options: OPTIONS,
      primaryProvider: "anthropic",
      primaryModel: "claude-sonnet-4-5",
    });

    expect(result.tier).toBe("standard");
    expect(result.reason).toBe("classifier");
    expect(result.detail).toBeUndefined();
  });

  it("uses custom promptFile when configured", async () => {
    const fsPromises = await import("node:fs/promises");
    const mockReadFile = vi.mocked(fsPromises.default.readFile);
    mockReadFile.mockImplementation(async (filePath: unknown) => {
      if (String(filePath) === "/custom/ROUTER.md") {
        return "Custom prompt\n{{HEURISTICS}}\n{{MESSAGE}}";
      }
      throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    });

    mockClassifierResponse("FAST: test");

    const result = await dynamicTieredStrategy.route({
      ctx: makeMsgCtx("hi"),
      config: {} as OpenClawConfig,
      options: {
        ...OPTIONS,
        classifier: { ...OPTIONS.classifier, promptFile: "/custom/ROUTER.md" },
      },
      primaryProvider: "anthropic",
      primaryModel: "claude-sonnet-4-5",
    });

    expect(result.tier).toBe("fast");
    expect(mockReadFile).toHaveBeenCalledWith("/custom/ROUTER.md", "utf-8");
  });

  it("uses custom heuristicsFile when configured", async () => {
    const fsPromises = await import("node:fs/promises");
    const mockReadFile = vi.mocked(fsPromises.default.readFile);
    mockReadFile.mockImplementation(async (filePath: unknown) => {
      if (String(filePath) === "/custom/HEURISTICS.md") {
        return "FAST — Everything.\nSTANDARD — Nothing.\nDEEP — Never.";
      }
      throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    });

    mockClassifierResponse("FAST: custom heuristics");

    const result = await dynamicTieredStrategy.route({
      ctx: makeMsgCtx("hi"),
      config: {} as OpenClawConfig,
      options: {
        ...OPTIONS,
        classifier: { ...OPTIONS.classifier, heuristicsFile: "/custom/HEURISTICS.md" },
      },
      primaryProvider: "anthropic",
      primaryModel: "claude-sonnet-4-5",
    });

    expect(result.tier).toBe("fast");
    expect(mockReadFile).toHaveBeenCalledWith("/custom/HEURISTICS.md", "utf-8");
  });

  it("falls back to built-in defaults when files are missing", async () => {
    mockClassifierResponse("STANDARD: general question");

    const result = await dynamicTieredStrategy.route({
      ctx: makeMsgCtx("How does this work?"),
      config: {} as OpenClawConfig,
      options: OPTIONS,
      primaryProvider: "anthropic",
      primaryModel: "claude-sonnet-4-5",
    });

    expect(result.tier).toBe("standard");
    expect(result.reason).toBe("classifier");
    expect(result.detail).toBe("general question");

    // Verify the prompt contains the default heuristics content
    const call = mockCompleteSimple.mock.calls[0];
    const messages = (call[1] as { messages: Array<{ content: string }> }).messages;
    expect(messages[0].content).toContain("FAST —");
    expect(messages[0].content).toContain("STANDARD —");
    expect(messages[0].content).toContain("DEEP —");
    expect(messages[0].content).toContain("Format: TIER: reason");
  });

  it("uses maxTokens of 30", async () => {
    mockClassifierResponse("FAST: greeting");

    await dynamicTieredStrategy.route({
      ctx: makeMsgCtx("hi"),
      config: {} as OpenClawConfig,
      options: OPTIONS,
      primaryProvider: "anthropic",
      primaryModel: "claude-sonnet-4-5",
    });

    const call = mockCompleteSimple.mock.calls[0];
    const opts = call[2] as { maxTokens: number };
    expect(opts.maxTokens).toBe(30);
  });

  it("works with aws-sdk auth mode (no apiKey)", async () => {
    vi.mocked(getApiKeyForModel).mockResolvedValueOnce({
      mode: "aws-sdk",
      source: "AWS_PROFILE",
    });
    mockClassifierResponse("FAST: greeting");

    const result = await dynamicTieredStrategy.route({
      ctx: makeMsgCtx("Hello"),
      config: {} as OpenClawConfig,
      options: OPTIONS,
      primaryProvider: "anthropic",
      primaryModel: "claude-sonnet-4-5",
    });

    expect(result.tier).toBe("fast");
    expect(result.reason).toBe("classifier");

    const call = mockCompleteSimple.mock.calls[0];
    const opts = call[2] as { apiKey: string };
    expect(opts.apiKey).toBe("");
  });

  describe("recent context", () => {
    it("includes recent context in classifier prompt when provided", async () => {
      mockClassifierResponse("DEEP: ongoing debugging");

      const recentContext = `Recent conversation:
User: I'm debugging the distributed cache inv...
Assistant [sonnet]: Let me look at the cache invalidation lo...
User: yes`;

      await dynamicTieredStrategy.route({
        ctx: makeMsgCtx("yes"),
        config: {} as OpenClawConfig,
        options: OPTIONS,
        primaryProvider: "anthropic",
        primaryModel: "claude-sonnet-4-5",
        recentContext,
      });

      const call = mockCompleteSimple.mock.calls[0];
      const messages = (call[1] as { messages: Array<{ content: string }> }).messages;
      expect(messages[0].content).toContain("Recent conversation:");
      expect(messages[0].content).toContain("Assistant [sonnet]:");
      expect(messages[0].content).not.toContain("{{CONTEXT}}");
    });

    it("omits context section when recentContext is not provided", async () => {
      mockClassifierResponse("FAST: greeting");

      await dynamicTieredStrategy.route({
        ctx: makeMsgCtx("hi"),
        config: {} as OpenClawConfig,
        options: OPTIONS,
        primaryProvider: "anthropic",
        primaryModel: "claude-sonnet-4-5",
      });

      const call = mockCompleteSimple.mock.calls[0];
      const messages = (call[1] as { messages: Array<{ content: string }> }).messages;
      expect(messages[0].content).not.toContain("{{CONTEXT}}");
      expect(messages[0].content).not.toContain("Recent conversation:");
    });

    it("includes context-awareness guidance in default heuristics", async () => {
      mockClassifierResponse("STANDARD: general question");

      await dynamicTieredStrategy.route({
        ctx: makeMsgCtx("How does this work?"),
        config: {} as OpenClawConfig,
        options: OPTIONS,
        primaryProvider: "anthropic",
        primaryModel: "claude-sonnet-4-5",
      });

      const call = mockCompleteSimple.mock.calls[0];
      const messages = (call[1] as { messages: Array<{ content: string }> }).messages;
      expect(messages[0].content).toContain(
        "When recent conversation context is provided, ALWAYS consider it",
      );
    });
  });

  describe("real-world routing scenarios", () => {
    // These tests verify the classifier prompt is assembled correctly for
    // realistic scenarios derived from actual user conversations. They check
    // that the heuristics and context give the classifier the right signals.

    function getClassifierPrompt(): string {
      const call = mockCompleteSimple.mock.calls[0];
      return (call[1] as { messages: Array<{ content: string }> }).messages[0].content;
    }

    describe("food diary logging (lunch conversation)", () => {
      const foodLoggingContext = `Recent conversation:
User: [sent a photo of chicken pesto salad]
Assistant [sonnet]: Yeah, got it! That looks delicious — chicken pesto salad from Wildsprout. Want me to log it to your FatSecret diary?`;

      it("'yes' confirming food logging routes to STANDARD with context", async () => {
        mockClassifierResponse("STANDARD: confirming food log action");

        const result = await dynamicTieredStrategy.route({
          ctx: makeMsgCtx("yes"),
          config: {} as OpenClawConfig,
          options: OPTIONS,
          primaryProvider: "anthropic",
          primaryModel: "claude-sonnet-4-5",
          recentContext: foodLoggingContext,
        });

        const prompt = getClassifierPrompt();
        // Prompt should contain the context showing food logging discussion
        expect(prompt).toContain("FatSecret diary");
        expect(prompt).toContain("Assistant [sonnet]:");
        // Heuristics should mention food/diary logging in DEEP tier
        expect(prompt).toContain("Food/diary logging");
        // Heuristics should say confirmations in ongoing tasks are STANDARD
        expect(prompt).toContain("Confirmations");
        // Should route to standard tier
        expect(result.tier).toBe("standard");
      });

      it("'yes' without context falls to FAST (no conversation signal)", async () => {
        mockClassifierResponse("FAST: simple confirmation");

        const result = await dynamicTieredStrategy.route({
          ctx: makeMsgCtx("yes"),
          config: {} as OpenClawConfig,
          options: OPTIONS,
          primaryProvider: "anthropic",
          primaryModel: "claude-sonnet-4-5",
        });

        const prompt = getClassifierPrompt();
        expect(prompt).not.toContain("Recent conversation:");
        expect(result.tier).toBe("fast");
      });

      it("'add everything including the avo' routes to STANDARD", async () => {
        mockClassifierResponse("STANDARD: multi-item food logging");

        const context = `Recent conversation:
User: [sent a photo of chicken pesto salad]
Assistant [sonnet]: Yeah, got it! That looks delicious — chicken pesto salad...
User: yes
Assistant [haiku]: Logged! Pesto Chicken (1 serving, 120g) — 248 kcal. That's just the chicken though. Want me to add the rest?`;

        const result = await dynamicTieredStrategy.route({
          ctx: makeMsgCtx(
            "yes, add everything, including the avo on top. Did you see it in the image?",
          ),
          config: {} as OpenClawConfig,
          options: OPTIONS,
          primaryProvider: "anthropic",
          primaryModel: "claude-sonnet-4-5",
          recentContext: context,
        });

        const prompt = getClassifierPrompt();
        expect(prompt).toContain("Food/diary logging");
        expect(prompt).toContain("248 kcal");
        expect(result.tier).toBe("standard");
      });
    });

    describe("follow-up web searches", () => {
      it("'Can you search their website?' routes to STANDARD with food context", async () => {
        mockClassifierResponse("STANDARD: web search follow-up");

        const context = `Recent conversation:
User: yes, add everything, including the avo on top
Assistant [sonnet]: Logged your full Wildsprout chicken pesto salad: 537 kcal
User: That sounds better. Does it match Wildsprout restaurant's menu?
Assistant [sonnet]: I don't have access to Wildsprout's actual menu or their published nutrition info.`;

        const result = await dynamicTieredStrategy.route({
          ctx: makeMsgCtx("Can you search their website?"),
          config: {} as OpenClawConfig,
          options: OPTIONS,
          primaryProvider: "anthropic",
          primaryModel: "claude-sonnet-4-5",
          recentContext: context,
        });

        const prompt = getClassifierPrompt();
        expect(prompt).toContain("web searches");
        expect(prompt).toContain("Wildsprout");
        expect(prompt).toContain("Assistant [sonnet]:");
        expect(result.tier).toBe("standard");
      });
    });

    describe("image analysis with action", () => {
      it("photo with 'log this to fatsecret' routes to DEEP", async () => {
        mockClassifierResponse("DEEP: image analysis with food logging");

        const result = await dynamicTieredStrategy.route({
          ctx: makeMsgCtx("[photo attached] log this to fatsecret"),
          config: {} as OpenClawConfig,
          options: OPTIONS,
          primaryProvider: "anthropic",
          primaryModel: "claude-sonnet-4-5",
        });

        const prompt = getClassifierPrompt();
        // Heuristics should mention images and food/diary logging
        expect(prompt).toContain("Messages with images or attachments");
        expect(prompt).toContain("Food/diary logging");
        expect(result.tier).toBe("deep");
      });
    });

    describe("simple messages stay FAST without misleading context", () => {
      it("'hi' in a new session routes to FAST", async () => {
        mockClassifierResponse("FAST: simple greeting");

        const result = await dynamicTieredStrategy.route({
          ctx: makeMsgCtx("hi"),
          config: {} as OpenClawConfig,
          options: OPTIONS,
          primaryProvider: "anthropic",
          primaryModel: "claude-sonnet-4-5",
        });

        expect(result.tier).toBe("fast");
      });

      it("'thanks' after a FAST conversation stays FAST", async () => {
        mockClassifierResponse("FAST: simple thanks");

        const context = `Recent conversation:
User: what time is it?
Assistant [haiku]: It's 2:30 PM.`;

        const result = await dynamicTieredStrategy.route({
          ctx: makeMsgCtx("thanks"),
          config: {} as OpenClawConfig,
          options: OPTIONS,
          primaryProvider: "anthropic",
          primaryModel: "claude-sonnet-4-5",
          recentContext: context,
        });

        const prompt = getClassifierPrompt();
        expect(prompt).toContain("Assistant [haiku]:");
        expect(result.tier).toBe("fast");
      });
    });

    describe("heuristics content validation", () => {
      it("distinguishes simple commands from multi-step skill execution", async () => {
        mockClassifierResponse("STANDARD: test");

        await dynamicTieredStrategy.route({
          ctx: makeMsgCtx("test"),
          config: {} as OpenClawConfig,
          options: OPTIONS,
          primaryProvider: "anthropic",
          primaryModel: "claude-sonnet-4-5",
        });

        const prompt = getClassifierPrompt();
        // FAST should be restricted to standalone greetings/thanks only
        expect(prompt).toContain("ONLY use for standalone greetings");
        // DEEP should mention multi-step skill execution
        expect(prompt).toContain(
          "skill execution that involves data entry or multi-step scripting",
        );
      });
    });
  });

  describe("file seeding", () => {
    it("seeds ROUTER.md when missing and using default path", async () => {
      const fsPromises = await import("node:fs/promises");
      const mockWriteFile = vi.mocked(fsPromises.default.writeFile ?? vi.fn());
      if (!fsPromises.default.writeFile) {
        fsPromises.default.writeFile = mockWriteFile;
      }
      mockWriteFile.mockResolvedValue(undefined as never);

      // readFile rejects (ENOENT) by default from the top-level mock
      mockClassifierResponse("FAST: greeting");

      await dynamicTieredStrategy.route({
        ctx: makeMsgCtx("hi"),
        config: {} as OpenClawConfig,
        options: OPTIONS,
        primaryProvider: "anthropic",
        primaryModel: "claude-sonnet-4-5",
      });

      // Allow fire-and-forget writes to settle
      await new Promise((r) => setTimeout(r, 10));

      expect(mockWriteFile).toHaveBeenCalledWith(
        "/mock/workspace/ROUTER.md",
        expect.stringContaining("{{HEURISTICS}}"),
        { encoding: "utf-8", flag: "wx" },
      );
    });

    it("seeds ROUTER-HEURISTICS.md when missing and using default path", async () => {
      const fsPromises = await import("node:fs/promises");
      const mockWriteFile = vi.mocked(fsPromises.default.writeFile ?? vi.fn());
      if (!fsPromises.default.writeFile) {
        fsPromises.default.writeFile = mockWriteFile;
      }
      mockWriteFile.mockResolvedValue(undefined as never);

      mockClassifierResponse("FAST: greeting");

      await dynamicTieredStrategy.route({
        ctx: makeMsgCtx("hi"),
        config: {} as OpenClawConfig,
        options: OPTIONS,
        primaryProvider: "anthropic",
        primaryModel: "claude-sonnet-4-5",
      });

      await new Promise((r) => setTimeout(r, 10));

      expect(mockWriteFile).toHaveBeenCalledWith(
        "/mock/workspace/ROUTER-HEURISTICS.md",
        expect.stringContaining("FAST —"),
        { encoding: "utf-8", flag: "wx" },
      );
    });

    it("does not seed when using custom promptFile/heuristicsFile", async () => {
      const fsPromises = await import("node:fs/promises");
      const mockReadFile = vi.mocked(fsPromises.default.readFile);
      const mockWriteFile = vi.mocked(fsPromises.default.writeFile ?? vi.fn());
      if (!fsPromises.default.writeFile) {
        fsPromises.default.writeFile = mockWriteFile;
      }
      mockWriteFile.mockResolvedValue(undefined as never);

      // Custom files exist
      mockReadFile.mockImplementation(async (filePath: unknown) => {
        if (String(filePath) === "/custom/ROUTER.md") {
          return "Custom prompt\n{{HEURISTICS}}\n{{MESSAGE}}";
        }
        if (String(filePath) === "/custom/HEURISTICS.md") {
          return "FAST — Everything.";
        }
        throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
      });

      mockClassifierResponse("FAST: test");

      await dynamicTieredStrategy.route({
        ctx: makeMsgCtx("hi"),
        config: {} as OpenClawConfig,
        options: {
          ...OPTIONS,
          classifier: {
            ...OPTIONS.classifier,
            promptFile: "/custom/ROUTER.md",
            heuristicsFile: "/custom/HEURISTICS.md",
          },
        },
        primaryProvider: "anthropic",
        primaryModel: "claude-sonnet-4-5",
      });

      await new Promise((r) => setTimeout(r, 10));

      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it("does not seed when files already exist", async () => {
      const fsPromises = await import("node:fs/promises");
      const mockReadFile = vi.mocked(fsPromises.default.readFile);
      const mockWriteFile = vi.mocked(fsPromises.default.writeFile ?? vi.fn());
      if (!fsPromises.default.writeFile) {
        fsPromises.default.writeFile = mockWriteFile;
      }
      mockWriteFile.mockResolvedValue(undefined as never);

      // Default files exist on disk
      mockReadFile.mockImplementation(async (filePath: unknown) => {
        if (String(filePath) === "/mock/workspace/ROUTER.md") {
          return "Existing prompt\n{{HEURISTICS}}\n{{MESSAGE}}";
        }
        if (String(filePath) === "/mock/workspace/ROUTER-HEURISTICS.md") {
          return "FAST — Custom rules.";
        }
        throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
      });

      mockClassifierResponse("FAST: test");

      await dynamicTieredStrategy.route({
        ctx: makeMsgCtx("hi"),
        config: {} as OpenClawConfig,
        options: OPTIONS,
        primaryProvider: "anthropic",
        primaryModel: "claude-sonnet-4-5",
      });

      await new Promise((r) => setTimeout(r, 10));

      expect(mockWriteFile).not.toHaveBeenCalled();
    });
  });
});
