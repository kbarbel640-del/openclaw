# Intelligent Delegation Spec — OpenClaw Formalization

_Final v3 — 2026-02-16_
_Based on: Tomašev, Franklin, Osindero — "Intelligent AI Delegation" (arXiv:2602.11865, Feb 2026)_
_Target branch: `feat/subagent-comms` (extends existing orchestrator request registry)_
_Reviewed by: Opus (architecture, 3C/6W/8S), Codex GPT-5.3 (code-grounded, 3C/6W/3S)_

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

### Critical Architecture Files (verified by both reviewers)

| File                                      | Role                                                            | Lines |
| ----------------------------------------- | --------------------------------------------------------------- | ----- |
| `src/agents/tools/sessions-spawn-tool.ts` | Spawn flow (tool interface)                                     | ~380  |
| `src/agents/subagent-registry.ts`         | Run registration, `SubagentRunRecord` type, cleanup lifecycle   | ~614  |
| `src/agents/subagent-announce.ts`         | Post-completion announce flow (returns `boolean` only)          | ~200+ |
| `src/agents/pi-tools.ts`                  | Tool list construction for agents                               | ~438  |
| `src/agents/pi-tools.policy.ts`           | Tool policy pipeline (allow/deny), no session-store read path   | ~260  |
| `src/agents/delegation-prompt.ts`         | Fleet table prompt injection                                    | ~100  |
| `src/agents/system-prompt.ts`             | System prompt builder                                           | large |
| `src/agents/schema/typebox.ts`            | **⚠️ Bans `Type.Union([Type.Literal])` for tool schemas**       | —     |
| `src/config/zod-schema.agent-runtime.ts`  | Agent config schema (Zod)                                       | ~640  |
| `src/gateway/server-methods/agent.ts`     | Agent RPC handler, rewrites session entries via field allowlist | —     |
| `src/gateway/sessions-patch.ts`           | Session patch handler, rejects unknown keys                     | —     |
| `src/gateway/protocol/schema/sessions.ts` | Session patch schema validation                                 | —     |
| `src/gateway/protocol/schema/agent.ts`    | Agent RPC param schema (`AgentParamsSchema`)                    | —     |

### What This Spec Adds

| Feature                              | Priority | Complexity |
| ------------------------------------ | -------- | ---------- |
| **A. Verification Contracts**        | P0       | Medium     |
| **B. Agent Capability Cards**        | P1       | Low        |
| **C. Structured Completion Reports** | P0       | Medium     |
| **D. Progress Streaming**            | P1       | Medium     |
| **E. Per-Spawn Tool Scoping**        | P2       | High       |
| **F. Agent Performance Tracking**    | P2       | Low        |

### Backward Compatibility

All new `sessions_spawn` fields are optional. Existing spawn calls without these fields behave identically to current behavior. No breaking changes.

### Prerequisites

1. **Merge `feat/subagent-comms` to main** — all new work builds on this branch. Must be clean first.
2. **Extract core spawn logic** from `sessions-spawn-tool.ts` into a reusable function (see Wave 0).
3. **Initialize orchestrator registry on gateway boot** — currently only subagent registry is initialized at `src/gateway/server.impl.ts:240`. Orchestrator registry init (`initOrchestratorRegistry()`) must also be called to ensure pending request state survives restarts.

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

**⚠️ RESTART SAFETY (Codex finding): Cleanup is marked "handled" in `subagent-registry.ts:406` BEFORE `runSubagentAnnounceFlow()` executes. A gateway restart during verification strands the run.** Must defer the "handled" marker until after verification completes, or add a persisted `verificationState` field.

