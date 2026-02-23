import type { StreamFn } from "@mariozechner/pi-agent-core";
import type { Context, Model, SimpleStreamOptions } from "@mariozechner/pi-ai";
import { describe, expect, it, vi } from "vitest";
import { applyExtraParamsToAgent } from "./extra-params.js";

vi.mock("@mariozechner/pi-ai", () => ({
  streamSimple: vi.fn(() => ({
    push: vi.fn(),
    result: vi.fn(),
  })),
}));

type ReasoningCase = {
  applyProvider: string;
  applyModelId: string;
  model: Model<"openai-completions">;
  thinkingLevel?: "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
  initialPayload?: Record<string, unknown>;
  options?: SimpleStreamOptions;
};

function runReasoningCase(params: ReasoningCase) {
  const payload: Record<string, unknown> = {
    model: params.model.id,
    messages: [],
    ...params.initialPayload,
  };
  const baseStreamFn: StreamFn = (_model, _context, options) => {
    options?.onPayload?.(payload);
    return {} as ReturnType<StreamFn>;
  };
  const agent = { streamFn: baseStreamFn };

  applyExtraParamsToAgent(
    agent,
    undefined,
    params.applyProvider,
    params.applyModelId,
    undefined,
    params.thinkingLevel,
  );

  const context: Context = { messages: [] };
  void agent.streamFn?.(params.model, context, params.options ?? {});

  return payload;
}

describe("extra-params: OpenRouter reasoning parameter handling", () => {
  it("injects reasoning.effort for OpenRouter with thinkingLevel", () => {
    const payload = runReasoningCase({
      applyProvider: "openrouter",
      applyModelId: "minimax/minimax-m2.5",
      model: {
        api: "openai-completions",
        provider: "openrouter",
        id: "minimax/minimax-m2.5",
      } as Model<"openai-completions">,
      thinkingLevel: "medium",
    });

    expect(payload.reasoning).toEqual({ effort: "medium" });
  });

  it("removes conflicting reasoning_effort when reasoning is set", () => {
    const payload = runReasoningCase({
      applyProvider: "openrouter",
      applyModelId: "minimax/minimax-m2.5",
      model: {
        api: "openai-completions",
        provider: "openrouter",
        id: "minimax/minimax-m2.5",
      } as Model<"openai-completions">,
      thinkingLevel: "low",
      initialPayload: {
        reasoning_effort: "low",
      },
    });

    expect(payload.reasoning).toEqual({ effort: "low" });
    expect(payload).not.toHaveProperty("reasoning_effort");
  });

  it("maps thinkingLevel off to reasoning.effort none", () => {
    const payload = runReasoningCase({
      applyProvider: "openrouter",
      applyModelId: "minimax/minimax-m2.5",
      model: {
        api: "openai-completions",
        provider: "openrouter",
        id: "minimax/minimax-m2.5",
      } as Model<"openai-completions">,
      thinkingLevel: "off",
    });

    expect(payload.reasoning).toEqual({ effort: "none" });
  });

  it("does not inject reasoning without thinkingLevel", () => {
    const payload = runReasoningCase({
      applyProvider: "openrouter",
      applyModelId: "minimax/minimax-m2.5",
      model: {
        api: "openai-completions",
        provider: "openrouter",
        id: "minimax/minimax-m2.5",
      } as Model<"openai-completions">,
    });

    expect(payload).not.toHaveProperty("reasoning");
  });

  it("preserves existing reasoning.max_tokens without injecting effort", () => {
    const payload = runReasoningCase({
      applyProvider: "openrouter",
      applyModelId: "minimax/minimax-m2.5",
      model: {
        api: "openai-completions",
        provider: "openrouter",
        id: "minimax/minimax-m2.5",
      } as Model<"openai-completions">,
      thinkingLevel: "high",
      initialPayload: {
        reasoning: { max_tokens: 4096 },
      },
    });

    expect(payload.reasoning).toEqual({ max_tokens: 4096 });
    expect((payload.reasoning as Record<string, unknown>).effort).toBeUndefined();
  });
});
