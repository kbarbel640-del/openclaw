import type { PromptRequest } from "@agentclientprotocol/sdk";
import { describe, expect, it, vi } from "vitest";
import type { GatewayClient } from "../gateway/client.js";
import type { EventFrame } from "../gateway/protocol/index.js";
import { createInMemorySessionStore } from "./session.js";
import { AcpGatewayAgent } from "./translator.js";
import { createAcpConnection, createAcpGateway } from "./translator.test-helpers.js";

/**
 * Build a chat event frame that the gateway would emit during streaming.
 */
function chatEvent(
  sessionKey: string,
  state: string,
  fullText?: string,
  runId?: string,
): EventFrame {
  const payload: Record<string, unknown> = { sessionKey, state };
  if (runId) {
    payload.runId = runId;
  }
  if (fullText !== undefined) {
    payload.message = {
      content: [{ type: "text", text: fullText }],
    };
  }
  return { type: "event", event: "chat", payload };
}

/**
 * Set up an AcpGatewayAgent with a session ready for prompting.
 * The gateway mock captures the idempotency key (runId) from chat.send
 * so tests can build matching event frames.
 */
async function setupPromptSession() {
  const connection = createAcpConnection();
  const sessionStore = createInMemorySessionStore();

  let capturedRunId: string | undefined;

  const request = vi.fn(async (method: string, params: Record<string, unknown>) => {
    if (method === "chat.send") {
      capturedRunId = params.idempotencyKey as string;
      // Don't resolve — the prompt is driven to completion via handleGatewayEvent
      return {};
    }
    return {};
  }) as unknown as GatewayClient["request"];

  const agent = new AcpGatewayAgent(connection, createAcpGateway(request), {
    sessionStore,
    prefixCwd: false,
  });

  const sessionId = "test-session";
  sessionStore.createSession({
    sessionId,
    sessionKey: "agent:main:test",
    cwd: "/tmp",
  });

  return {
    agent,
    connection,
    sessionStore,
    sessionId,
    sessionKey: "agent:main:test",
    getRunId: () => capturedRunId,
  };
}

describe("acp streaming: final event flushes remaining delta text", () => {
  it("emits trailing tokens when final event carries text beyond last delta", async () => {
    const { agent, connection, sessionId, sessionKey } = await setupPromptSession();

    // Start the prompt (this calls chat.send via gateway mock)
    const promptPromise = agent.prompt({
      sessionId,
      prompt: [{ type: "text", text: "hello" }],
      _meta: {},
    } as unknown as PromptRequest);

    // Simulate streaming: two delta events with cumulative text
    await agent.handleGatewayEvent(chatEvent(sessionKey, "delta", "Hello world"));
    await agent.handleGatewayEvent(chatEvent(sessionKey, "delta", "Hello world, how are you"));

    // Final event carries the COMPLETE text including trailing tokens
    // that weren't in any prior delta
    await agent.handleGatewayEvent(
      chatEvent(sessionKey, "final", "Hello world, how are you today?"),
    );

    const result = await promptPromise;
    expect(result.stopReason).toBe("end_turn");

    // Verify all chunks were emitted
    const updateCalls = (connection.sessionUpdate as ReturnType<typeof vi.fn>).mock.calls;
    const messageChunks = updateCalls
      .filter(
        (call: unknown[]) =>
          (call[0] as Record<string, unknown>)?.update &&
          ((call[0] as Record<string, unknown>).update as Record<string, unknown>)
            ?.sessionUpdate === "agent_message_chunk",
      )
      .map(
        (call: unknown[]) =>
          (
            ((call[0] as Record<string, unknown>).update as Record<string, unknown>)
              ?.content as Record<string, string>
          )?.text,
      );

    // Delta 1: "Hello world" (0→11)
    // Delta 2: ", how are you" (11→24)
    // Final flush: " today?" (24→31)
    expect(messageChunks).toEqual(["Hello world", ", how are you", " today?"]);
  });

  it("does not emit extra chunk when final text matches last delta", async () => {
    const { agent, connection, sessionId, sessionKey } = await setupPromptSession();

    const promptPromise = agent.prompt({
      sessionId,
      prompt: [{ type: "text", text: "hello" }],
      _meta: {},
    } as unknown as PromptRequest);

    await agent.handleGatewayEvent(chatEvent(sessionKey, "delta", "Complete response."));
    await agent.handleGatewayEvent(chatEvent(sessionKey, "final", "Complete response."));

    const result = await promptPromise;
    expect(result.stopReason).toBe("end_turn");

    const updateCalls = (connection.sessionUpdate as ReturnType<typeof vi.fn>).mock.calls;
    const messageChunks = updateCalls
      .filter(
        (call: unknown[]) =>
          (call[0] as Record<string, unknown>)?.update &&
          ((call[0] as Record<string, unknown>).update as Record<string, unknown>)
            ?.sessionUpdate === "agent_message_chunk",
      )
      .map(
        (call: unknown[]) =>
          (
            ((call[0] as Record<string, unknown>).update as Record<string, unknown>)
              ?.content as Record<string, string>
          )?.text,
      );

    // Only one chunk — no duplicate from final flush
    expect(messageChunks).toEqual(["Complete response."]);
  });

  it("handles final event without message data gracefully", async () => {
    const { agent, connection, sessionId, sessionKey } = await setupPromptSession();

    const promptPromise = agent.prompt({
      sessionId,
      prompt: [{ type: "text", text: "hello" }],
      _meta: {},
    } as unknown as PromptRequest);

    await agent.handleGatewayEvent(chatEvent(sessionKey, "delta", "Some text."));
    // Final event with no message payload (messageData is undefined)
    await agent.handleGatewayEvent(chatEvent(sessionKey, "final"));

    const result = await promptPromise;
    expect(result.stopReason).toBe("end_turn");

    const updateCalls = (connection.sessionUpdate as ReturnType<typeof vi.fn>).mock.calls;
    const messageChunks = updateCalls
      .filter(
        (call: unknown[]) =>
          (call[0] as Record<string, unknown>)?.update &&
          ((call[0] as Record<string, unknown>).update as Record<string, unknown>)
            ?.sessionUpdate === "agent_message_chunk",
      )
      .map(
        (call: unknown[]) =>
          (
            ((call[0] as Record<string, unknown>).update as Record<string, unknown>)
              ?.content as Record<string, string>
          )?.text,
      );

    // Only the delta chunk — no crash from missing final message
    expect(messageChunks).toEqual(["Some text."]);
  });
});
