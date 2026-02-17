# Intelligent Delegation Spec — OpenClaw Formalization

_Final v2 — 2026-02-16_
_Based on: Tomašev, Franklin, Osindero — "Intelligent AI Delegation" (arXiv:2602.11865, Feb 2026)_
_Target branch: `feat/subagent-comms` (extends existing orchestrator request registry)_
_Reviewed by: Opus (architecture), Codex (code-grounded, partial — killed after 20min reasoning)_

---

## 1. Overview

This spec formalizes six capabilities into OpenClaw's subagent infrastructure, building on the existing `feat/subagent-comms` work (orchestrator request/respond tools, session status projection, request registry). The goal: move from ad-hoc orchestration to protocol-level intelligent delegation.

### What Already Exists (feat/subagent-comms)

| Component                                                       | Status   | Key Files                                                         |
| --------------------------------------------------------------- | -------- | ----------------------------------------------------------------- |
| Orchestrator request registry                                   | ✅ Built | `src/agents/orchestrator-request-registry.ts`, `.store.ts`        |
| `request_orchestrator` tool (child→parent)                      | ✅ Built | `src/agents/tools/request-orchestrator-tool.ts`                   |
| `respond_orchestrator_request` tool (parent→child)              | ✅ Built | `src/agents/tools/respond-orchestrator-request-tool.ts`           |
| Session status projection (`runStatus`, `pendingRequestCount`)  | ✅ Built | `src/agents/tools/sessions-list-tool.ts`, `sessions-tree-tool.ts` |
| Rate limiting (5/min/child, 3 pending/child, 20 pending/parent) | ✅ Built | `orchestrator-request-registry.ts` constants                      |
| Persistence (disk-backed registry)                              | ✅ Built | `orchestrator-request-registry.store.ts`                          |

**Note:** `sessions_tree` exposes `runStatus` and `pendingRequestCount` but NOT `blockedReason`. `sessions_list` exposes all three. The tree derives a simplified status: `"blocked"` if pendingRequests > 0, else `"running"`.

### Critical Architecture Files (reviewers confirmed)

| File                                      | Role                                       | Lines |
| ----------------------------------------- | ------------------------------------------ | ----- |
| `src/agents/tools/sessions-spawn-tool.ts` | Spawn flow (tool interface)                | ~380  |
| `src/agents/subagent-registry.ts`         | Run registration, `SubagentRunRecord` type | ~614  |
| `src/agents/subagent-announce.ts`         | Post-completion announce flow              | ~200+ |
| `src/agents/pi-tools.ts`                  | Tool list resolution for agents            | ~438  |
| `src/agents/pi-tools.policy.ts`           | Tool policy pipeline (allow/deny)          | ~260  |
| `src/agents/delegation-prompt.ts`         | Fleet table prompt injection               | ~100  |
| `src/agents/system-prompt.ts`             | System prompt builder                      | large |
| `src/config/zod-schema.agent-runtime.ts`  | Agent config schema (Zod)                  | ~640  |

### What This Spec Adds

| Feature                              | Priority | Complexity  |
| ------------------------------------ | -------- | ----------- |
| **A. Verification Contracts**        | P0       | Medium      |
| **B. Agent Capability Cards**        | P1       | Low         |
| **C. Structured Completion Reports** | P0       | Medium      |
| **D. Progress Streaming**            | P1       | Medium      |
| **E. Per-Spawn Tool Scoping**        | P2       | Medium-High |
| **F. Agent Performance Tracking**    | P2       | Low         |

### Backward Compatibility

All new `sessions_spawn` fields are optional. Existing spawn calls without these fields behave identically to current behavior. No breaking changes.

### Prerequisites

1. **Merge `feat/subagent-comms` to main** — all new work builds on this branch. Must be clean first.
2. **Extract core spawn logic** from `sessions-spawn-tool.ts` into a reusable function (see Wave 0).

---

## 2. Feature A: Verification Contracts

### Problem

Subagents report "done" but output is missing, malformed, or incomplete. The orchestrator has no automated way to validate task completion. This is the #1 failure mode in production fleet operations.

### Design

Add an optional `verification` field to `sessions_spawn`. When present, the orchestrator validates artifacts **before** announcing success to the parent session.

