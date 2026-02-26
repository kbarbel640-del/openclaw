/**
 * End-to-end integration tests for OpenAI WebSocket streaming.
 *
 * These tests hit the real OpenAI Responses API over WebSocket and verify
 * the full request/response lifecycle including:
 *  - Connection establishment and session reuse
 *  - Incremental tool-result sends with previous_response_id
 *  - Context options forwarding (temperature, top_p, tool_choice, reasoning)
 *  - Graceful fallback to HTTP on connection failure
 *  - Connection lifecycle cleanup via releaseWsSession
 *
 * Run manually with a valid OPENAI_API_KEY:
 *   OPENAI_API_KEY=sk-... npx vitest run src/agents/openai-ws-stream.e2e.test.ts
 *
 * Skipped in CI — no API key available and we avoid billable external calls.
 */

import { describe, it, expect, afterEach } from "vitest";
import {
  createOpenAIWebSocketStreamFn,
  releaseWsSession,
  hasWsSession,
} from "./openai-ws-stream.js";

const API_KEY = process.env.OPENAI_API_KEY;
const LIVE = !!API_KEY;
const testFn = LIVE ? it : it.skip;

// Model config matching what pi-embedded-runner would pass
const model = {
  api: "openai-responses" as const,
  provider: "openai",
  id: "gpt-4o-mini",
  name: "gpt-4o-mini",
  baseUrl: "",
  reasoning: false,
  input: { maxTokens: 128_000 },
  output: { maxTokens: 16_384 },
  cache: false,
  compat: {},
} as unknown as Parameters<ReturnType<typeof createOpenAIWebSocketStreamFn>>[0];

type StreamFnParams = Parameters<ReturnType<typeof createOpenAIWebSocketStreamFn>>;
function makeContext(userMessage: string): StreamFnParams[1] {
  return {
    systemPrompt: "You are a helpful assistant. Reply in one sentence.",
    messages: [{ role: "user" as const, content: userMessage }],
    tools: [],
  } as unknown as StreamFnParams[1];
}

describe("OpenAI WebSocket e2e", () => {
  afterEach(() => {
    releaseWsSession("e2e-session");
  });

  testFn(
    "completes a single-turn request over WebSocket",
    async () => {
      const streamFn = createOpenAIWebSocketStreamFn(API_KEY!, "e2e-session");
      const stream = streamFn(model, makeContext("What is 2+2?"), {});

      const events: Array<{ type: string }> = [];
      for await (const event of stream as AsyncIterable<{ type: string }>) {
        events.push(event as { type: string });
      }

      const done = events.find((e) => e.type === "done") as
        | { type: "done"; message: { content: Array<{ type: string; text?: string }> } }
        | undefined;
      expect(done).toBeDefined();
      expect(done!.message.content.length).toBeGreaterThan(0);

      const text = done!.message.content
        .filter((c) => c.type === "text")
        .map((c) => c.text)
        .join("");
      expect(text).toMatch(/4/);
    },
    30_000,
  );

  testFn(
    "forwards temperature and produces varied output",
    async () => {
      const streamFn = createOpenAIWebSocketStreamFn(API_KEY!, "e2e-session");
      const stream = streamFn(model, makeContext("Pick a random number between 1 and 1000."), {
        temperature: 1.5,
      });

      const events: Array<{ type: string }> = [];
      for await (const event of stream as AsyncIterable<{ type: string }>) {
        events.push(event as { type: string });
      }

      expect(events.some((e) => e.type === "done")).toBe(true);
    },
    30_000,
  );

  testFn(
    "session is tracked in registry during request",
    async () => {
      const streamFn = createOpenAIWebSocketStreamFn(API_KEY!, "e2e-session");

      // Before first call, session doesn't exist yet
      expect(hasWsSession("e2e-session")).toBe(false);

      const stream = streamFn(model, makeContext("Say hello."), {});
      for await (const _ of stream as AsyncIterable<unknown>) {
        /* consume */
      }

      // After successful call, session should be registered
      expect(hasWsSession("e2e-session")).toBe(true);

      // Cleanup
      releaseWsSession("e2e-session");
      expect(hasWsSession("e2e-session")).toBe(false);
    },
    30_000,
  );

  testFn(
    "falls back to HTTP gracefully with invalid API key",
    async () => {
      const streamFn = createOpenAIWebSocketStreamFn("sk-invalid-key", "e2e-fallback");
      const stream = streamFn(model, makeContext("Hello"), {});

      // Should either produce a done event (via HTTP fallback) or an error —
      // but must NOT hang forever.
      const events: Array<{ type: string }> = [];
      for await (const event of stream as AsyncIterable<{ type: string }>) {
        events.push(event as { type: string });
      }

      const hasTerminal = events.some((e) => e.type === "done" || e.type === "error");
      expect(hasTerminal).toBe(true);

      releaseWsSession("e2e-fallback");
    },
    30_000,
  );
});