```
1. Parent calls sessions_spawn({ task, verification, ... })
   → verification contract + original spawn params stored on SubagentRunRecord
2. Subagent runs normally (no awareness of verification)
3. Subagent completes (or times out)
4. runSubagentAnnounceFlow() fires (both code paths converge here)
   4a. Wait for embedded run settlement (existing: waitForEmbeddedPiRunEnd)
   4b. Wait for compaction if in progress (existing)
   4c. NEW: If verification contract exists on the run record:
       - Set verificationState: "running" on run record, persist
       - Run artifact checks (file exists, size, JSON schema)
       - Parse completion report from final tool call (if requireCompletionReport)
       - Apply verificationTimeoutMs (default 30s)
       - If ALL pass → set verificationState: "passed", proceed to announce
       - If ANY fail → execute onFailure:
         * "fail": set verificationState: "failed", announce with details
         * "escalate": set verificationState: "failed", announce failure + details
         * "retry_once": check retryAttemptedAt marker (idempotency guard)
           - If already retried → treat as "fail"
           - Else → set retryAttemptedAt, call extracted spawn function with
             { retryOf: originalRunId, retryReason: failureDetails }
   4d. Store VerificationResult on SubagentRunRecord, persist
   4e. THEN mark as "handled" (moved from before verification)
5. Announce to parent (existing flow continues)
```

**On restart recovery:** If gateway restarts mid-verification, the run record has `verificationState: "running"` but is NOT marked handled. The registry resume logic (`subagent-registry.ts:194`) will re-trigger the announce flow, which re-runs verification. This is safe because artifact checks are idempotent. The `retryAttemptedAt` marker prevents duplicate retries.

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
//   verification?: VerificationContract;        // the contract (from spawn)
//   verificationResult?: VerificationResult;    // the outcome (post-run)
//   verificationState?: "pending" | "running" | "passed" | "failed";  // restart-safe state
//   retryAttemptedAt?: number;                  // idempotency guard for retry_once
//   originalSpawnParams?: {                     // captured at spawn time for faithful retry
//     agentId: string;
//     model?: string;
//     thinking?: string;
//     runTimeoutSeconds?: number;
//     label?: string;
//   };
```

**Codex finding:** `retry_once` needs original spawn parameters (model, thinking level, timeouts) to faithfully reproduce the original spawn. Current run records don't store these — they're resolved dynamically in the spawn tool. The `originalSpawnParams` field captures them at spawn time.

#### 2.4 Registry Persistence Changes

`runSubagentAnnounceFlow()` currently returns only `boolean`. It has no access to update/persist run records — persistence is encapsulated in a private `persistSubagentRuns()` function in the registry.

**Required changes:**

1. Export a `updateRunRecord(runId, patch)` function from `subagent-registry.ts` that applies a partial update and persists
2. Pass the `runId` into `runSubagentAnnounceFlow()` (or a callback for record updates)
3. Announce flow uses `updateRunRecord()` to write verification state/results

#### 2.5 Retry Behavior

When `onFailure: "retry_once"`:

- Check `retryAttemptedAt` — if already set, treat as `"fail"` (idempotency)
- Set `retryAttemptedAt = Date.now()` on the run record, persist
- Call extracted spawn function with `originalSpawnParams` + failure context:
  ```
  [RETRY — Previous attempt failed verification]
  Failure reason: File output/results.json was empty (0 bytes, minimum 100 bytes required).
  Original task: <original task text>
  ```
- The retried run carries `{ retryOf: originalRunId }` metadata
- Only one retry — if the retry also fails verification, it becomes a `"fail"`

**Prerequisite:** Core spawn logic must be extracted from `sessions-spawn-tool.ts` into a reusable function (Wave 0).

#### 2.6 Extracted Spawn Function Contract (Wave 0b)

```typescript
// New: src/agents/spawn-core.ts

export type SpawnCoreParams = {
  agentId: string;
  task: string;
  requesterSessionKey: string;
  requesterOrigin?: DeliveryContext;
  model?: string;
  thinking?: string;
  runTimeoutSeconds?: number;
  label?: string;
  verification?: VerificationContract;
  completionReport?: boolean;
  progressReporting?: boolean;
  // ... other spawn params
};

export type SpawnCoreResult = {
  childSessionKey: string;
  runId: string;
  agentId: string;
};

