import type { StreamFn } from "@mariozechner/pi-agent-core";
import type { Context, Model, SimpleStreamOptions } from "@mariozechner/pi-ai";
import { AssistantMessageEventStream } from "@mariozechner/pi-ai";
import { describe, expect, it } from "vitest";
import {
  appendAnthropicBeta,
  applyExtraParamsToAgent,
  resolveExtraParams,
} from "./pi-embedded-runner.js";

describe("resolveExtraParams", () => {
  it("returns undefined with no model config", () => {
    const result = resolveExtraParams({
      cfg: undefined,
      provider: "zai",
      modelId: "glm-4.7",
    });

    expect(result).toBeUndefined();
  });

  it("returns params for exact provider/model key", () => {
    const result = resolveExtraParams({
      cfg: {
        agents: {
          defaults: {
            models: {
              "openai/gpt-4": {
                params: {
                  temperature: 0.7,
                  maxTokens: 2048,
                },
              },
            },
          },
        },
      },
      provider: "openai",
      modelId: "gpt-4",
    });

    expect(result).toEqual({
      temperature: 0.7,
      maxTokens: 2048,
    });
  });

  it("ignores unrelated model entries", () => {
    const result = resolveExtraParams({
      cfg: {
        agents: {
          defaults: {
            models: {
              "openai/gpt-4": {
                params: {
                  temperature: 0.7,
                },
              },
            },
          },
        },
      },
      provider: "openai",
      modelId: "gpt-4.1-mini",
    });

    expect(result).toBeUndefined();
  });
});

describe("appendAnthropicBeta", () => {
  it("returns new beta when no existing header", () => {
    expect(appendAnthropicBeta(undefined, "fast-mode-2026-02-01")).toBe("fast-mode-2026-02-01");
  });

  it("appends new beta to existing header", () => {
    const result = appendAnthropicBeta(
      "interleaved-thinking-2025-05-14,fine-grained-tool-streaming-2025-05-14",
      "fast-mode-2026-02-01",
    );
    expect(result).toBe(
      "interleaved-thinking-2025-05-14,fine-grained-tool-streaming-2025-05-14,fast-mode-2026-02-01",
    );
  });

  it("does not duplicate an existing beta", () => {
    const result = appendAnthropicBeta(
      "interleaved-thinking-2025-05-14,fast-mode-2026-02-01",
      "fast-mode-2026-02-01",
    );
    expect(result).toBe("interleaved-thinking-2025-05-14,fast-mode-2026-02-01");
  });

  it("handles empty string as no existing header", () => {
    // Empty string is treated as "no betas exist", returns just the new one
    expect(appendAnthropicBeta("", "fast-mode-2026-02-01")).toBe("fast-mode-2026-02-01");
  });
});

