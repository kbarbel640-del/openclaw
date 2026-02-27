import type { StreamFn } from "@mariozechner/pi-agent-core";
import type { Context, Model } from "@mariozechner/pi-ai";
import { createAssistantMessageEventStream } from "@mariozechner/pi-ai";
import { describe, expect, it } from "vitest";
import { applyExtraParamsToAgent } from "./extra-params.js";

type ResponsesPayload = {
  model: string;
  input: Array<Record<string, unknown>>;
  previous_response_id?: string;
  store?: boolean;
};

function runResponsesPayload(payload: ResponsesPayload) {
  const baseStreamFn: StreamFn = (_model, _context, options) => {
    options?.onPayload?.(payload);
    return createAssistantMessageEventStream();
  };
  const agent = { streamFn: baseStreamFn };

  applyExtraParamsToAgent(agent, undefined, "openai", "gpt-oss");

  const model = {
    api: "openai-responses",
    provider: "openai",
    id: "gpt-oss",
    baseUrl: "http://127.0.0.1:3001/v1",
  } as Model<"openai-responses">;
  const context: Context = { messages: [] };

  void agent.streamFn?.(model, context, {});
}

describe("extra-params: OpenAI Responses tool chain guard", () => {
  it("keeps valid tool call/output chains intact", () => {
    const payload: ResponsesPayload = {
      model: "gpt-oss",
      previous_response_id: "resp_prev_1",
      input: [
        { type: "function_call", call_id: "call_a", id: "fc_a", name: "tool_a", arguments: "{}" },
        { type: "function_call", call_id: "call_b", id: "fc_b", name: "tool_b", arguments: "{}" },
        { type: "function_call_output", call_id: "call_b", output: "ok-b" },
        { type: "function_call_output", call_id: "call_a", output: "ok-a" },
      ],
    };

    runResponsesPayload(payload);

    expect(payload.input).toHaveLength(4);
    expect(payload.previous_response_id).toBe("resp_prev_1");
  });

  it("drops function_call_output when no matching prior function_call exists", () => {
    const payload: ResponsesPayload = {
      model: "gpt-oss",
      previous_response_id: "resp_prev_2",
      input: [
        { type: "message", role: "user", content: [{ type: "input_text", text: "hi" }] },
        { type: "function_call_output", call_id: "call_missing", output: "bad" },
      ],
    };

    runResponsesPayload(payload);

    expect(payload.input).toEqual([
      { type: "message", role: "user", content: [{ type: "input_text", text: "hi" }] },
    ]);
    expect(payload.previous_response_id).toBeUndefined();
  });

  it("drops outputs for duplicate function_call ids (cross-turn reuse)", () => {
    const payload: ResponsesPayload = {
      model: "gpt-oss",
      previous_response_id: "resp_prev_3",
      input: [
        {
          type: "function_call",
          call_id: "call_reused",
          id: "fc_1",
          name: "tool",
          arguments: "{}",
        },
        { type: "message", role: "user", content: [{ type: "input_text", text: "next turn" }] },
        {
          type: "function_call",
          call_id: "call_reused",
          id: "fc_2",
          name: "tool",
          arguments: "{}",
        },
        { type: "function_call_output", call_id: "call_reused", output: "bad-reuse" },
      ],
    };

    runResponsesPayload(payload);

    expect(payload.input).toEqual([
      { type: "function_call", call_id: "call_reused", id: "fc_1", name: "tool", arguments: "{}" },
      { type: "message", role: "user", content: [{ type: "input_text", text: "next turn" }] },
      { type: "function_call", call_id: "call_reused", id: "fc_2", name: "tool", arguments: "{}" },
    ]);
    expect(payload.previous_response_id).toBeUndefined();
  });

  it("keeps parallel multi-tool outputs when each call_id matches once", () => {
    const payload: ResponsesPayload = {
      model: "gpt-oss",
      input: [
        { type: "function_call", call_id: "call_1", id: "fc_1", name: "a", arguments: "{}" },
        { type: "function_call", call_id: "call_2", id: "fc_2", name: "b", arguments: "{}" },
        { type: "function_call_output", call_id: "call_2", output: "b ok" },
        { type: "function_call_output", call_id: "call_1", output: "a ok" },
      ],
    };

    runResponsesPayload(payload);

    expect(payload.input).toHaveLength(4);
    expect(payload.input[2]?.call_id).toBe("call_2");
    expect(payload.input[3]?.call_id).toBe("call_1");
  });
});