/**
 * Core spawn logic extracted from sessions-spawn-tool.ts.
 * Handles: provider limits, depth checks, config resolution, model overrides,
 * run registration, gateway agent RPC call.
 *
 * The tool becomes a thin wrapper: validate LLM params → call spawnCore().
 * Verification retry calls spawnCore() directly.
 */
export async function spawnCore(params: SpawnCoreParams): Promise<SpawnCoreResult>;
```

#### 2.7 Acceptance Criteria

- [ ] `sessions_spawn` accepts optional `verification` field
- [ ] Verification contract + `originalSpawnParams` stored on `SubagentRunRecord`
- [ ] Verification runs inside `runSubagentAnnounceFlow()` after run settlement
- [ ] `verificationState` persisted for restart safety
- [ ] "Handled" marker deferred until after verification completes
- [ ] Artifact checks: file existence, minBytes, JSON validity, minItems, requiredKeys
- [ ] `verificationTimeoutMs` applies to all checks (default 30s)
- [ ] `onFailure: "fail"` marks run as failed with structured failure details
- [ ] `onFailure: "escalate"` announces failure to parent with details
- [ ] `onFailure: "retry_once"` re-spawns with original params + failure context
- [ ] `retryAttemptedAt` prevents duplicate retries across restarts
- [ ] `sessions_tree` shows verification status per node
- [ ] `updateRunRecord()` exported from registry for announce-flow updates
- [ ] Unit tests for each verification check type
- [ ] E2E test: spawn with contract, valid file → passes
- [ ] E2E test: spawn with contract, invalid file → triggers onFailure
- [ ] E2E test: verification timeout → maps to onFailure path
- [ ] E2E test: restart during verification → re-runs verification on resume
- [ ] E2E test: retry idempotency → second retry attempt treated as "fail"
- [ ] Handles race: verification doesn't run while compaction is in progress

---

## 3. Feature B: Agent Capability Cards

### Problem

Agent routing is tribal knowledge in MEMORY.md. New sessions lose this context.

### Design

Add `capabilities` field to agent definitions in `openclaw.json`.

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
    "typicalLatency": "90s",
    "notes": "No file writes, no tool access beyond search. Daily quota limits.",
  },
}
```

**Decisions:** `description` stays for fleet table. Combined `strengths`/`weaknesses` into `notes`. `costTier` manually set for now. Removed `maxConcurrency` (overlaps `subagents.maxChildrenPerAgent`).

#### 3.2 Schema Validation

Update both:

1. `src/config/types.agents.ts` — TypeScript type
2. `src/config/zod-schema.agent-runtime.ts` — Zod schema (for `openclaw doctor`)

#### 3.3 Routing Helper

```typescript
// New: src/agents/capability-routing.ts

export function suggestAgents(hint: RoutingHint, config: OpenClawConfig): AgentSuggestion[];
```

Does NOT auto-spawn — recommends only.

#### 3.4 System Prompt Injection

Enhance fleet table in `delegation-prompt.ts` to include capability tags.

#### 3.5 Acceptance Criteria

- [ ] `capabilities` field accepted in agent config schema
- [ ] `openclaw doctor` validates new field (Zod schema updated)
- [ ] `suggestAgents()` returns ranked list based on tags/cost
- [ ] Fleet table includes capability data when available
- [ ] Backward compatible (missing `capabilities` = works as before)
- [ ] Unit tests for routing logic

---

## 4. Feature C: Structured Completion Reports

### Problem

Subagent results arrive as free-text prose. Wastes orchestrator context and is error-prone.

### Design

Tool-based approach: `report_completion` tool that subagents call as final action.

#### 4.1 New Tool: `report_completion`

**⚠️ SCHEMA CONSTRAINT (Codex finding): The repo bans `Type.Union([Type.Literal])` in tool schemas (`src/agents/schema/typebox.ts:13`) for provider compatibility. Must use `optionalStringEnum()` helper instead.**

