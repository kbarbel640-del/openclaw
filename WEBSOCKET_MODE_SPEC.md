# OpenAI Responses API WebSocket Mode — Implementation Spec

## Overview

Add WebSocket transport support for OpenAI's Responses API (`wss://api.openai.com/v1/responses`).
This keeps a persistent connection for multi-tool-call workflows, sending only incremental inputs per turn.

**GitHub Issue:** https://github.com/openclaw/openclaw/issues/24830
**OpenAI Docs:** https://developers.openai.com/api/docs/guides/websocket-mode
**Branch:** `feat/openai-websocket-mode`

## Architecture

### Current Flow (HTTP)

```
Agent turn → HTTP POST /v1/responses → response → tool calls
→ tool execution → HTTP POST /v1/responses (full context) → response → ...
```

### Target Flow (WebSocket)

```
Agent turn → ws.send(response.create) → streaming events → tool calls
→ tool execution → ws.send(response.create + previous_response_id + incremental input) → ...
```

## Key Files to Modify

### 1. Provider Layer — `src/agents/pi-embedded-runner/run/attempt.ts`

This is where the actual LLM API call happens. Need to:

- Detect if WebSocket mode is enabled for OpenAI provider
- If enabled, use persistent WebSocket connection instead of HTTP
- Send `response.create` events with incremental `input` + `previous_response_id`
- Parse streaming SSE-like events from WebSocket frames

### 2. Connection Manager — NEW: `src/agents/openai-ws-connection.ts`

- Manage persistent WebSocket connection lifecycle
- Connection pooling (one per agent? one per session?)
- Auto-reconnect on drop
- Warm-up support (`generate: false`)
- Cleanup on session end

### 3. Config — `src/config/types.gateway.ts`

- Add `providers.openai.websocket` boolean (default: false)
- Add `providers.openai.websocketWarmup` boolean (default: false)

### 4. OpenResponses Schema — `src/gateway/open-responses.schema.ts`

- Already has `previous_response_id` — verify WebSocket event format compatibility

### 5. Tests — NEW: `src/agents/openai-ws-connection.test.ts`

- Unit tests for connection manager
- Mock WebSocket server for integration tests
- Fallback behavior when connection drops

## WebSocket Protocol (from OpenAI docs)

### Client → Server

```json
{
  "type": "response.create",
  "model": "gpt-5.2",
  "store": false,
  "input": [{ "type": "message", "role": "user", "content": [{"type": "input_text", "text": "..."}] }],
  "tools": [...]
}
```

### Continuation (with previous_response_id)

```json
{
  "type": "response.create",
  "model": "gpt-5.2",
  "store": false,
  "previous_response_id": "resp_123",
  "input": [
    { "type": "function_call_output", "call_id": "call_123", "output": "tool result" }
  ],
  "tools": [...]
}
```

### Warm-up (no generation)

```json
{
  "type": "response.create",
  "model": "gpt-5.2",
  "generate": false,
  "tools": [...],
  "instructions": "..."
}
```

### Server → Client Events

Same as Responses API SSE events:

- `response.created`
- `response.output_item.added`
- `response.content_part.added`
- `response.output_text.delta`
- `response.function_call_arguments.delta`
- `response.completed`

## Implementation Plan

### Phase 1: Connection Manager

- [ ] `OpenAIWebSocketManager` class
- [ ] Connection lifecycle (create, send, receive, close)
- [ ] Auth header injection (`Authorization: Bearer $KEY`)
- [ ] Auto-reconnect with exponential backoff
- [ ] Connection health check / keepalive

### Phase 2: Provider Integration

- [ ] Detect `websocket: true` in OpenAI provider config
- [ ] Route tool-call continuations through WebSocket instead of HTTP
- [ ] Parse WebSocket events into existing response format
- [ ] Track `previous_response_id` per session

### Phase 3: Warm-up & Optimization

- [ ] `generate: false` warm-up on session start
- [ ] Pre-load tools definition on connection open
- [ ] Metrics: compare latency HTTP vs WebSocket

### Phase 4: Fallback & Error Handling

- [ ] Fall back to HTTP if WebSocket fails
- [ ] Handle `previous_response_not_found` (cache miss)
- [ ] Handle connection drops mid-turn
- [ ] Graceful degradation (no user-visible errors)

## Testing Strategy

- Unit tests with mock WebSocket server (ws library)
- E2E test with real OpenAI API (optional, behind flag)
- Benchmark: measure latency reduction on 10/20/50 tool-call chains

## Notes

- OpenClaw already uses `ws` package (WebSocketServer for Control UI)
- The `pi-embedded-runner` is the core agent execution engine
- `attempt.ts` handles individual LLM call attempts
- Existing `previous_response_id` support in OpenResponses schema is HTTP-only inbound; this adds it as outbound to OpenAI