describe("applyExtraParamsToAgent", () => {
  it("adds OpenRouter attribution headers to stream options", () => {
    const calls: Array<SimpleStreamOptions | undefined> = [];
    const baseStreamFn: StreamFn = (_model, _context, options) => {
      calls.push(options);
      return new AssistantMessageEventStream();
    };
    const agent = { streamFn: baseStreamFn };

    applyExtraParamsToAgent(agent, undefined, "openrouter", "openrouter/auto");

    const model = {
      api: "openai-completions",
      provider: "openrouter",
      id: "openrouter/auto",
    } as Model<"openai-completions">;
    const context: Context = { messages: [] };

    void agent.streamFn?.(model, context, { headers: { "X-Custom": "1" } });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.headers).toEqual({
      "HTTP-Referer": "https://openclaw.ai",
      "X-Title": "OpenClaw",
      "X-Custom": "1",
    });
  });

  it("passes speed:fast as onPayload body injection for anthropic", () => {
    const payloads: unknown[] = [];
    const calls: Array<SimpleStreamOptions | undefined> = [];
    const baseStreamFn: StreamFn = (_model, _context, options) => {
      calls.push(options);
      return new AssistantMessageEventStream();
    };
    const agent = { streamFn: baseStreamFn };

    applyExtraParamsToAgent(
      agent,
      {
        agents: {
          defaults: {
            models: {
              "anthropic/claude-opus-4-6": {
                params: { speed: "fast" },
              },
            },
          },
        },
      },
      "anthropic",
      "claude-opus-4-6",
    );

    const model = {
      api: "anthropic-messages",
      provider: "anthropic",
      id: "claude-opus-4-6",
    } as Model<"anthropic-messages">;
    const context: Context = { messages: [] };

    void agent.streamFn?.(model, context, {
      onPayload: (p: unknown) => payloads.push(p),
    });

    expect(calls).toHaveLength(1);

    // Simulate what pi-ai does: call onPayload with the request body
    const mockPayload: Record<string, unknown> = { model: "claude-opus-4-6" };
    calls[0]?.onPayload?.(mockPayload);

    // speed should be injected into the payload
    expect(mockPayload.speed).toBe("fast");

    // original onPayload should also be called
    expect(payloads).toHaveLength(1);
    expect(payloads[0]).toBe(mockPayload);
  });

  it("appends fast-mode beta header for anthropic speed:fast", () => {
    const calls: Array<SimpleStreamOptions | undefined> = [];
    const baseStreamFn: StreamFn = (_model, _context, options) => {
      calls.push(options);
      return new AssistantMessageEventStream();
    };
    const agent = { streamFn: baseStreamFn };

    applyExtraParamsToAgent(
      agent,
      {
        agents: {
          defaults: {
            models: {
              "anthropic/claude-opus-4-6": {
                params: { speed: "fast" },
              },
            },
          },
        },
      },
      "anthropic",
      "claude-opus-4-6",
    );

    const model = {
      api: "anthropic-messages",
      provider: "anthropic",
      id: "claude-opus-4-6",
      headers: {
        "anthropic-beta": "interleaved-thinking-2025-05-14,fine-grained-tool-streaming-2025-05-14",
      },
    } as unknown as Model<"anthropic-messages">;
    const context: Context = { messages: [] };

    void agent.streamFn?.(model, context);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.headers?.["anthropic-beta"]).toBe(
      "interleaved-thinking-2025-05-14,fine-grained-tool-streaming-2025-05-14,fast-mode-2026-02-01",
    );
  });

  it("ignores speed param for non-anthropic providers", () => {
    const calls: Array<SimpleStreamOptions | undefined> = [];
    const baseStreamFn: StreamFn = (_model, _context, options) => {
      calls.push(options);
      return new AssistantMessageEventStream();
    };
    const agent = { streamFn: baseStreamFn };

    applyExtraParamsToAgent(
      agent,
      {
        agents: {
          defaults: {
            models: {
              "openai/gpt-4": {
                params: { speed: "fast" },
              },
            },
          },
        },
      },
      "openai",
      "gpt-4",
    );

    // streamFn should not be wrapped since speed is only for anthropic
    // and there are no other valid params
    expect(agent.streamFn).toBe(baseStreamFn);
  });

  it("combines speed with other params like temperature", () => {
    const calls: Array<SimpleStreamOptions | undefined> = [];
    const baseStreamFn: StreamFn = (_model, _context, options) => {
      calls.push(options);
      return new AssistantMessageEventStream();
    };
    const agent = { streamFn: baseStreamFn };

    applyExtraParamsToAgent(
      agent,
      {
        agents: {
          defaults: {
            models: {
              "anthropic/claude-opus-4-6": {
                params: { speed: "fast", temperature: 0.5 },
              },
            },
          },
        },
      },
      "anthropic",
      "claude-opus-4-6",
    );

    const model = {
      api: "anthropic-messages",
      provider: "anthropic",
      id: "claude-opus-4-6",
    } as Model<"anthropic-messages">;
    const context: Context = { messages: [] };

    void agent.streamFn?.(model, context);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.temperature).toBe(0.5);
    expect(calls[0]?.headers?.["anthropic-beta"]).toContain("fast-mode-2026-02-01");
  });

  it("applies speed via extraParamsOverride", () => {
    const calls: Array<SimpleStreamOptions | undefined> = [];
    const baseStreamFn: StreamFn = (_model, _context, options) => {
      calls.push(options);
      return new AssistantMessageEventStream();
    };
    const agent = { streamFn: baseStreamFn };

    applyExtraParamsToAgent(agent, undefined, "anthropic", "claude-opus-4-6", {
      speed: "fast",
    });

    const model = {
      api: "anthropic-messages",
      provider: "anthropic",
      id: "claude-opus-4-6",
    } as Model<"anthropic-messages">;
    const context: Context = { messages: [] };

    void agent.streamFn?.(model, context);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.headers?.["anthropic-beta"]).toContain("fast-mode-2026-02-01");
  });
});