```typescript
// New: src/agents/tools/report-completion-tool.ts
// Use optionalStringEnum() from src/agents/schema/typebox.ts — NOT Type.Union([Type.Literal])

import { optionalStringEnum } from "../schema/typebox.js";

const COMPLETION_STATUSES = ["complete", "partial", "failed"] as const;
const CONFIDENCE_LEVELS = ["high", "medium", "low"] as const;

const ReportCompletionSchema = Type.Object({
  status: optionalStringEnum(COMPLETION_STATUSES), // NOT Type.Union
  confidence: optionalStringEnum(CONFIDENCE_LEVELS), // NOT Type.Union
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

#### 4.2 Detecting Last Tool Call

**Codex finding:** The announce flow reads sanitized assistant text after stripping tool-result messages (`src/agents/tools/agent-step.ts`). The "last tool call was `report_completion`" check needs explicit telemetry plumbing — either:

1. Store the tool call name on the run record via agent event listener, OR
2. Read the raw session transcript in announce flow and scan for `report_completion` tool use

Option 1 is cleaner (no transcript parsing). The existing `onAgentEvent` listener in `subagent-registry.ts:331` already tracks lifecycle events — extend it to capture the last tool call name.

#### 4.3 Fallback: Text Delimiter Parser

```typescript
// New: src/agents/completion-report-parser.ts
// Searches from END of message backward, case-insensitive, skips fenced code blocks
export function parseCompletionReport(text: string): CompletionReport | null;
```

#### 4.4 Integration

1. **Tool availability:** Available to ALL subagents by default.
2. **Prompt injection:** Only when spawner sets `completionReport: true`.
3. **Post-completion:** Check last tool call name → parse tool result. Fallback to text parser.
4. **`sessions_tree` enhancement:** Shows completion status/confidence.

#### 4.5 Acceptance Criteria

- [ ] `report_completion` tool using `optionalStringEnum()` (not `Type.Union`)
- [ ] Last tool call name captured via agent event listener
- [ ] Text fallback parser: searches from end, case-insensitive, skips code blocks
- [ ] Parsed report stored on `SubagentRunRecord.completionReport`
- [ ] `sessions_tree` shows completion status/confidence
- [ ] `completionReport: true` spawn option triggers prompt injection
- [ ] Verification contract can require completion report
- [ ] Schema conformance test (no `anyOf` in tool schema output)
- [ ] Unit tests: tool call parsing, text parsing, malformed, missing

---

## 5. Feature D: Progress Streaming

### Problem

Long-running tasks create a "black hole" — no signal until completion or timeout.

### Design

Non-blocking `report_progress` tool.

#### 5.1 New Tool: `report_progress`

**⚠️ Same schema constraint: use `optionalStringEnum()`, not `Type.Union([Type.Literal])`.**

```typescript
// New: src/agents/tools/report-progress-tool.ts

const PROGRESS_LEVELS = ["L0_operational", "L1_plan_update", "L2_detail"] as const;

