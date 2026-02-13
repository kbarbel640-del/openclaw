# ADR-010: Streaming Response Pipeline

## Status: PROPOSED

## Date: 2026-02-13

## Bounded Context: Response Delivery

## Context

The current architecture (ADR-003) returns **batch responses only**. `runCliAgent()` in
`cli-runner.ts` spawns Claude Code as a subprocess with `--output-format json`, waits for
the complete subprocess output, then delivers the entire response as a single message.
Risk assessment R020 rates this as MEDIUM risk (score 8) because every request is affected
and GLM-4.7 responses can take 30+ seconds for complex reasoning.

Users in **Telegram** and **MAX** messengers expect:
- A typing indicator within 500ms of sending a message
- Progressive text appearing as the model generates tokens
- Responsive UX comparable to ChatGPT and native messenger bots

The infrastructure already supports streaming at every layer except OpenClaw:
- **Cloud.ru FM API** supports `"stream": true` and returns SSE (`text/event-stream`)
  with OpenAI-compatible `data: {"choices":[{"delta":{"content":"..."}}]}` chunks
- **claude-code-proxy** passes SSE through from Cloud.ru to Claude Code
- **Claude Code CLI** supports `--output-format stream-json`, which emits newline-delimited
  JSON events (`{"type":"assistant","subtype":"text","content":"token"}`) to stdout
- **Telegram Bot API** supports `sendChatAction("typing")` and `editMessageText` for
  progressive message updates (rate limit: 30 msg/sec per chat)
- **MAX Bot API** supports `editMessage` for progressive updates (rate limit: 30 RPS per bot)

The gap is in OpenClaw: `runCliAgent()` collects all stdout before returning, discarding
the streaming capability that Claude Code already provides.

### DDD Aggregate: ResponseStream

The `ResponseStream` aggregate encapsulates the lifecycle of a single streaming response
from token generation start to final message delivery. It owns the state machine:

```
INITIATED → TYPING_SENT → STREAMING → FINALIZING → DELIVERED
                              ↓
                           ERRORED → FALLBACK_BATCH
```

**Invariants:**
1. A ResponseStream is created for exactly one user message
2. At most one active ResponseStream per conversation (enforced by session lock)
3. If streaming fails mid-response, the aggregate transitions to FALLBACK_BATCH
   and delivers whatever has been accumulated as a single message
4. The aggregate must be garbage-collected within 5 minutes of creation (timeout)

## Decision

Implement a streaming response pipeline as module `@openclaw/stream-pipeline` that reads
Claude Code subprocess stdout incrementally, parses stream-json events, accumulates tokens,
and delivers progressive message updates to messenger adapters.

### Streaming Architecture

```
Cloud.ru FM API (SSE: text/event-stream)
  → claude-code-proxy (SSE passthrough)
    → Claude Code CLI (--output-format stream-json, stdout)
      → OpenClaw StreamParser (newline-delimited JSON reader)
        → TokenAccumulator (debounced buffer)
          → MessengerAdapter.sendProgressUpdate()
            → Telegram editMessageText / MAX editMessage / Web SSE
```

### CLI Backend Change

Replace `--output-format json` with `--output-format stream-json` in the `claude-cli`
backend configuration:

```typescript
// cli-backends.ts — modified DEFAULT_CLAUDE_BACKEND
const DEFAULT_CLAUDE_BACKEND: CliBackendConfig = {
  command: "claude",
  args: ["-p", "--output-format", "stream-json", "--dangerously-skip-permissions"],
  // ... rest unchanged
};
```

The subprocess stdout now emits newline-delimited JSON instead of a single JSON blob.
`runCliAgent()` must be refactored to read stdout incrementally via `readline` or
a transform stream instead of buffering to completion.

### Stream Event Types

Claude Code `stream-json` output emits the following event types:

```typescript
/** Raw event from Claude Code --output-format stream-json */
type StreamJsonEvent =
  | { type: "system"; subtype: "init"; session_id: string }
  | { type: "assistant"; subtype: "text"; content: string }
  | { type: "assistant"; subtype: "tool_use"; tool: string; input: Record<string, unknown> }
  | { type: "assistant"; subtype: "tool_result"; tool: string; output: string }
  | { type: "result"; subtype: "success"; result: string; session_id: string }
  | { type: "result"; subtype: "error"; error: string }
  | { type: "result"; subtype: "max_turns" };
```

### StreamParser Interface