#### 2.1 Schema Extension (`sessions_spawn`)

```typescript
// New: src/agents/spawn-verification.types.ts

export type VerificationArtifact = {
  /** Path to expected output file (relative to workspace or absolute) */
  path: string;
  /** Optional: validate file is valid JSON */
  json?: boolean;
  /** Optional: if json=true, validate top-level is array with min items */
  minItems?: number;
  /** Optional: if json=true, validate each item has these keys */
  requiredKeys?: string[];
  /** Optional: minimum file size in bytes (catches empty/stub files) */
  minBytes?: number;
};

export type VerificationContract = {
  /** List of expected output artifacts */
  artifacts?: VerificationArtifact[];
  /** If true, require the subagent's final tool call to be report_completion */
  requireCompletionReport?: boolean;
  /** Action on verification failure */
  onFailure?: "retry_once" | "escalate" | "fail";
  /** Timeout for verification checks (default: 30s) */
  verificationTimeoutMs?: number;
};
```

**Review decision:** Removed `validationCommand` from v1. On macOS there's no process sandbox, and the command string comes from LLM output — it's an arbitrary code execution vector. Built-in artifact checks cover 95% of cases. Can add later behind a `dangerouslyAllowValidationCommands` config flag.

#### 2.2 Spawn & Verification Flow

**⚠️ CRITICAL: Verification hook goes in `runSubagentAnnounceFlow()` in `src/agents/subagent-announce.ts`.** NOT in the spawn tool. The announce flow has two code paths (RPC `agent.wait` + lifecycle event fallback) that both converge here. If verification is placed elsewhere, one path bypasses it.

```
1. Parent calls sessions_spawn({ task, verification, ... })
   → verification contract stored on SubagentRunRecord
2. Subagent runs normally (no awareness of verification)
3. Subagent completes (or times out)
4. runSubagentAnnounceFlow() fires (both code paths converge here)
   4a. Wait for embedded run settlement (existing: waitForEmbeddedPiRunEnd)
   4b. Wait for compaction if in progress (existing)
   4c. NEW: If verification contract exists on the run record:
       - Run artifact checks (file exists, size, JSON schema)
       - Parse completion report from final message (if requireCompletionReport)
       - Apply verificationTimeoutMs (default 30s) to the checks
       - If ALL pass → proceed to announce as normal
       - If ANY fail → execute onFailure:
         * "fail": mark as failed, announce with verification failure details
         * "escalate": announce failure + structured details to parent
         * "retry_once": call extracted spawn function (Wave 0) with
           { retryOf: originalRunId, retryReason: failureDetails }
           appended to the task prompt
   4d. Store VerificationResult on SubagentRunRecord
5. Announce to parent (existing flow continues)
```

#### 2.3 SubagentRunRecord Extension

```typescript
// Extend existing SubagentRunRecord in src/agents/subagent-registry.ts

export type VerificationResult = {
  status: "passed" | "failed" | "skipped";
  checks: Array<{
    type: "artifact" | "completion_report";
    target?: string; // file path
    passed: boolean;
    reason?: string; // human-readable failure reason
  }>;
  verifiedAt: number;
};

// Add to SubagentRunRecord:
//   verification?: VerificationContract;      // the contract (from spawn)
//   verificationResult?: VerificationResult;  // the outcome (post-run)
```

#### 2.4 Retry Behavior

When `onFailure: "retry_once"`:

- The retried spawn includes failure context in the task prompt:
  ```
  [RETRY — Previous attempt failed verification]
  Failure reason: File output/results.json was empty (0 bytes, minimum 100 bytes required).
  Original task: <original task text>
  ```
- The retried run carries `{ retryOf: originalRunId }` metadata
- Only one retry — if the retry also fails verification, it becomes a `"fail"`

**Prerequisite:** Core spawn logic must be extracted from `sessions-spawn-tool.ts` into a reusable function (Wave 0). The spawn tool is a 380-line monolith with provider limit checks, depth checks, config resolution, model overrides. Without extraction, retry requires either duplicating all that logic or synthetic tool calls (both terrible).

#### 2.5 Acceptance Criteria

