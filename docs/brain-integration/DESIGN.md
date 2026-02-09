# Brain MCP 4-Tier Memory Integration

## Overview

This document describes the integration of OpenClaw with Brain MCP's 4-tier memory system, providing programmatic enforcement of tiered memory search and write operations.

## Problem Statement

Currently, OpenClaw agents depend on AGENTS.md instructions to use Brain MCP. This is unreliable because:

1. **No programmatic enforcement** - LLM may forget or skip instructions
2. **Context window competition** - Instructions get deprioritized as context fills
3. **No tiered routing logic** - LLM can't reliably make latency/accuracy tradeoffs
4. **Inconsistent execution** - Different sessions yield different compliance
5. **No automatic fallback** - If Brain MCP fails, agent breaks

## Solution: Programmatic 4-Tier Integration

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     OpenClaw Agent                          │
│                                                             │
│  memory_search("query") ──► BrainTieredManager.search()    │
│                                    │                        │
│                    ┌───────────────┼───────────────┐        │
│                    ▼               ▼               ▼        │
│               ┌────────┐    ┌──────────┐    ┌──────────┐   │
│               │ Tier 0 │    │ Tier 1-2 │    │ Tier 3   │   │
│               │ Local  │    │  Brain   │    │  Brain   │   │
│               │memory.md│   │quick/smart│   │ unified  │   │
│               └────────┘    └──────────┘    └──────────┘   │
│                    │               │               │        │
│                    └───────────────┴───────────────┘        │
│                                    │                        │
│                              Merged Results                 │
└─────────────────────────────────────────────────────────────┘
```

### Tier Definitions

| Tier | Source                          | Latency | Use Case                        |
| ---- | ------------------------------- | ------- | ------------------------------- |
| 0    | Local memory.md                 | <1ms    | Immediate context, recent notes |
| 1    | Brain quick_search              | <100ms  | Fast lookups, autocomplete      |
| 2    | Brain unified_search (semantic) | <500ms  | Context retrieval               |
| 3    | Brain unified_search (full)     | <3000ms | Deep reasoning, comprehensive   |

### Search Flow

```typescript
async search(query: string): Promise<MemorySearchResult[]> {
  // ALWAYS Tier 0 first - enforced by code
  const tier0 = await this.searchMemoryMd(query);

  // If good local match, stop early
  if (tier0.length >= 3 && tier0[0].score > 0.8) {
    return tier0;
  }

  // Escalate to Brain tiers based on query complexity
  const tier = this.selectTier(query, tier0);
  const brainResults = await this.searchBrain(query, tier);

  return this.mergeResults(tier0, brainResults);
}
```

### Write Flow

```typescript
async write(content: string): Promise<void> {
  // ALWAYS write to Tier 0 (memory.md)
  // Existing cron handles sync to Brain
  await this.appendToMemoryMd(content);
}
```

## Configuration

### Per-Agent Config

```json
{
  "memory": {
    "backend": "brain-tiered",
    "brainTiered": {
      "workspaceId": "aaaaaaaa-1111-2222-3333-444444444444",
      "memoryMdPath": "./memory.md",
      "brainMcpUrl": "http://localhost:8765",
      "tiers": {
        "escalationThreshold": 0.7,
        "maxTier": 3,
        "timeoutMs": 5000
      }
    }
  }
}
```

### Multi-Agent Support

Each of the 8 agents has:

- Their own `memory.md` file (Tier 0)
- Their own Brain workspace ID
- Independent tier escalation

The backend is parameterized by agent config, no code changes needed per agent.

## Backward Compatibility

- Existing "builtin" and "qmd" backends unchanged
- New "brain-tiered" backend is opt-in via config
- Agents not configured for brain-tiered continue working as before

## Graceful Degradation

```typescript
try {
  const brainResults = await this.searchBrain(query);
  return [...tier0, ...brainResults];
} catch (error) {
  // Brain MCP unavailable - Tier 0 still works
  console.warn("Brain MCP unavailable, using Tier 0 only");
  return tier0;
}
```

## Implementation Files

| File                                 | Purpose                                  |
| ------------------------------------ | ---------------------------------------- |
| `src/config/types.memory.ts`         | Add "brain-tiered" to MemoryBackend type |
| `src/config/types.brain-tiered.ts`   | BrainTiered config types                 |
| `src/memory/brain-tiered-manager.ts` | Main implementation                      |
| `src/memory/brain-mcp-client.ts`     | Brain MCP client wrapper                 |
| `src/memory/search-manager.ts`       | Wire in new backend                      |

## Testing Strategy

All tests use REAL components (TDD, no mocks):

1. **Unit tests**: BrainTieredManager with real Brain MCP
2. **Integration tests**: Full search flow with real data
3. **Regression tests**: Existing backends still work

## Decision Log

| Date       | Decision                             | Rationale                       |
| ---------- | ------------------------------------ | ------------------------------- |
| 2025-02-06 | Add brain-tiered as new backend type | Preserve backward compatibility |
| 2025-02-06 | Tier 0 always searched first         | Fastest, always available       |
| 2025-02-06 | Graceful fallback to Tier 0          | Reliability over features       |
| 2025-02-06 | Per-agent workspace config           | Support 8 agents independently  |

## References

- [Brain MCP Blueprint](/Users/joechoa/Brain/brain_blueprint.md)
- [4-Tier Memory Paper](/Users/joechoa/Brain/docs/paper_brain_multi_agent_memory.md)
- [Memory System Architecture](/Users/joechoa/Brain/claudedocs/brain_memory_system_architecture.md)