```typescript
/**
 * Parses newline-delimited stream-json events from Claude Code stdout.
 * Emits typed domain events for downstream consumers.
 *
 * Bounded Context: Response Delivery
 * Aggregate: ResponseStream
 */
interface StreamParser {
  /** Called for each text token as it arrives */
  onToken(callback: (token: string) => void): void;

  /** Called when Claude Code invokes a tool (informational — tools are disabled) */
  onToolUse(callback: (event: ToolUseEvent) => void): void;

  /** Called when the stream completes successfully */
  onComplete(callback: (result: CompleteResponse) => void): void;

  /** Called on stream error or timeout */
  onError(callback: (error: StreamError) => void): void;

  /** Feed a raw line from subprocess stdout */
  feed(line: string): void;

  /** Signal that the subprocess has exited */
  end(exitCode: number): void;

  /** Destroy the parser and release resources */
  destroy(): void;
}

interface ToolUseEvent {
  readonly tool: string;
  readonly input: Record<string, unknown>;
  readonly timestamp: number;
}

interface CompleteResponse {
  readonly text: string;
  readonly sessionId: string;
  readonly tokenCount: number;
  readonly durationMs: number;
}

interface StreamError {
  readonly code: "PARSE_ERROR" | "TIMEOUT" | "SUBPROCESS_CRASH" | "PROXY_ERROR";
  readonly message: string;
  readonly partialText: string;
  readonly recoverable: boolean;
}
```

### TokenAccumulator

The accumulator buffers tokens and flushes to the messenger adapter on a debounced
schedule. This prevents exceeding messenger rate limits while maintaining responsive UX.

```typescript
/**
 * Accumulates streaming tokens and flushes to a callback on a schedule.
 * Prevents rate limit violations by debouncing messenger API calls.
 *
 * Bounded Context: Response Delivery
 * Value Object (stateful, but not an entity — no identity beyond its ResponseStream)
 */
interface TokenAccumulatorConfig {
  /** Minimum interval between flushes in ms (default: 1000) */
  flushIntervalMs: number;
  /** Minimum characters before triggering a flush (default: 80) */
  minCharsToFlush: number;
  /** Maximum characters to buffer before forcing a flush (default: 4000) */
  maxBufferSize: number;
  /** Callback invoked on each flush with accumulated text so far */
  onFlush: (accumulatedText: string, isFinal: boolean) => Promise<void>;
}

interface TokenAccumulator {
  /** Append a token to the buffer */
  push(token: string): void;
  /** Signal end of stream — triggers final flush */
  finalize(): Promise<void>;
  /** Get current accumulated text without flushing */
  peek(): string;
  /** Cancel accumulation and release timer resources */
  cancel(): void;
}
```

Flush strategy:
- Timer fires every `flushIntervalMs` (default 1000ms)
- If buffer has >= `minCharsToFlush` characters, flush immediately
- If buffer exceeds `maxBufferSize`, force-flush regardless of timer
- On `finalize()`, flush remaining buffer with `isFinal=true`
- Timer is cleared on `cancel()` or `finalize()`

### Messenger-Specific Streaming Adapters

Each messenger platform has different capabilities and rate limits for progressive
message updates. The `MessengerStreamAdapter` interface abstracts these differences.

```typescript
/**
 * Platform-specific adapter for delivering progressive message updates.
 *
 * Bounded Context: Response Delivery
 * Port (in hexagonal architecture) — implemented per platform
 */
interface MessengerStreamAdapter {
  /** Send typing indicator (platform-specific) */
  sendTypingIndicator(chatId: string): Promise<void>;

  /** Send initial placeholder message, returns message ID for future edits */
  sendInitialMessage(chatId: string, text: string): Promise<string>;

  /** Edit existing message with accumulated text */
  editMessage(chatId: string, messageId: string, text: string): Promise<void>;

  /** Send final message (may replace or finalize the edited message) */
  finalizeMessage(chatId: string, messageId: string, text: string): Promise<void>;

  /** Platform-specific configuration */
  readonly config: MessengerStreamConfig;
}

interface MessengerStreamConfig {
  /** Platform identifier */
  readonly platform: "telegram" | "max" | "web" | "whatsapp";
  /** Maximum edits per second (platform rate limit) */
  readonly maxEditsPerSecond: number;
  /** Whether platform supports typing indicators */
  readonly supportsTypingIndicator: boolean;
  /** Whether platform supports message editing */
  readonly supportsMessageEdit: boolean;
  /** Maximum message length in characters */
  readonly maxMessageLength: number;
  /** Recommended flush interval in ms (derived from rate limits) */
  readonly recommendedFlushIntervalMs: number;
}
```