- [ ] `sessions_spawn` accepts optional `verification` field
- [ ] Verification contract stored on `SubagentRunRecord`
- [ ] Verification runs inside `runSubagentAnnounceFlow()` after run settlement
- [ ] Artifact checks: file existence, minBytes, JSON validity, minItems, requiredKeys
- [ ] `verificationTimeoutMs` applies to all checks (default 30s)
- [ ] `onFailure: "fail"` marks run as failed with structured failure details
- [ ] `onFailure: "escalate"` announces failure to parent with details
- [ ] `onFailure: "retry_once"` re-spawns with failure context (requires Wave 0)
- [ ] `sessions_tree` shows verification status per node
- [ ] Unit tests for each verification check type
- [ ] E2E test: spawn with contract, valid file → passes
- [ ] E2E test: spawn with contract, invalid file → triggers onFailure
- [ ] E2E test: verification timeout → maps to onFailure path
- [ ] Handles race: verification doesn't run while compaction is in progress

---

## 3. Feature B: Agent Capability Cards

### Problem

Agent routing is tribal knowledge in MEMORY.md. New sessions lose this context. Orchestrators make suboptimal routing decisions.

### Design

Add a `capabilities` field to agent definitions in `openclaw.json`. Use alongside existing `description` field (which already powers the fleet table in `delegation-prompt.ts`).

#### 3.1 Config Schema Extension

```jsonc
// In openclaw.json agents.list[]
{
  "id": "athena",
  "model": "google/gemini-3-pro-preview",
  "description": "Deep analysis and architecture review", // EXISTING — keep for fleet table
  // NEW:
  "capabilities": {
    "tags": ["research", "synthesis", "reasoning", "code-review"],
    "costTier": "medium", // "free" | "cheap" | "medium" | "expensive"
    "typicalLatency": "90s", // human-readable hint
    "notes": "No file writes, no tool access beyond search. Daily quota limits.",
  },
}
```

**Review decisions:**

- `description` stays as-is for fleet table. `capabilities` is for machine-queryable metadata.
- Combined `strengths`/`weaknesses` into single `notes` field — the distinction was arbitrary.
- `costTier` is manually set for now. Future: derive from model pricing config via `resolveModelCost()`.
- Removed `maxConcurrency` — overlaps with existing `subagents.maxChildrenPerAgent`.

#### 3.2 Schema Validation

Must update both:

1. `src/config/types.agents.ts` — TypeScript type
2. `src/config/zod-schema.agent-runtime.ts` — Zod schema (for `openclaw doctor` validation)

Both files need the new `capabilities` object. It's optional and `.passthrough()` or `.strict()` depending on convention.

#### 3.3 Routing Helper

```typescript
// New: src/agents/capability-routing.ts

export type RoutingHint = {
  taskType?: string; // "research" | "code" | "review" | "grunt" | "debug"
  costPreference?: string; // "cheapest" | "balanced" | "best"
  requiredTags?: string[]; // must-have capabilities
};

export type AgentSuggestion = {
  agentId: string;
  score: number;
  reason: string;
};

/**
 * Given a routing hint, return ranked agent IDs from config.
 * Does NOT auto-spawn — recommends only. Orchestrator decides.
 */
export function suggestAgents(hint: RoutingHint, config: OpenClawConfig): AgentSuggestion[];
```

#### 3.4 System Prompt Injection

Enhance the existing fleet table in `delegation-prompt.ts` to include capability tags:

```
## Available Subagents
| Agent | Tags | Cost | Latency | Notes |
|-------|------|------|---------|-------|
| minimax | code, grunt, parallel | cheap | 30s | Bulk work, pattern-following |
| athena | research, synthesis, review | medium | 90s | Deep analysis, daily quota |
...
```

#### 3.5 Acceptance Criteria

- [ ] `capabilities` field accepted in agent config schema
- [ ] `openclaw doctor` validates new field (Zod schema updated)
- [ ] `suggestAgents()` returns ranked list based on tags/cost
- [ ] Fleet table in system prompt includes capability data when available
- [ ] Existing configs without `capabilities` still work (backward compatible)
- [ ] Unit tests for routing logic (tag matching, cost preference)

