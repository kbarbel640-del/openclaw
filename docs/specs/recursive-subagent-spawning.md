# Recursive Subagent Spawning — Design Spec

**Status:** Draft v2 (post-review)
**Date:** 2026-02-14
**Author:** Ren (orchestrated with Codex CLI)

## 1. Goal

Enable subagents to spawn their own subagents (recursive delegation), implementing the RLM (Recursive Language Model) pattern. Currently, `sessions-spawn-tool.ts` returns `{ status: "forbidden" }` for any call originating from a subagent session. We want to lift this restriction with proper safeguards.

## 2. Desired Outcome

- Any agent whose config has `subagents.allowRecursiveSpawn: true` can spawn sub-subagents.
- Depth is capped (default: 3 levels, configurable via `subagents.maxDepth`).
- Each level inherits the parent's tool policy but can be further restricted.
- Autocompaction, context pruning, and all existing session management features work identically for recursive subagent sessions.
- Results bubble up to the **immediate parent** (not the root requester), preserving the delegation chain.

## 3. Config Schema Changes

### 3.1 `agents.defaults.subagents` (new fields)

```typescript
subagents: {
  // Existing fields
  maxConcurrent?: number;
  archiveAfterMinutes?: number;
  model?: string | { primary?: string; fallbacks?: string[] };
  thinking?: string;

  // NEW fields
  allowRecursiveSpawn?: boolean;  // default: false
  maxDepth?: number;              // default: 3, range: 1-10
}
```

### 3.2 `agents.list[n].subagents` (new fields)

```typescript
subagents: {
  // Existing fields
  allowAgents?: string[];
  model?: string | { primary?: string; fallbacks?: string[] };
  thinking?: string;

  // NEW fields
  allowRecursiveSpawn?: boolean;  // default: inherits from agents.defaults.subagents
  maxDepth?: number;              // default: inherits from agents.defaults.subagents
}
```

### 3.3 Resolution Order

For any given agent ID:

1. Per-agent `agents.list[n].subagents.allowRecursiveSpawn` / `maxDepth`
2. Global `agents.defaults.subagents.allowRecursiveSpawn` / `maxDepth`
3. Hardcoded defaults: `allowRecursiveSpawn: false`, `maxDepth: 3`

## 4. Session Key Format

### 4.1 Current Format

```
agent:{agentId}:subagent:{uuid}
```

### 4.2 New Nested Format

```
agent:{agentId}:subagent:{uuid}              # depth 1
agent:{agentId}:subagent:{uuid}:sub:{uuid2}  # depth 2
agent:{agentId}:subagent:{uuid}:sub:{uuid2}:sub:{uuid3}  # depth 3
```

**Key design decisions:**

- The first segment always uses `subagent:` (existing convention)
- Nested levels use `sub:` (shorter, avoids ambiguity in parsing)
- The `agentId` in the prefix is always the **root** agent that initiated the chain
- Each `:sub:` segment adds a UUID for that level

### 4.3 Parsing

`isSubagentSessionKey()` already works — it checks if the rest starts with `subagent:`. No change needed.

New utility functions:

```typescript
function getSubagentDepth(sessionKey: string): number;
// Returns 0 for non-subagent keys, 1 for direct subagents, 2+ for nested

function getParentSessionKey(sessionKey: string): string | null;
// Strips the last :sub:{uuid} segment to get the parent key
// For depth-1 subagents, returns the main agent key
```

### 4.4 Compatibility

`parseAgentSessionKey()` already returns `{ agentId, rest }` where rest = everything after `agent:{id}:`. The existing regex-free split logic handles arbitrary depth naturally. No change needed to that function.

## 5. Depth Tracking & Enforcement

### 5.1 In `sessions-spawn-tool.ts`

Replace the hard block:

