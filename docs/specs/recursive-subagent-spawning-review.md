# Recursive Subagent Spawning — Spec Review

## 1. Logical flaws or missed edge cases

- **Root-agent leakage in session keys is coupled to policy resolution in `sessions-spawn-tool.ts`.**
  The proposed nested key format keeps the first `agentId` as the chain root, but `sessions-spawn-tool.ts` currently resolves requester config by parsing `requesterSessionKey` (`parseAgentSessionKey(...).agentId`) when deciding allowlists/tool policy. This makes recursion decisions based on root agent identity instead of immediate parent identity for nested spawns.
  - Impact: a restricted parent may bypass its own policy if an ancestor is broader, or be over-constrained by ancestor defaults.
  - Related source: `src/agents/tools/sessions-spawn-tool.ts` (around current hard-block at lines 121-126).

- **Policy inheritance semantics are underspecified for tool/mode overrides.**
  Spec says deeper levels inherit parent policy and may further restrict. Current file-level plan only removes `sessions_spawn` from global deny list and enables it conditionally. There is no explicit mechanism to enforce “only further restrictions” for deeper levels once policy is per-agent-resolved at root.

- **`requestedAgentId` mismatch with root key semantics not handled.**
  Once nested keying is root-based, spawning to a different target agent still needs to resolve which agent’s policy governs that spawn (parent vs target). Spec uses `resolveMaxDepth(cfg, requesterAgentId)` and similar calls but does not define how `requesterAgentId` should be selected under root-key format.

- **Depth-based enforcement occurs before target allowlist checks.**
  If depth cap is hit, we block first with `sessions_spawn` forbidden. This is fine, but no explicit precedence/diagnostic contract is described; clients may misinterpret whether cap or target-policy failed.

## 2. Session key format soundness

- **Format is parseable by existing `parseAgentSessionKey` and new-depth logic, but semantic drift exists.**
  `parseAgentSessionKey` already captures everything after `agent:{id}:` as `rest`, so nested `:sub:` segments are preserved. This supports arbitrary nesting from a parser perspective.

- **Ambiguity on agent identity becomes semantic debt.**
  Encoding only the root in `agentId` for all descendants (per spec §4.2) conflicts with existing use of this field for per-session agent identity decisions in spawn/tooling logic. The format is technically valid but semantically lossy.

- **No explicit validation in key format section for malformed keys.**
  If `getSubagentDepth` relies on substring counts, malformed keys containing extra `:sub:` in unexpected places could produce incorrect depths. Needs a strict parser based on token sequence (`subagent` then repeating `sub` groups).

- **`isSubagentSessionKey()` is not sufficient as a depth oracle.**
  It only identifies presence, not structure. New utilities are required for anything beyond boolean checks, which the spec acknowledges.

## 3. Depth tracking correctness

- **Core counting rule is mostly consistent with examples.**
  If `getSubagentDepth` returns depth as 1/2/3 from the format examples, then `currentDepth >= maxDepth` correctly gates further spawning.

- **Boundary condition depends on exact depth definition.**
  The spec defines default maxDepth=3 and the examples imply depth-3 is allowed as existing node but cannot spawn deeper. The sample check (`>=`) matches that only if depth counts current level correctly.

- **Potential undercount if key is normalized or aliased.**
  Depth logic assumes `requesterSessionKey` already full internal key. If aliases or alternative key variants can reach this path, depth becomes 0/incorrect and safety caps fail.

## 4. Will this break existing tests?

- **Likely yes, unless updated.**
  Existing tests that assert `sessions_spawn` forbidden from any subagent session will fail because the hard block is removed.

- **Session key assertions will fail where they assume single-level pattern.**
  Any tests expecting `agent:{id}:subagent:{uuid}` for every nested spawn path will break once `:sub:{uuid}` is introduced.

- **Config-schema/type tests may fail if types are only partially updated.**
  The spec introduces `subagents.allowRecursiveSpawn/maxDepth`; until schema and runtime type defaults are consistently updated, validation tests are likely to fail.

- **Policy tests are likely to need rework.**
  If policy is still resolved from root key, existing per-agent allowlist expectations for non-root descendants may no longer hold.

## 5. Specific improvements needed

- Make depth and identity explicit in session metadata rather than implicit through string shape.
  - Add dedicated parent-session reference in spawn/run records where needed.
  - Avoid overloading `agentId` for both “root chain id” and “active parent id”.

- Define and codify whether recursive policy checks use immediate parent config or root config.
  - Update `sessions-spawn-tool.ts` to use an explicit requester-parent agent id path and avoid relying on `parseAgentSessionKey(...).agentId` for nested recursion.

- Specify malformed key handling in parsing helpers.
  - `getSubagentDepth()` should reject/return null on invalid patterns rather than silently counting text matches.
  - `getParentSessionKey()` should define behavior for invalid/non-sub keys and depth-1 keys unambiguously.

- Add explicit test coverage for mixed-agent chains.
  - A chain where root and intermediate agents have different `subagents` policy and different restrictions should define expected outcomes.
  - Add tests for `:sub:` keys that include unexpected segments to harden parser behavior.