---

## 4. Feature C: Structured Completion Reports

### Problem

Subagent results arrive as free-text prose. The orchestrator must read through it to determine success/failure/artifacts. Wastes context and is error-prone.

### Design

**Tool-based approach** (per review recommendation): Create a `report_completion` tool that subagents call as their final action. Tool calls have structured schemas enforced by the API — no parsing ambiguity.

#### 4.1 New Tool: `report_completion`

```typescript
// New: src/agents/tools/report-completion-tool.ts

const ReportCompletionSchema = Type.Object({
  status: Type.Union([Type.Literal("complete"), Type.Literal("partial"), Type.Literal("failed")]),
  confidence: Type.Union([Type.Literal("high"), Type.Literal("medium"), Type.Literal("low")]),
  artifacts: Type.Optional(
    Type.Array(
      Type.Object({
        path: Type.String(),
        description: Type.Optional(Type.String()),
      }),
    ),
  ),
  blockers: Type.Optional(Type.Array(Type.String())),
  summary: Type.String({ description: "What was accomplished" }),
  warnings: Type.Optional(Type.Array(Type.String())),
});
```

#### 4.2 Fallback: Text Delimiter Parser

For models without robust tool support, also support text-based reports:

```typescript
// New: src/agents/completion-report-parser.ts

export type CompletionReport = {
  status: "complete" | "partial" | "failed";
  confidence: "high" | "medium" | "low";
  artifacts: Array<{ path: string; description?: string }>;
  blockers: string[];
  summary: string;
  warnings: string[];
};

/**
 * Extract from tool call result OR parse from text delimiters.
 * Searches from END of message backward.
 * Case-insensitive. Skips content inside fenced code blocks.
 * Returns null if no report found.
 */
export function parseCompletionReport(text: string): CompletionReport | null;
```

#### 4.3 Integration

1. **Tool availability:** `report_completion` available to ALL subagents by default (included in default tool list). No tool-missing errors.
2. **Prompt injection:** Only inject usage instructions when spawner sets `completionReport: true` (standalone option, independent of verification):
   ```
   Before finishing, call the report_completion tool with your status, artifacts, and summary.
   ```
3. **Post-completion parsing:** In `runSubagentAnnounceFlow()`, check if last tool call was `report_completion`. If not, try text parser as fallback. Store parsed report on `SubagentRunRecord.completionReport`.
4. **`sessions_tree` enhancement:**
   ```
   └─ minimax-batch-1 ✅ complete (high) [42s]
   └─ minimax-batch-2 ⚠️ partial (medium) [38s] — 1 blocker
   └─ minimax-batch-3 ❌ failed (low) [12s]
   ```

#### 4.4 Acceptance Criteria

- [ ] `report_completion` tool created and available to subagents
- [ ] Text fallback parser: searches from end, case-insensitive, skips code blocks
- [ ] Parsed report stored on `SubagentRunRecord.completionReport`
- [ ] `sessions_tree` shows completion status/confidence when report exists
- [ ] `completionReport: true` spawn option triggers prompt injection
- [ ] Verification contract can require completion report
- [ ] Unit tests: tool call parsing, text parsing, malformed, missing, edge cases

---

## 5. Feature D: Progress Streaming

### Problem

After spawning a subagent, the orchestrator has no signal until completion or timeout. Long-running tasks create a "black hole."

### Design

Lightweight non-blocking `report_progress` tool for status updates.

#### 5.1 New Tool: `report_progress`

```typescript
// New: src/agents/tools/report-progress-tool.ts

const ReportProgressSchema = Type.Object({
  phase: Type.String({ description: "Current phase or step" }),
  percentComplete: Type.Optional(Type.Number({ minimum: 0, maximum: 100 })),
  level: Type.Optional(
    Type.Union([
      Type.Literal("L0_operational"),
      Type.Literal("L1_plan_update"),
      Type.Literal("L2_detail"),
    ]),
  ),
  metrics: Type.Optional(Type.Record(Type.String(), Type.Union([Type.String(), Type.Number()]))),
});
```

#### 5.2 Behavior