### Platform Strategy Matrix

| Platform | Method | Rate Limit | Flush Interval | Typing | Strategy |
|----------|--------|-----------|----------------|--------|----------|
| **Telegram** | `editMessageText` | 30 msg/sec per chat | 1000ms | `sendChatAction("typing")` | Send typing immediately. Send initial message with first chunk. Edit message every 1s with accumulated text. Telegram auto-clears typing on message send. Max message: 4096 chars; split into multiple messages if exceeded. |
| **MAX** | `editMessage` | 30 RPS per bot (shared) | 1000ms | `sendAction("typing")` | Send typing immediately. Send initial message. Edit every 1s. Rate limit is shared across all chats, so under high load increase interval to 2s. Max message: 4096 chars. |
| **Web** | WebSocket / SSE | Unlimited (self-hosted) | 0ms (real-time) | Connection status | Stream tokens directly via WebSocket frames or SSE events. No message editing needed. Client renders tokens as they arrive. |
| **WhatsApp** | Not supported | N/A | N/A | No | WhatsApp Business API does not support message editing. Fall back to batch response with typing indicator only. |

### Telegram Adapter Implementation Sketch

```typescript
class TelegramStreamAdapter implements MessengerStreamAdapter {
  readonly config: MessengerStreamConfig = {
    platform: "telegram",
    maxEditsPerSecond: 30,
    supportsTypingIndicator: true,
    supportsMessageEdit: true,
    maxMessageLength: 4096,
    recommendedFlushIntervalMs: 1000,
  };

  private typingTimer: NodeJS.Timeout | null = null;

  async sendTypingIndicator(chatId: string): Promise<void> {
    await this.bot.sendChatAction(chatId, "typing");
    // Telegram typing indicator expires after 5s — renew every 4s
    this.typingTimer = setInterval(() => {
      this.bot.sendChatAction(chatId, "typing").catch(() => {});
    }, 4000);
  }

  async sendInitialMessage(chatId: string, text: string): Promise<string> {
    this.clearTypingTimer();
    const msg = await this.bot.sendMessage(chatId, text + " ...");
    return String(msg.message_id);
  }

  async editMessage(chatId: string, messageId: string, text: string): Promise<void> {
    // Telegram throws "message is not modified" if text unchanged — catch and ignore
    try {
      await this.bot.editMessageText(text + " ...", {
        chat_id: chatId,
        message_id: Number(messageId),
      });
    } catch (err: unknown) {
      if (!(err instanceof Error && err.message.includes("message is not modified"))) {
        throw err;
      }
    }
  }

  async finalizeMessage(chatId: string, messageId: string, text: string): Promise<void> {
    this.clearTypingTimer();
    try {
      await this.bot.editMessageText(text, {
        chat_id: chatId,
        message_id: Number(messageId),
        parse_mode: "Markdown",
      });
    } catch {
      // If edit fails (e.g., message too old), send as new message
      await this.bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
    }
  }

  private clearTypingTimer(): void {
    if (this.typingTimer) {
      clearInterval(this.typingTimer);
      this.typingTimer = null;
    }
  }
}
```

### MAX Adapter Implementation Sketch

```typescript
class MaxStreamAdapter implements MessengerStreamAdapter {
  readonly config: MessengerStreamConfig = {
    platform: "max",
    maxEditsPerSecond: 30,
    supportsTypingIndicator: true,
    supportsMessageEdit: true,
    maxMessageLength: 4096,
    recommendedFlushIntervalMs: 1000,
  };

  async sendTypingIndicator(chatId: string): Promise<void> {
    // MAX Bot API: POST /chats/{chatId}/actions with body {"action": "typing"}
    await this.client.post(`/chats/${chatId}/actions`, { action: "typing" });
  }

  async sendInitialMessage(chatId: string, text: string): Promise<string> {
    const res = await this.client.post("/messages", {
      chat_id: chatId,
      text: text + " ...",
    });
    return res.data.message_id;
  }

  async editMessage(chatId: string, messageId: string, text: string): Promise<void> {
    await this.client.put(`/messages/${messageId}`, {
      chat_id: chatId,
      text: text + " ...",
    });
  }

  async finalizeMessage(chatId: string, messageId: string, text: string): Promise<void> {
    await this.client.put(`/messages/${messageId}`, {
      chat_id: chatId,
      text,
      format: "markdown",
    });
  }
}
```

### Orchestration: StreamingResponseHandler