const ReportProgressSchema = Type.Object({
  phase: Type.String({ description: "Current phase or step" }),
  percentComplete: Type.Optional(Type.Number({ minimum: 0, maximum: 100 })),
  level: optionalStringEnum(PROGRESS_LEVELS),
  metrics: Type.Optional(Type.Record(Type.String(), Type.Union([Type.String(), Type.Number()]))),
});
```

#### 5.2 Behavior

- **Non-blocking:** Returns immediately.
- **Rate limited:** 1 update per 30 seconds per subagent.
- **Availability:** All subagents. Prompt instructions only when `progressReporting: true`.

#### 5.3 Storage

**Codex finding: spec was internally contradictory** — said "store on `SubagentRunRecord.progressLog`" AND "store separately from registry." Resolution:

**Store in a separate per-run file:** `~/.openclaw/state/progress/<runId>.jsonl`

- Append-only JSONL, one line per progress update
- Read by `sessions_tree` on demand (not loaded into memory with registry)
- Cleaned up when run record is cleaned up
- `SubagentRunRecord` gets only `latestProgress?: { phase, percentComplete, updatedAt }` (last update, kept lean)

#### 5.4 Acceptance Criteria

- [ ] `report_progress` tool using `optionalStringEnum()`
- [ ] Non-blocking, rate limited (1/30s)
- [ ] Progress stored in separate per-run JSONL file
- [ ] `SubagentRunRecord.latestProgress` has only latest update
- [ ] `sessions_tree` shows latest progress for running sessions
- [ ] `progressReporting: true` triggers prompt instructions
- [ ] Cleanup of progress files when run record is cleaned
- [ ] Unit tests for rate limiting, storage, display

---

## 6. Feature E: Per-Spawn Tool Scoping

### Problem

All subagents of a given type get the same tool access. Principle of least privilege violated.

### Design

Per-spawn `toolsAllow` and `toolsDeny` overrides that narrow (never widen) agent config.

#### 6.1 Schema Extension

```typescript
toolsAllow?: string[];  // intersected with agent config
toolsDeny?: string[];   // subtracted after allow
```

Resolution: `Final = (AgentConfig ∩ spawnAllow) − spawnDeny`

#### 6.2 Threading Mechanism

**⚠️ CRITICAL (Codex finding): The SessionEntry approach from v2 DOES NOT WORK.** Codex identified 4 blocking issues:

1. `SessionEntry` has no `toolOverrides` field (`src/config/sessions/types.ts:25`)
2. `sessions.patch` rejects unknown keys (`src/gateway/protocol/schema/sessions.ts:50`)
3. Patch application has no handling for overrides (`src/gateway/sessions-patch.ts:61`)
4. Agent startup rewrites session entries via explicit field allowlist that drops unthreaded fields (`src/gateway/server-methods/agent.ts:256`)
5. `pi-tools.policy.ts` has no session-store read path

**Revised approach (Codex suggestion): Ephemeral RPC param threading.**

Thread tool overrides through the `agent` gateway RPC, not persistent session state:

1. **Extend `AgentParamsSchema`** (`src/gateway/protocol/schema/agent.ts:54`) with:
   ```typescript
   toolOverrides: Type.Optional(
     Type.Object({
       allow: Type.Optional(Type.Array(Type.String())),
       deny: Type.Optional(Type.Array(Type.String())),
     }),
   );
   ```
2. **Thread through gateway handler** (`src/gateway/server-methods/agent.ts:399`) into command invocation
3. **Thread through `AgentCommandOpts`** (`src/commands/agent/types.ts`) → `runEmbeddedPiAgent()`
4. **Thread through embedded run params** (`src/agents/pi-embedded-runner/run/params.ts:21`) → `attempt.ts`
5. **Apply as extra policy layer** in `createOpenClawCodingTools()` / `createOpenClawTools()` (`src/agents/pi-tools.ts:119`)

This avoids all persistent-state issues. Tool overrides are ephemeral — they exist only for the duration of the RPC call that spawns the agent run. No session store pollution, no patch schema changes, no restart concerns.

#### 6.3 Files Modified (complete list)

| File                                           | Change                                                 |
| ---------------------------------------------- | ------------------------------------------------------ |
| `src/gateway/protocol/schema/agent.ts`         | Add `toolOverrides` to `AgentParamsSchema`             |
| `src/gateway/server-methods/agent.ts`          | Thread `toolOverrides` to command invocation           |
| `src/commands/agent.ts`                        | Thread to `runEmbeddedPiAgent()`                       |
| `src/commands/agent/types.ts`                  | Add to `AgentCommandOpts`                              |
| `src/agents/pi-embedded-runner/run/params.ts`  | Add to run params                                      |
| `src/agents/pi-embedded-runner/run/attempt.ts` | Pass to tool construction                              |
| `src/agents/pi-tools.ts`                       | Apply override policy in `createOpenClawCodingTools()` |
| `src/agents/openclaw-tools.ts`                 | Apply override policy in `createOpenClawTools()`       |
| `src/agents/tools/sessions-spawn-tool.ts`      | Pass overrides in `callGateway({ method: "agent" })`   |

#### 6.4 Enforcement

- **Validate at spawn time** in `sessions-spawn-tool.ts`: if `toolsAllow` contains tools not in agent config, return error.
- **Apply at tool construction** in `pi-tools.ts`: intersect/subtract before building tool list.
- **Can only narrow, never widen.** Enforced by intersection.

#### 6.5 Acceptance Criteria

- [ ] `sessions_spawn` accepts `toolsAllow` and `toolsDeny`
- [ ] Overrides threaded through gateway RPC → command → embedded runner → tool construction
- [ ] Applied as policy layer in `pi-tools.ts` / `openclaw-tools.ts`
- [ ] Widening attempt returns spawn error
- [ ] Unit tests: allow-only, deny-only, both, empty, widening blocked
- [ ] E2E test: spawn with `toolsDeny=["message"]`, verify tool unavailable
- [ ] E2E test: override survival through full RPC chain
- [ ] E2E test: `SessionEntry` patch does NOT affect tool overrides (ephemeral only)

---

## 7. Feature F: Agent Performance Tracking

### Problem

No systematic data on agent success rates for routing decisions.

### Design

Auto-log performance metrics after each subagent run.

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
  tokens?: { input: number | null; output: number | null }; // null = unknown (race condition)
  retryOf?: string;
  escalatedFrom?: string;
};
```