- **Non-blocking:** Fire-and-forget. Returns immediately, no wait for parent response.
- **Rate limited:** Max 1 update per 30 seconds per subagent (per review: 10s is a no-op given LLM turn cadence; 30s is the real practical limit).
- **Storage:** Append-only log on `SubagentRunRecord.progressLog`, capped at 100 entries (oldest evicted). Stored separately from main registry to avoid bloating persistence I/O.
- **Availability:** Available to ALL subagents. Prompt instructions injected only when spawner opts in via `progressReporting: true`.

#### 5.3 `sessions_tree` Enhancement

```typescript
// Extend SessionsTreeNode
type SessionsTreeNode = {
  // ... existing fields ...
  latestProgress?: {
    phase: string;
    percentComplete?: number;
    updatedAt: number;
  };
};
```

Display: `└─ minimax-batch-1 🔄 running [42s] — "Processing batch 3/5" (60%)`

#### 5.4 Acceptance Criteria

- [ ] `report_progress` tool available to all subagents
- [ ] Non-blocking (returns immediately)
- [ ] Rate limited (1/30s/child)
- [ ] Progress log capped at 100 entries, stored separately from registry
- [ ] `sessions_tree` shows latest progress for running sessions
- [ ] `progressReporting: true` spawn option triggers prompt instructions
- [ ] Unit tests for rate limiting, storage, display
- [ ] E2E test: spawn, report progress, verify in tree

---

## 6. Feature E: Per-Spawn Tool Scoping

### Problem

All subagents of a given type get the same tool access. Research agents don't need `message`. Code agents shouldn't have `gog`. Principle of least privilege is violated.

### Design

Add optional `toolsAllow` and `toolsDeny` overrides to `sessions_spawn` that narrow (never widen) the agent's configured tool access.

#### 6.1 Schema Extension

```typescript
// Extend sessions_spawn parameters
toolsAllow?: string[];  // intersected with agent config (can only narrow)
toolsDeny?: string[];   // subtracted after allow (can only narrow)
```

Resolution: `Final = (AgentConfig ∩ spawnAllow) − spawnDeny`

#### 6.2 Threading Mechanism

**⚠️ CRITICAL: There is currently no way to pass per-spawn tool restrictions to the child session's tool resolution.**

The spawn tool (`sessions-spawn-tool.ts`) sends a message via `callGateway({ method: "agent" })`. Tool resolution happens later in `pi-tools.ts` / `pi-tools.policy.ts` when the agent processes the message. There's no bridge between the two.

**Chosen approach (Option 2 from review): Store on SessionEntry.**

1. `sessions-spawn-tool.ts` writes `toolOverrides: { allow, deny }` to the child's `SessionEntry` in the session store
2. `pi-tools.policy.ts` reads `toolOverrides` from the session entry during tool resolution
3. Applies intersection/subtraction logic

This is cleanest because `SessionEntry` is already the canonical source for per-session overrides (e.g., `thinkingLevel`). Requires modifying:

- `src/config/sessions.ts` — add `toolOverrides` to `SessionEntry` type
- `src/agents/tools/sessions-spawn-tool.ts` — write overrides to session store
- `src/agents/pi-tools.policy.ts` — read and apply overrides

#### 6.3 Enforcement

