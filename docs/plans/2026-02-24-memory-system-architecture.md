# MABOS Memory & Knowledge Management System — Architecture & Implementation Guide

> A complete technical reference for engineers building an RLM-inspired, multi-store
> memory and knowledge management system for LLM-based autonomous agents. This document describes the architecture,
> data structures, algorithms, and protocols in enough detail to reimplement the system
> independently in any language or framework.

**Origin**: OpenClaw-MABOS (Multi-Agent Business Operating System)
**Theoretical basis**: "Recursive Language Models" (arXiv:2512.24601v2, Zhang, Kraska, Khattab — Jan 2026)
**Implementation**: TypeScript, Node.js 22+, SQLite, TypeDB (optional)

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Tech Stack](#2-tech-stack)
3. [Architecture Layers](#3-architecture-layers)
4. [Data Structures](#4-data-structures)
5. [Three-Store Memory Model](#5-three-store-memory-model)
6. [R1: Recursive Memory Consolidation](#6-r1-recursive-memory-consolidation)
7. [R2: Hierarchical Memory Index](#7-r2-hierarchical-memory-index)
8. [R3: Context-Aware Pre-Compaction Checkpoints](#8-r3-context-aware-pre-compaction-checkpoints)
9. [R4: Recursive Memory Search](#9-r4-recursive-memory-search)
10. [R5: BDI Recursive Reasoning Loop](#10-r5-bdi-recursive-reasoning-loop)
11. [Native Search Layer](#11-native-search-layer)
12. [TypeDB Knowledge Graph Layer](#12-typedb-knowledge-graph-layer)
13. [Materialization Pipeline](#13-materialization-pipeline)
14. [BDI Cognitive Architecture](#14-bdi-cognitive-architecture)
15. [File Layout & Conventions](#15-file-layout--conventions)
16. [API Surface (Tool Definitions)](#16-api-surface-tool-definitions)
17. [Testing Strategy](#17-testing-strategy)
18. [Performance Characteristics](#18-performance-characteristics)
19. [Implementation Checklist](#19-implementation-checklist)
20. [Fact Store (SPO Triple Store)](#20-fact-store-spo-triple-store)
21. [Rule Engine](#21-rule-engine)
22. [Inference Engine](#22-inference-engine)
23. [Case-Based Reasoning (CBR)](#23-case-based-reasoning-cbr)
24. [Ontology Management](#24-ontology-management)
25. [Reasoning Engine](#25-reasoning-engine)
26. [TypeDB Agent Tools](#26-typedb-agent-tools)

---

## 1. System Overview

The memory system provides persistent, searchable, hierarchically organized memory for autonomous LLM agents operating within a BDI (Belief-Desire-Intention) cognitive framework. It solves three problems:

1. **Context window limits** — LLMs forget everything after compaction. The memory system externalizes durable knowledge to files and databases so it survives across sessions.
2. **Flat recall** — Naive file-based memory is append-only and unsearchable. The system adds hybrid search (BM25 + vector), recursive query refinement, and time-hierarchical rollups.
3. **Information overload** — Raw memories accumulate without structure. Recursive consolidation compresses related items, and the BDI cycle prunes stale beliefs.

### Design Principles

- **Files are the source of truth.** JSON and Markdown files on disk are the authoritative store. All secondary backends (SQLite, TypeDB) are best-effort write-through.
- **Graceful degradation.** Every operation succeeds even if TypeDB is unreachable, embedding providers are offline, or the vector index is empty. Fallback paths always exist.
- **Materialization over inference.** Rather than computing summaries on demand, the system materializes derived artifacts (weekly digests, consolidated memories) as Markdown files that existing indexers automatically discover.
- **Agent-scoped isolation.** Each agent has its own memory store, cognitive files, and namespace. Cross-agent queries are only possible through the TypeDB graph layer.

---

## 2. Tech Stack

### Required

| Component            | Version    | Purpose                                                    |
| -------------------- | ---------- | ---------------------------------------------------------- |
| Node.js              | >= 22.12.0 | Runtime                                                    |
| TypeScript           | >= 5.9     | Language (strict mode, ES2023 target, NodeNext modules)    |
| @sinclair/typebox    | ^0.34      | Runtime type validation for tool parameters                |
| SQLite (node:sqlite) | Built-in   | Native search index (BM25 via FTS5, vector via sqlite-vec) |
| Filesystem           | POSIX      | Markdown + JSON storage (the source of truth)              |

### Optional

| Component          | Version  | Purpose                                                                     |
| ------------------ | -------- | --------------------------------------------------------------------------- |
| TypeDB             | 3.0+     | Knowledge graph for relational BDI reasoning                                |
| Embedding provider | Any      | Vector embeddings (OpenAI text-embedding-3-small, Gemini, Voyage, or local) |
| Vitest             | >= 4.0   | Test framework                                                              |
| pnpm               | >= 10.23 | Package manager                                                             |

### Key Dependencies

```json
{
  "typescript": "^5.9.3",
  "@sinclair/typebox": "^0.34",
  "vitest": "^4.0.18"
}
```

Node.js built-ins used: `node:fs/promises`, `node:path`, `node:crypto` (for hashing), `node:sqlite` (for FTS5/vector search).

---

## 3. Architecture Layers

```
┌──────────────────────────────────────────────────────────────────┐
│  Agent Tools (LLM-callable)                                      │
│  memory_store_item · memory_recall · memory_consolidate          │
│  memory_checkpoint · memory_build_hierarchy · memory_hierarchy_  │
│  search · memory_status                                          │
├──────────────────────────────────────────────────────────────────┤
│  Memory Logic Layer                                              │
│  ├── Three-Store Model (working / short-term / long-term)        │
│  ├── R1: Consolidation (grouping + summarization)                │
│  ├── R4: Recursive Search (iterative query refinement)           │
│  └── R3: Checkpoints (structured session state)                  │
├──────────────────────────────────────────────────────────────────┤
│  Materialization Pipeline                                        │
│  ├── Memory Items → mabos-memory-items.md                        │
│  ├── BDI State → mabos-beliefs.md                                │
│  ├── Facts → mabos-facts.md                                      │
│  └── R2: Time Hierarchy → weekly/ monthly/ quarterly/            │
├──────────────────────────────────────────────────────────────────┤
│  Storage Backends (dual-write)                                   │
│  ├── Primary: JSON files (memory-store.json)                     │
│  ├── Primary: Markdown files (memory/*.md, MEMORY.md)            │
│  ├── Secondary: SQLite (FTS5 + sqlite-vec) — native search       │
│  └── Tertiary: TypeDB (knowledge graph) — best-effort            │
├──────────────────────────────────────────────────────────────────┤
│  BDI Runtime (background heartbeat)                              │
│  ├── Intention pruning (deadline + stall detection)              │
│  ├── Desire re-prioritization                                    │
│  ├── R5: Chunked belief processing                               │
│  └── R5: Conflict detection → memory/bdi-conflicts/              │
├──────────────────────────────────────────────────────────────────┤
│  Knowledge Management Layer                                      │
│  ├── Fact Store (SPO triples, confidence, temporal validity)     │
│  ├── Rule Engine (inference · constraint · policy)               │
│  ├── Inference Engine (forward · backward · abductive)           │
│  ├── CBR (case-based reasoning, S(B,D) = F(Sb ∩ Sd))           │
│  ├── Ontology Management (propose · validate · merge)            │
│  └── Reasoning (35 methods, meta-reasoning router, fusion)       │
└──────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Write path**: Tool call → JSON store update → Markdown daily log append → Materialized index file regeneration → (best-effort) TypeDB insert → (best-effort) Native search index sync
2. **Read path**: Load JSON store → Merge TypeDB results (if available) → Filter by type/importance → Apply search (semantic or recursive) → Update access counts → Return results
3. **Consolidation path**: Identify candidates (importance >= threshold OR access count >= threshold) → Group by tag similarity → Summarize groups → Write to long-term store → Materialize → Bridge to native MEMORY.md

---

## 4. Data Structures

### MemoryItem

The atomic unit of memory. Every memory in every store is a MemoryItem.

```typescript
type MemoryItem = {
  id: string; // Unique ID, format: "M-{timestamp}-{random4}"
  content: string; // The memory content (natural language)
  type: MemoryType; // Categorization (see below)
  importance: number; // 0.0 to 1.0, affects consolidation priority
  source: string; // Origin: "manual", "bdi-cycle", "inference", "consolidation", etc.
  tags: string[]; // Free-form tags for grouping and retrieval
  created_at: string; // ISO 8601 timestamp
  accessed_at: string; // Updated on each recall
  access_count: number; // Incremented on each recall
  derived_from?: string[]; // R1: IDs of source memories (for consolidated items)
};

type MemoryType = "event" | "decision" | "outcome" | "lesson" | "fact" | "observation";
```

### MemoryStore

The complete in-memory state for one agent. Persisted as `memory-store.json`.

```typescript
type MemoryStore = {
  working: MemoryItem[]; // Max 7 items (Miller's Law)
  short_term: MemoryItem[]; // Max 200 items, 2-hour TTL
  long_term: MemoryItem[]; // Unlimited, persistent
  version: number; // Incremented on every save (optimistic concurrency)
};
```

### ID Format

All memory IDs follow the pattern `M-{Date.now()}-{random(4)}`, e.g., `M-1708800000000-a3f2`. This ensures:

- Temporal ordering via lexicographic sort
- Collision avoidance via random suffix
- Human readability in logs and materialized files

---

## 5. Three-Store Memory Model

Inspired by the Atkinson-Shiffrin model of human memory.

### Working Memory (7 items)

- **Capacity**: 7 items (Miller's Law)
- **Purpose**: Immediate context for the current task
- **Eviction**: When full, oldest item is demoted to short-term
- **Persistence**: Saved to JSON but conceptually ephemeral

### Short-Term Memory (200 items, 2-hour TTL)

- **Capacity**: 200 items
- **TTL**: 2 hours from creation (configurable via `SHORT_TERM_TTL_MS`)
- **Eviction**: Expired items pruned on every access. When full, lowest-importance item evicted.
- **Purpose**: Recent observations, intermediate findings, session-scoped facts

### Long-Term Memory (unlimited, persistent)

- **Capacity**: Unlimited
- **TTL**: None (permanent)
- **Source**: Items promoted from short-term via consolidation, or stored directly
- **Purpose**: Durable knowledge — lessons learned, validated decisions, key facts

### Store Transitions

```
                ┌──────────────┐
   direct       │   Working    │  overflow (>7)
   store ──────>│   Memory     │─────────────────┐
                │   (7 max)    │                  │
                └──────────────┘                  v
                ┌──────────────┐           ┌──────────────┐
   direct       │  Short-Term  │  consolidate  │  Long-Term   │
   store ──────>│   Memory     │──────────────>│   Memory     │
                │  (200, 2hr)  │               │  (permanent) │
                └──────────────┘               └──────────────┘
                       │                              ^
                       │         direct store         │
                       └──────────────────────────────┘
```

### Persistence

The entire `MemoryStore` is serialized as `agents/{agent_id}/memory-store.json`. Every mutation increments `version` for optimistic concurrency detection.

---

## 6. R1: Recursive Memory Consolidation

### Problem

Verbatim promotion copies items one-to-one from short-term to long-term, producing an ever-growing flat list of redundant entries.

### Solution

Group related candidates by tag overlap, then compress each group into a single narrative summary with lineage tracking.

### Algorithm

#### Step 1: Identify Candidates

```
candidates = short_term.filter(i => i.importance >= threshold OR i.access_count >= min_access)
candidates += working.filter(i => i.importance >= threshold)
```

Default thresholds: importance >= 0.6, access_count >= 2.

#### Step 2: Group by Tag Similarity

Uses Jaccard similarity on tag sets with a threshold of 0.3:

```
jaccard(A, B) = |A ∩ B| / |A ∪ B|

function groupRelatedMemories(items):
  groups = []
  assigned = Set()
  for item in items:
    if item.id in assigned: continue
    group = [item]
    assigned.add(item.id)
    for other in items:
      if other.id in assigned: continue
      if jaccard(item.tags, other.tags) > 0.3:
        group.append(other)
        assigned.add(other.id)
    groups.append(group)
  return groups
```

This is a greedy single-pass clustering. Items with no tag overlap form singleton groups (promoted verbatim).

#### Step 3: Summarize Each Group

```
function summarizeMemoryGroup(group):
  if group.length == 1: return group[0]

  return MemoryItem {
    id: new unique ID,
    content: "[Consolidated from {n} memories] " + group.map(g => g.content).join(" | "),
    type: type of highest-importance item,
    importance: max(group.map(g => g.importance)),
    tags: union(group.map(g => g.tags)),
    derived_from: group.map(g => g.id),
    source: "consolidation",
  }
```

#### Step 4: Promote

Remove original candidates from short-term. Add summarized items to long-term. Write to native `MEMORY.md` and materialize.

### Compression Ratio

Typical ratio is 3-5x on related items. Groups average 3-5 items when tags overlap. Singleton groups pass through at 1:1.

### Lineage Tracking

The `derived_from` field creates a provenance chain. Materialized Markdown includes this field so it's searchable:

```markdown
- **Derived from:** M-1708800000-a3f2, M-1708800100-b4c1, M-1708800200-d5e3
```

---

## 7. R2: Hierarchical Memory Index

### Problem

Flat daily logs make it impossible to answer questions about trends, patterns, or themes across weeks or months without reading every file.

### Solution

Materialize time-hierarchy summaries at three granularities: weekly, monthly, and quarterly.

### File Structure

```
agents/{agent_id}/memory/
├── 2026-02-17.md          # Daily log
├── 2026-02-18.md
├── 2026-02-19.md
├── weekly/
│   └── 2026-W08.md        # Weekly digest (Mon-Sun)
├── monthly/
│   └── 2026-02.md          # Monthly themes
└── quarterly/
    └── 2026-Q1.md           # Quarterly review
```

### Build Algorithm

**Weekly**: Read all `memory/YYYY-MM-DD.md` files for a given Monday–Sunday range. Concatenate with day headers.

**Monthly**: Read all `weekly/YYYY-Www.md` files for weeks overlapping the month. Also read any daily files for the month directly.

**Quarterly**: Read all `monthly/YYYY-MM.md` files for the three months in the quarter.

### ISO Week Calculation

```
function getISOWeek(date):
  d = UTC date copy
  dayNum = d.dayOfWeek || 7   // Monday=1, Sunday=7
  d.date += 4 - dayNum         // Nearest Thursday
  yearStart = Jan 1 of d.year
  week = ceil(((d - yearStart) / 86400000 + 1) / 7)
  return { year: d.year, week }
```

### Monday Detection

```
function getMonday(date):
  d = copy of date
  day = d.dayOfWeek
  diff = d.date - day + (day == 0 ? -6 : 1)
  d.date = diff
  return d
```

### Tools

**`memory_build_hierarchy`**: Scans daily logs, discovers unique weeks/months/quarters, builds missing summaries. Parameters: `agent_id`, optional `scope` (week/month/quarter/all), optional `since` (ISO date).

**`memory_hierarchy_search`**: Substring search within files at a specific level. Parameters: `agent_id`, `query`, `level` (daily/weekly/monthly/quarterly), optional `limit`.

### Auto-Indexing

Materialized files land in `memory/` subdirectories. Any file watcher monitoring `memory/**/*.md` (e.g., chokidar) will automatically index them for BM25 + vector search.

---

## 8. R3: Context-Aware Pre-Compaction Checkpoints

### Problem

When an LLM's context window fills up and compaction occurs, the agent loses its working state — what it was doing, what decisions were pending, what it planned to do next.

### Solution

Before compaction, write a structured checkpoint file that captures session state in a format the agent can quickly re-ingest after compaction.

### Trigger

The memory flush fires when:

```
totalTokens >= contextWindow - reserveTokensFloor - softThresholdTokens
```

Default values: `softThresholdTokens = 4000`, `reserveTokensFloor = 8000`.

### Checkpoint File Format

Written to `memory/checkpoints/YYYY-MM-DD-HHmm.md`:

```markdown
# Session Checkpoint — 2026-02-24 14:30 UTC

## Current Task Context

Implementing RLM-inspired memory enhancements for the MABOS extension.

## Active Decisions

- Use Jaccard similarity (threshold 0.3) for memory grouping
- Cap recursive search depth at 3

## Key Findings

- TypeDB integration is best-effort; JSON files are source of truth
- Materializer auto-indexes via chokidar file watcher

## Next Steps

- Add tests for R1, R3, R4
- Run integration verification

## Open Questions

- Should weekly summaries auto-build on Sundays?
```

### Checkpoint Tool Parameters

```typescript
{
  agent_id: string,                    // Required
  context: string,                     // What the agent was working on
  decisions?: string[],                // Active decisions
  findings?: string[],                 // Key findings
  next_steps?: string[],               // Planned next actions
  open_questions?: string[],           // Unresolved questions
}
```

### Latest Checkpoint Resolution

```
function resolveLatestCheckpoint(agent_id):
  dir = memory/checkpoints/
  files = listdir(dir).filter(f => f.endsWith(".md")).sort()
  if files.length == 0: return null
  return readFile(files[last])
```

Lexicographic sort of `YYYY-MM-DD-HHmm.md` filenames guarantees temporal ordering.

### Flush Prompt

The enhanced flush prompt instructs the agent to:

1. Store durable memories to `memory/YYYY-MM-DD.md` (append only)
2. Write a session checkpoint to `memory/checkpoints/YYYY-MM-DD-HHmm.md`
3. Reply with a silent token if nothing to store

---

## 9. R4: Recursive Memory Search

### Problem

Single-pass search finds direct matches but misses indirect connections. If memory A mentions "market" and memory B mentions "enterprise" (found in A), a search for "market" never discovers B.

### Solution

Iterative query refinement: search, extract new terms from results, refine the query, search again. Each iteration discovers items one hop further from the original query.

### Algorithm

```
function recursiveMemorySearch(query, maxDepth, limit, allItems):
  accumulatedIds = Set()
  results = []
  currentQuery = query

  for depth in 0..maxDepth:
    if results.length >= limit: break

    q = currentQuery.toLowerCase()
    matching = allItems
      .filter(i => i.id not in accumulatedIds)
      .filter(i => i.content.toLowerCase().includes(q)
                 OR i.tags.any(t => t.toLowerCase().includes(q)))

    for m in matching:
      accumulatedIds.add(m.id)
      results.append({...m, _depth: depth})

    if depth < maxDepth AND matching.length > 0:
      // Extract terms from results not in original query
      queryTerms = Set(q.split(/\s+/))
      newTerms = Set()
      for item in matching[0..5]:
        words = item.content.toLowerCase()
          .replace(/[^\w\s]/g, "")
          .split(/\s+/)
          .filter(w => w.length > 3 AND w not in queryTerms)
        newTerms.addAll(words)

      if newTerms.size == 0: break
      currentQuery = query + " " + newTerms.take(3).join(" ")

  return results[0..limit]
```

### Depth Cap

Maximum depth is capped at 3 to prevent runaway recursion. Depths beyond 3 add noise without meaningful recall improvement.

### Output Format

Results include depth annotations so the consumer knows which iteration discovered each item:

```
- **M-123** [long_term] [decision] (imp: 0.8, depth: 0) — Direct market analysis
- **M-456** [short_term] [fact] (imp: 0.6, depth: 1) — Enterprise billing (via refinement)
```

### Query Refinement Heuristic

The refinement step is deliberately lightweight (no LLM call):

1. Take top 5 results from current depth
2. Extract words longer than 3 characters from their content
3. Remove words already in the original query
4. Take the first 3 novel terms
5. Append them to the original query

This avoids latency from LLM calls while expanding search breadth. The tradeoff is that refinement is keyword-based rather than semantic.

### Integration with Semantic Search

When `recursive_depth > 0`, the recursive search replaces the standard semantic/substring path. When `recursive_depth == 0` (default), the existing hybrid semantic search (BM25 + vector re-scoring) is used unchanged.

---

## 10. R5: BDI Recursive Reasoning Loop

### Problem

The BDI maintenance heartbeat processes beliefs, desires, and intentions as monolithic strings. When an agent accumulates 50+ belief sections, processing becomes unwieldy and conflicts go undetected.

### Solution

Chunk belief processing into manageable segments and add cross-belief conflict detection.

### Chunked Processing

```
BELIEF_CHUNK_SIZE = 50  // sections per chunk

function processBeliefChunks(beliefs, processor, chunkSize):
  sections = beliefs.split(/(?=^## )/m).filter(Boolean)
  if sections.length <= chunkSize:
    return processor(beliefs)

  chunks = []
  for i in range(0, sections.length, chunkSize):
    chunks.append(sections[i..i+chunkSize].join("\n"))

  totalPruned = 0
  processed = []
  for chunk in chunks:
    result = processor(chunk)
    totalPruned += result.pruned
    processed.append(result.updated)

  return { totalPruned, result: processed.join("\n") }
```

### Conflict Detection

```
function detectBeliefConflicts(beliefs):
  blocks = beliefs.split(/(?=^## )/m).filter(Boolean)
  conflicts = []

  parsed = blocks.map(block => {
    heading = block.firstLine.replace(/^## /, "").trim()
    certainty = extractFloat(block, /certainty:\s*([\d.]+)/) ?? 0.5
    subject = heading.toLowerCase().stripNonAlphanumeric()
    return { heading, subject, certainty, block }
  })

  for i in 0..parsed.length:
    for j in i+1..parsed.length:
      a = parsed[i], b = parsed[j]
      if a.subject == b.subject
         AND a.certainty > 0.6
         AND b.certainty > 0.6
         AND a.block != b.block:
        conflicts.append({
          belief1: a.heading,
          belief2: b.heading,
          reason: "Both have high certainty ({a.certainty}, {b.certainty}) but different content"
        })

  return conflicts
```

### Conflict Reports

Written to `memory/bdi-conflicts/YYYY-MM-DD.md`:

```markdown
# BDI Conflict Report — 2026-02-24

> 2 conflict(s) detected during maintenance cycle.

## Conflict 1

- **Belief A:** Market demand is growing
- **Belief B:** Market demand is declining
- **Reason:** Both have high certainty (0.85, 0.78) but different content
```

### Enhanced BDI Cycle Result

```typescript
interface BdiCycleResult {
  agentId: string;
  staleIntentionsPruned: number;
  desiresPrioritized: number;
  conflictsDetected: number;
  chunksProcessed: number;
  timestamp: string;
}
```

### Maintenance Cycle Flow

1. **Prune stale intentions**: Check deadline markers (`[deadline: YYYY-MM-DD]`), mark expired. Check stall markers (`[updated: YYYY-MM-DD]`), mark stalled if beyond threshold.
2. **Re-sort desires**: Parse `priority:` values from desire blocks, sort descending.
3. **Count belief chunks**: Split beliefs into sections, calculate chunk count.
4. **Detect conflicts**: Run pairwise comparison on belief subjects.
5. **Write conflict report**: If conflicts found, write to `memory/bdi-conflicts/`.

### Commitment Strategies

The stall threshold varies by commitment strategy:

| Strategy              | Stall Threshold | Behavior                                |
| --------------------- | --------------- | --------------------------------------- |
| single-minded         | Never           | Only expire past deadline               |
| open-minded (default) | 7 days          | Expire past deadline + stalled > 7 days |
| cautious              | 3 days          | Expire past deadline + stalled > 3 days |

---

## 11. Native Search Layer

The native search layer is a SQLite-backed hybrid search engine that indexes all Markdown files in the `memory/` directory.

### Storage

- **Database**: SQLite via `node:sqlite`
- **Location**: `~/.openclaw/memory/{agentId}.sqlite`
- **Tables**:
  - `files` — file metadata (path, hash, mtime, size)
  - `chunks` — text chunks with embeddings
  - `chunks_fts` — FTS5 virtual table (BM25 ranking)
  - `chunks_vec` — sqlite-vec extension (cosine distance)
  - `embedding_cache` — cached embeddings by provider/model/hash

### Chunking

```
chunkTokens: 400      // ~1600 characters per chunk
chunkOverlap: 80      // ~320 characters overlap
```

### Hybrid Search Pipeline

```
Query
  ├──> FTS5 BM25 Search ──> text scores
  ├──> Vector Cosine Search ──> vector scores
  └──> Hybrid Merge: score = 0.7 * vector + 0.3 * text
       └──> Optional MMR re-ranking (diversity)
       └──> Optional temporal decay (exp(-λ * age_days))
       └──> Top 6 results (default)
```

### Defaults

| Parameter           | Value                                     |
| ------------------- | ----------------------------------------- |
| maxResults          | 6                                         |
| minScore            | 0.35                                      |
| candidateMultiplier | 4 (24 intermediate candidates)            |
| vectorWeight        | 0.7                                       |
| textWeight          | 0.3                                       |
| MMR                 | disabled (λ=0.7 when enabled)             |
| Temporal decay      | disabled (half-life=30 days when enabled) |

### Embedding Providers

| Provider      | Default Model          |
| ------------- | ---------------------- |
| OpenAI        | text-embedding-3-small |
| Google Gemini | gemini-embedding-001   |
| Voyage AI     | voyage-4-large         |
| Local         | Custom model path      |

Falls back to FTS-only mode if no embedding provider is configured.

---

## 12. TypeDB Knowledge Graph Layer

### Purpose

TypeDB provides graph-native relation traversal that flat file search cannot replicate. It is entirely optional — the system works without it.

### Schema (auto-generated from SBVR ontology)

**Entities**: agent, belief, desire, goal, intention, plan, plan_step, persona, skill, workflow, task, decision, spo_fact, knowledge_rule, cbr_case, memory_item, action_execution, reasoning_method, reasoning_result

**Relations**: agent_owns, belief_supports_goal, desire_motivates_goal, goal_requires_plan, plan_contains_step, step_depends_on, agent_has_skill, agent_has_persona, method_produces_result, decision_resolves_goal

**Attributes**: 60+ (uid, name, certainty, priority, urgency, alignment, hierarchy_level, progress, status, commitment_strategy, etc.)

### Write-Through Pattern

```
Tool Call
  |
  +-> Write JSON/Markdown     (always succeeds)
  |
  +-> Try Write TypeDB         (best-effort)
       |-> Success: now queryable via TypeQL
       |-> Failure: logged, JSON is authoritative
```

### Read-Merge Pattern

```
items = loadFromJSON()                    // Always works
try:
  typedbItems = queryTypeDB()             // Best-effort
  items += typedbItems.dedupById(items)   // Merge, no duplicates
catch: pass                               // Continue with JSON only
```

### What TypeDB Enables That Files Don't

1. **Multi-hop relation traversal**: `belief → supports → goal → requires → plan` in one query
2. **Cross-agent aggregation**: "Which strategic goals are behind across all 9 agents?"
3. **Typed ontology validation**: Business entities have semantic roles (customer buys product)
4. **Conflict impact analysis**: R5 conflicts can be traced to the goals they affect

### Connection Details

```
Default URL: http://localhost:8729
Database naming: mabos_{business_id}
Authentication: admin/password
Driver: typedb-driver-http v3.0.0
```

---

## 13. Materialization Pipeline

Rather than searching raw JSON at query time, the system materializes structured data as Markdown files that existing indexers (BM25 + vector) automatically discover.

### Materializers

| Materializer                 | Input                              | Output                       | Trigger                 |
| ---------------------------- | ---------------------------------- | ---------------------------- | ----------------------- |
| `materializeMemoryItems`     | memory-store.json                  | memory/mabos-memory-items.md | After store/consolidate |
| `materializeFacts`           | facts.json                         | memory/mabos-facts.md        | After fact_assert       |
| `materializeBeliefs`         | Beliefs.md + Desires.md + Goals.md | memory/mabos-beliefs.md      | After BDI mutation      |
| `materializeWeeklySummary`   | memory/YYYY-MM-DD.md (7 days)      | memory/weekly/YYYY-Www.md    | On hierarchy build      |
| `materializeMonthlySummary`  | memory/weekly/\*.md                | memory/monthly/YYYY-MM.md    | On hierarchy build      |
| `materializeQuarterlyReview` | memory/monthly/\*.md               | memory/quarterly/YYYY-Qq.md  | On hierarchy build      |

### Materialized File Format

Each materialized file uses consistent Markdown structure with metadata fields that the search indexer can match:

```markdown
# MABOS Memory Items — {agent_id}

> Auto-materialized from memory-store.json. {n} long-term, {m} short-term items.

## [long_term] decision: Revenue model validated...

- **ID:** M-1708800000-a3f2
- **Store:** long_term
- **Type:** decision
- **Importance:** 0.9
- **Source:** inference
- **Tags:** revenue, validation
- **Derived from:** M-1708799000-b1c2, M-1708799100-c2d3
- **Created:** 2026-02-24T14:30:00.000Z

Revenue model validated by customer interviews...
```

### Auto-Indexing

Any file watcher monitoring `agents/{id}/memory/**/*.md` will pick up materialized files. No registration or configuration needed — just write the file and the indexer discovers it.

---

## 14. BDI Cognitive Architecture

Each agent has 10 cognitive files stored in `agents/{agent_id}/`:

| File            | Purpose                                            |
| --------------- | -------------------------------------------------- |
| Persona.md      | Role definition, title, department, autonomy level |
| Capabilities.md | Skills, tool access, proficiency levels            |
| Beliefs.md      | Current knowledge state (with certainty levels)    |
| Desires.md      | Motivations and priorities                         |
| Goals.md        | Strategic/tactical/operational objectives          |
| Intentions.md   | Committed actions (with deadlines, status)         |
| Plans.md        | Multi-step action plans                            |
| Commitments.md  | External commitments and obligations               |
| Learnings.md    | Accumulated lessons and insights                   |
| Memory.md       | Legacy memory file (human-readable log)            |

### Heartbeat Cycle

The BDI maintenance service runs on a configurable interval (default: 30 minutes):

1. Discover all agent directories in workspace
2. For each agent, read cognitive state
3. Run maintenance cycle (prune intentions, sort desires, detect conflicts)
4. Write updates back to files
5. Log cycle results

---

## 15. File Layout & Conventions

```
workspace/
└── agents/
    └── {agent_id}/
        ├── agent.json                    # Agent manifest (BDI config)
        ├── Persona.md                    # Role definition
        ├── Beliefs.md                    # Epistemic state
        ├── Desires.md                    # Motivations
        ├── Goals.md                      # Objectives
        ├── Intentions.md                 # Committed actions
        ├── Plans.md                      # Action plans
        ├── Commitments.md                # Obligations
        ├── Learnings.md                  # Lessons
        ├── Capabilities.md              # Skills
        ├── Memory.md                     # Legacy human-readable log
        ├── MEMORY.md                     # Native long-term memory
        ├── memory-store.json             # Three-store JSON
        ├── facts.json                    # SPO fact store
        ├── rules.json                    # Rule engine rules
        ├── cases.json                    # CBR case base
        ├── Knowledge.md                  # Knowledge base
        ├── Playbooks.md                  # Business playbooks
        └── memory/
            ├── 2026-02-24.md             # Daily log
            ├── 2026-02-23.md
            ├── mabos-memory-items.md     # Materialized memory items
            ├── mabos-facts.md            # Materialized facts
            ├── mabos-beliefs.md          # Materialized BDI state
            ├── checkpoints/
            │   └── 2026-02-24-1430.md    # Session checkpoint
            ├── weekly/
            │   └── 2026-W08.md           # Weekly digest
            ├── monthly/
            │   └── 2026-02.md            # Monthly themes
            ├── quarterly/
            │   └── 2026-Q1.md            # Quarterly review
            └── bdi-conflicts/
                └── 2026-02-24.md         # Conflict report
```

### Naming Conventions

- Daily logs: `YYYY-MM-DD.md`
- Checkpoints: `YYYY-MM-DD-HHmm.md` (HHmm with colon stripped)
- Weekly: `YYYY-Www.md` (ISO week, zero-padded)
- Monthly: `YYYY-MM.md`
- Quarterly: `YYYY-Qq.md`
- Conflict reports: `YYYY-MM-DD.md`

---

## 16. API Surface (Tool Definitions)

### memory_store_item

Store an item in working, short-term, or long-term memory.

| Parameter  | Type     | Required | Default      | Description                                         |
| ---------- | -------- | -------- | ------------ | --------------------------------------------------- |
| agent_id   | string   | yes      | —            | Agent identifier                                    |
| content    | string   | yes      | —            | Memory content                                      |
| type       | enum     | yes      | —            | event, decision, outcome, lesson, fact, observation |
| importance | number   | yes      | —            | 0.0–1.0                                             |
| source     | string   | no       | "manual"     | Origin identifier                                   |
| tags       | string[] | no       | []           | Tags for retrieval                                  |
| store      | enum     | no       | "short_term" | working, short_term, long_term                      |

### memory_recall

Search across memory stores.

| Parameter       | Type   | Required | Default | Description                         |
| --------------- | ------ | -------- | ------- | ----------------------------------- |
| agent_id        | string | yes      | —       | Agent identifier                    |
| query           | string | no       | —       | Search query                        |
| type            | string | no       | —       | Filter by memory type               |
| store           | enum   | no       | "all"   | working, short_term, long_term, all |
| limit           | number | no       | 20      | Max results                         |
| min_importance  | number | no       | 0       | Minimum importance filter           |
| recursive_depth | number | no       | 0       | R4: recursion depth (max 3)         |

### memory_consolidate

Promote important short-term memories to long-term.

| Parameter        | Type    | Required | Default | Description                           |
| ---------------- | ------- | -------- | ------- | ------------------------------------- |
| agent_id         | string  | yes      | —       | Agent identifier                      |
| min_importance   | number  | no       | 0.6     | Minimum importance threshold          |
| min_access_count | number  | no       | 2       | Minimum access count threshold        |
| dry_run          | boolean | no       | false   | Preview without saving                |
| summarize        | boolean | no       | true    | R1: group and summarize related items |

### memory_checkpoint

Write a structured session checkpoint.

| Parameter      | Type     | Required | Default | Description          |
| -------------- | -------- | -------- | ------- | -------------------- |
| agent_id       | string   | yes      | —       | Agent identifier     |
| context        | string   | yes      | —       | Current task context |
| decisions      | string[] | no       | —       | Active decisions     |
| findings       | string[] | no       | —       | Key findings         |
| next_steps     | string[] | no       | —       | Next steps to resume |
| open_questions | string[] | no       | —       | Open questions       |

### memory_build_hierarchy

Build time-hierarchy summaries from daily logs.

| Parameter | Type   | Required | Default | Description               |
| --------- | ------ | -------- | ------- | ------------------------- |
| agent_id  | string | yes      | —       | Agent identifier          |
| scope     | enum   | no       | "all"   | week, month, quarter, all |
| since     | string | no       | —       | Start date (ISO)          |

### memory_hierarchy_search

Search at a specific granularity level.

| Parameter | Type   | Required | Default | Description                       |
| --------- | ------ | -------- | ------- | --------------------------------- |
| agent_id  | string | yes      | —       | Agent identifier                  |
| query     | string | yes      | —       | Search query                      |
| level     | enum   | yes      | —       | daily, weekly, monthly, quarterly |
| limit     | number | no       | 10      | Max results                       |

### memory_status

Show memory store counts and recent items.

| Parameter | Type   | Required | Default | Description      |
| --------- | ------ | -------- | ------- | ---------------- |
| agent_id  | string | yes      | —       | Agent identifier |

---

## 17. Testing Strategy

### Test Environment Setup

Tests use a temporary workspace directory (`mkdtemp`) with a mock plugin API that captures tool registrations. No external services (TypeDB, embedding providers) are needed.

```typescript
const api = {
  config: { agents: { defaults: { workspace: tmpWorkspace } } },
  registerTool: (tool) => {
    tools.push(tool);
    toolMap.set(tool.name, tool);
  },
  registerService: () => {},
  // ... other no-op stubs
};
register(api);
```

### Test Categories

| Category                   | What to Test                                                                            |
| -------------------------- | --------------------------------------------------------------------------------------- |
| Store operations           | Store to each store, verify JSON persistence, verify daily log write                    |
| Consolidation (R1)         | Store 5+ related items, consolidate with summarize=true, verify grouping + derived_from |
| Consolidation (no summary) | Consolidate with summarize=false, verify individual promotion                           |
| Checkpoint (R3)            | Write checkpoint, verify file structure and all sections                                |
| Recursive search (R4)      | Store indirectly related items, search with depth=1, verify multi-hop discovery         |
| Standard search            | Search with depth=0, verify no depth annotations                                        |
| Backward compat            | Verify Memory.md, memory-store.json, MEMORY.md all still written                        |
| Dry run                    | Consolidate with dry_run=true, verify no state mutation                                 |

### Verification Commands

```bash
# Run memory tests
npx vitest run extensions/mabos/tests/memory-bridge.test.ts

# Run all MABOS tests
npx vitest run extensions/mabos/tests/

# Run with verbose output
npx vitest run extensions/mabos/tests/ --reporter=verbose
```

---

## 18. Performance Characteristics

| Operation                        | Typical Latency | Bottleneck                                        |
| -------------------------------- | --------------- | ------------------------------------------------- |
| memory_store_item                | 5-15ms          | Filesystem write (JSON + 2 Markdown files)        |
| memory_recall (depth=0)          | 15-50ms         | Semantic search (if embedding provider available) |
| memory_recall (depth=1)          | 30-80ms         | 2x search passes + term extraction                |
| memory_recall (depth=3)          | 60-150ms        | 4x search passes                                  |
| memory_consolidate (10 items)    | 20-50ms         | Grouping + JSON write + materialization           |
| memory_checkpoint                | 2-5ms           | Single file write                                 |
| memory_build_hierarchy (30 days) | 100-300ms       | Reading 30 daily files + writing summaries        |
| BDI maintenance cycle (1 agent)  | 10-30ms         | File reads + intention parsing                    |
| TypeDB write-through             | +50-200ms       | Network round-trip (async, non-blocking)          |

### Scaling Characteristics

- **Memory store size**: Linear read/write. At 10,000+ long-term items, consider sharding by date.
- **Consolidation**: O(n²) for grouping (pairwise tag comparison). At 1,000+ candidates, batch by date first.
- **Recursive search**: O(depth × n) where n is store size. Capped at depth 3.
- **Hierarchy build**: O(days) for weekly, O(weeks) for monthly, O(months) for quarterly. All sequential reads.
- **Conflict detection**: O(n²) pairwise comparison on belief headings. Practical limit ~500 beliefs.

---

## 19. Implementation Checklist

For engineers building this system from scratch:

### Phase 1: Core Memory (MVP)

- [ ] Define MemoryItem type with all fields including derived_from
- [ ] Implement MemoryStore (working/short-term/long-term) with JSON persistence
- [ ] Implement memory_store_item with store selection and eviction
- [ ] Implement memory_recall with substring search and importance/recency scoring
- [ ] Implement memory_status
- [ ] Write daily log files (memory/YYYY-MM-DD.md) on every store
- [ ] Write MEMORY.md on consolidation

### Phase 2: Consolidation (R1)

- [ ] Implement Jaccard similarity function
- [ ] Implement groupRelatedMemories (greedy clustering, threshold 0.3)
- [ ] Implement summarizeMemoryGroup (merge content, union tags, max importance, derived_from)
- [ ] Add summarize parameter to consolidation
- [ ] Update materializer to include derived_from in output

### Phase 3: Search Enhancement (R4)

- [ ] Implement recursiveMemorySearch (iterative deepening with query refinement)
- [ ] Add recursive_depth parameter to recall
- [ ] Add depth annotations to output format
- [ ] Cap depth at 3

### Phase 4: Checkpoints (R3)

- [ ] Implement memory_checkpoint tool
- [ ] Implement resolveLatestCheckpoint
- [ ] Enhance pre-compaction flush prompt to request checkpoints
- [ ] Create memory/checkpoints/ directory structure

### Phase 5: Hierarchy (R2)

- [ ] Implement ISO week calculation
- [ ] Implement materializeWeeklySummary
- [ ] Implement materializeMonthlySummary
- [ ] Implement materializeQuarterlyReview
- [ ] Implement memory_build_hierarchy tool
- [ ] Implement memory_hierarchy_search tool

### Phase 6: BDI Integration (R5)

- [ ] Implement processBeliefChunks (section-based splitting)
- [ ] Implement detectBeliefConflicts (pairwise heading comparison)
- [ ] Write conflict reports to memory/bdi-conflicts/
- [ ] Add conflictsDetected and chunksProcessed to cycle results
- [ ] Implement commitment strategy-aware stall thresholds

### Phase 7: Search Backend (optional)

- [ ] Set up SQLite with FTS5 and sqlite-vec
- [ ] Implement chunking pipeline (400 tokens, 80 overlap)
- [ ] Implement hybrid merge (0.7 vector + 0.3 text)
- [ ] Configure embedding provider
- [ ] Set up file watcher for auto-sync

### Phase 8: Knowledge Graph (optional)

- [ ] Set up TypeDB connection with graceful degradation
- [ ] Implement write-through pattern (JSON primary, TypeDB secondary)
- [ ] Implement read-merge pattern (JSON + TypeDB deduplicated)
- [ ] Convert SBVR ontology to TypeQL schema
- [ ] Implement BDI relation queries

### Phase 9: Fact Store

- [ ] Define Fact type with SPO, confidence, temporal validity, derivation
- [ ] Implement fact_assert with duplicate detection and upsert
- [ ] Implement fact_retract with ID, subject, and predicate filters
- [ ] Implement fact_query with SPO pattern matching and temporal validity
- [ ] Implement fact_explain with recursive derivation tracing
- [ ] Add TypeDB write-through for facts
- [ ] Add fact materialization (mabos-facts.md)

### Phase 10: Rule Engine

- [ ] Define Rule type with conditions, conclusions, and 3 rule types
- [ ] Implement variable binding in condition patterns (?variable syntax)
- [ ] Implement rule_create with TypeDB write-through
- [ ] Implement rule_list with type filtering
- [ ] Implement rule_toggle for enable/disable
- [ ] Implement constraint_check with severity levels
- [ ] Implement policy_eval for business rule evaluation

### Phase 11: Inference Engine

- [ ] Implement forward chaining with fixed-point iteration
- [ ] Implement condition pattern matching with variable binding
- [ ] Implement confidence propagation (min \* confidence_factor)
- [ ] Implement backward chaining with knowledge gap identification
- [ ] Implement abductive reasoning with hypothesis scoring
- [ ] Implement knowledge_explain combining all inference methods

### Phase 12: Case-Based Reasoning

- [ ] Define Case type with situation, solution, outcome
- [ ] Implement CBR-BDI retrieval algorithm S(B,D) = F(Sb ∩ Sd)
- [ ] Implement cbr_store with deduplication and pruning
- [ ] Configure max case limit (default: 10,000)

### Phase 13: Ontology Management

- [ ] Define JSON-LD/OWL ontology storage format
- [ ] Implement ontology_propose_concept with SBVR metadata
- [ ] Implement ontology_validate_proposal (duplicates, naming, consistency)
- [ ] Implement ontology_merge_approved
- [ ] Implement ontology_scaffold_domain with business templates
- [ ] Convert SBVR ontology (170 concepts, 131 fact types) to JSON-LD

### Phase 14: Reasoning Engine

- [ ] Define 35 reasoning methods across 6 categories
- [ ] Implement meta-reasoning router (scoreMethodsForProblem)
- [ ] Implement single-method invocation (backward compatible)
- [ ] Implement auto-selection via problem classification
- [ ] Implement multi-method fusion with synthesis

---

\*This document describes the MABOS memory system as implemented in OpenClaw-MABOS.

## 20. Fact Store (SPO Triple Store)

### Purpose

The fact store holds structured knowledge as Subject-Predicate-Object (SPO) triples — an RDF-like representation that enables precise querying, inference, and temporal validity tracking.

### Data Structure

```typescript
type Fact = {
  id: string; // Format: "F-{timestamp}-{random4}"
  subject: string; // Entity (e.g., "acme-consulting")
  predicate: string; // Relationship (e.g., "hasRevenue", "isCompetitorOf")
  object: string; // Value (e.g., "$50000", "rival-corp")
  confidence: number; // 0.0–1.0
  source: string; // Provenance (e.g., "cfo-report", "inference")
  valid_from?: string; // Temporal validity start (ISO)
  valid_until?: string; // Temporal validity end (ISO, omit for indefinite)
  derived_from?: string[]; // Fact IDs if inferred
  rule_id?: string; // Rule that derived this fact
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
};

type FactStore = {
  facts: Fact[];
  version: number; // Optimistic concurrency
};
```

### Storage

- **Primary**: `agents/{agent_id}/facts.json`
- **Secondary**: TypeDB (write-through, best-effort)
- **Materialized**: `agents/{agent_id}/memory/mabos-facts.md` (auto-indexed)

### Tools

**`fact_assert`** — Add or update an SPO triple. If an identical (subject, predicate, object) triple exists, it updates confidence/source/validity. Otherwise creates a new fact. Write-through to TypeDB. Triggers materialization.

| Parameter   | Type   | Required | Description           |
| ----------- | ------ | -------- | --------------------- |
| agent_id    | string | yes      | Agent identifier      |
| subject     | string | yes      | Subject entity        |
| predicate   | string | yes      | Relationship/property |
| object      | string | yes      | Object/value          |
| confidence  | number | yes      | 0.0–1.0               |
| source      | string | yes      | Provenance            |
| valid_from  | string | no       | Temporal start (ISO)  |
| valid_until | string | no       | Temporal end (ISO)    |

**`fact_retract`** — Remove facts by ID, subject, or predicate. Supports bulk retraction.

| Parameter | Type   | Required | Description                      |
| --------- | ------ | -------- | -------------------------------- |
| agent_id  | string | yes      | Agent identifier                 |
| fact_id   | string | no       | Specific fact ID                 |
| subject   | string | no       | Retract all facts about subject  |
| predicate | string | no       | Retract all facts with predicate |

**`fact_query`** — Query with SPO pattern matching, confidence filtering, and temporal validity.

| Parameter       | Type    | Required | Description                            |
| --------------- | ------- | -------- | -------------------------------------- |
| agent_id        | string  | yes      | Agent identifier                       |
| subject         | string  | no       | Filter (supports \* wildcard)          |
| predicate       | string  | no       | Filter by predicate                    |
| object          | string  | no       | Filter by object                       |
| min_confidence  | number  | no       | Minimum confidence (default: 0.0)      |
| valid_at        | string  | no       | Check temporal validity at date        |
| include_derived | boolean | no       | Include inferred facts (default: true) |
| limit           | number  | no       | Max results (default: 50)              |

**`fact_explain`** — Trace derivation of a fact. Shows the inference chain: which facts and rules produced this fact, recursively up to 2 levels deep.

| Parameter | Type   | Required | Description        |
| --------- | ------ | -------- | ------------------ |
| agent_id  | string | yes      | Agent identifier   |
| fact_id   | string | yes      | Fact ID to explain |

### Temporal Validity

Facts support time-bounded truth. A fact with `valid_from: "2026-01-01"` and `valid_until: "2026-06-30"` only matches queries where `valid_at` falls within that range. Facts without `valid_until` are indefinitely valid.

### Write-Through Pattern

```
fact_assert called
  |
  +-> Update facts.json                   (always)
  +-> Try TypeDB insert                   (best-effort)
  +-> materializeFacts() → mabos-facts.md (async, best-effort)
```

---

## 21. Rule Engine

### Purpose

The rule engine defines and evaluates three types of rules that operate over the fact store:

1. **Inference rules** — Derive new facts from existing facts (forward chaining)
2. **Constraint rules** — Validate states and flag violations
3. **Policy rules** — Business rules that trigger actions or escalations

### Data Structure

```typescript
type ConditionPattern = {
  subject?: string; // Literal or ?variable
  predicate: string; // Required predicate to match
  object?: string; // Literal or ?variable
  operator?: "eq" | "gt" | "lt" | "gte" | "lte" | "ne" | "contains";
};

type Rule = {
  id: string; // Format: "R-001"
  name: string;
  description: string;
  type: "inference" | "constraint" | "policy";
  conditions: ConditionPattern[]; // All must match for rule to fire
  // Inference rules:
  conclusion?: { subject?: string; predicate: string; object?: string };
  // Constraint rules:
  violation_message?: string;
  severity?: "info" | "warning" | "error" | "critical";
  // Policy rules:
  action?: string;
  escalate?: boolean;
  // Metadata:
  confidence_factor: number; // Multiplier for derived fact confidence (default: 0.9)
  enabled: boolean;
  domain?: string; // Business domain scope
  created_at: string;
};
```

### Storage

- `agents/{agent_id}/rules.json`
- TypeDB write-through (best-effort)

### Variable Binding

Conditions use `?variable` syntax for pattern matching:

```
Condition 1: (?x, hasRevenue, ?y)    // Bind ?x to subject, ?y to object
Condition 2: (?x, locatedIn, "US")   // ?x must match same subject
Conclusion:  (?x, isTaxable, "true") // Use bound ?x in conclusion
```

### Constraint Evaluation

Constraint rules are checked by `constraint_check`. A constraint is **violated** when all its conditions ARE met (the bad state exists):

```
for each enabled constraint rule:
  if ALL conditions match existing facts:
    report violation with severity level
```

### Tools

| Tool               | Purpose                                                       |
| ------------------ | ------------------------------------------------------------- |
| `rule_create`      | Create inference, constraint, or policy rule                  |
| `rule_list`        | List rules, optionally filtered by type                       |
| `rule_toggle`      | Enable/disable a rule                                         |
| `constraint_check` | Evaluate constraints against current facts, report violations |
| `policy_eval`      | Evaluate policy rules against current context                 |

---

## 22. Inference Engine

### Purpose

The inference engine derives new knowledge from existing facts and rules using three reasoning methods: forward chaining, backward chaining, and abductive reasoning.

### Forward Chaining

Applies inference rules to known facts iteratively until no new facts can be derived (fixed-point).

```
function forwardChain(facts, rules, maxIterations=10):
  newFacts = []
  existingTriples = Set(facts.map(f => f.subject|f.predicate|f.object))

  for iter in 0..maxIterations:
    derived = false
    allFacts = facts + newFacts

    for rule in rules where rule.type == "inference" and rule.enabled:
      bindings = matchConditions(rule.conditions, allFacts)

      for binding in bindings:
        conclusion = resolveBinding(rule.conclusion, binding)
        tripleKey = conclusion.subject|conclusion.predicate|conclusion.object

        if tripleKey not in existingTriples:
          supportingFacts = findSupportingFacts(rule.conditions, allFacts, binding)
          confidence = min(supportingFacts.map(f => f.confidence)) * rule.confidence_factor

          newFact = Fact {
            id: "F-inf-{timestamp}-{random4}",
            subject: conclusion.subject,
            predicate: conclusion.predicate,
            object: conclusion.object,
            confidence: confidence,
            source: "inference",
            derived_from: supportingFacts.map(f => f.id),
            rule_id: rule.id,
          }
          newFacts.append(newFact)
          existingTriples.add(tripleKey)
          derived = true

    if not derived: break  // Fixed-point reached

  return newFacts
```

### Confidence Propagation

Derived facts inherit the minimum confidence of their supporting facts, multiplied by the rule's `confidence_factor` (default: 0.9). This ensures derived knowledge degrades gracefully:

```
confidence(derived) = min(confidence(support_1), ..., confidence(support_n)) * rule.confidence_factor
```

After 3 chained inferences: `0.9^3 = 0.729` — automatically lower confidence for deeply derived facts.

### Backward Chaining

Goal-directed reasoning: given a goal triple, find whether it can be proven from existing facts and rules.

```
function backwardChain(goal, facts, rules):
  // 1. Direct match — check if goal triple exists in facts
  direct = facts.filter(f => matches(f, goal))
  if direct.length > 0: return PROVEN with supporting facts

  // 2. Find rules whose conclusion matches the goal predicate
  applicable = rules.filter(r => r.conclusion.predicate == goal.predicate)
  if applicable.length == 0: return CANNOT_PROVE (knowledge gap)

  // 3. Analyze what's needed for each rule
  for rule in applicable:
    satisfied = rule.conditions.filter(c => facts.any(f => matches(f, c)))
    missing = rule.conditions.filter(c => NOT facts.any(f => matches(f, c)))
    report(rule, satisfied, missing)

  return POTENTIALLY_DERIVABLE with knowledge gaps
```

### Abductive Reasoning

Generates hypotheses that explain an observation by finding rules whose conclusions match and scoring by evidence support:

```
score(hypothesis) = (supported_conditions / total_conditions) * confidence_factor
```

Hypotheses are ranked by score. The highest-scored hypothesis is the best explanation given current evidence.

### Tools

| Tool                | Purpose                                                |
| ------------------- | ------------------------------------------------------ |
| `infer_forward`     | Run forward chaining, optionally persist derived facts |
| `infer_backward`    | Goal-directed proof, identify knowledge gaps           |
| `infer_abductive`   | Generate and rank explanatory hypotheses               |
| `knowledge_explain` | Answer questions by combining all inference methods    |

---

## 23. Case-Based Reasoning (CBR)

### Purpose

CBR stores past decision-making episodes (cases) and retrieves similar ones when facing new situations, using the CBR-BDI algorithm.

### Data Structure

```typescript
type Case = {
  case_id: string; // Format: "C-001"
  situation: {
    beliefs: string[]; // Belief IDs active during this case
    desires: string[]; // Desire IDs active during this case
    context: string; // Natural language situation description
  };
  solution: {
    plan_id: string; // Plan that was used
    actions: string[]; // Actions taken
  };
  outcome: {
    success: boolean; // Whether the outcome was positive
    metrics?: Record<string, number>; // Quantitative results
    lessons?: string; // Lessons learned
  };
  stored_at: string; // ISO timestamp
};
```

### Storage

- `agents/{agent_id}/cases.json` (array of Case objects)
- Max cases configurable via `cbrMaxCases` (default: 10,000)

### CBR-BDI Retrieval Algorithm

```
S(B,D) = F(Sb ∩ Sd)

function retrieve(currentBeliefs, currentDesires, cases):
  for each case:
    Sb = |case.beliefs ∩ currentBeliefs| / |case.beliefs|   // Belief overlap
    Sd = |case.desires ∩ currentDesires| / |case.desires|   // Desire overlap
    score = 0.6 * Sb + 0.4 * Sd                             // Weighted similarity

  return cases.sortByScore().take(maxResults)
```

The weighting (60% beliefs, 40% desires) reflects that situational similarity matters more than motivational similarity for plan reuse.

### Tools

| Tool           | Purpose                                           |
| -------------- | ------------------------------------------------- |
| `cbr_retrieve` | Find similar past cases using CBR-BDI scoring     |
| `cbr_store`    | Store a new case (situation + solution + outcome) |

---

## 24. Ontology Management

### Purpose

The ontology management system enables agents to propose, validate, and merge new domain concepts into the knowledge graph. Ontologies are stored as JSON-LD/OWL files and optionally converted to TypeQL schemas for TypeDB.

### Pipeline

```
Agent proposes concept
    |
    v
ontology_propose_concept → proposals/{domain}-proposals.json
    |
    v
Knowledge agent reviews
    |
    v
ontology_validate_proposal → checks consistency, duplicates, naming
    |
    v
ontology_merge_approved → writes to {domain}.jsonld @graph
```

### Ontology Storage (JSON-LD/OWL)

```json
{
  "@context": {
    "owl": "http://www.w3.org/2002/07/owl#",
    "rdfs": "http://www.w3.org/2000/01/rdf-schema#",
    "mabos": "http://mabos.ai/ontology/"
  },
  "@graph": [
    {
      "@id": "mabos:Customer",
      "@type": "owl:Class",
      "rdfs:label": "Customer",
      "rdfs:subClassOf": { "@id": "mabos:BusinessEntity" },
      "mabos:sbvr_definition": "A person or organization that purchases goods or services"
    }
  ]
}
```

### SBVR Ontology

The Semantics of Business Vocabulary and Rules (SBVR) ontology provides the foundational business vocabulary:

- **170 business concepts** organized in a class hierarchy
- **131 fact types** (relationships between concepts)
- **8 business rules** (constraints and obligations)

The SBVR ontology is stored as JSON-LD and automatically converted to TypeQL schema when syncing to TypeDB.

### Proposal Schema

```typescript
type OntologyProposal = {
  id: string;
  domain: string; // Target ontology file
  node_type: "class" | "object_property" | "datatype_property";
  node_id: string; // Qualified ID (e.g., "ecommerce:DropshipFulfillment")
  label: string; // Human-readable name
  parent_class?: string; // Superclass for classes
  domain_class?: string; // Domain for properties
  range?: string; // Range for properties
  sbvr_definition?: string; // Business vocabulary definition
  sbvr_synonyms?: string[]; // Alternative terms
  rationale: string; // Why this concept is needed
  proposed_by: string; // Agent ID
  status: "pending" | "approved" | "rejected";
  validation_result?: object; // From validate step
  proposed_at: string;
};
```

### Validation Checks

The `ontology_validate_proposal` tool checks:

1. **Duplicate detection** — Levenshtein distance < 3 against existing node labels
2. **Naming conventions** — PascalCase for classes, camelCase for properties
3. **Parent validity** — Parent class must exist in the ontology
4. **Semantic consistency** — SBVR definition must be provided

### Domain Scaffolding

`ontology_scaffold_domain` generates a new domain ontology from a business type template. Supported templates:

| Template   | Generated Concepts                                   |
| ---------- | ---------------------------------------------------- |
| saas       | Subscription, Plan, Tier, MRR, ARR, Churn, Trial     |
| ecommerce  | Product, Cart, Order, Fulfillment, Return, Inventory |
| consulting | Engagement, Deliverable, Milestone, SOW, Retainer    |
| agency     | Campaign, Creative, Client, Brief, Approval          |

### Tools

| Tool                         | Purpose                                           |
| ---------------------------- | ------------------------------------------------- |
| `ontology_propose_concept`   | Propose a new class/property with SBVR metadata   |
| `ontology_validate_proposal` | Check consistency, duplicates, naming conventions |
| `ontology_merge_approved`    | Write approved nodes into domain ontology         |
| `ontology_list_proposals`    | List pending proposals awaiting review            |
| `ontology_scaffold_domain`   | Generate domain ontology from business template   |

---

## 25. Reasoning Engine

### Purpose

The reasoning engine provides 35 reasoning methods across 6 categories, accessible through a unified `reason` tool with a meta-reasoning router that selects the optimal method for each problem.

### Categories and Methods

| Category      | Methods                                                                         |
| ------------- | ------------------------------------------------------------------------------- |
| Formal        | deductive, inductive, abductive, analogical, modal, deontic, temporal           |
| Probabilistic | bayesian, decision-theory, expected-utility, info-theory, monte-carlo           |
| Causal        | causal, counterfactual, interventional, root-cause, systems-thinking            |
| Experience    | heuristic, case-based, pattern-recognition, satisficing, naturalistic           |
| Social        | game-theory, negotiation, social-choice, argumentation, stakeholder             |
| Meta          | meta-cognitive, strategy-selection, learning-to-reason, reflection, calibration |

### Invocation Modes

**Mode 1: Explicit method** — Specify `method` parameter directly (backward compatible):

```
reason(agent_id, method="bayesian", problem="...")
```

**Mode 2: Auto-select** — Provide `problem_classification` and let the meta-reasoning router choose:

```
reason(agent_id, problem_classification={
  uncertainty: "high",
  complexity: "complex",
  domain: "empirical",
  time_pressure: "moderate",
  data_availability: "sparse",
  stakes: "high"
}, problem="...")
```

**Mode 3: Multi-method fusion** — Run multiple methods and synthesize:

```
reason(agent_id, multi_method=true, methods=["deductive", "bayesian", "causal"], problem="...")
```

### Meta-Reasoning Router

The `scoreMethodsForProblem` function scores each method based on problem classification:

```
function scoreMethodsForProblem(classification):
  for method in REASONING_METHODS:
    score = 0
    if method.ideal_uncertainty matches classification.uncertainty: score += 0.2
    if method.ideal_complexity matches classification.complexity: score += 0.2
    if method.ideal_domain matches classification.domain: score += 0.3
    if method.ideal_data matches classification.data_availability: score += 0.15
    if method.ideal_stakes matches classification.stakes: score += 0.15
  return methods.sortByScore()
```

### Multi-Method Fusion

When `multi_method=true`, the engine:

1. Runs each selected method independently
2. Collects conclusions from each
3. Identifies agreements and disagreements
4. Produces a unified conclusion weighing each method's strengths
5. States overall confidence

### Problem Classification Schema

```typescript
type ProblemClassification = {
  uncertainty: "low" | "medium" | "high";
  complexity: "simple" | "moderate" | "complex";
  domain: "formal" | "empirical" | "social" | "mixed";
  time_pressure: "none" | "moderate" | "urgent";
  data_availability: "rich" | "moderate" | "sparse";
  stakes: "low" | "medium" | "high";
};
```

---

## 26. TypeDB Agent Tools

### Purpose

Five agent-facing tools for direct TypeDB interaction: status checking, schema syncing, querying, and bulk data import.

### Tools

**`typedb_status`** — Check TypeDB connection health, list databases.

**`typedb_sync_schema`** — Re-generate TypeQL schema from ontologies and push to TypeDB. Creates database if needed. Pipeline:

1. Ensure database exists (`mabos_{business_id}`)
2. Define base schema (agents, facts, rules, memory, cases)
3. Load JSON-LD ontologies, convert to TypeQL, define ontology schema

**`typedb_query`** — Run raw TypeQL match queries against a database. Returns JSON results (truncated at 4KB).

**`typedb_sync_agent_data`** — Bulk import agent's JSON data (facts, rules, memory) into TypeDB. Syncs:

- All facts from `facts.json`
- All rules from `rules.json`
- All memory items from `memory-store.json` (working + short-term + long-term)

**`goal_seed_business`** — Seed VividWalls business goals into the knowledge graph. Creates strategic, tactical, and operational goals with proper BDI relationships.

### Schema Conversion Pipeline

```
JSON-LD Ontology (.jsonld)
    |
    v
loadOntologies() → parse all .jsonld files
    |
    v
mergeOntologies() → combine @graph arrays
    |
    v
jsonldToTypeQL() → extract entities, attributes, relations
    |
    v
generateDefineQuery() → TypeQL define statement
    |
    v
client.defineSchema() → push to TypeDB
```

### Base TypeQL Schema

```typeql
define
  agent sub entity,
    owns uid @key, owns name, owns role, owns department;
  belief sub entity,
    owns uid @key, owns content, owns certainty, owns source;
  desire sub entity,
    owns uid @key, owns content, owns priority, owns urgency;
  goal sub entity,
    owns uid @key, owns name, owns status, owns progress;
  intention sub entity,
    owns uid @key, owns content, owns status, owns deadline;
  spo_fact sub entity,
    owns uid @key, owns subject_val, owns predicate_val, owns object_val,
    owns confidence, owns source;
  agent_owns sub relation,
    relates owner, relates owned;
  belief_supports_goal sub relation,
    relates supporter, relates supported;
  ...
```

---

Total implementation: ~5,000 lines of TypeScript across 15+ files.\*