#### 7.2 Storage

- JSONL: `~/.openclaw/data/agent-performance-YYYY-MM-DD.jsonl`
- Daily rotation, 30-day retention
- No message content, metadata only

#### 7.3 Acceptance Criteria

- [ ] Record written after every subagent run completion
- [ ] JSONL append-only with daily rotation
- [ ] `getAgentStats()` returns aggregates
- [ ] Token data uses `null` for unknown
- [ ] 30-day retention with cleanup
- [ ] Unit tests for recording, aggregation, rotation

---

## 8. Implementation Plan

### Wave 0: Prerequisites (MUST complete first)

**0a — Merge `feat/subagent-comms` to main**

- Tests pass, no conflicts

**0b — Extract core spawn logic**

- Extract from `sessions-spawn-tool.ts` into `src/agents/spawn-core.ts`
- Define clear function contract (see §2.6 `SpawnCoreParams` / `SpawnCoreResult`)
- Tool becomes thin wrapper: validate LLM params → call `spawnCore()`
- **Files:** `sessions-spawn-tool.ts` → refactor, NEW `spawn-core.ts`
- **Tests:** ALL existing spawn tests must still pass

**0c — Export `updateRunRecord()` from registry**

- Add `updateRunRecord(runId, patch)` to `subagent-registry.ts`
- Applies partial update + calls `persistSubagentRuns()`
- Enables announce flow to write verification state

**0d — Initialize orchestrator registry on gateway boot**

- Add `initOrchestratorRegistry()` call in `src/gateway/server.impl.ts:240`
- Currently only subagent registry is initialized; pending requests not restored after restart

### Wave 1: Core Types + Parsers (parallel, no dependencies)

**1a — Completion Report Tool + Parser**

- `src/agents/tools/report-completion-tool.ts` (using `optionalStringEnum()`) + tests
- `src/agents/completion-report-parser.ts` + tests
- Schema conformance test: verify no `anyOf` in tool schema output

**1b — Verification Types + Runner**

- `src/agents/spawn-verification.types.ts`
- `src/agents/spawn-verification.ts` (artifact checks) + tests

**1c — Progress Tool**

- `src/agents/tools/report-progress-tool.ts` (using `optionalStringEnum()`) + tests
- Rate limiting, per-run JSONL storage

### Wave 2: Integration (sequential, depends on 0 + 1)

