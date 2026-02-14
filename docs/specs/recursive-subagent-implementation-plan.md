# Recursive Subagent Spawning — Implementation Plan

**Date:** 2026-02-14

## Phase 1: Session Key Utilities (No Behavior Change)

### File: `src/sessions/session-key-utils.ts`

Add two new functions:

```typescript
/**
 * Returns the subagent nesting depth.
 * - Non-subagent keys → 0
 * - `agent:main:subagent:{uuid}` → 1
 * - `agent:main:subagent:{uuid}:sub:{uuid2}` → 2
 * - etc.
 */
export function getSubagentDepth(sessionKey: string | undefined | null): number;

/**
 * Returns the parent session key by stripping the last `:sub:{uuid}` segment.
 * For depth-1 subagents (`agent:{id}:subagent:{uuid}`), returns the main key `agent:{id}:main`.
 * For non-subagent keys, returns null.
 */
export function getParentSubagentKey(sessionKey: string | undefined | null): string | null;
```

**Tests to write first:**

- `getSubagentDepth` with non-subagent key → 0
- `getSubagentDepth` with depth-1 key → 1
- `getSubagentDepth` with depth-2 key → 2
- `getSubagentDepth` with depth-3 key → 3
- `getSubagentDepth` with null/undefined → 0
- `getParentSubagentKey` with depth-1 key → main key
- `getParentSubagentKey` with depth-2 key → depth-1 key
- `getParentSubagentKey` with non-subagent → null

### File: `src/routing/session-key.ts`

Re-export the new functions.

---

## Phase 2: Config Schema (No Behavior Change)

### File: `src/config/types.agents.ts`

Add to the `subagents` type in `AgentConfig`:

```typescript
subagents?: {
  allowAgents?: string[];
  model?: string | { primary?: string; fallbacks?: string[] };
  thinking?: string;
  // NEW
  allowRecursiveSpawn?: boolean;
  maxDepth?: number;
};
```

### File: `src/config/types.agent-defaults.ts`

Add to the subagents section in `AgentDefaultsConfig`:

```typescript
subagents?: {
  maxConcurrent?: number;
  archiveAfterMinutes?: number;
  model?: string | { primary?: string; fallbacks?: string[] };
  thinking?: string;
  // NEW
  allowRecursiveSpawn?: boolean;
  maxDepth?: number;
};
```

### File: `src/config/zod-schema.agent-defaults.ts`

Add to the subagents schema:

```typescript
allowRecursiveSpawn: z.boolean().optional(),
maxDepth: z.number().int().min(1).max(10).optional(),
```

### File: `src/config/zod-schema.agent-runtime.ts`

Add the same fields to both per-agent subagent schemas (lines ~455 and ~551).

**Tests:**

- Zod schema accepts valid config with new fields
- Zod schema rejects maxDepth < 1 or > 10
- Zod schema rejects non-boolean allowRecursiveSpawn

---

## Phase 3: Config Resolution Helpers

### File: `src/agents/recursive-spawn-config.ts` (NEW)

```typescript
import { loadConfig, type OpenClawConfig } from "../config/config.js";
import { resolveAgentConfig } from "./agent-scope.js";

const DEFAULT_MAX_DEPTH = 3;

export function resolveAllowRecursiveSpawn(cfg: OpenClawConfig, agentId: string): boolean {
  const agentConfig = resolveAgentConfig(cfg, agentId);
  const perAgent = agentConfig?.subagents?.allowRecursiveSpawn;
  if (typeof perAgent === "boolean") return perAgent;
  const global = cfg.agents?.defaults?.subagents?.allowRecursiveSpawn;
  if (typeof global === "boolean") return global;
  return false;
}

export function resolveMaxSpawnDepth(cfg: OpenClawConfig, agentId: string): number {
  const agentConfig = resolveAgentConfig(cfg, agentId);
  const perAgent = agentConfig?.subagents?.maxDepth;
  if (typeof perAgent === "number" && Number.isFinite(perAgent)) {
    return Math.max(1, Math.min(10, Math.floor(perAgent)));
  }
  const global = cfg.agents?.defaults?.subagents?.maxDepth;
  if (typeof global === "number" && Number.isFinite(global)) {
    return Math.max(1, Math.min(10, Math.floor(global)));
  }
  return DEFAULT_MAX_DEPTH;
}
```

**Tests:**

- Per-agent config takes priority over global
- Global config takes priority over default
- Default is 3
- Invalid values are clamped

---

## Phase 4: Lift the Hard Block (Core Behavior Change)

### File: `src/agents/tools/sessions-spawn-tool.ts`

**Change 1:** Replace lines 121-126 (the hard block):