- **Validate at spawn time:** If `toolsAllow` contains tools not in agent config, return error (don't silently ignore). Gives orchestrator feedback.
- **Scoping can only narrow, never widen.** Enforced by intersection logic.

#### 6.4 Acceptance Criteria

- [ ] `sessions_spawn` accepts `toolsAllow` and `toolsDeny`
- [ ] Tool overrides stored on `SessionEntry`
- [ ] `pi-tools.policy.ts` reads and applies overrides
- [ ] Widening attempt returns spawn error (not silent)
- [ ] Unit tests: allow-only, deny-only, both, empty, widening blocked
- [ ] E2E test: spawn with `toolsDeny=["message"]`, verify tool unavailable

---

## 7. Feature F: Agent Performance Tracking

### Problem

Agent routing decisions are based on anecdotal experience. No systematic data on which agents succeed at what tasks.

### Design

Automatically log performance metrics after each subagent run.

#### 7.1 Performance Record

```typescript
// New: src/agents/performance-tracker.ts

export type AgentPerformanceRecord = {
  runId: string;
  agentId: string;
  taskType?: string;
  spawnerSessionKey: string;
  startedAt: number;
  endedAt: number;
  runtimeMs: number;
  outcome: "success" | "partial" | "failure" | "timeout";
  verificationPassed?: boolean;
  completionReport?: { status: string; confidence: string };
  tokens?: { input: number | null; output: number | null }; // null = unknown (not 0)
  retryOf?: string;
  escalatedFrom?: string;
};
```

**Review note:** Token data from `waitForSessionUsage()` is often stale or missing (race condition — `totalTokensFresh` exists for this reason). Store `null` for unknown, not `0`.

#### 7.2 Storage

- JSONL append-only: `~/.openclaw/data/agent-performance-YYYY-MM-DD.jsonl`
- Daily rotation, 30-day retention
- Lightweight: no message content, metadata only

#### 7.3 Query + Prompt Integration

```typescript
export function getAgentStats(
  agentId: string,
  opts?: { days?: number },
): {
  totalRuns: number;
  successRate: number;
  avgRuntimeMs: number;
  escalationRate: number;
};
```

Stats summary available alongside capability cards in system prompt.

#### 7.4 Acceptance Criteria

- [ ] Performance record written after every subagent run
- [ ] JSONL append-only with daily rotation
- [ ] `getAgentStats()` returns aggregates
- [ ] 30-day retention with cleanup
- [ ] Token data uses `null` for unknown
- [ ] Unit tests for recording, aggregation, rotation

---

## 8. Implementation Plan

### Wave 0: Prerequisites (MUST complete first)

**0a — Merge `feat/subagent-comms` to main**

- Ensure branch is clean, tests pass
- Resolve any merge conflicts

**0b — Extract core spawn logic**

- Extract from `sessions-spawn-tool.ts` (~380 lines) into `src/agents/spawn-core.ts`
- The tool becomes a thin wrapper calling the extracted function
- This enables programmatic re-spawn (for verification retry) without duplicating logic
- **Files:** `sessions-spawn-tool.ts` → refactor, NEW `spawn-core.ts`
- **Tests:** Existing spawn tests must still pass (no behavior change)

### Wave 1: Core Types + Parsers (parallel, no dependencies)

**1a — Completion Report Tool + Parser**

- `src/agents/tools/report-completion-tool.ts` + tests
- `src/agents/completion-report-parser.ts` + tests (text fallback)
- Pure tool + parsing logic, no integration

**1b — Verification Types + Runner**

- `src/agents/spawn-verification.types.ts`
- `src/agents/spawn-verification.ts` (runs artifact checks) + tests
- Pure validation logic, no integration

**1c — Progress Tool**

- `src/agents/tools/report-progress-tool.ts` + tests
- Non-blocking fire-and-forget, rate limiting logic
- Pure tool, no integration

### Wave 2: Integration (sequential, depends on 0 + 1)

**2a — Wire completion reports into flow**

- `report_completion` added to default subagent tool list (`openclaw-tools.ts`)
- `report_progress` added to default subagent tool list
- Post-completion parsing in `runSubagentAnnounceFlow()`
- `SubagentRunRecord` extended with `completionReport` field
- `sessions_tree` displays completion status

**2b — Wire verification into announce flow**

- Verification hook in `runSubagentAnnounceFlow()` (after run settlement, before announce)
- `SubagentRunRecord` extended with `verification` + `verificationResult`
- `sessions_spawn` schema extended with `verification` field
- `sessions_tree` shows verification status
- Retry logic using extracted `spawn-core.ts`

**2c — Wire progress into registry**

- Progress storage on `SubagentRunRecord.progressLog` (separate from main persistence)
- `sessions_tree` shows latest progress

### Wave 3: Capability Cards + Performance (parallel, separate files)

**3a — Capability Cards**

- Config type extension (`types.agents.ts`)
- Zod schema extension (`zod-schema.agent-runtime.ts`)
- `capability-routing.ts` + tests
- Enhanced fleet table in `delegation-prompt.ts`

**3b — Performance Tracking**

- `performance-tracker.ts` + tests
- Hook into `runSubagentAnnounceFlow()` (after verification, before announce)
- JSONL storage with rotation

### Wave 4: Per-Spawn Tool Scoping

- `SessionEntry` type extension (`src/config/sessions.ts`)
- Spawn tool writes overrides to session store
- `pi-tools.policy.ts` reads and applies overrides
- Validation at spawn time (reject widening)
- Tests

### File Conflict Analysis

| Wave | New Files                                                          | Modified Files                                                                                    |
| ---- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| 0b   | `spawn-core.ts`                                                    | `sessions-spawn-tool.ts`                                                                          |
| 1a   | `report-completion-tool.ts`, `completion-report-parser.ts` + tests | —                                                                                                 |
| 1b   | `spawn-verification.types.ts`, `spawn-verification.ts` + tests     | —                                                                                                 |
| 1c   | `report-progress-tool.ts` + tests                                  | —                                                                                                 |
| 2a   | —                                                                  | `openclaw-tools.ts`, `subagent-announce.ts`, `subagent-registry.ts`, `sessions-tree-tool.ts`      |
| 2b   | —                                                                  | `subagent-announce.ts`, `subagent-registry.ts`, `sessions-spawn-tool.ts`, `sessions-tree-tool.ts` |
| 2c   | —                                                                  | `subagent-registry.ts`, `sessions-tree-tool.ts`                                                   |
| 3a   | `capability-routing.ts` + tests                                    | `types.agents.ts`, `zod-schema.agent-runtime.ts`, `delegation-prompt.ts`                          |
| 3b   | `performance-tracker.ts` + tests                                   | `subagent-announce.ts`                                                                            |
| 4    | —                                                                  | `sessions.ts`, `sessions-spawn-tool.ts`, `pi-tools.policy.ts`                                     |

**No conflicts within Wave 1.** Wave 2a-2c share files (sequential). Wave 3a/3b are parallel (different files). Wave 4 is independent.

### Task Sizing

| Wave      | Estimated Agent-Hours | Parallelism      |
| --------- | --------------------- | ---------------- |
| 0         | 1-2h                  | Sequential       |
| 1 (a+b+c) | 1.5h                  | ✅ Full parallel |
| 2 (a+b+c) | 3-4h                  | ⚠️ Sequential    |
| 3 (a+b)   | 1.5h                  | ✅ Parallel      |
| 4         | 1.5h                  | After Wave 2     |

**Total: ~9-11 agent-hours**

---

## 9. Security Considerations

### No `validationCommand` in v1

Removed per review. On macOS host, there's no process sandbox — any command runs with full user permissions. The command string originates from LLM output. Built-in artifact checks handle the primary failure mode (missing/malformed output).

### Tool Scoping Cannot Widen

Per-spawn `toolsAllow` is intersected with agent config, never unioned. Widening attempts are rejected at spawn time with an error (not silently ignored).

### Progress Reporting Rate Limits

1 update/30s/child prevents spam. Progress log capped at 100 entries per run.

### Performance Data Privacy

JSONL contains no message content — only metadata (run IDs, agent IDs, timing, outcomes).

---

## 10. Non-Goals

- **Auto-routing:** Data layer only. Orchestrator still makes final call.
- **ZKP / multi-agent verification games:** Overkill for internal fleet.
- **Financial delegation / smart contracts:** Not relevant.
- **Decentralized identity:** We control all agents; session keys suffice.
- **Cross-organization delegation:** All agents within one OpenClaw instance.
- **`validationCommand`:** Deferred to v2 behind config flag.

---

## 11. Open Questions (Resolved)

| #   | Question                              | Resolution                                                                |
| --- | ------------------------------------- | ------------------------------------------------------------------------- |
| 1   | Completion report format              | **Tool call** (`report_completion`) primary, text delimiters as fallback  |
| 2   | Progress tool availability            | **All subagents** get the tool; prompt instructions only when opted in    |
| 3   | Performance tracking granularity      | **Per-run only**; orchestrator computes aggregates as needed              |
| 4   | Pass failure reason to retried agent? | **Yes** — append failure context to retry task prompt                     |
| 5   | Capability card format                | **Hybrid**: structured `tags` for routing + free-text `notes` for prompts |