**2a — Wire completion reports**

- Add `report_completion` + `report_progress` to default tool list (`openclaw-tools.ts`)
- Extend agent event listener to capture last tool call name (`subagent-registry.ts:331`)
- Post-completion parsing in `runSubagentAnnounceFlow()`
- `SubagentRunRecord` extended with `completionReport`, `latestProgress`
- `sessions_tree` displays status

**2b — Wire verification**

- Verification hook in `runSubagentAnnounceFlow()` (after settlement, before announce)
- Defer "handled" marker until after verification (`subagent-registry.ts:406`)
- `SubagentRunRecord` extended with `verification`, `verificationResult`, `verificationState`, `retryAttemptedAt`, `originalSpawnParams`
- `sessions_spawn` schema extended with `verification` field
- Retry logic using `spawnCore()` from Wave 0b
- Restart recovery: re-run verification for runs with `verificationState: "running"`

**2c — Wire progress storage**

- Per-run JSONL files at `~/.openclaw/state/progress/<runId>.jsonl`
- `sessions_tree` reads latest progress on demand
- Cleanup hook when run records are cleaned

### Wave 3: Capability Cards + Performance (parallel)

**3a — Capability Cards**

- `types.agents.ts` + `zod-schema.agent-runtime.ts` extensions
- `capability-routing.ts` + tests
- Enhanced fleet table in `delegation-prompt.ts`

**3b — Performance Tracking**

- `performance-tracker.ts` + tests
- Hook into `runSubagentAnnounceFlow()` (after verification)
- JSONL storage with rotation

### Wave 4: Per-Spawn Tool Scoping (RPC threading)

- `AgentParamsSchema` extension (`gateway/protocol/schema/agent.ts`)
- Thread through: gateway handler → command → embedded runner → tool construction
- Apply policy in `pi-tools.ts` + `openclaw-tools.ts`
- Validation in `sessions-spawn-tool.ts`
- Full chain of files (see §6.3)

### File Conflict Analysis

| Wave | New Files                                                          | Modified Files                                                                                                                                                                                                                                               |
| ---- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0b   | `spawn-core.ts`                                                    | `sessions-spawn-tool.ts`                                                                                                                                                                                                                                     |
| 0c   | —                                                                  | `subagent-registry.ts`                                                                                                                                                                                                                                       |
| 0d   | —                                                                  | `server.impl.ts`                                                                                                                                                                                                                                             |
| 1a   | `report-completion-tool.ts`, `completion-report-parser.ts` + tests | —                                                                                                                                                                                                                                                            |
| 1b   | `spawn-verification.types.ts`, `spawn-verification.ts` + tests     | —                                                                                                                                                                                                                                                            |
| 1c   | `report-progress-tool.ts` + tests                                  | —                                                                                                                                                                                                                                                            |
| 2a   | —                                                                  | `openclaw-tools.ts`, `subagent-announce.ts`, `subagent-registry.ts`, `sessions-tree-tool.ts`                                                                                                                                                                 |
| 2b   | —                                                                  | `subagent-announce.ts`, `subagent-registry.ts`, `sessions-spawn-tool.ts`, `sessions-tree-tool.ts`                                                                                                                                                            |
| 2c   | —                                                                  | `sessions-tree-tool.ts`                                                                                                                                                                                                                                      |
| 3a   | `capability-routing.ts` + tests                                    | `types.agents.ts`, `zod-schema.agent-runtime.ts`, `delegation-prompt.ts`                                                                                                                                                                                     |
| 3b   | `performance-tracker.ts` + tests                                   | `subagent-announce.ts`                                                                                                                                                                                                                                       |
| 4    | —                                                                  | `gateway/protocol/schema/agent.ts`, `gateway/server-methods/agent.ts`, `commands/agent.ts`, `commands/agent/types.ts`, `pi-embedded-runner/run/params.ts`, `pi-embedded-runner/run/attempt.ts`, `pi-tools.ts`, `openclaw-tools.ts`, `sessions-spawn-tool.ts` |