The handler wires together the parser, accumulator, and messenger adapter:

```typescript
/**
 * Orchestrates the streaming response lifecycle for a single user message.
 * Creates and manages a ResponseStream aggregate instance.
 *
 * Bounded Context: Response Delivery
 * Application Service
 */
async function handleStreamingResponse(
  subprocess: ChildProcess,
  adapter: MessengerStreamAdapter,
  chatId: string,
  sessionId: string,
): Promise<CompleteResponse> {
  // 1. Immediately send typing indicator
  await adapter.sendTypingIndicator(chatId);

  // 2. Create parser and accumulator
  const parser = createStreamParser();
  let messageId: string | null = null;
  let firstChunkReceived = false;

  const accumulator = createTokenAccumulator({
    flushIntervalMs: adapter.config.recommendedFlushIntervalMs,
    minCharsToFlush: 80,
    maxBufferSize: adapter.config.maxMessageLength - 100, // leave room for ellipsis
    onFlush: async (text, isFinal) => {
      if (!firstChunkReceived) {
        messageId = await adapter.sendInitialMessage(chatId, text);
        firstChunkReceived = true;
      } else if (messageId && isFinal) {
        await adapter.finalizeMessage(chatId, messageId, text);
      } else if (messageId) {
        await adapter.editMessage(chatId, messageId, text);
      }
    },
  });

  // 3. Wire parser to accumulator
  parser.onToken((token) => accumulator.push(token));

  // 4. Read subprocess stdout line-by-line
  const rl = readline.createInterface({ input: subprocess.stdout! });
  rl.on("line", (line) => parser.feed(line));

  // 5. Wait for completion
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      accumulator.cancel();
      parser.destroy();
      reject(new StreamError("TIMEOUT", "Stream timed out after 300s", accumulator.peek()));
    }, 300_000);

    parser.onComplete(async (result) => {
      clearTimeout(timeout);
      await accumulator.finalize();
      resolve(result);
    });

    parser.onError(async (error) => {
      clearTimeout(timeout);
      if (error.recoverable && error.partialText.length > 0) {
        // Deliver partial response as final message
        if (messageId) {
          await adapter.finalizeMessage(chatId, messageId, error.partialText);
        }
      }
      reject(error);
    });
  });
}
```

### Long Message Handling

Telegram and MAX both have a 4096-character message limit. For responses exceeding this:

```typescript
interface LongMessageStrategy {
  /** Split text into chunks respecting word boundaries and markdown structure */
  split(text: string, maxLength: number): string[];
}
```

Strategy:
1. During streaming, if accumulated text approaches 4000 chars, finalize the current
   message and start a new one (send new initial message, update messageId)
2. Track an array of message IDs for the response
3. On finalization, edit only the last message; previous chunks are already final
4. Prefer splitting at paragraph boundaries (`\n\n`), then sentence boundaries (`. `),
   then word boundaries (` `)

### Fallback to Batch Mode

If streaming fails (subprocess does not support stream-json, proxy error, parse failure),
the system must gracefully degrade to the current batch behavior:

```typescript
async function handleResponseWithFallback(
  subprocess: ChildProcess,
  adapter: MessengerStreamAdapter,
  chatId: string,
  sessionId: string,
): Promise<CompleteResponse> {
  try {
    return await handleStreamingResponse(subprocess, adapter, chatId, sessionId);
  } catch (error) {
    if (error instanceof StreamError && error.code === "PARSE_ERROR") {
      // Stream-json not supported — fall back to buffered read
      const fullOutput = await collectSubprocessOutput(subprocess);
      const text = parseJsonResponse(fullOutput);
      await adapter.sendInitialMessage(chatId, text);
      return { text, sessionId, tokenCount: 0, durationMs: 0 };
    }
    throw error;
  }
}
```

### Integration with runCliAgent()

The change to `runCliAgent()` in `cli-runner.ts` is minimal:

```typescript
// BEFORE (batch):
// const stdout = await collectAllStdout(child);
// return parseJsonOutput(stdout);

// AFTER (streaming):
if (streamAdapter) {
  return await handleStreamingResponse(child, streamAdapter, chatId, sessionId);
} else {
  // Legacy path — no adapter available (e.g., API-only caller)
  const stdout = await collectAllStdout(child);
  return parseJsonOutput(stdout);
}
```

The `streamAdapter` is resolved by the gateway layer based on the message source
(Telegram, MAX, Web, etc.) and injected into the agent runner context.

## Consequences

### Positive