```typescript
// BEFORE
if (isSubagentSessionKey(requesterSessionKey)) {
  return jsonResult({
    status: "forbidden",
    error: "sessions_spawn is not allowed from sub-agent sessions",
  });
}

// AFTER
if (isSubagentSessionKey(requesterSessionKey)) {
  const currentDepth = getSubagentDepth(requesterSessionKey);
  const maxDepth = resolveMaxDepth(cfg, requesterAgentId);
  const allowRecursive = resolveAllowRecursiveSpawn(cfg, requesterAgentId);

  if (!allowRecursive) {
    return jsonResult({
      status: "forbidden",
      error:
        "Recursive spawning is not enabled for this agent. Set subagents.allowRecursiveSpawn: true in config.",
    });
  }

  if (currentDepth >= maxDepth) {
    return jsonResult({
      status: "forbidden",
      error: `Maximum subagent depth reached (${maxDepth}). Cannot spawn deeper.`,
    });
  }
}
```

### 5.2 Child Session Key Generation

For recursive spawns, append `:sub:{uuid}` to the parent's session key instead of generating a fresh `agent:{id}:subagent:{uuid}`:

```typescript
// BEFORE (always)
const childSessionKey = `agent:${targetAgentId}:subagent:${crypto.randomUUID()}`;

// AFTER
const childSessionKey = isSubagentSessionKey(requesterSessionKey)
  ? `${requesterSessionKey}:sub:${crypto.randomUUID()}`
  : `agent:${targetAgentId}:subagent:${crypto.randomUUID()}`;
```

## 6. Announce Routing

### 6.1 Principle: Results Bubble Up to Immediate Parent

When a depth-2 subagent completes:

1. Its results are announced to its **parent** (the depth-1 subagent), not the root agent.
2. The depth-1 subagent processes the results and includes them in its own final output.
3. The depth-1 subagent's results are then announced to the root agent.

This preserves the delegation chain — each level synthesizes and summarizes before passing up.

### 6.2 Implementation

In `registerSubagentRun()` and the announce flow:

- `requesterSessionKey` is already set to the spawner's session key
- For recursive spawns, this will be the parent subagent's key (e.g., `agent:main:subagent:{uuid}`)
- The announce flow already targets `requesterSessionKey`, so it naturally routes to the parent
- **No change needed** to `subagent-announce.ts` announce routing logic

### 6.3 System Prompt for Recursive Subagents

`buildSubagentSystemPrompt()` needs a minor update:

- Add a note about the subagent's depth level
- Clarify that results go to the immediate parent, not the end user
- Keep the "stay focused" and "be ephemeral" rules

## 7. Tool Policy Inheritance

### 7.1 Current Behavior

Subagents get tools filtered by `resolveSubagentToolPolicy()`, which applies a deny list (no `sessions_spawn`, `cron`, `memory_search`, etc.).

### 7.2 New Behavior

When recursive spawning is enabled:

- Remove `sessions_spawn` from `DEFAULT_SUBAGENT_TOOL_DENY` (it's controlled by config now)
- Add `sessions_list` and `sessions_history` as allowed for recursive subagents (they need to monitor their children)
- Deeper levels inherit the parent's policy — each level can only restrict further, never expand

### 7.3 Depth-Based Restrictions

No automatic per-depth restrictions in v1. The config-level `maxDepth` is the primary safety valve. Tool policy is inherited uniformly. Future versions could add per-depth tool overrides.

## 8. Edge Cases

### 8.1 Infinite Recursion Prevention

- `maxDepth` hard cap (default 3, max 10)
- `maxConcurrent` still applies globally
- Depth is calculated from the session key structure (countable, not spoofable)

### 8.2 Parent Timeout Before Children Complete

- When a parent subagent times out, its children continue until **their own** timeout
- Children's results are still announced to the parent's session key
- If the parent session is already deleted (cleanup: "delete"), the announce fails silently
- Future enhancement: cascade cancellation (not in v1)

### 8.3 Cleanup Cascading

- When a parent with `cleanup: "delete"` completes, only its own session is deleted
- Child sessions have their own cleanup lifecycle via `subagent-registry`
- The sweeper handles orphaned sessions via `archiveAfterMinutes`
- Future enhancement: explicit cascade cleanup (not in v1)

### 8.4 Cost Tracking

- Each subagent session tracks its own tokens/cost independently
- The announce flow already includes stats per session
- No aggregated cost tracking across depth levels in v1
- Parent agent receives child stats in the announce message and can report them

## 9. Context Management

### 9.1 Autocompaction

- `compaction.mode: safeguard` works identically for recursive sessions
- Each session has its own compaction state
- No cross-session compaction dependencies

### 9.2 Context Pruning

- `contextPruning` settings apply per-session
- Recursive subagents inherit global defaults like any other session
- No depth-specific pruning overrides in v1

### 9.3 Session Store Persistence

- `subagent-registry.store.ts` already persists all runs to disk
- Recursive runs use the same persistence mechanism
- The `SubagentRunRecord` type doesn't need changes — `requesterSessionKey` already captures the full parent chain

## 10. Files to Modify

1. **`src/agents/tools/sessions-spawn-tool.ts`** — Lift hard block, add depth checking, update child key generation
2. **`src/config/types.agents.ts`** — Add `allowRecursiveSpawn` and `maxDepth` to subagents type
3. **`src/config/zod-schema.agent-defaults.ts`** — Add schema validation for new fields
4. **`src/config/zod-schema.agent-runtime.ts`** — Add schema validation for per-agent new fields
5. **`src/sessions/session-key-utils.ts`** — Add `getSubagentDepth()` and `getParentSessionKey()`
6. **`src/agents/subagent-announce.ts`** — Update system prompt for depth awareness
7. **`src/agents/pi-tools.policy.ts`** — Conditionally allow `sessions_spawn` for recursive subagents
8. **`src/routing/session-key.ts`** — Re-export new utility functions

## 11. Test Plan

1. **Unit: session key depth parsing** — `getSubagentDepth()` for various key formats
2. **Unit: parent key extraction** — `getParentSessionKey()` for various depths
3. **Unit: config resolution** — `resolveAllowRecursiveSpawn()` and `resolveMaxDepth()` with various config combinations
4. **E2E: recursive spawn allowed** — Subagent with `allowRecursiveSpawn: true` can spawn
5. **E2E: recursive spawn blocked by default** — Subagent without config gets forbidden
6. **E2E: depth limit enforced** — Subagent at max depth gets forbidden
7. **E2E: child session key format** — Verify nested key format is correct
8. **E2E: announce routes to parent** — Verify results go to immediate parent, not root
9. **E2E: schema validation** — New config fields pass zod validation
10. **E2E: tool policy** — `sessions_spawn` available in subagent tool set when recursive enabled

## 12. Review Findings & Resolutions

### 12.1 Root Agent Identity (Codex Review §1)

**Concern:** `parseAgentSessionKey` returns root agent ID, not immediate parent. Policy checks may use wrong identity.
**Resolution:** For v1, this is **correct behavior**. All subagents in a recursive chain belong to the same root agent. The root agent's config governs the entire chain. Cross-agent recursive spawning is a v2 feature. The `requesterAgentId` resolved from the session key is the root agent who "owns" the chain and whose policy should govern it.

### 12.2 Existing Test Breakage (Codex Review §4)

**Concern:** Tests asserting "forbidden" error text will break.
**Resolution:** Since `allowRecursiveSpawn` defaults to `false`, subagent spawn attempts still get "forbidden" — but with a different error message. Tests checking exact error text need updating. Tests checking `status: "forbidden"` still pass unchanged.

### 12.3 Malformed Key Handling (Codex Review §5)

**Resolution:** `getSubagentDepth()` will use token-based parsing (split on `:` and count structured segments) rather than substring matching. Returns 0 for invalid/non-subagent keys. `getParentSubagentKey()` returns null for invalid keys and for depth-0 keys.

### 12.4 Mixed-Agent Chains (Codex Review §5)

**Resolution:** Explicitly a v2 non-goal. In v1, cross-agent recursive spawning follows existing `allowAgents` rules but the depth/recursive config is always checked against the root agent.

## 13. Non-Goals (v1)

- Cascade cancellation when parent dies
- Per-depth tool restrictions
- Aggregated cost tracking across depth levels
- Cross-agent recursive spawning policy (different agentId at different depths with separate policies)
- UI/dashboard for recursive spawn trees
- Mixed-agent chain policy inheritance