```typescript
// BEFORE
if (typeof requesterSessionKey === "string" && isSubagentSessionKey(requesterSessionKey)) {
  return jsonResult({
    status: "forbidden",
    error: "sessions_spawn is not allowed from sub-agent sessions",
  });
}

// AFTER
if (typeof requesterSessionKey === "string" && isSubagentSessionKey(requesterSessionKey)) {
  const currentDepth = getSubagentDepth(requesterSessionKey);
  const allowRecursive = resolveAllowRecursiveSpawn(cfg, requesterAgentId);
  const maxDepth = resolveMaxSpawnDepth(cfg, requesterAgentId);

  if (!allowRecursive) {
    return jsonResult({
      status: "forbidden",
      error:
        "Recursive spawning is not enabled. Set subagents.allowRecursiveSpawn: true in config.",
    });
  }

  if (currentDepth >= maxDepth) {
    return jsonResult({
      status: "forbidden",
      error: `Maximum subagent depth (${maxDepth}) reached. Cannot spawn deeper.`,
    });
  }
}
```

**Change 2:** Update child session key generation:

```typescript
// BEFORE
const childSessionKey = `agent:${targetAgentId}:subagent:${crypto.randomUUID()}`;

// AFTER
const childSessionKey =
  typeof requesterSessionKey === "string" && isSubagentSessionKey(requesterSessionKey)
    ? `${requesterSessionKey}:sub:${crypto.randomUUID()}`
    : `agent:${targetAgentId}:subagent:${crypto.randomUUID()}`;
```

**Change 3:** For recursive spawns, resolve the agent config using the ROOT agent ID (parsed from the session key prefix), not the requester's immediate session.

**Tests:**

- Subagent with `allowRecursiveSpawn: true` can spawn → status: "accepted"
- Subagent without config gets → status: "forbidden" (existing behavior preserved)
- Subagent at max depth gets → status: "forbidden"
- Child session key has correct nested format
- Existing non-recursive spawn tests still pass

---

## Phase 5: System Prompt Update

### File: `src/agents/subagent-announce.ts`

Update `buildSubagentSystemPrompt()` to include depth context:

```typescript
// Add after "## Session Context"
const depth = getSubagentDepth(params.childSessionKey);
if (depth > 1) {
  lines.push(`- Depth: ${depth} (results go to your parent subagent, not the end user)`);
  lines.push("- You CAN spawn sub-subagents if needed (they will report back to you)");
}
```

**Tests:**

- Depth-1 prompt doesn't mention depth
- Depth-2+ prompt includes depth info and delegation note

---

## Phase 6: Tool Policy (Conditional)

### File: `src/agents/pi-tools.policy.ts`

The `DEFAULT_SUBAGENT_TOOL_DENY` list currently includes `sessions_spawn`. When recursive spawning is enabled, we need to NOT deny `sessions_spawn` for subagents.

However, this is more nuanced — the deny list is applied at tool creation time, not at call time. The sessions-spawn-tool itself already does the depth/config check. So we have two options:

**Option A (Simpler):** Remove `sessions_spawn` from the deny list entirely. The tool's own logic handles permission checking. This means the tool SHOWS UP in the subagent's tool list but returns "forbidden" if config doesn't allow it.

**Option B (Cleaner UX):** Make the deny list config-aware. Only show `sessions_spawn` to subagents whose root agent has recursive spawning enabled.

**Recommendation:** Option A for v1. The tool's internal check is the source of truth. Showing the tool but getting a "forbidden" response is better than hiding it entirely and having no way to enable recursive spawning.

Actually, looking more carefully — `sessions_spawn` is NOT in `DEFAULT_SUBAGENT_TOOL_DENY` list. Let me re-check...

Looking at the deny list in `pi-tools.policy.ts`:

```
"gateway", "agents_list", "whatsapp_login", "session_status", "cron", "memory_search", "memory_get"
```

`sessions_spawn` is NOT denied for subagents at the tool policy level! The denial happens inside the tool's execute function (the hard block). So **no changes needed to pi-tools.policy.ts**.

---

## Phase 7: Run Full Test Suite

After each phase:

```bash
cd ~/Development/openclaw
npx vitest run --config vitest.unit.config.ts
npx vitest run --config vitest.e2e.config.ts
```

---

## Order of Operations

1. **Phase 1** → Write tests, implement session key utilities, run tests
2. **Phase 2** → Add types and schema, run tests
3. **Phase 3** → Implement config resolution, write tests, run tests
4. **Phase 4** → Lift hard block, write tests, run tests (this is the core change)
5. **Phase 5** → Update system prompt, write tests, run tests
6. **Phase 6** → Verify no tool policy changes needed (confirmed above)
7. **Phase 7** → Full test suite run, verify no regressions

## Risk Assessment

- **Low risk:** Phases 1-3 (additive only, no behavior change)
- **Medium risk:** Phase 4 (core behavior change, but guarded by config default `false`)
- **Low risk:** Phase 5 (prompt text change only)
- **Zero risk:** Phase 6 (no changes needed)

## Key Invariant

The default behavior (`allowRecursiveSpawn: false`) means existing tests and deployments are completely unaffected. Recursive spawning only activates when explicitly configured.