- **Immediate UX improvement**: Users see typing indicator within 500ms and progressive
  text within 2-3 seconds, versus 10-30+ second wait for batch responses
- **Zero infrastructure changes**: Cloud.ru FM, proxy, and Claude Code already support
  streaming — only OpenClaw code changes required
- **Graceful degradation**: Fallback to batch mode if streaming fails at any layer
- **Platform-optimized**: Each messenger gets an adapter tuned to its rate limits and
  capabilities
- **Addresses R020**: Directly mitigates the MEDIUM risk identified in shift-left analysis
- **Addresses T-R01**: Typing indicator sent immediately as recommended in risk assessment

### Negative

- **Increased complexity**: StreamParser, TokenAccumulator, and per-platform adapters add
  ~500 lines of new code across 5-6 files
- **Message edit flickering**: Rapid edits on slow connections may cause visual flickering
  in Telegram/MAX clients (mitigated by 1s debounce)
- **Partial response risk**: If streaming fails mid-response, user may receive truncated
  text (mitigated by FALLBACK_BATCH state and partial delivery)
- **Rate limit pressure on MAX**: The 30 RPS limit is shared across all bot chats; with
  10 concurrent streaming responses each editing at 1/s, that is 10 RPS consumed by edits
  alone, leaving 20 RPS for all other bot operations
- **Cannot stream to WhatsApp**: WhatsApp Business API does not support message editing;
  users on WhatsApp still get batch responses with typing indicator only
- **Testing complexity**: Streaming behavior requires mocking subprocess stdout with timed
  token emission, which is harder than mocking a single JSON response

### Risks

| Risk | Probability | Impact | Mitigation |
|------|:-----------:|:------:|-----------|
| `stream-json` format changes in Claude Code update | Low | High | Pin Claude Code version; parser validates event structure |
| Telegram `editMessageText` rate limit hit under load | Medium | Medium | Increase flush interval to 2s under load; circuit breaker |
| MAX 30 RPS shared limit exhausted by streaming edits | Medium | High | Adaptive flush interval; prioritize new messages over edits |
| Subprocess stdout buffering delays token delivery | Low | Low | Set `PYTHONUNBUFFERED=1`; use `readline` interface |
| Proxy drops SSE connection mid-stream | Medium | Medium | FALLBACK_BATCH with partial text delivery |
| Memory leak from uncleaned timers/streams | Low | Medium | `destroy()` on parser; `cancel()` on accumulator; 5min hard timeout |

### Invariants (DDD)

1. **Single Active Stream**: At most one `ResponseStream` per conversation at any time.
   Enforced by the existing `serialize: true` in `cli-backends.ts` and a per-session mutex.
2. **Typing Before Content**: `sendTypingIndicator()` must be called before any content
   delivery. The adapter must not throw on typing indicator failure (fire-and-forget).
3. **Final Message Integrity**: The last `finalizeMessage()` call must contain the complete
   accumulated text, not a delta. This ensures the user always has the full response even
   if they missed intermediate edits.
4. **Timeout Guarantee**: Every `ResponseStream` must terminate within 300 seconds (5 min).
   The hard timeout kills the subprocess and delivers partial text if available.
5. **Graceful Degradation**: If `StreamParser.feed()` throws on the first line, the system
   must fall back to batch mode without user-visible error.

### Domain Events

| Event | Trigger | Consumer |
|-------|---------|----------|
| `ResponseStreamInitiated` | User message received, subprocess spawned | Metrics, logging |
| `TypingIndicatorSent` | Adapter sends typing action | Metrics |
| `FirstTokenReceived` | Parser emits first `onToken` | Metrics (time-to-first-token) |
| `ProgressMessageSent` | Accumulator flushes to adapter | Rate limit tracker |
| `ResponseStreamCompleted` | Parser emits `onComplete` | Session manager, metrics |
| `ResponseStreamFailed` | Parser emits `onError` or timeout | Error tracking, fallback |
| `FallbackToBatch` | Streaming failed, batch mode activated | Alerting |

## Module Boundary: `@openclaw/stream-pipeline`

### File Structure

```
src/stream-pipeline/
  index.ts                          # Public API barrel export
  stream-parser.ts                  # StreamParser implementation (~120 lines)
  token-accumulator.ts              # TokenAccumulator implementation (~80 lines)
  streaming-response-handler.ts     # Orchestration (~100 lines)
  long-message-splitter.ts          # Message splitting logic (~60 lines)
  adapters/
    messenger-stream-adapter.ts     # Interface + MessengerStreamConfig
    telegram-stream-adapter.ts      # Telegram implementation (~80 lines)
    max-stream-adapter.ts           # MAX implementation (~70 lines)
    web-stream-adapter.ts           # WebSocket/SSE implementation (~50 lines)
    batch-fallback-adapter.ts       # No-op adapter for non-streaming platforms (~30 lines)
```

