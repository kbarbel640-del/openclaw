# Clarity — Relevance-Based Context Prioritization

Replaces static priority rules with dynamic relevance scoring based on actual usage patterns.

## Overview

Clarity implements Capability 2 of the Active Context Manager: **Relevance-Based Prioritization**. Instead of using fixed priority tiers, it dynamically scores context items based on:

- **Recency**: Items mentioned in the last N turns get a bonus
- **Frequency**: Items mentioned more often score higher (logarithmic scale)
- **Utility**: Items actually referenced in responses get a boost
- **Staleness**: Unused items decay exponentially (half-life ~5 turns)
- **Anchoring**: User-marked important items are preserved

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Relevance      │────▶│  Context        │────▶│  Relevance      │
│  Scorer         │     │  Tracker        │     │  Pruner         │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        ▼                       ▼                       ▼
   - Frequency scoring    - Mention extraction    - Keep/prune decisions
   - Recency bonus        - Reference tracking    - Strict mode support
   - Staleness decay      - O(1) updates          - Budget awareness
   - Anchor bonus         - Persistence           - Category limits
```

## Scoring Algorithm

```
baseScore = log2(mentionCount + 1) × frequencyScale
recencyBonus = (1 - turnsSinceMention/(recencyWindow+1)) × maxRecencyBonus
utilityBonus = referenceCount × referenceWeight
stalenessPenalty = (1 - decayFactor^turnsStale) × baseScore
anchorBonus = anchored ? 100 : 0

finalScore = baseScore + recencyBonus + utilityBonus - stalenessPenalty + anchorBonus
```

Default parameters:

- `halfLife`: 5 turns (exponential decay)
- `recencyWindow`: 3 turns (linear bonus zone)
- `recencyBonus`: 20 points
- `referenceWeight`: 15 points per reference
- `frequencyScale`: 10
- `anchorBonus`: 100 points

## Tracking Mechanism

### Efficient Updates (O(1) per turn)

Instead of scanning history every turn (O(n²)), Clarity maintains running statistics:

- `mentionCount`: Incremented on each mention
- `lastMentionTurn`: Updated on each mention
- `referenceCount`: Incremented when referenced in responses
- `anchored`: Boolean flag set by user

### Entity Extraction

Clarity extracts context items from messages using pattern matching:

- **Projects**: Capitalized names (`ClaraCore`), hyphenated (`focus-engine`)
- **Tools**: Tool names (`web_search`, `edit`, `read`, `memory_search`)
- **Memory Files**: File references (`SOUL.md`, `memory/active-context.md`)
- **Keywords**: Important terms (frequency-based, 2+ occurrences)

## Integration with Clarity Strict Mode

```javascript
// In strict mode, preserve items above threshold
if (strictMode && item.adjustedScore >= strictModePreserveThreshold) {
  shouldKeep = true;
}

// ESSENTIAL tier always preserved
if (strictMode && item.tier === "essential") {
  shouldKeep = true;
}

// Anchored items always preserved
if (item.metadata?.anchored) {
  shouldKeep = true;
}
```

## Storage Format

Uses the memory plugin's `kv_store`:

```javascript
// Namespace: 'clarity'
// Key: 'clarity:relevance_state'
{
  currentTurn: 42,
  lastPersistAt: 1708377600000,
  items: [
    {
      id: 'claracore',
      mentionCount: 5,
      referenceCount: 2,
      lastMentionTurn: 40,
      anchored: true,
      createdAt: 1708374000000
    },
    // ...
  ]
}
```

## Commands

| Command                    | Description                |
| -------------------------- | -------------------------- |
| `/clarity`                 | Show status and top items  |
| `/clarity scores`          | Show detailed scores table |
| `/clarity anchor <item>`   | Mark item as anchored      |
| `/clarity unanchor <item>` | Remove anchor from item    |
| `/clarity prune`           | Trigger manual pruning     |
| `/clarity stats`           | Show statistics            |
| `/clarity config`          | Show current configuration |

## Gateway Methods

| Method              | Description              |
| ------------------- | ------------------------ |
| `clarity.getState`  | Full tracker state       |
| `clarity.getScores` | Current relevance scores |
| `clarity.anchor`    | Mark item as anchored    |
| `clarity.unanchor`  | Remove anchor            |
| `clarity.prune`     | Trigger pruning          |
| `clarity.stats`     | Get statistics           |
| `clarity.config`    | Get configuration        |

## Configuration

```json
{
  "enabled": true,
  "strictMode": false,
  "scoring": {
    "halfLife": 5,
    "recencyWindow": 3,
    "recencyBonus": 20,
    "referenceWeight": 15,
    "frequencyScale": 10,
    "anchorBonus": 100
  },
  "pruning": {
    "pruneThreshold": 8,
    "strictModePreserveThreshold": 25,
    "maxItemsPerCategory": 20,
    "targetContextItems": 30,
    "maxContextItems": 50,
    "minMentionsPreserve": 3
  }
}
```

## Hooks

- `before_agent_start`: Injects relevance context, tracks mentions
- `agent_end`: Tracks references, advances turn counter
- `before_compaction`: Evaluates and prunes low-relevance items
- `session_end`: Persists final state

## Debugging

Scores are inspectable via:

1. `/clarity scores` command
2. `clarity.getScores` gateway method
3. Prepended `[CLARITY CONTEXT]` block each turn

Example output:

```
[CLARITY CONTEXT]
High-relevance context:
  ● ⚓ claracore (125)
  ● openclaw (78)
  ◐ tool:web_search (45)
  ○ SOUL.md (32)
```

## Design Constraints Met

✅ **Efficient scoring**: O(1) per turn, no O(n²) history scanning  
✅ **Clean integration**: Works with existing Clarity strict mode  
✅ **Anchored preservation**: User-marked items always kept  
✅ **Inspectable scores**: Multiple ways to view/debug scores  
✅ **Persistent storage**: Scores survive restarts via kv_store