**No conflicts within Wave 1.** Wave 2a-2c sequential. Wave 3a/3b parallel. Wave 4 independent.

### High-Risk Test Scenarios (Codex-identified)

These MUST be covered:

- [ ] Restart during verification → run resumes, verification re-runs
- [ ] Retry idempotency → `retryAttemptedAt` prevents duplicate retries
- [ ] Dual-trigger dedupe → lifecycle event + `agent.wait` don't both trigger verification
- [ ] `SessionEntry` patch doesn't affect ephemeral tool overrides
- [ ] Schema conformance → no `anyOf` in tool schema output (provider compatibility)
- [ ] Original spawn param capture → retry uses same model/thinking/timeout

### Task Sizing

| Wave        | Estimated Agent-Hours | Parallelism      |
| ----------- | --------------------- | ---------------- |
| 0 (a+b+c+d) | 2-3h                  | Sequential       |
| 1 (a+b+c)   | 1.5h                  | ✅ Full parallel |
| 2 (a+b+c)   | 3-4h                  | ⚠️ Sequential    |
| 3 (a+b)     | 1.5h                  | ✅ Parallel      |
| 4           | 2-3h                  | After Wave 2     |

**Total: ~10-15 agent-hours**

---

## 9. Security Considerations

### No `validationCommand` in v1

Removed. Built-in artifact checks handle primary failure modes.

### Tool Scoping Cannot Widen

Validated at spawn time (error on widening attempt). Enforced by intersection in tool construction.

### Progress Rate Limits

1/30s/child. Progress log capped at 100 entries per run.

### Performance Data Privacy

JSONL metadata only — no message content.

### Restart Safety

Verification state persisted before execution. Idempotent re-run on restart. Retry guarded by `retryAttemptedAt` marker.

---

## 10. Non-Goals

- Auto-routing, ZKP verification, financial delegation, decentralized identity, cross-org delegation, `validationCommand` (deferred to v2).

---

## 11. Open Questions (Resolved)

| #   | Question                              | Resolution                                                                                   |
| --- | ------------------------------------- | -------------------------------------------------------------------------------------------- |
| 1   | Completion report format              | **Tool call** (`report_completion`) with `optionalStringEnum()`, text delimiters as fallback |
| 2   | Progress tool availability            | **All subagents** get the tool; prompt instructions only when opted in                       |
| 3   | Performance tracking granularity      | **Per-run only**                                                                             |
| 4   | Pass failure reason to retried agent? | **Yes** + capture original spawn params for faithful retry                                   |
| 5   | Capability card format                | **Hybrid**: structured `tags` + free-text `notes`                                            |

---

## 12. Review Findings Summary

### Opus Review (architecture) — 3 Critical / 6 Warn / 8 Suggest

- ✅ C1: Verification insertion point → fixed to `runSubagentAnnounceFlow()`
- ✅ C2: Spawn refactor prerequisite → Wave 0b with defined contract
- ✅ C3: Tool scoping threading → revised to ephemeral RPC approach (per Codex)

### Codex Review (code-grounded) — 3 Critical / 6 Warn / 3 Suggest

- ✅ C1: Tool scoping SessionEntry blockers → switched to RPC threading
- ✅ C2: Restart safety / persistence gaps → added `verificationState`, `retryAttemptedAt`, deferred "handled" marker, `updateRunRecord()` export
- ✅ C3: Schema `Type.Union` ban → switched to `optionalStringEnum()` throughout
- ✅ W1: Last tool call detection → agent event listener extension
- ✅ W2: Orchestrator registry not initialized on boot → Wave 0d
- ✅ W3: Progress storage contradiction → separate per-run JSONL
- ✅ W4: Wave 4 file list incomplete → expanded to 9 files
- ✅ W5: Retry needs original spawn params → `originalSpawnParams` field
- ✅ W6: Missing test scenarios → §8 high-risk test list