### Public API

```typescript
// src/stream-pipeline/index.ts
export { createStreamParser } from "./stream-parser";
export { createTokenAccumulator } from "./token-accumulator";
export { handleStreamingResponse, handleResponseWithFallback } from "./streaming-response-handler";
export { splitLongMessage } from "./long-message-splitter";

export type { StreamParser, CompleteResponse, StreamError, ToolUseEvent } from "./stream-parser";
export type { TokenAccumulator, TokenAccumulatorConfig } from "./token-accumulator";
export type { MessengerStreamAdapter, MessengerStreamConfig } from "./adapters/messenger-stream-adapter";

export { TelegramStreamAdapter } from "./adapters/telegram-stream-adapter";
export { MaxStreamAdapter } from "./adapters/max-stream-adapter";
export { WebStreamAdapter } from "./adapters/web-stream-adapter";
export { BatchFallbackAdapter } from "./adapters/batch-fallback-adapter";
```

### Dependency Rules

- `@openclaw/stream-pipeline` depends on Node.js `readline` and `child_process` (stdlib only)
- Messenger adapters depend on their respective bot SDKs (injected, not imported)
- The module does NOT depend on `cli-runner.ts` — it is called BY `cli-runner.ts`
- The module does NOT depend on `agent-runner.ts` — the gateway resolves the adapter
  and passes it through the existing agent execution context

### Test Plan

| Test | Type | Description |
|------|------|-------------|
| StreamParser parses valid stream-json | Unit | Feed valid lines, verify `onToken`/`onComplete` callbacks |
| StreamParser handles malformed JSON | Unit | Feed garbage, verify `onError` with `PARSE_ERROR` code |
| TokenAccumulator flushes on interval | Unit | Push tokens, advance timer, verify `onFlush` calls |
| TokenAccumulator respects maxBufferSize | Unit | Push large text, verify forced flush before limit |
| TelegramStreamAdapter edits message | Integration | Mock Telegram API, verify `editMessageText` calls |
| MaxStreamAdapter rate limit backoff | Integration | Simulate 429 from MAX API, verify increased interval |
| Full pipeline end-to-end | Integration | Mock subprocess stdout with timed tokens, verify adapter calls |
| Fallback to batch on parse failure | Integration | Feed non-JSON stdout, verify batch delivery |
| Timeout after 300s | Unit | Start stream, never complete, verify timeout error |
| Long message splitting | Unit | 8000-char text, verify split at paragraph boundaries |

## Alternatives Considered

1. **WebSocket proxy between OpenClaw and messenger** -- Adds infrastructure complexity.
   Rejected because messenger APIs already support progressive editing natively.

2. **Server-Sent Events from OpenClaw to a web frontend, batch to messengers** --
   Creates two code paths with different behavior. Rejected in favor of unified
   streaming pipeline with platform-specific adapters.

3. **Polling-based progressive updates** (send partial responses as new messages) --
   Creates message spam in chat. Rejected because message editing provides cleaner UX.

4. **Direct Cloud.ru FM streaming (bypass Claude Code)** -- Loses the agentic pipeline
   (multi-step reasoning, session persistence, tool orchestration) that ADR-003
   establishes as the core value proposition. Rejected.

## References

- `src/agents/cli-runner.ts:35-324` -- `runCliAgent()` current batch implementation
- `src/agents/cli-backends.ts:30-53` -- `DEFAULT_CLAUDE_BACKEND` config (`--output-format`)
- ADR-003 -- Claude Code as agentic engine (documents batch limitation)
- Risk R020 -- "Streaming Not Supported to End Users" (shift-left risk analysis)
- Risk T-R01 -- "Response latency 35+ seconds" (risk assessment)
- [Claude Code CLI streaming](https://docs.anthropic.com/en/docs/claude-code) -- `--output-format stream-json`
- [Cloud.ru FM API streaming](https://cloud.ru/docs/foundation-models/ug/topics/api-ref) -- `"stream": true`
- [Telegram Bot API editMessageText](https://core.telegram.org/bots/api#editmessagetext)
- [MAX Bot API](https://dev.max.ru) -- `editMessage`, 30 RPS rate limit
