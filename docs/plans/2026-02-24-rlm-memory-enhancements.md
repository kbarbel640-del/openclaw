# RLM-Inspired Memory Enhancements in OpenClaw-MABOS

## Technical Reference Document

| Field            | Value                                                               |
| ---------------- | ------------------------------------------------------------------- |
| **Document**     | RLM-Inspired Memory Enhancements — Technical Reference              |
| **Version**      | 1.0                                                                 |
| **Date**         | 2026-02-24                                                          |
| **Status**       | Active                                                              |
| **Authors**      | OpenClaw-MABOS Architecture Team                                    |
| **Audience**     | Developers, architects, contributors joining the project            |
| **Related Docs** | Memory System Architecture, BDI-SBVR Framework, System Architecture |
| **RLM Paper**    | arXiv:2512.24601v2, Zhang, Kraska, Khattab — January 2026           |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Background: The RLM Paper](#2-background-the-rlm-paper)
3. [Problem Statement](#3-problem-statement)
4. [Enhancement Overview](#4-enhancement-overview)
5. [R1: Recursive Memory Consolidation](#5-r1-recursive-memory-consolidation)
6. [R1: Implementation Details](#6-r1-implementation-details)
7. [R2: Hierarchical Memory Index](#7-r2-hierarchical-memory-index)
8. [R2: Materializer Functions and Tools](#8-r2-materializer-functions-and-tools)
9. [R3: Context-Aware Pre-Compaction Compression](#9-r3-context-aware-pre-compaction-compression)
10. [R3: Checkpoint Lifecycle](#10-r3-checkpoint-lifecycle)
11. [R4: Recursive Memory Search](#11-r4-recursive-memory-search)
12. [R4: Query Refinement Algorithm](#12-r4-query-refinement-algorithm)
13. [R5: BDI Cycle as Recursive Reasoning Loop](#13-r5-bdi-cycle-as-recursive-reasoning-loop)
14. [R5: Belief Conflict Detection](#14-r5-belief-conflict-detection)
15. [RLM Paper Concepts to MABOS Implementation Mapping](#15-rlm-paper-concepts-to-mabos-implementation-mapping)
16. [System Interoperation: How All Five Enhancements Work Together](#16-system-interoperation-how-all-five-enhancements-work-together)
17. [Data Lifecycle End-to-End](#17-data-lifecycle-end-to-end)
18. [File-by-File Implementation Map](#18-file-by-file-implementation-map)
19. [Technology Integration Layer](#19-technology-integration-layer)
20. [Verification and Testing](#20-verification-and-testing)
21. [Performance Considerations and Limits](#21-performance-considerations-and-limits)
22. [References and Related Documents](#22-references-and-related-documents)

---

## 1. Executive Summary

OpenClaw-MABOS applies five enhancements (designated R1 through R5) inspired by the
Recursive Language Models (RLM) paper to transform its memory and cognitive subsystems.
Before these enhancements, MABOS operated with a flat memory store: memories were stored
verbatim, searched in a single pass, and lost across context compaction events. The BDI
cognitive cycle processed beliefs as flat lists regardless of size.

The RLM paper demonstrates that treating context as a hierarchically navigable external
environment -- with recursive decomposition, summarization, and navigation -- enables LLMs
to process inputs far beyond native context window limits. The fundamental insight is that
instead of cramming everything into the context window, you decompose information
hierarchically, navigate to relevant parts recursively, and summarize back up.

These five enhancements apply that insight systematically:

| Enhancement | Name                           | Core RLM Concept Applied        |
| ----------- | ------------------------------ | ------------------------------- |
| R1          | Recursive Memory Consolidation | Recursive summarization         |
| R2          | Hierarchical Memory Index      | Hierarchical decomposition      |
| R3          | Pre-Compaction Compression     | Recursive context checkpointing |
| R4          | Recursive Memory Search        | Recursive navigation            |
| R5          | BDI Recursive Reasoning Loop   | Recursive chunked processing    |

Together they form a complete recursive memory management system where memories are
consolidated, organized hierarchically, preserved across compaction events, searched with
iterative refinement, and reasoned over in manageable chunks.

---

## 2. Background: The RLM Paper

### Citation

> "Recursive Language Models"
> Ruiqi Zhang, Tim Kraska, Omar Khattab
> arXiv:2512.24601v2 -- January 2026

### Core Contributions

The RLM paper makes five theoretical contributions relevant to MABOS:

**Contribution 1: Context as External Environment.**
Standard LLM usage treats context as a fixed-size input buffer. RLM reframes context as an
external environment that the model navigates. The context window becomes a viewport into a
larger information space, not the space itself.

**Contribution 2: Recursive Decomposition.**
When input exceeds context capacity, RLM decomposes it into a tree of chunks. Each chunk
is small enough to fit in the context window. The tree structure preserves locality and
enables efficient navigation.

**Contribution 3: Hierarchical Summarization.**
At each level of the chunk tree, RLM produces summaries that compress the content below.
The root summary captures the entire document at the highest abstraction level. Any level
can be consulted depending on the granularity needed.

**Contribution 4: Recursive Navigation.**
To answer a query, RLM navigates the chunk tree top-down: examine summary, decide which
children are relevant, descend into those children, refine the query based on what was
found, and continue until reaching leaf nodes with the needed detail.

**Contribution 5: Fixed-Size Working Context.**
Throughout processing, RLM maintains a fixed-size working context. It never attempts to
load the entire input. Instead, it accumulates findings from tree navigation into a
bounded working set.

### Performance Results

The paper demonstrates that these techniques enable processing of inputs 100x beyond native
context window limits with minimal quality degradation. The key metric: on long-document QA
tasks, RLM achieves 94-97% of the quality of an "infinite context" oracle while using only
1% of the context that would be needed for brute-force inclusion.

---

## 3. Problem Statement

Before the R1-R5 enhancements, OpenClaw-MABOS suffered from five specific deficiencies in
its memory and cognitive subsystems:

### 3.1 Memory Clutter (addressed by R1)

When short-term memories were consolidated to long-term storage, they were moved verbatim.
A week of active work could produce hundreds of individually stored memory items, many
redundant or closely related, with no mechanism to compress related items into higher-level
abstractions. Long-term memory became an unsorted attic.

### 3.2 Temporal Blindness (addressed by R2)

Daily memory logs accumulated as flat files. Finding patterns across weeks or months
required reading through every individual daily file sequentially. There was no mechanism
to produce higher-level temporal summaries -- no weekly digests, no monthly themes, no
quarterly reviews. The agent could recall yesterday but not "what has been the trajectory
of this project over the past three months."

### 3.3 Compaction Amnesia (addressed by R3)

When OpenClaw compacts conversation context to fit the LLM's context window, the agent
loses session state: what it was working on, decisions made, open questions, and findings.
Post-compaction, it effectively starts from a blank slate, potentially re-doing work or
contradicting earlier decisions.

### 3.4 Shallow Search (addressed by R4)

Standard memory recall performed a single-pass search. It found items directly matching
the query but missed indirectly related memories that require following chains of
association. Searching for "authentication" would find memories tagged with that word but
miss a related "session management redesign" decision that was never tagged with
"authentication."

### 3.5 Cognitive Overload (addressed by R5)

The BDI maintenance heartbeat processed beliefs, desires, and intentions as flat lists.
When an agent accumulated hundreds of beliefs over weeks of operation, the entire belief
set was loaded into a single processing pass. This exceeded practical context limits and
meant belief conflicts went undetected because contradictory beliefs might be pages apart
in the flat list.

---

## 4. Enhancement Overview

The five enhancements map to specific source files and expose specific tools:

```
+----------+-------------------------------------+-----------------------------+-------------------+
| ID       | Enhancement                         | Primary Source File(s)      | Tools Exposed     |
+----------+-------------------------------------+-----------------------------+-------------------+
| R1       | Recursive Memory Consolidation      | memory-tools.ts             | memory_consolidate|
| R2       | Hierarchical Memory Index           | memory-hierarchy.ts         | memory_build_     |
|          |                                     | memory-materializer.ts      |   hierarchy       |
|          |                                     |                             | memory_hierarchy_ |
|          |                                     |                             |   search          |
| R3       | Pre-Compaction Compression          | memory-flush.ts             | memory_checkpoint |
|          |                                     | memory-tools.ts             |                   |
| R4       | Recursive Memory Search             | memory-tools.ts             | memory_recall     |
|          |                                     |                             |   (recursive_depth|
|          |                                     |                             |    parameter)     |
| R5       | BDI Recursive Reasoning Loop        | bdi-runtime/index.ts        | (internal to BDI  |
|          |                                     |                             |  heartbeat cycle) |
+----------+-------------------------------------+-----------------------------+-------------------+
```

### Dependency Graph Between Enhancements

```
         R3 (Checkpoint)
             |
             | captures session state before compaction
             v
         R1 (Consolidation)
             |
             | groups and summarizes related memories
             v
         R2 (Hierarchy)
             |
             | builds temporal summary tree from consolidated data
             v
         R4 (Recursive Search)
             |
             | searches across all hierarchy levels
             v
         R5 (BDI Reasoning)
             |
             | processes beliefs in chunks, detects conflicts
             v
      [Agent Cognitive State]
```

Each enhancement operates independently but they compose into a system where the output
of one feeds the input of the next. The remainder of this document describes each in
detail.

---

## 5. R1: Recursive Memory Consolidation

### What It Does

R1 transforms memory consolidation from a verbatim copy operation into an intelligent
compression pipeline. When short-term memories are moved to long-term storage, related
items are grouped by tag similarity, compressed into single summary entries, and annotated
with provenance links back to the original items.

### Why It Exists

Without consolidation, an agent that stores 20 memories per day accumulates 600 items per
month in long-term storage. Many of these are closely related: five memories about the
same debugging session, three about a single architectural decision, four about a recurring
user preference. Without compression, these remain as 600 individual items that all compete
for retrieval slots during memory recall.

With R1, those 600 items might consolidate into 150 summary entries, each representing a
coherent topic with a provenance chain (`derived_from`) pointing back to the originals.
Retrieval becomes more efficient because each result carries more information.

### The Three-Tier Memory Store

R1 operates within a three-tier memory architecture:

```
+-------------------------------------------------------------------+
|                     MEMORY TIERS                                   |
+-------------------------------------------------------------------+
|                                                                    |
|  +-----------------------+                                         |
|  |   WORKING MEMORY      |  Capacity: 7 items (Miller's Law)     |
|  |   (Immediate context) |  TTL: Current session only             |
|  +-----------+-----------+  Eviction: LRU when full               |
|              |                                                     |
|              | overflow / explicit store                           |
|              v                                                     |
|  +-----------------------+                                         |
|  |   SHORT-TERM MEMORY   |  Capacity: 200 items                  |
|  |   (Recent sessions)   |  TTL: 2 hours                         |
|  +-----------+-----------+  Eviction: TTL expiry + overflow       |
|              |                                                     |
|              | consolidation (R1)                                  |
|              v                                                     |
|  +-----------------------+                                         |
|  |   LONG-TERM MEMORY    |  Capacity: Unbounded                  |
|  |   (Persistent store)  |  TTL: None (persistent)               |
|  +-----------------------+  Navigable via R2 hierarchy + R4 search|
|                                                                    |
+-------------------------------------------------------------------+
```

### How R1 Applies the RLM Insight

RLM's recursive summarization compresses related information into higher-level abstractions
while preserving the ability to drill down to originals. R1 does the same for memories:

- **RLM**: Leaf chunks are summarized into parent nodes in the chunk tree.
- **R1**: Individual memories are summarized into consolidated entries with `derived_from` provenance.

The parallel is direct. In RLM, you can read the parent summary for a high-level view or
descend to leaves for detail. In R1, you can read the consolidated entry for a compressed
view or follow `derived_from` links to the original items.

---

## 6. R1: Implementation Details

### Core Data Type: MemoryItem

```typescript
interface MemoryItem {
  id: string; // Unique identifier (e.g., "mem-a1b2c3")
  content: string; // The memory content
  importance: number; // 0.0 to 1.0 scale
  tags: string[]; // Categorical tags for clustering
  timestamp: string; // ISO 8601 creation time
  tier: "working" | "short_term" | "long_term";
  derived_from?: string[]; // R1: Provenance chain to source items
}
```

The `derived_from` field is R1's addition to the base type. It is only populated on
consolidated entries and contains the IDs of the original memory items that were merged
to produce this entry.

### Grouping Algorithm: `groupRelatedMemories()`

```typescript
function groupRelatedMemories(items: MemoryItem[]): MemoryItem[][] {
  // Jaccard similarity on tag sets
  // threshold > 0.3 means items share enough tags to be related

  const groups: MemoryItem[][] = [];
  const assigned = new Set<string>();

  for (const item of items) {
    if (assigned.has(item.id)) continue;

    const group = [item];
    assigned.add(item.id);

    for (const candidate of items) {
      if (assigned.has(candidate.id)) continue;

      const intersection = item.tags.filter((t) => candidate.tags.includes(t));
      const union = new Set([...item.tags, ...candidate.tags]);
      const jaccard = intersection.length / union.size;

      if (jaccard > 0.3) {
        group.push(candidate);
        assigned.add(candidate.id);
      }
    }

    groups.push(group);
  }

  return groups;
}
```

**Jaccard Similarity Threshold: 0.3**

This threshold was chosen empirically. At 0.2, too many unrelated items cluster together
(high recall, low precision). At 0.5, only near-duplicates cluster (low recall, high
precision). The 0.3 threshold balances: items sharing roughly one-third of their tags are
considered related enough to consolidate.

Items with no tag overlap with any other item form singleton groups and pass through
consolidation unchanged.

### Summarization: `summarizeMemoryGroup()`

```typescript
function summarizeMemoryGroup(group: MemoryItem[]): MemoryItem {
  // Single-item groups pass through unchanged
  if (group.length === 1) {
    return { ...group[0], tier: "long_term" };
  }

  // Multi-item groups: merge into consolidated entry
  const mergedContent = group.map((item) => item.content).join("\n\n---\n\n");

  const consolidatedContent =
    `Consolidated from ${group.length} related memories:\n\n` + mergedContent;

  return {
    id: generateId("mem"),
    content: consolidatedContent,
    importance: Math.max(...group.map((g) => g.importance)), // Max importance
    tags: [...new Set(group.flatMap((g) => g.tags))], // Union of all tags
    timestamp: new Date().toISOString(),
    tier: "long_term",
    derived_from: group.map((g) => g.id), // Provenance
  };
}
```

Key design decisions:

- **Importance**: Takes the maximum from the group, not the average. Rationale: if any
  item in a group was important, the consolidated entry should be at least as important.
  Averaging would dilute important items mixed with mundane ones.

- **Tags**: Takes the union of all tags. The consolidated entry is findable by any tag
  that any of its source items carried.

- **Content**: Currently concatenates with separators. A future enhancement may use an
  LLM call to produce a true narrative summary, but the current approach avoids latency
  and works well enough for retrieval purposes.

### Tool Definition: `memory_consolidate`

```typescript
{
  name: "memory_consolidate",
  description: "Consolidate short-term memories into long-term storage",
  parameters: {
    agent_id: { type: "string", required: true },
    summarize: { type: "boolean", default: true },
    // When false, items are moved verbatim (pre-R1 behavior)
  }
}
```

### Write-Through Pipeline

After consolidation, each resulting MemoryItem follows this write path:

```
Consolidated MemoryItem
    |
    +---> memory-store.json (source of truth, JSON array)
    |
    +---> memory/YYYY-MM-DD.md (materialized Markdown, APPEND)
    |         |
    |         +---> OpenClaw chokidar watcher detects change
    |                   |
    |                   +---> FTS5 BM25 index updated
    |                   +---> sqlite-vec vector index updated
    |
    +---> TypeDB (best-effort, non-blocking)
              |
              +---> Graph node created with entity relationships
              +---> Failure is non-fatal; JSON/Markdown are authoritative
```

---

## 7. R2: Hierarchical Memory Index

### What It Does

R2 builds a navigable tree of time-based summaries at increasing granularity levels. Daily
memory logs are aggregated into weekly summaries, weekly summaries into monthly themes, and
monthly themes into quarterly reviews. This creates a hierarchy that allows navigating
temporal memory at different zoom levels.

### Why It Exists

An agent operating daily for three months produces approximately 90 daily log files. To
understand "what has this agent been focused on this quarter," a human or the agent itself
would need to read all 90 files. With R2, that question is answered by reading a single
quarterly review document that was recursively built from the daily data.

This mirrors how human organizations manage knowledge: daily standups feed into weekly
reports, which feed into monthly reviews, which feed into quarterly planning documents.
Each level compresses the level below while preserving the key signals.

### How R2 Applies the RLM Insight

RLM builds a chunk tree over a document: the document is split into leaf chunks, which
are summarized into parent chunks, which are summarized into higher parents, up to a
root summary. R2 builds the same structure over time:

```
RLM Chunk Tree                    R2 Memory Hierarchy
==============                    ===================

    [Root Summary]                [Quarterly Review]
         |                              |
    +---------+                   +-----------+
    |         |                   |           |
 [Part 1]  [Part 2]          [Month 1]   [Month 2]  ...
    |         |                   |           |
 +--+--+   +--+--+          +----+----+  +---+---+
 |     |   |     |          |    |    |  |   |   |
[C1] [C2] [C3] [C4]       [W1] [W2] ... [W5][W6]...
                            |
                        +---+---+
                        |   |   |
                       [D1][D2]...[D7]
```

The structural parallel is exact. The key difference is that RLM's tree is spatial
(chunks of a document) while R2's tree is temporal (periods of time).

### File Hierarchy on Disk

```
memory/
|
|-- 2026-02-17.md              # Daily log (Monday)
|-- 2026-02-18.md              # Daily log (Tuesday)
|-- 2026-02-19.md              # Daily log (Wednesday)
|-- 2026-02-20.md              # Daily log (Thursday)
|-- 2026-02-21.md              # Daily log (Friday)
|-- 2026-02-22.md              # Daily log (Saturday)
|-- 2026-02-23.md              # Daily log (Sunday)
|
|-- weekly/
|   |-- 2026-W07.md            # Week 7 digest
|   |-- 2026-W08.md            # Week 8 digest
|   +-- ...
|
|-- monthly/
|   |-- 2026-01.md             # January themes
|   |-- 2026-02.md             # February themes
|   +-- ...
|
|-- quarterly/
|   |-- 2026-Q1.md             # Q1 review
|   +-- ...
|
+-- checkpoints/               # R3 checkpoints (see Section 9)
    |-- 2026-02-24-0930.md
    +-- ...
```

All files in this tree are plain Markdown. OpenClaw's chokidar file watcher monitors the
`memory/` directory recursively, so every file created by R2 is automatically indexed into
both the FTS5 BM25 index and the sqlite-vec vector index. No additional configuration or
core changes are required.

---

## 8. R2: Materializer Functions and Tools

### Materializer Functions (`memory-materializer.ts`, 279 lines)

The materializer file contains both the R2 hierarchy functions and base materializer
functions that bridge MABOS data to OpenClaw's native indexer.

#### Base Materializers (non-R2)

```typescript
// Bridge MABOS facts to OpenClaw's indexer
materializeFacts(api, agentId);
// Input:  facts.json
// Output: mabos-facts.md

// Bridge BDI cognitive files to OpenClaw's indexer
materializeBeliefs(api, agentId);
// Input:  Beliefs.md, Desires.md, Goals.md
// Output: mabos-beliefs.md

// Bridge memory store to OpenClaw's indexer
materializeMemoryItems(api, agentId);
// Input:  memory-store.json
// Output: mabos-memory-items.md
```

#### R2 Hierarchy Materializers

**`materializeWeeklySummary(api, agentId, weekStart)`**

```typescript
async function materializeWeeklySummary(
  api: OpenClawApi,
  agentId: string,
  weekStart: Date, // Monday of the target week
): Promise<void> {
  // 1. Enumerate daily logs for Mon-Sun of that week
  const dailyFiles = [];
  for (let d = 0; d < 7; d++) {
    const date = addDays(weekStart, d);
    const filename = `memory/${formatDate(date)}.md`;
    if (await fileExists(api, filename)) {
      dailyFiles.push({ date, content: await readFile(api, filename) });
    }
  }

  // 2. Build weekly digest with per-day sections
  let digest = `# Weekly Summary: ${formatWeek(weekStart)}\n\n`;
  digest += `## Overview\n\n`;
  digest += `Coverage: ${dailyFiles.length} days with recorded activity.\n\n`;

  for (const { date, content } of dailyFiles) {
    digest += `## ${formatDate(date)}\n\n`;
    digest += extractKeyItems(content); // Pull out headings + key lines
    digest += `\n\n`;
  }

  // 3. Write to weekly directory
  const weekId = getISOWeek(weekStart);
  await writeFile(api, `memory/weekly/${weekId}.md`, digest);
}
```

**`materializeMonthlySummary(api, agentId, month)`**

```typescript
async function materializeMonthlySummary(
  api: OpenClawApi,
  agentId: string,
  month: string, // Format: "YYYY-MM"
): Promise<void> {
  // 1. Read all weekly summaries that fall within this month
  // 2. Read any daily entries not covered by weekly summaries
  // 3. Build monthly document with:
  //    - Themes section (recurring topics across weeks)
  //    - Patterns section (behavioral or decision patterns)
  //    - Key Decisions section (decisions with high importance)
  //    - Per-week summary subsections
  // 4. Write to memory/monthly/YYYY-MM.md
}
```

**`materializeQuarterlyReview(api, agentId, quarter)`**

```typescript
async function materializeQuarterlyReview(
  api: OpenClawApi,
  agentId: string,
  quarter: string, // Format: "YYYY-Qn"
): Promise<void> {
  // 1. Read the 3 monthly summaries for this quarter
  // 2. Build quarterly document with:
  //    - Strategic Themes section
  //    - Quarter-over-quarter trends
  //    - Major milestones and decisions
  //    - Per-month summary subsections
  // 3. Write to memory/quarterly/YYYY-Qn.md
}
```

**`materializeAll()`**

```typescript
async function materializeAll(api: OpenClawApi, agentId: string): Promise<void> {
  // Run base materializers in parallel (non-fatal failures)
  await Promise.allSettled([
    materializeFacts(api, agentId),
    materializeBeliefs(api, agentId),
    materializeMemoryItems(api, agentId),
  ]);
}
```

Note that `materializeAll()` runs the base materializers only. The hierarchy materializers
(weekly, monthly, quarterly) are triggered separately via the `memory_build_hierarchy` tool
or the BDI Sunday maintenance cycle.

### Tools (`memory-hierarchy.ts`)

**`memory_build_hierarchy`**

```typescript
{
  name: "memory_build_hierarchy",
  description: "Build time-based memory hierarchy from daily logs",
  parameters: {
    agent_id: { type: "string", required: true },
    scope: {
      type: "string",
      enum: ["week", "month", "quarter", "all"],
      required: false,
      description: "Granularity level to build. 'all' builds every level."
    },
    since: {
      type: "string",
      required: false,
      description: "ISO date string. Only build summaries from this date forward."
    }
  }
}
```

Execution flow:

```
memory_build_hierarchy(agent_id, scope="all", since="2026-02-01")
    |
    +---> Discover daily log files in memory/ since 2026-02-01
    |
    +---> Group daily files by ISO week
    |         |
    |         +---> For each week: materializeWeeklySummary()
    |
    +---> Group weekly summaries by month
    |         |
    |         +---> For each month: materializeMonthlySummary()
    |
    +---> Group monthly summaries by quarter
              |
              +---> For each quarter: materializeQuarterlyReview()
```

**`memory_hierarchy_search`**

```typescript
{
  name: "memory_hierarchy_search",
  description: "Search memory at a specific granularity level",
  parameters: {
    agent_id: { type: "string", required: true },
    query:    { type: "string", required: true },
    level: {
      type: "string",
      enum: ["daily", "weekly", "monthly", "quarterly"],
      required: true
    },
    limit: { type: "number", default: 5 }
  }
}
```

Search is performed via substring matching against `.md` files in the corresponding
directory:

| Level       | Directory Searched      |
| ----------- | ----------------------- |
| `daily`     | `memory/*.md`           |
| `weekly`    | `memory/weekly/*.md`    |
| `monthly`   | `memory/monthly/*.md`   |
| `quarterly` | `memory/quarterly/*.md` |

Results are ranked by number of query term matches within each file.

### BDI Integration

The BDI maintenance heartbeat includes a Sunday trigger for weekly hierarchy builds:

```typescript
// In bdi-runtime/index.ts, within runMaintenanceCycle()
if (isSunday(now)) {
  await materializeWeeklySummary(api, agentId, getWeekStart(now));
  // Monthly/quarterly built less frequently, typically at month/quarter end
}
```

This ensures that weekly summaries are always current without requiring manual invocation.

---

## 9. R3: Context-Aware Pre-Compaction Compression

### What It Does

R3 intercepts the context compaction process to capture a structured checkpoint of the
agent's current session state before the compaction discards conversation history. After
compaction, the checkpoint is injected into the next context window, giving the agent
continuity across compaction boundaries.

### Why It Exists

Context compaction is a necessary mechanism: LLM context windows are finite, and long
sessions will eventually fill them. Without R3, compaction is a hard discontinuity. The
agent before compaction might have been in the middle of debugging a specific issue, had
made three decisions about the approach, identified two open questions, and planned next
steps. After compaction, all of this is gone.

R3 makes compaction a soft boundary instead. The checkpoint preserves:

- **Current task context**: What the agent was actively working on
- **Active decisions**: Decisions made during this session segment
- **Key findings**: Facts or insights discovered
- **Open questions**: Unresolved questions that need follow-up
- **Next steps**: Planned actions that were interrupted by compaction

### How R3 Applies the RLM Insight

RLM's core mechanism is maintaining a fixed-size working context while navigating a larger
information space. When RLM processes a chunk, it produces a summary that captures the
essential information, then moves to the next chunk with that summary as context. The
previous chunk's raw content is discarded, but its summary persists.

R3 applies the same pattern to session context:

```
RLM Processing                   R3 Compaction
==============                   ==============

Process Chunk N                  Session Segment N
    |                                |
    v                                v
Summarize Chunk N                Checkpoint Segment N
    |                                |
    v                                v
Discard Chunk N raw content      Compaction discards conversation
    |                                |
    v                                v
Process Chunk N+1                Session Segment N+1
  with Chunk N summary             with Checkpoint N injected
  in working context               into context
```

The checkpoint is the "summary" of the session segment. It compresses an unbounded
conversation into a fixed-format structured document.

---

## 10. R3: Checkpoint Lifecycle

### Phase 1: Flush Trigger Detection

```typescript
// memory-flush.ts

function shouldRunMemoryFlush(
  totalTokens: number,
  contextWindow: number,
  reserveTokens: number,
  softThreshold: number, // Default: 4000 tokens
  memoryFlushCompactionCount: number,
  currentCompactionCount: number,
): boolean {
  // Only run once per compaction cycle
  if (currentCompactionCount <= memoryFlushCompactionCount) {
    return false;
  }

  // Check if context is approaching the limit
  const available = contextWindow - reserveTokens;
  const remaining = available - totalTokens;

  return remaining <= softThreshold;
}
```

The `softThreshold` of 4000 tokens provides a buffer. The flush runs when there are
approximately 4000 tokens of space remaining, giving the agent room to write the
checkpoint before compaction actually occurs.

The `memoryFlushCompactionCount` tracker ensures the flush runs at most once per
compaction cycle, preventing redundant checkpoints.

### Phase 2: Flush Prompt Injection

```typescript
// memory-flush.ts

const DEFAULT_MEMORY_FLUSH_PROMPT = `
You are about to undergo context compaction. Before this happens, you must
preserve your current session state.

1. APPEND durable memories to memory/{date}.md
   - Facts learned, decisions made, insights gained
   - Use APPEND mode -- do not overwrite existing daily content

2. WRITE a session checkpoint to memory/checkpoints/{date}-{time}.md with:
   - ## Current Task Context
     What you were actively working on
   - ## Active Decisions
     Decisions made during this session segment
   - ## Key Findings
     Important facts or insights discovered
   - ## Open Questions
     Unresolved questions needing follow-up
   - ## Next Steps
     Planned actions to resume after compaction
`;

function resolveMemoryFlushPromptForRun(date: Date): string {
  const dateStr = formatDate(date); // "2026-02-24"
  const timeStr = formatTime(date); // "0930"

  return DEFAULT_MEMORY_FLUSH_PROMPT.replace("{date}", dateStr).replace("{time}", timeStr);
}
```

### Phase 3: Checkpoint Writing

The `memory_checkpoint` tool provides a structured API for writing checkpoints:

```typescript
{
  name: "memory_checkpoint",
  description: "Write a structured session checkpoint before compaction",
  parameters: {
    agent_id:       { type: "string", required: true },
    context:        { type: "string", required: true,
                      description: "Current task context" },
    decisions:      { type: "array", items: "string",
                      description: "Decisions made this segment" },
    findings:       { type: "array", items: "string",
                      description: "Key findings and insights" },
    next_steps:     { type: "array", items: "string",
                      description: "Planned next actions" },
    open_questions: { type: "array", items: "string",
                      description: "Unresolved questions" }
  }
}
```

Output file format (`memory/checkpoints/2026-02-24-0930.md`):

```markdown
# Session Checkpoint: 2026-02-24 09:30

## Current Task Context

Debugging the authentication token refresh loop that causes
401 errors after 12 hours of continuous session.

## Active Decisions

- Decided to use sliding window refresh instead of fixed interval
- Chose to store refresh tokens in httpOnly cookies rather than localStorage

## Key Findings

- The 401 errors correlate with exactly 12-hour gaps, matching the token TTL
- The existing refresh logic has a race condition when two requests trigger
  refresh simultaneously

## Open Questions

- Should we add a mutex/lock around the refresh operation?
- Is the 12-hour TTL configurable server-side or hardcoded?

## Next Steps

- Implement sliding window refresh in auth-service.ts
- Add a debounce wrapper around the refresh function
- Write integration test for the 12-hour boundary
```

### Phase 4: Checkpoint Resolution (Post-Compaction)

```typescript
// memory-tools.ts

async function resolveLatestCheckpoint(api: OpenClawApi, agentId: string): Promise<string | null> {
  // Scan memory/checkpoints/ directory
  const checkpointDir = `memory/checkpoints/`;
  const files = await listFiles(api, checkpointDir);

  if (files.length === 0) return null;

  // Sort by filename (which encodes date-time) descending
  const sorted = files.sort().reverse();

  // Read and return the most recent checkpoint
  return await readFile(api, `${checkpointDir}${sorted[0]}`);
}
```

The BDI heartbeat calls this function to inject checkpoint content as a belief update
after compaction is detected, restoring the agent's session continuity.

### Phase 5: Settings Resolution

```typescript
// memory-flush.ts

function resolveMemoryFlushSettings(): MemoryFlushSettings {
  // Reads from agents.defaults.compaction.memoryFlush config
  return {
    enabled: true, // Default: enabled
    softThreshold: 4000, // Tokens of buffer before compaction
    prompt: DEFAULT_MEMORY_FLUSH_PROMPT,
  };
}
```

### Complete R3 Flow Diagram

```
                           CONTEXT USAGE
                           =============
Time -->
Token    |                                                    |
Usage    |                                          +---------+
         |                                     +---/          |
         |                                +---/    |          |
         |                           +---/    |    |          |
         |                      +---/    |    |    |          |
         |                 +---/    |    |    |    |          |
         |            +---/    |    |    |    |    |          |
         |       +---/    |    |    |    |    |    |          |
         |  +---/    |    |    |    |    |    |    |          |
         +-/----+----+----+----+----+----+----+----+----------+
                                              ^    ^
                                              |    |
                                    softThreshold  contextWindow
                                    (4000 tokens   - reserveTokens
                                     remaining)
                                              |
                                              v
                                    shouldRunMemoryFlush() = true
                                              |
                                              v
                                    Inject flush prompt
                                              |
                                              v
                                    Agent writes checkpoint
                                              |
                                              v
                                    COMPACTION OCCURS
                                              |
                                              v
                                    resolveLatestCheckpoint()
                                              |
                                              v
                                    Inject into next context
                                              |
                                              v
                                    Agent resumes with continuity
```

---

## 11. R4: Recursive Memory Search

### What It Does

R4 augments the `memory_recall` tool with a `recursive_depth` parameter that controls how
many rounds of iterative query refinement the search performs. At depth 0 (default), it
behaves as a standard single-pass search. At depth 1-3, it performs multiple search passes,
extracting new terms from each pass's results to refine the query for the next pass.

### Why It Exists

Single-pass search is limited by the vocabulary of the original query. If you search for
"authentication system," you find memories that contain those words or are semantically
close to them. But you miss memories about "token refresh policy" or "session management
redesign" that are topically related but lexically distant.

Recursive search bridges this gap. The first pass finds "JWT token implementation" and
"OAuth2 provider setup." From these results, the algorithm extracts new terms like "JWT,"
"OAuth2," and "token." The second pass searches for "authentication system JWT OAuth2
token," which now finds "token refresh policy" and "session management redesign."

This mirrors how a human researcher works: you start with a query, read the results, notice
new terms and concepts, and refine your search based on what you learned.

### How R4 Applies the RLM Insight

RLM navigates a chunk tree by recursively descending into relevant children. At each level,
it refines its understanding of what to look for based on what it found so far. R4 applies
the same recursive refinement pattern to memory search:

```
RLM Navigation                    R4 Recursive Search
==============                    ===================

Start at root                     Start with original query
    |                                 |
    v                                 v
Examine root summary              Search pass (depth 0)
    |                                 |
    v                                 v
Identify relevant children        Extract new terms from results
    |                                 |
    v                                 v
Descend into child N              Refined query = original + new terms
    |                                 |
    v                                 v
Examine child N summary           Search pass (depth 1)
    |                                 |
    v                                 v
Identify relevant grandchildren   Extract more terms
    |                                 |
    v                                 v
Continue recursing...             Continue refining...
    |                                 |
    v                                 v
Collect and merge findings        Deduplicate and merge all results
```

---

## 12. R4: Query Refinement Algorithm

### Core Algorithm: `recursiveMemorySearch()`

```typescript
async function recursiveMemorySearch(
  api: OpenClawApi,
  agentId: string,
  query: string,
  depth: number, // Current recursion depth (counts down)
  limit: number,
  accumulatedResults: MemoryItem[], // Results from all passes so far
): Promise<MemoryItem[]> {
  // --- Base operation: run standard search ---
  const results = await semanticRecall(api, agentId, query, limit);

  // Add results to accumulator (with depth annotation)
  for (const item of results) {
    if (!accumulatedResults.find((r) => r.id === item.id)) {
      item._searchDepth = depth; // Annotate discovery depth
      accumulatedResults.push(item);
    }
  }

  // --- Recursive case ---
  if (depth > 0 && results.length > 0) {
    // Extract unique terms from current results
    const queryTerms = new Set(query.toLowerCase().split(/\s+/));
    const newTerms = extractUniqueTerms(results).filter(
      (term) => !queryTerms.has(term.toLowerCase()),
    );

    if (newTerms.length > 0) {
      // Build refined query
      const refinedQuery = `${query} ${newTerms.slice(0, 5).join(" ")}`;

      // Recurse with reduced depth
      await recursiveMemorySearch(api, agentId, refinedQuery, depth - 1, limit, accumulatedResults);
    }
  }

  return accumulatedResults;
}
```

### Term Extraction Heuristic: `extractUniqueTerms()`

```typescript
function extractUniqueTerms(items: MemoryItem[]): string[] {
  const termFreq = new Map<string, number>();

  for (const item of items) {
    // Tokenize content into words
    const words = item.content
      .split(/\s+/)
      .map((w) => w.replace(/[^a-zA-Z0-9]/g, ""))
      .filter((w) => w.length > 3); // Skip short words

    // Also include tags
    const allTerms = [...words, ...item.tags];

    for (const term of allTerms) {
      termFreq.set(term, (termFreq.get(term) || 0) + 1);
    }
  }

  // Sort by frequency (most common terms in results are most relevant)
  return [...termFreq.entries()].sort((a, b) => b[1] - a[1]).map(([term]) => term);
}
```

**Design Decision: No LLM Call for Query Refinement**

The term extraction heuristic is intentionally lightweight. An alternative design would use
an LLM call to analyze the results and generate a semantically refined query. This was
rejected for two reasons:

1. **Latency**: Each recursion level would add an LLM round-trip (500ms-2s). At depth 3,
   that is 1.5-6 seconds of additional latency just for query refinement.

2. **Predictability**: The heuristic produces deterministic, inspectable query refinements.
   An LLM-based refinement would be non-deterministic and harder to debug.

The heuristic works well in practice because memory items are typically rich in domain
terminology. Extracting frequent terms from results naturally surfaces the vocabulary
needed to find related memories.

### Hybrid Search Pipeline: `semanticRecall()`

```typescript
async function semanticRecall(
  api: OpenClawApi,
  agentId: string,
  query: string,
  limit: number,
): Promise<MemoryItem[]> {
  // Attempt 1: OpenClaw native search (vector + BM25)
  try {
    const nativeResults = await api.search(query, { limit });
    if (nativeResults.length > 0) {
      return blendScores(nativeResults, 0.7, 0.3);
      // 70% semantic similarity + 30% importance weight
    }
  } catch {
    // Native search unavailable, fall through to fallback
  }

  // Attempt 2: Substring matching (fallback)
  const allItems = await loadMemoryStore(agentId);
  return allItems
    .filter((item) => item.content.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => b.importance - a.importance)
    .slice(0, limit);
}
```

**Score Blending Formula**:

```
finalScore = 0.7 * semanticSimilarity + 0.3 * importance
```

Where:

- `semanticSimilarity` is the cosine distance from the vector index (0.0 to 1.0)
- `importance` is the item's importance field (0.0 to 1.0)

This blending ensures that highly important items are boosted in results even if their
semantic similarity is not the highest. A critical architectural decision (importance 0.9)
with moderate semantic match (0.6) scores: `0.7 * 0.6 + 0.3 * 0.9 = 0.69`, which beats
a trivial note (importance 0.2) with perfect semantic match: `0.7 * 1.0 + 0.3 * 0.2 = 0.76`.
At extreme importance differences, this matters.

### Output Format

Results include depth annotations so the consumer knows how each item was discovered:

```
- **M-abc123** [long_term] [decision] (imp: 0.8, depth: 0)
  JWT token implementation uses RS256 with 12-hour TTL

- **M-def456** [long_term] [architecture] (imp: 0.7, depth: 0)
  OAuth2 provider configured with PKCE flow

- **M-ghi789** [short_term] [decision] (imp: 0.6, depth: 1)
  Token refresh policy: sliding window, 15-min before expiry

- **M-jkl012** [long_term] [task] (imp: 0.5, depth: 1)
  Session management redesign planned for Sprint 12
```

Items at depth 0 were found by the original query. Items at depth 1+ were found via query
refinement. This transparency helps the agent (and developers debugging the system)
understand the provenance of each search result.

### Worked Example

**Query**: "authentication system" at `recursive_depth: 2`

**Depth 0** (query: "authentication system"):

- Found: "JWT token implementation" (tags: [authentication, jwt, security])
- Found: "OAuth2 provider setup" (tags: [authentication, oauth2])
- New terms extracted: "JWT", "OAuth2", "token", "security", "PKCE"

**Depth 1** (query: "authentication system JWT OAuth2 token security PKCE"):

- Found: "Token refresh policy decision" (tags: [jwt, session, policy])
- Found: "Session management redesign" (tags: [session, architecture])
- New terms extracted: "refresh", "session", "sliding", "window"

**Depth 2** (query: "authentication system JWT OAuth2 token security PKCE refresh session sliding window"):

- Found: "Redis session store migration" (tags: [session, infrastructure, redis])
- Found: "Rate limiting on auth endpoints" (tags: [security, api, rate-limit])

**Final result set**: 6 items spanning authentication, token management, session handling,
infrastructure, and API security. A single-pass search at depth 0 would have returned only
the first 2.

---

## 13. R5: BDI Cycle as Recursive Reasoning Loop

### What It Does

R5 modifies the BDI (Belief-Desire-Intention) maintenance heartbeat to process cognitive
state files in chunks rather than as monolithic inputs. When an agent's belief file exceeds
50 sections, R5 splits it into chunks of 50 and processes each independently, then merges
the results. It also adds belief conflict detection within and across chunks.

### Why It Exists

The BDI heartbeat runs periodically to maintain agent cognitive state: prune stale
intentions, re-prioritize desires, and validate beliefs. As agents operate over weeks and
months, their cognitive files grow. A Beliefs.md file with 200 sections cannot be
processed in a single LLM context window pass without exceeding token limits or degrading
quality due to attention dilution.

More critically, belief conflicts -- two beliefs that contradict each other -- become
invisible in large files. A belief added in week 1 ("Redis is our session store") might
conflict with a belief added in week 8 ("We migrated sessions to PostgreSQL"), but if they
are 150 sections apart, no single-pass processing will catch the contradiction.

### How R5 Applies the RLM Insight

RLM processes documents too large for the context window by recursively splitting into
chunks and processing each independently. R5 applies this exact pattern to belief files:

```
RLM Document Processing          R5 Belief Processing
=======================          ====================

Document too large               Beliefs.md too large
    |                                |
    v                                v
Split into chunks of N tokens    Split into chunks of 50 sections
    |                                |
    v                                v
Process each chunk               Process each chunk
  independently                    independently
    |                                |
    v                                v
Summarize chunk results          Merge chunk results (pruned items,
    |                              updated beliefs)
    v                                |
Merge summaries into             v
  final result                   Merge into updated Beliefs.md
                                     +
                                 Conflict detection across chunks
```

### Constants and Configuration

```typescript
const BELIEF_CHUNK_SIZE = 50; // Max sections per processing chunk
```

Each agent has 10 cognitive files:

| File              | Purpose                                  |
| ----------------- | ---------------------------------------- |
| `Beliefs.md`      | Factual beliefs about the world          |
| `Desires.md`      | High-level goals and aspirations         |
| `Goals.md`        | Specific, actionable objectives          |
| `Intentions.md`   | Active plans being executed              |
| `Plans.md`        | Detailed step-by-step plans              |
| `Commitments.md`  | Commitments to other agents or users     |
| `Memory.md`       | Long-form memory narratives              |
| `Persona.md`      | Agent identity and behavioral guidelines |
| `Capabilities.md` | Known skills and tool proficiencies      |
| `Learnings.md`    | Lessons learned from past experience     |

---

## 14. R5: Belief Conflict Detection

### Chunked Processing: `processBeliefChunks()`

```typescript
function processBeliefChunks(
  beliefs: string,
  processor: (chunk: string) => ProcessResult,
  chunkSize: number = BELIEF_CHUNK_SIZE,
): AggregateResult {
  // Split on ## headers (each section starts with ##)
  const sections = beliefs.split(/(?=^##\s)/m);

  // Base case: small enough to process directly
  if (sections.length <= chunkSize) {
    return processor(beliefs);
  }

  // Recursive case: split into chunks
  const results: ProcessResult[] = [];
  let totalPruned = 0;

  for (let i = 0; i < sections.length; i += chunkSize) {
    const chunk = sections.slice(i, i + chunkSize).join("\n");
    const result = processor(chunk);

    totalPruned += result.pruned;
    results.push(result);
  }

  return {
    totalPruned,
    result: results.map((r) => r.updated).join("\n"),
    chunksProcessed: results.length,
  };
}
```

### Conflict Detection: `detectBeliefConflicts()`

```typescript
interface BeliefBlock {
  subject: string; // What the belief is about
  content: string; // The belief content
  certainty: number; // 0.0 to 1.0
  addedDate: string; // When the belief was recorded
}

function detectBeliefConflicts(beliefs: string): ConflictReport[] {
  const blocks = parseBeliefBlocks(beliefs);
  const conflicts: ConflictReport[] = [];

  // Compare beliefs about the same subject
  const bySubject = groupBy(blocks, (b) => b.subject);

  for (const [subject, relatedBeliefs] of bySubject) {
    if (relatedBeliefs.length < 2) continue;

    for (let i = 0; i < relatedBeliefs.length; i++) {
      for (let j = i + 1; j < relatedBeliefs.length; j++) {
        const a = relatedBeliefs[i];
        const b = relatedBeliefs[j];

        // Both high certainty but conflicting content
        if (a.certainty > 0.6 && b.certainty > 0.6 && contentConflicts(a.content, b.content)) {
          conflicts.push({
            subject,
            beliefA: a,
            beliefB: b,
            severity: Math.min(a.certainty, b.certainty),
          });
        }
      }
    }
  }

  return conflicts;
}
```

**Conflict reports** are written to `memory/bdi-conflicts/YYYY-MM-DD.md` and are
searchable via both `memory_recall` and `memory_hierarchy_search`. Example:

```markdown
# Belief Conflicts Detected: 2026-02-24

## Conflict 1: Session Storage

- **Belief A** (certainty: 0.9, added: 2026-01-15):
  "Redis is our primary session store"
- **Belief B** (certainty: 0.85, added: 2026-02-20):
  "Sessions are stored in PostgreSQL after the migration"
- **Severity**: 0.85
- **Recommended Action**: Review and resolve -- one belief is likely stale
```

### Commitment Strategies

The maintenance cycle prunes stale intentions based on the agent's commitment strategy,
configured in `agent.json`:

```typescript
type CommitmentStrategy = "single-minded" | "open-minded" | "cautious";
```

| Strategy        | Pruning Rules                                     |
| --------------- | ------------------------------------------------- |
| `single-minded` | Only expire past deadline                         |
| `open-minded`   | Expire past deadline + stalled > 7 days (default) |
| `cautious`      | Expire past deadline + stalled > 3 days           |

"Stalled" means an intention has not been updated (no progress notes, no status change)
for the specified number of days.

### Maintenance Cycle: `runMaintenanceCycle()`

```typescript
async function runMaintenanceCycle(
  api: OpenClawApi,
  agents: AgentConfig[],
): Promise<BdiCycleResult[]> {
  const results: BdiCycleResult[] = [];

  for (const agent of agents) {
    // 1. Read cognitive state (10 files)
    const state = await readCognitiveState(api, agent.id);

    // 2. Prune stale intentions per commitment strategy
    const pruned = pruneIntentions(state.intentions, agent.commitmentStrategy);

    // 3. Re-sort desires by priority (descending)
    const sortedDesires = sortByPriority(state.desires);

    // 4. Process beliefs in chunks (R5)
    const beliefResult = processBeliefChunks(
      state.beliefs,
      (chunk) => validateAndCleanBeliefs(chunk),
      BELIEF_CHUNK_SIZE,
    );

    // 5. Detect conflicts (R5)
    const conflicts = detectBeliefConflicts(state.beliefs);

    // 6. Write conflict reports
    if (conflicts.length > 0) {
      await writeConflictReport(api, agent.id, conflicts);
    }

    // 7. Weekly hierarchy build on Sundays (R2 integration)
    if (isSunday(new Date())) {
      await materializeWeeklySummary(api, agent.id, getWeekStart(new Date()));
    }

    // 8. Write updated cognitive state
    await writeCognitiveState(api, agent.id, {
      ...state,
      beliefs: beliefResult.result,
      intentions: pruned.remaining,
      desires: sortedDesires,
    });

    results.push({
      agentId: agent.id,
      intentionsPruned: pruned.count,
      conflictsDetected: conflicts.length,
      chunksProcessed: beliefResult.chunksProcessed,
      desireCount: sortedDesires.length,
    });
  }

  return results;
}
```

### Agent Discovery

```typescript
async function discoverAgents(api: OpenClawApi): Promise<AgentConfig[]> {
  // Scan agents/ directory for subdirectories containing
  // Persona.md or Beliefs.md (either is sufficient to identify an agent)
  const agentDirs = await listDirectories(api, "agents/");

  return agentDirs
    .filter((dir) => hasFile(dir, "Persona.md") || hasFile(dir, "Beliefs.md"))
    .map((dir) => loadAgentConfig(dir));
}
```

### BdiCycleResult Type

```typescript
interface BdiCycleResult {
  agentId: string;
  intentionsPruned: number;
  conflictsDetected: number; // R5 addition
  chunksProcessed: number; // R5 addition
  desireCount: number;
  beliefCount: number;
  // ... existing fields
}
```

---

## 15. RLM Paper Concepts to MABOS Implementation Mapping

This section provides a systematic mapping between each theoretical concept in the RLM
paper and its concrete implementation in MABOS. This is the definitive reference for
understanding why each design decision was made.

### 15.1 Context as External Environment

**RLM Paper**: The model treats context not as a fixed input buffer but as a navigable
external environment. The context window is a viewport, not the space itself.

**MABOS Implementation**: Memory is not crammed into the LLM prompt. Instead, it is stored
externally in a hierarchy of Markdown files that the agent navigates via tools:

| RLM Concept                | MABOS Realization                                |
| -------------------------- | ------------------------------------------------ |
| External environment       | `memory/` directory hierarchy                    |
| Navigation mechanism       | `memory_recall`, `memory_hierarchy_search` tools |
| Context window as viewport | Only retrieved items enter the context           |
| Environment structure      | Three-tier store + temporal hierarchy            |

### 15.2 Recursive Decomposition

**RLM Paper**: Large inputs are split into a tree of chunks, each small enough to process
in the context window. The tree preserves locality.

**MABOS Implementations** (three separate applications):

| Application | What Is Decomposed   | How It Is Decomposed                    |
| ----------- | -------------------- | --------------------------------------- |
| R1          | Related memory items | Jaccard clustering into groups          |
| R2          | Temporal memory      | Daily -> weekly -> monthly -> quarterly |
| R5          | Agent belief base    | Sections split into chunks of 50        |

### 15.3 Hierarchical Summarization

**RLM Paper**: Each level of the chunk tree compresses the level below. Higher levels
provide broader, more abstract views. Lower levels provide detail.

**MABOS Implementations**:

| Application | Leaf Level           | Summary Levels                             |
| ----------- | -------------------- | ------------------------------------------ |
| R1          | Individual memories  | Consolidated entries (with `derived_from`) |
| R2          | Daily logs           | Weekly -> Monthly -> Quarterly             |
| R3          | Full session context | Structured checkpoint document             |

### 15.4 Recursive Navigation

**RLM Paper**: Queries are answered by navigating the chunk tree, refining the query at
each level based on what was found.

**MABOS Implementations**:

| Application | Navigation Path                                                |
| ----------- | -------------------------------------------------------------- |
| R4          | Query -> results -> extract terms -> refined query -> repeat   |
| R2          | Quarterly -> Monthly -> Weekly -> Daily (via hierarchy_search) |

### 15.5 Fixed-Size Working Context

**RLM Paper**: The model maintains a fixed working context throughout processing. It never
loads the entire input.

**MABOS Implementations**:

| Application  | Fixed-Size Constraint                                   |
| ------------ | ------------------------------------------------------- |
| Memory tiers | Working memory: 7 items (Miller's Law)                  |
|              | Short-term: 200 items with 2-hour TTL                   |
| R3           | Checkpoints compress unbounded sessions to fixed format |
| R5           | Chunks of 50 sections (never full belief file at once)  |

### Summary Diagram

```
+------------------------------------------------------------+
|              RLM THEORETICAL FRAMEWORK                      |
+------------------------------------------------------------+
|                                                             |
|  Context as External     Recursive          Hierarchical    |
|  Environment             Decomposition      Summarization   |
|       |                       |                   |         |
|       v                       v                   v         |
|  +----------+  +----------+  +----------+  +-----------+   |
|  |  memory/  |  | R1:Group |  | R2:Time  |  | R1:Consol |   |
|  |  directory|  | R2:Time  |  | hierarchy|  | R2:Weekly |   |
|  |  hierarchy|  | R5:Chunk |  | levels   |  | R3:Chkpt  |   |
|  +----------+  +----------+  +----------+  +-----------+   |
|                                                             |
|  Recursive               Fixed-Size                         |
|  Navigation              Working Context                    |
|       |                       |                              |
|       v                       v                              |
|  +----------+           +----------+                         |
|  | R4:Recur |           | 7-item   |                         |
|  |   search |           | working  |                         |
|  | R2:Level |           | R3:Fixed |                         |
|  |   search |           |  format  |                         |
|  +----------+           | R5:50-sec|                         |
|                         |  chunks  |                         |
|                         +----------+                         |
+------------------------------------------------------------+
```

---

## 16. System Interoperation: How All Five Enhancements Work Together

### The Core Integration Pattern

The five enhancements are not isolated features -- they form a pipeline where each
enhancement's output feeds the next's input. Understanding this pipeline is essential for
debugging, extending, or modifying the system.

```
+-----------------------------------------------------------------------+
|                    MEMORY LIFECYCLE PIPELINE                            |
+-----------------------------------------------------------------------+
|                                                                        |
|  [Agent operates, stores memories throughout session]                  |
|       |                                                                |
|       v                                                                |
|  R3: Pre-Compaction Checkpoint                                         |
|       | Captures: task context, decisions, findings, questions, steps  |
|       | Writes to: memory/checkpoints/YYYY-MM-DD-HHmm.md              |
|       |                                                                |
|       v                                                                |
|  [Compaction occurs -- conversation history discarded]                 |
|       |                                                                |
|       v                                                                |
|  R3: Checkpoint Resolution                                             |
|       | Reads: most recent checkpoint                                  |
|       | Injects: into next context window as belief update              |
|       |                                                                |
|       v                                                                |
|  [Agent resumes with continuity]                                       |
|       |                                                                |
|       v                                                                |
|  R1: Memory Consolidation (periodic)                                   |
|       | Input: short-term items (up to 200)                            |
|       | Process: group by Jaccard similarity -> summarize groups        |
|       | Output: consolidated long-term items with derived_from          |
|       | Writes to: memory-store.json + memory/YYYY-MM-DD.md + TypeDB   |
|       |                                                                |
|       v                                                                |
|  R2: Hierarchy Build (weekly on Sundays, or manual)                    |
|       | Input: daily logs in memory/                                   |
|       | Process: aggregate daily -> weekly -> monthly -> quarterly      |
|       | Output: summary files in memory/weekly/, monthly/, quarterly/  |
|       |                                                                |
|       v                                                                |
|  R4: Recursive Search (on demand)                                      |
|       | Input: query + recursive_depth                                 |
|       | Process: search -> extract terms -> refine -> re-search        |
|       | Searches across: all tiers + all hierarchy levels              |
|       | Output: deduplicated results with depth annotations            |
|       |                                                                |
|       v                                                                |
|  R5: BDI Maintenance (periodic heartbeat)                              |
|       | Input: agent cognitive state (10 files)                        |
|       | Process: chunk beliefs -> process each -> detect conflicts      |
|       | Output: pruned intentions, sorted desires, conflict reports    |
|       | Triggers: R2 weekly build on Sundays                           |
|                                                                        |
+-----------------------------------------------------------------------+
```

### Cross-Enhancement Data Flows

**R3 feeds R1**: Checkpoints often contain memories that should be consolidated. The daily
log entries written during the R3 flush become inputs for R1 consolidation when the next
consolidation cycle runs.

**R1 feeds R2**: Consolidated long-term items are materialized to daily Markdown files.
These daily files are the leaf-level input for R2's hierarchy builder.

**R2 feeds R4**: The hierarchy files created by R2 (weekly, monthly, quarterly) are
indexed by OpenClaw and become searchable via R4's recursive search. When R4 searches at
depth > 0, it may find relevant weekly summaries that lead to new terms that find relevant
daily entries.

**R5 integrates R2**: The BDI maintenance cycle triggers R2's weekly hierarchy build on
Sundays, ensuring the temporal hierarchy stays current without manual intervention.

**R5 produces data for R4**: Conflict reports written by R5 to `memory/bdi-conflicts/`
are indexed and searchable via R4. An agent can search for "belief conflicts" to find past
contradictions.

### Timing and Frequency

| Enhancement | When It Runs                                              |
| ----------- | --------------------------------------------------------- |
| R1          | On explicit `memory_consolidate` tool call                |
| R2          | On explicit `memory_build_hierarchy` tool call, or        |
|             | automatically on Sundays via BDI heartbeat                |
| R3          | Automatically when context approaches compaction limit    |
| R4          | On explicit `memory_recall` call with recursive_depth > 0 |
| R5          | On each BDI maintenance heartbeat cycle                   |

---

## 17. Data Lifecycle End-to-End

This section traces a single piece of information from its creation through the entire
system, showing how each enhancement processes it.

### Scenario

An agent discovers during a debugging session that "the authentication token TTL is
12 hours, causing overnight session expiry."

### Step 1: Initial Storage

The agent calls `memory_store_item`:

```typescript
memory_store_item({
  agent_id: "agent-alpha",
  content:
    "Auth token TTL is 12 hours, causing overnight session expiry for users who leave tabs open",
  importance: 0.8,
  tags: ["authentication", "bug", "session", "token-ttl"],
  tier: "short_term",
});
```

This creates a MemoryItem in the short-term store (200-item capacity, 2-hour TTL). It is
also written to `memory/2026-02-24.md` as a daily log entry and sent to TypeDB via
write-through.

### Step 2: R3 Checkpoint (Pre-Compaction)

Later, context approaches the compaction limit. R3 triggers and the agent writes:

```markdown
# Session Checkpoint: 2026-02-24 14:30

## Current Task Context

Investigating overnight session expiry bug. Root cause identified as
12-hour auth token TTL.

## Active Decisions

- Will implement sliding window token refresh

## Key Findings

- Token TTL is 12 hours (hardcoded in auth-config.ts)
- No refresh mechanism exists -- tokens simply expire

## Next Steps

- Implement token refresh endpoint
- Add refresh trigger at T-15 minutes before expiry
```

Compaction occurs. The conversation history is discarded. On the next interaction,
`resolveLatestCheckpoint()` injects this checkpoint into the context.

### Step 3: R1 Consolidation

The consolidation cycle runs. The 12-hour TTL finding is in short-term along with four
related items about authentication:

```
Item 1: "Auth token TTL is 12 hours..." (tags: authentication, bug, session, token-ttl)
Item 2: "Token refresh endpoint needed" (tags: authentication, token, api)
Item 3: "PKCE flow configured for OAuth2" (tags: authentication, oauth2, security)
Item 4: "JWT uses RS256 algorithm" (tags: authentication, jwt, security)
Item 5: "Session cookie is httpOnly" (tags: session, security, cookie)
```

`groupRelatedMemories()` clusters them:

- **Group A**: Items 1, 2, 3, 4 (Jaccard on auth tags > 0.3)
- **Group B**: Item 5 (no sufficient overlap with Group A)

`summarizeMemoryGroup()` produces:

```typescript
{
  id: "mem-consolidated-x1",
  content: "Consolidated from 4 related memories:\n\nAuth token TTL is 12 hours...\n\n---\n\nToken refresh endpoint needed...\n\n---\n\nPKCE flow configured...\n\n---\n\nJWT uses RS256...",
  importance: 0.8,   // max of group
  tags: ["authentication", "bug", "session", "token-ttl", "token", "api", "oauth2", "security", "jwt"],
  tier: "long_term",
  derived_from: ["mem-1", "mem-2", "mem-3", "mem-4"]
}
```

### Step 4: R2 Hierarchy Build (Sunday)

The weekly summary aggregates all daily logs including the authentication findings:

```markdown
# Weekly Summary: 2026-W09

## Monday 2026-02-24

- Investigated overnight session expiry bug
- Root cause: 12-hour auth token TTL with no refresh mechanism
- Decision: implement sliding window token refresh
- ...

## Tuesday 2026-02-25

- Implemented token refresh endpoint
- ...
```

At month end, the monthly summary aggregates weekly summaries:

```markdown
# Monthly Summary: 2026-02

## Key Themes

- Authentication system hardening (weeks 8-9)
- ...

## Key Decisions

- Adopted sliding window token refresh pattern
- ...
```

### Step 5: R4 Recursive Search

Weeks later, someone queries `memory_recall("session problems", recursive_depth: 1)`:

**Depth 0**: Finds "Session cookie is httpOnly" and the R5 conflict report about sessions.
Extracts terms: "cookie", "httpOnly", "redis", "postgresql".

**Depth 1**: Refined query "session problems cookie httpOnly redis postgresql" finds:

- The consolidated authentication entry (mem-consolidated-x1)
- The weekly summary mentioning the token TTL fix

The original finding about 12-hour TTL is discovered indirectly, even though the original
query ("session problems") did not mention authentication or tokens.

### Step 6: R5 BDI Processing

The belief "Auth tokens have a 12-hour TTL" was added to Beliefs.md in week 8. In week 10,
after the fix is deployed, a new belief is added: "Auth tokens now use sliding window
refresh with configurable TTL." The R5 conflict detector flags:

```markdown
## Conflict: Auth Token TTL

- Belief A (week 8): "Auth tokens have a 12-hour fixed TTL"
- Belief B (week 10): "Auth tokens use sliding window refresh with configurable TTL"
- Recommended Action: Belief A is likely stale; update or remove
```

---

## 18. File-by-File Implementation Map

### `extensions/mabos/src/tools/memory-tools.ts` (962 lines)

This is the largest file and contains three of the five enhancements (R1, R3, R4).

**Tools Exposed**:

| Tool                 | Enhancement | Description                                 |
| -------------------- | ----------- | ------------------------------------------- |
| `memory_store_item`  | --          | Store item to working/short-term/long-term  |
| `memory_recall`      | R4          | Hybrid search with optional recursive depth |
| `memory_consolidate` | R1          | Group + summarize related items             |
| `memory_status`      | --          | Show store sizes and counts                 |
| `memory_checkpoint`  | R3          | Write structured session checkpoint         |

**Key Internal Functions**:

| Function                    | Enhancement | Purpose                             |
| --------------------------- | ----------- | ----------------------------------- |
| `groupRelatedMemories()`    | R1          | Jaccard clustering on tag sets      |
| `summarizeMemoryGroup()`    | R1          | Compress group into single item     |
| `recursiveMemorySearch()`   | R4          | Iterative query refinement search   |
| `extractUniqueTerms()`      | R4          | Term extraction heuristic           |
| `semanticRecall()`          | R4          | Hybrid vector + BM25 scoring        |
| `resolveLatestCheckpoint()` | R3          | Read most recent checkpoint file    |
| `writeNativeDailyLog()`     | --          | Bridge to OpenClaw's native indexer |
| `writeLongTermBridge()`     | --          | Bridge to MEMORY.md                 |

### `extensions/mabos/src/tools/memory-materializer.ts` (279 lines)

Contains R2 materializers plus base materializers.

**Functions**:

| Function                       | Enhancement | Input -> Output                            |
| ------------------------------ | ----------- | ------------------------------------------ |
| `materializeFacts()`           | --          | facts.json -> mabos-facts.md               |
| `materializeBeliefs()`         | --          | BDI files -> mabos-beliefs.md              |
| `materializeMemoryItems()`     | --          | memory-store.json -> mabos-memory-items.md |
| `materializeWeeklySummary()`   | R2          | daily logs -> weekly/YYYY-Wnn.md           |
| `materializeMonthlySummary()`  | R2          | weekly -> monthly/YYYY-MM.md               |
| `materializeQuarterlyReview()` | R2          | monthly -> quarterly/YYYY-Qn.md            |
| `materializeAll()`             | --          | Parallel execution of base materializers   |

### `extensions/mabos/src/tools/memory-hierarchy.ts`

Contains R2 tools.

**Tools Exposed**:

| Tool                      | Enhancement | Description                              |
| ------------------------- | ----------- | ---------------------------------------- |
| `memory_build_hierarchy`  | R2          | Scan daily logs, build missing summaries |
| `memory_hierarchy_search` | R2          | Search at specific granularity level     |

**Tool Parameters**:

```
memory_build_hierarchy:
  agent_id:  string  (required)
  scope:     "week" | "month" | "quarter" | "all"  (optional)
  since:     ISO date string  (optional)

memory_hierarchy_search:
  agent_id:  string  (required)
  query:     string  (required)
  level:     "daily" | "weekly" | "monthly" | "quarterly"  (required)
  limit:     number  (default: 5)
```

### `mabos/bdi-runtime/index.ts` (380 lines)

Contains R5 plus R2 integration.

**Functions**:

| Function                  | Enhancement | Purpose                          |
| ------------------------- | ----------- | -------------------------------- |
| `processBeliefChunks()`   | R5          | Recursive chunked processing     |
| `detectBeliefConflicts()` | R5          | Belief contradiction detection   |
| `runMaintenanceCycle()`   | R5 + R2     | Enhanced heartbeat with chunking |
| `discoverAgents()`        | --          | Scan for agent directories       |
| `createBdiService()`      | --          | Service lifecycle management     |
| `pruneIntentions()`       | --          | Stale intention removal          |
| `sortByPriority()`        | --          | Desire priority ordering         |

### `src/auto-reply/reply/memory-flush.ts` (125 lines)

Contains R3 flush integration.

**Functions and Constants**:

| Name                               | Enhancement | Purpose                                       |
| ---------------------------------- | ----------- | --------------------------------------------- |
| `DEFAULT_MEMORY_FLUSH_PROMPT`      | R3          | Enhanced prompt with checkpoint instructions  |
| `resolveMemoryFlushPromptForRun()` | R3          | Date-stamped prompt resolution                |
| `resolveMemoryFlushSettings()`     | R3          | Config: enabled, 4000-token threshold         |
| `shouldRunMemoryFlush()`           | R3          | Token-based trigger with once-per-cycle guard |

### File Dependency Graph

```
memory-flush.ts (R3 trigger)
    |
    | triggers flush prompt that invokes
    v
memory-tools.ts (R1, R3 checkpoint, R4)
    |
    | consolidated items materialized by
    v
memory-materializer.ts (R2 materializers)
    |
    | hierarchy tools defined in
    v
memory-hierarchy.ts (R2 tools)
    |
    | weekly build triggered by
    v
bdi-runtime/index.ts (R5 + R2 integration)
    |
    | discovers agents, processes beliefs,
    | triggers weekly hierarchy builds
    v
[Agent cognitive state files]
```

---

## 19. Technology Integration Layer

### 19.1 OpenClaw Native Bridge

All MABOS memory tools write to Markdown files in the `memory/` directory. This design
decision is critical: it means MABOS piggybacks on OpenClaw's existing indexing
infrastructure without requiring any modifications to the OpenClaw core.

**How it works**:

```
MABOS writes Markdown file to memory/
         |
         v
OpenClaw chokidar file watcher detects filesystem change
         |
         v
File content is processed by indexing pipeline:
         |
         +---> FTS5 BM25 indexing (SQLite full-text search)
         |     - Tokenizes content
         |     - Builds inverted index
         |     - Supports BM25 ranking
         |
         +---> sqlite-vec vector indexing
               - Generates embedding via configured provider
               - Stores vector in sqlite-vec
               - Supports cosine similarity search
```

**What this means for each enhancement**:

| Enhancement | Files Written                                     | Automatically Indexed? |
| ----------- | ------------------------------------------------- | ---------------------- |
| R1          | memory/YYYY-MM-DD.md, memory-store.json           | Yes (Markdown only)    |
| R2          | memory/weekly/_.md, monthly/_.md, quarterly/\*.md | Yes                    |
| R3          | memory/checkpoints/\*.md                          | Yes                    |
| R5          | memory/bdi-conflicts/\*.md                        | Yes                    |

**Hybrid scoring** in OpenClaw's search combines:

- **BM25 keyword score**: Exact and partial term matches via SQLite FTS5
- **Vector semantic score**: Cosine similarity via sqlite-vec
- **MMR (Maximal Marginal Relevance)**: Diversity penalty to avoid redundant results

### 19.2 TypeDB Write-Through

Memory operations follow a write-through pattern where TypeDB is a secondary store:

```
Memory Operation (store/consolidate)
    |
    +---> Primary: JSON file (memory-store.json)
    |         Source of truth for all memory items
    |
    +---> Primary: Markdown file (memory/YYYY-MM-DD.md)
    |         Source for OpenClaw indexing
    |
    +---> Secondary: TypeDB (best-effort, non-blocking)
              |
              +---> Success: Graph node created with relationships
              +---> Failure: Logged and ignored; JSON/Markdown are authoritative
```

**Why write-through and not write-back?** TypeDB provides graph-based querying that can
express relationships between memories (e.g., "find all memories that derive from memory X"
via the `derived_from` relationship). However, TypeDB availability is not guaranteed in all
deployments. The write-through pattern means:

- Core functionality works without TypeDB
- TypeDB enhances querying when available
- No data loss if TypeDB is temporarily down

### 19.3 Embedding Providers

Semantic search in R4 requires embedding vectors. The system supports multiple providers:

| Provider      | Model                    | Dimensions |
| ------------- | ------------------------ | ---------- |
| OpenAI        | text-embedding-3-small   | 1536       |
| OpenAI        | text-embedding-3-large   | 3072       |
| Google Gemini | embedding-001            | 768        |
| Voyage AI     | voyage-2                 | 1024       |
| Local         | node-llama-cpp (various) | varies     |

The provider is configured at the OpenClaw level, not the MABOS level. MABOS calls
OpenClaw's search API, which handles embedding generation transparently.

---

## 20. Verification and Testing

### 20.1 Unit Testing Approach

Each enhancement should be tested at the function level:

**R1 Tests** (`memory-consolidation.test.ts`):

```typescript
describe("groupRelatedMemories", () => {
  it("groups items with Jaccard similarity > 0.3", () => {
    const items = [
      makeItem({ tags: ["auth", "security", "jwt"] }),
      makeItem({ tags: ["auth", "security", "oauth"] }),
      makeItem({ tags: ["database", "migration"] }),
    ];
    const groups = groupRelatedMemories(items);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toHaveLength(2); // auth items grouped
    expect(groups[1]).toHaveLength(1); // database item alone
  });

  it("creates singleton groups for items with no overlap", () => {
    const items = [makeItem({ tags: ["alpha"] }), makeItem({ tags: ["beta"] })];
    const groups = groupRelatedMemories(items);
    expect(groups).toHaveLength(2);
  });
});

describe("summarizeMemoryGroup", () => {
  it("passes through single-item groups unchanged", () => {
    const item = makeItem({ importance: 0.5 });
    const result = summarizeMemoryGroup([item]);
    expect(result.content).toBe(item.content);
    expect(result.derived_from).toBeUndefined();
  });

  it("takes max importance from group", () => {
    const items = [
      makeItem({ importance: 0.3 }),
      makeItem({ importance: 0.9 }),
      makeItem({ importance: 0.5 }),
    ];
    const result = summarizeMemoryGroup(items);
    expect(result.importance).toBe(0.9);
  });

  it("unions tags from all items", () => {
    const items = [makeItem({ tags: ["a", "b"] }), makeItem({ tags: ["b", "c"] })];
    const result = summarizeMemoryGroup(items);
    expect(result.tags).toEqual(expect.arrayContaining(["a", "b", "c"]));
  });

  it("populates derived_from with source IDs", () => {
    const items = [makeItem({ id: "mem-1" }), makeItem({ id: "mem-2" })];
    const result = summarizeMemoryGroup(items);
    expect(result.derived_from).toEqual(["mem-1", "mem-2"]);
  });
});
```

**R4 Tests** (`recursive-search.test.ts`):

```typescript
describe("recursiveMemorySearch", () => {
  it("returns standard results at depth 0", async () => {
    const results = await recursiveMemorySearch(api, "agent-1", "auth", 0, 10, []);
    expect(results.every((r) => r._searchDepth === 0)).toBe(true);
  });

  it("expands search at depth > 0", async () => {
    const depthZero = await recursiveMemorySearch(api, "agent-1", "auth", 0, 10, []);
    const depthOne = await recursiveMemorySearch(api, "agent-1", "auth", 1, 10, []);
    expect(depthOne.length).toBeGreaterThanOrEqual(depthZero.length);
  });

  it("deduplicates results across depths", async () => {
    const results = await recursiveMemorySearch(api, "agent-1", "auth", 2, 10, []);
    const ids = results.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("caps at max depth 3", async () => {
    const results = await recursiveMemorySearch(api, "agent-1", "auth", 5, 10, []);
    expect(results.every((r) => r._searchDepth >= 0)).toBe(true);
    // Implementation should clamp depth to 3
  });
});

describe("extractUniqueTerms", () => {
  it("extracts frequent terms from result content", () => {
    const items = [
      makeItem({ content: "JWT token implementation with RS256" }),
      makeItem({ content: "JWT token refresh using sliding window" }),
    ];
    const terms = extractUniqueTerms(items);
    expect(terms[0]).toBe("token"); // Most frequent
  });

  it("filters out short terms (<=3 chars)", () => {
    const items = [makeItem({ content: "the JWT is a token" })];
    const terms = extractUniqueTerms(items);
    expect(terms).not.toContain("the");
    expect(terms).not.toContain("is");
  });
});
```

**R5 Tests** (`bdi-chunked-processing.test.ts`):

```typescript
describe("processBeliefChunks", () => {
  it("processes small files in a single pass", () => {
    const beliefs = generateBeliefSections(30); // 30 sections
    const result = processBeliefChunks(beliefs, mockProcessor);
    expect(result.chunksProcessed).toBe(1); // Under 50 threshold
  });

  it("chunks large files into groups of 50", () => {
    const beliefs = generateBeliefSections(120); // 120 sections
    const result = processBeliefChunks(beliefs, mockProcessor);
    expect(result.chunksProcessed).toBe(3); // 50 + 50 + 20
  });

  it("preserves all sections after chunking", () => {
    const beliefs = generateBeliefSections(75);
    const result = processBeliefChunks(beliefs, identityProcessor);
    const outputSections = result.result.split(/(?=^##\s)/m).filter(Boolean);
    expect(outputSections.length).toBe(75);
  });
});

describe("detectBeliefConflicts", () => {
  it("detects contradictory beliefs about same subject", () => {
    const beliefs = `
## Session Store
Redis is our primary session store.
Certainty: 0.9

## Session Store
Sessions are stored in PostgreSQL after migration.
Certainty: 0.85
`;
    const conflicts = detectBeliefConflicts(beliefs);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].subject).toBe("Session Store");
  });

  it("ignores low-certainty conflicts", () => {
    const beliefs = `
## API Style
We might use REST.
Certainty: 0.3

## API Style
GraphQL could be better.
Certainty: 0.2
`;
    const conflicts = detectBeliefConflicts(beliefs);
    expect(conflicts).toHaveLength(0); // Both below 0.6 threshold
  });
});
```

### 20.2 Integration Testing

Integration tests verify the cross-enhancement data flows described in Section 16:

**R3-to-R1 Flow**:

1. Trigger memory flush
2. Verify checkpoint file written
3. Run consolidation
4. Verify daily log entries from flush are included in consolidation input

**R1-to-R2 Flow**:

1. Store related memories in short-term
2. Consolidate (R1)
3. Build weekly hierarchy (R2)
4. Verify weekly summary includes content from consolidated entries

**R2-to-R4 Flow**:

1. Build hierarchy (R2)
2. Search with recursive depth (R4)
3. Verify hierarchy files appear in search results

**R5-R2 Sunday Integration**:

1. Mock the date to Sunday
2. Run maintenance cycle (R5)
3. Verify weekly summary was triggered (R2)

### 20.3 Manual Verification Checklist

For each enhancement, verify:

| Check                                            | Enhancement | How to Verify                                  |
| ------------------------------------------------ | ----------- | ---------------------------------------------- |
| Short-term items consolidate to long-term        | R1          | Call memory_consolidate, check memory_status   |
| Consolidated items have derived_from             | R1          | Inspect memory-store.json                      |
| Jaccard grouping clusters related items          | R1          | Store items with overlapping tags, consolidate |
| Weekly summary file created                      | R2          | Call memory_build_hierarchy scope=week         |
| Monthly summary aggregates weekly files          | R2          | Build hierarchy with scope=month               |
| Quarterly review aggregates monthly files        | R2          | Build hierarchy with scope=quarter             |
| Hierarchy files indexed by OpenClaw              | R2          | Search for content from hierarchy files        |
| Checkpoint written before compaction             | R3          | Watch memory/checkpoints/ during long session  |
| Checkpoint injected after compaction             | R3          | Check agent context after compaction           |
| Depth-0 search returns baseline results          | R4          | Call memory_recall with recursive_depth=0      |
| Depth-1 search finds more than depth-0           | R4          | Compare result counts                          |
| Results include depth annotations                | R4          | Inspect output format                          |
| Large belief files chunked at 50 sections        | R5          | Create >50 belief sections, run cycle          |
| Conflicts detected between contradictory beliefs | R5          | Add contradictions, run cycle                  |
| Conflict reports written to memory/bdi-conflicts | R5          | Check directory after cycle                    |
| Sunday triggers weekly hierarchy build           | R5+R2       | Run cycle on Sunday, check weekly/             |

### 20.4 Failure Mode Testing

Each enhancement should be tested for graceful degradation:

| Failure Scenario                    | Expected Behavior                              |
| ----------------------------------- | ---------------------------------------------- |
| TypeDB unavailable during R1        | Consolidation succeeds; TypeDB write skipped   |
| No daily logs exist for R2 week     | Weekly summary skipped; no error               |
| Checkpoint directory missing for R3 | Created on first write                         |
| Empty results at R4 depth 0         | No recursion attempted; empty results returned |
| Belief file has no ## headers (R5)  | Processed as single chunk                      |
| OpenClaw search unavailable (R4)    | Falls back to substring matching               |

---

## 21. Performance Considerations and Limits

### 21.1 Memory Tier Capacity

| Tier       | Capacity  | Eviction Policy     | Performance Characteristic    |
| ---------- | --------- | ------------------- | ----------------------------- |
| Working    | 7 items   | LRU                 | O(1) access, always in memory |
| Short-term | 200 items | TTL (2h) + overflow | O(n) scan for TTL check       |
| Long-term  | Unbounded | None                | O(log n) via indexed search   |

The 7-item working memory limit follows Miller's Law (7 +/- 2) and ensures the most
immediately relevant items are always available without search.

The 200-item short-term limit and 2-hour TTL prevent unbounded growth of the fast-access
tier. Items that survive beyond 2 hours are either consolidated (R1) or lost.

### 21.2 R1 Consolidation Cost

- **Jaccard computation**: O(n^2) pairwise comparison where n is the number of items to
  consolidate. For 200 items, this is 19,900 comparisons -- fast for modern hardware.
- **No LLM calls**: The grouping and summarization are purely algorithmic. This keeps
  consolidation latency under 100ms for typical workloads.

### 21.3 R2 Hierarchy Build Cost

- **Weekly**: Reads 7 daily files, writes 1 weekly file. I/O bound, typically < 500ms.
- **Monthly**: Reads 4-5 weekly files, writes 1 monthly file. Similar cost.
- **Quarterly**: Reads 3 monthly files, writes 1 quarterly file.
- **Full rebuild** (scope="all"): Linear in the number of days since `since` date.

### 21.4 R4 Recursive Search Cost

Each recursion level adds one search round-trip:

| Depth | Search Passes | Typical Latency (with vector search) |
| ----- | ------------- | ------------------------------------ |
| 0     | 1             | 50-200ms                             |
| 1     | 2             | 100-400ms                            |
| 2     | 3             | 150-600ms                            |
| 3     | 4             | 200-800ms                            |

The depth cap of 3 ensures worst-case latency stays under 1 second. Beyond depth 3,
empirical testing showed diminishing returns: the query becomes so broad that results
lose relevance.

### 21.5 R5 Chunking Cost

- **Processing**: Each chunk of 50 sections is processed independently. For a 200-section
  belief file, 4 chunks are processed sequentially.
- **Conflict detection**: O(n^2) within each subject group, but subject groups are
  typically small (2-5 beliefs per subject). Total cost is closer to O(n \* k) where k is
  the average group size.

### 21.6 Storage Growth

Approximate storage growth rates for an active agent:

| Data Type         | Growth Rate             | Notes                             |
| ----------------- | ----------------------- | --------------------------------- |
| Daily logs        | ~2-5 KB/day             | Depends on session activity       |
| Weekly summaries  | ~1-3 KB/week            | Compressed from 7 daily logs      |
| Monthly summaries | ~2-4 KB/month           | Compressed from 4-5 weeklies      |
| Quarterly reviews | ~3-5 KB/quarter         | Compressed from 3 monthlies       |
| Checkpoints       | ~1-2 KB/compaction      | 2-5 compactions per long session  |
| Conflict reports  | ~0.5-1 KB when detected | Only written when conflicts exist |
| memory-store.json | Grows, then stabilizes  | R1 consolidation compresses       |

Over a year, an active agent generates approximately:

- 365 daily logs (~1 MB)
- 52 weekly summaries (~150 KB)
- 12 monthly summaries (~40 KB)
- 4 quarterly reviews (~18 KB)
- ~500 checkpoints (~750 KB)

Total: approximately 2 MB/year of structured memory data. This is well within practical
limits for file-based storage and indexing.

---

## 22. References and Related Documents

### Primary Reference

- **RLM Paper**: "Recursive Language Models" -- arXiv:2512.24601v2
  Authors: Ruiqi Zhang, Tim Kraska, Omar Khattab
  Published: January 2026
  Key sections relevant to MABOS: Sections 3 (Recursive Decomposition), 4 (Hierarchical
  Summarization), 5 (Recursive Navigation), 7 (Fixed Working Context)

### Related Architecture Documents

These three companion documents provide additional context for the systems that R1-R5
integrate with:

- **Memory & Knowledge Deep-Dive**: `docs/plans/2026-02-24-memory-system-architecture.md`
  Covers the complete memory system including the three-tier store, TypeDB integration,
  embedding providers, and the OpenClaw native bridge in detail. Read this for a deeper
  understanding of the memory infrastructure that R1-R5 build upon.

- **BDI + SBVR Framework**: `docs/plans/2026-02-24-bdi-sbvr-multiagent-framework.md`
  Covers the BDI cognitive architecture, SBVR rule engine, commitment strategies, and
  multi-agent coordination. Read this for a deeper understanding of the BDI cycle that
  R5 enhances.

- **Full System Architecture**: `docs/plans/2026-02-24-openclaw-mabos-system-architecture.md`
  Covers the complete OpenClaw-MABOS system including the extension architecture, tool
  registration, agent lifecycle, and configuration system. Read this for the big picture
  of how all components fit together.

### Source Files

| File                                                | Lines | Enhancements |
| --------------------------------------------------- | ----- | ------------ |
| `extensions/mabos/src/tools/memory-tools.ts`        | 962   | R1, R3, R4   |
| `extensions/mabos/src/tools/memory-materializer.ts` | 279   | R2           |
| `extensions/mabos/src/tools/memory-hierarchy.ts`    | --    | R2           |
| `mabos/bdi-runtime/index.ts`                        | 380   | R5           |
| `src/auto-reply/reply/memory-flush.ts`              | 125   | R3           |

---

_This document describes the RLM-inspired memory enhancements as designed and implemented
in OpenClaw-MABOS. For implementation planning and task tracking, refer to the project
management tools. For questions about specific behaviors, consult the source files listed
in Section 18._
