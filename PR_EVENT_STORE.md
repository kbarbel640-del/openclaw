# feat: Event-Sourced Memory with NATS JetStream

## Summary

This PR adds **optional Event-Sourced Memory** to OpenClaw, persisting agent events to NATS JetStream. It extends OpenClaw for advanced use cases while remaining fully backwards-compatible.

## Motivation

OpenClaw's existing session-based architecture works well for standard use cases. We built Event Store to address specific advanced requirements:

### 1. Multi-Agent Coordination
When running multiple agents, they need both:
- **Shared knowledge** — What did Agent A learn that Agent B should know?
- **Isolation** — Agent B shouldn't see Agent A's private conversations

Event Store with per-agent streams solves both elegantly.

### 2. Queryable History
"What did we discuss about topic X last week?"

With structured events, this becomes a simple query rather than grepping through files. Events are indexed, timestamped, and filterable.

### 3. Continuous Learning
Automatically analyze patterns over time:
- Which communication styles work best?
- What topics come up frequently?
- Where are skill gaps?

An event consumer can process events in real-time to build these insights.

### 4. Automatic Context Injection
Each new session starts with relevant context from recent events — automatically. No manual file management needed for session continuity.

### 5. Audit Trail
For compliance-sensitive deployments: immutable, timestamped record of all AI interactions that can be queried and audited.

## Design Principles

- **Opt-in** — Disabled by default, zero impact if not used
- **Non-blocking** — Event publishing failures don't affect core functionality
- **Backwards-compatible** — Existing file-based workflows continue to work
- **Extensible** — Per-agent configurations for isolation requirements

## Changes

### New Files

| File | Description |
|------|-------------|
| `src/infra/event-store.ts` | NATS JetStream integration |
| `src/infra/event-context.ts` | Context builder from events |
| `src/infra/event-store.test.ts` | Unit tests |
| `docs/features/event-store.md` | Documentation |
| `scripts/migrate-to-eventstore.mjs` | Migration script |

### Modified Files

| File | Change |
|------|--------|
| `src/config/types.gateway.ts` | Add `EventStoreConfig` type |
| `src/config/zod-schema.ts` | Validation schema |
| `src/gateway/server.impl.ts` | Lifecycle hooks |
| `src/agents/system-prompt.ts` | `eventContextHint` parameter |
| `src/agents/pi-embedded-runner/run/attempt.ts` | Auto-load context |

## Configuration

```yaml
gateway:
  eventStore:
    enabled: true
    url: nats://localhost:4222
    streamName: openclaw-events
    subjectPrefix: openclaw.events
    
    # Optional: Per-agent isolation
    agents:
      assistant-one:
        url: nats://agent1:pass@localhost:4222
        streamName: events-assistant-one
        subjectPrefix: openclaw.events.assistant-one
```

## Event Types

| Type | Description |
|------|-------------|
| `conversation.message.out` | Messages to/from model |
| `conversation.tool_call` | Tool invocations |
| `conversation.tool_result` | Tool results |
| `lifecycle.start/end` | Session boundaries |

## Event Schema

```typescript
interface OpenClawEvent {
  id: string;           // Time-sortable unique ID
  timestamp: number;    // Unix milliseconds
  agent: string;        // Agent identifier
  session: string;      // Session key
  type: EventType;
  visibility: string;   // 'internal' | 'public'
  payload: AgentEventPayload;
  meta: { runId, seq, stream };
}
```

## Migration

For existing workspaces that want to import historical data:

```bash
node scripts/migrate-to-eventstore.mjs --workspace ~/my-workspace --dry-run
```

## Testing

```bash
pnpm test src/infra/event-store.test.ts
```

## Who is this for?

- **Multi-agent deployments** needing coordination and isolation
- **Teams** wanting queryable conversation history
- **Compliance-sensitive** environments requiring audit trails
- **Developers** building learning/analytics on top of OpenClaw

For single-agent, casual use — the existing architecture remains perfect.

---

Co-authored-by: Albert Hild <albert@vainplex.de>
Co-authored-by: Claudia <claudia.keller0001@gmail.com>
