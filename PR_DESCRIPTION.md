# feat: Event-Sourced Memory with NATS JetStream

## Summary

This PR adds **Event-Sourced Memory** to OpenClaw, persisting all agent events to NATS JetStream. This enables full audit trails, context reconstruction, and multi-agent knowledge sharing.

## Motivation

Current OpenClaw architecture has memory limitations:
- Sessions start fresh, context is lost after compaction
- File-based workarounds (MEMORY.md, daily notes) are manual band-aids
- No audit trail of what happened when
- Multi-agent setups can't share knowledge natively

This PR makes events the source of truth. Memory is reconstructed from events, not stored as mutable state.

## Changes

### New Files

| File | Description |
|------|-------------|
| `src/infra/event-store.ts` | NATS JetStream integration - publishes all agent events |
| `src/infra/event-context.ts` | Context builder - queries events and formats for system prompt |
| `src/infra/event-store.test.ts` | Unit tests |
| `docs/features/event-store.md` | Comprehensive documentation |
| `scripts/migrate-to-eventstore.mjs` | Migration script for existing workspaces |

### Modified Files

| File | Change |
|------|--------|
| `src/config/types.gateway.ts` | Add `EventStoreConfig` type |
| `src/config/zod-schema.ts` | Add validation schema for event store config |
| `src/gateway/server.impl.ts` | Initialize/close event store on server lifecycle |
| `src/agents/system-prompt.ts` | Add `eventContextHint` parameter |
| `src/agents/pi-embedded-runner/run/attempt.ts` | Auto-load event context on session start |
| `extensions/matrix/*` | Multi-account support (bonus feature) |

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
      my-agent:
        url: nats://agent:pass@localhost:4222
        streamName: events-my-agent
        subjectPrefix: openclaw.events.my-agent
```

## Features

### 1. Event Capture (Phase 1)
Every interaction becomes an immutable event:
- `conversation.message.out` - Messages to/from model
- `conversation.tool_call` - Tool invocations
- `conversation.tool_result` - Tool results
- `lifecycle.start/end` - Session boundaries

### 2. Context Injection (Phase 2 & 3)
On session start, OpenClaw:
1. Queries recent events from NATS
2. Extracts conversation history (deduplicated)
3. Identifies active topics
4. Injects context into system prompt

Agents now remember recent conversations without manual file management.

### 3. Multi-Agent Isolation
With per-agent configurations, each agent can have:
- Separate NATS credentials
- Isolated event streams
- Read access only to their own events

Combined with NATS account permissions, this provides hard security isolation.

## Event Schema

```typescript
interface OpenClawEvent {
  id: string;           // Time-sortable unique ID
  timestamp: number;    // Unix milliseconds
  agent: string;        // Agent identifier
  session: string;      // Session key
  type: EventType;      // Event type
  visibility: string;   // 'internal' | 'public'
  payload: AgentEventPayload;
  meta: { runId, seq, stream, model?, channel? };
}
```

## Migration

For existing installations:

```bash
# 1. Start NATS JetStream
docker run -d --name nats -p 4222:4222 -v nats-data:/data nats:latest -js -sd /data

# 2. Run migration
node scripts/migrate-to-eventstore.mjs --workspace ~/my-workspace

# 3. Enable in config
# Add gateway.eventStore section
```

The migration imports:
- Daily notes (`memory/*.md`)
- Long-term memory (`MEMORY.md`)
- Knowledge graph entries

## Testing

```bash
pnpm test src/infra/event-store.test.ts
```

## Non-Breaking

- Feature is opt-in (`enabled: false` by default)
- Failures are non-blocking (agent works without event store)
- Existing file-based memory still works
- No changes to CLI or existing configs required

## Performance

- Event publishing is fire-and-forget (non-blocking)
- Context build adds ~50-100ms to session start (configurable)
- NATS JetStream handles persistence efficiently

## Future Work

- [ ] Event compaction/summarization for old events
- [ ] Cross-agent event sharing with visibility controls
- [ ] Web UI for event browsing
- [ ] Export/import for event backup

## Credits

Co-authored-by: Albert Hild <albert@vainplex.de>
Co-authored-by: Claudia <claudia.keller0001@gmail.com>

---

**Related:** RFC-001 Event-Sourced Memory, RFC-002 Continuous Learning

This is a significant architectural addition that we've been running in production for a week. Happy to address any feedback!
