# Upstream Integration Plan for `feat/subagent-comms`

**Goal:** Safely integrate all recommended `origin/main` and `upstream/main` changes into `feat/subagent-comms` with strict guardrails for subagent, compaction, and memory behavior.

**Architecture:** Use a staged integration flow: first merge from `origin/main` to absorb fork-local baseline updates, then cherry-pick upstream commits in ordered waves (safe wave first, deconfliction waves second). Every wave has explicit test gates and rollback checkpoints so we can stop at a clean boundary if regressions appear.

**Tech Stack:** Git (`merge`, `cherry-pick`, conflict resolution), TypeScript/Vitest (`pnpm test`), OpenClaw CLI/build checks (`pnpm build`, `pnpm check`).

---

## Scope: Every Change Recommended for Integration

### A) Must merge from fork baseline (`origin/main`)

- `a2b45b65f` `feat(sophon): migrate tools to API backend and add tests`
- `41170bb66` `chore: remove component debug logging`
- `e3abd7847` `fix(discord): guard against silent component drop in outbound send fallback`
- `cef11876c` `feat: port session tools visibility improvements (upstream c6c53437f)`
- `dff418fb3` `fix(discord): wire components through message tool channel bridge`

### B) Must cherry-pick (safe/apply-clean waves)

- `dd4eb8bf6` `fix(cron): retry next-second schedule compute on undefined`
- `ffbcb3734` `fix (memory/compaction): inject runtime date-time into memory flush prompt`
- `13ae1ae05` `fix(memory): tighten embedding manager inheritance types`
- `9805ce009` `refactor(memory): reuse cached embedding collector`
- `501e89367` `fix (memory/search): support unicode tokens in FTS query builder`
- `b32ae6fa0` `fix (memory/qmd): isolate managed collections per agent`
- `85430c849` `fix (memory/qmd): rebind drifted managed collection paths`
- `3fff266d5` `fix(session-memory): harden reset transcript recovery`
- `5ee79f80e` `fix: reduce default image dimension from 2000px to 1200px`
- `4f2c57eb4` `feat(skills): compact skill paths with ~ to reduce prompt tokens`
- `76949001e` `fix: compact skill paths in prompt`

### C) Must cherry-pick with careful deconfliction (custom subagent/compaction/memory overlap)

- `5a3a448bc` `feat(commands): add /subagents spawn command`
- `f24224683` `fix(subagents): pass group context in /subagents spawn`
- `b2acfd606` `fix(subagent): update SUBAGENT_SPAWN_ACCEPTED_NOTE`
- `6931ca703` `fix(subagent): route nested announce to parent even when parent run ended`
- `67014228c` `fix(subagents): harden announce retry guards`
- `068b9c974` `feat: wrap compaction generateSummary in retryAsync`
- `35a3e1b78` `feat: inject post-compaction workspace context as system event`
- `c4f829411` `feat: append workspace critical rules to compaction summary`
- `811c4f5e9` `feat: add post-compaction read audit (Layer 3)`
- `087dca8fa` `fix(subagent): harden read-tool overflow guards and sticky reply threading`
- `6b3e0710f` `feat(memory): add opt-in temporal decay for hybrid search scoring`
- `65ad9a426` `Memory: fix MMR tie-break and temporal timestamp dedupe`
- `cbf58d2e1` `fix(memory): harden context window cache collisions`

---

## Global Safety Rules

1. Never batch safe and high-conflict commits together.
2. Create a rollback tag before each wave.
3. Run targeted tests after each wave; only proceed when green.
4. For conflicts in subagent/compaction/memory files, preserve branch-specific behavior first, then layer upstream fixes.
5. Use `-x` for all cherry-picks for traceability.

---

### Task 1: Preflight Safety Snapshot

**Parallel:** no  
**Blocked by:** none  
**Owned files:** `.git/`, `/tmp/openclaw-integration-notes.md`

**Files:**

- Create: `/tmp/openclaw-integration-notes.md`
- Modify: none
- Test: none

**Step 1: Capture clean starting point**
Run:

```bash
git status --short
git rev-parse --abbrev-ref HEAD
git rev-parse HEAD
```

Expected: on `feat/subagent-comms`; save head SHA in notes.

**Step 2: Ensure remotes are up to date**
Run:

```bash
git fetch origin --prune
git fetch upstream --prune
```

Expected: both remotes updated without errors.

**Step 3: Create rollback tag**
Run:

```bash
git tag -f backup/pre-upstream-integration-2026-02-18
```

Expected: tag points to current `HEAD`.

---

### Task 2: Merge `origin/main` Baseline First

**Parallel:** no  
**Blocked by:** Task 1  
**Owned files:** `src/channels/plugins/actions/discord/handle-action.ts`, `src/infra/outbound/outbound-send-service.ts`, `src/agents/openclaw-tools.sessions-visibility.e2e.test.ts`, `src/gateway/server.sessions-send.e2e.test.ts`, Sophon extension files

**Files:**

- Modify: merge touches from `origin/main` into branch
- Test: `src/agents/openclaw-tools.sessions-visibility.e2e.test.ts`, `src/gateway/server.sessions-send.e2e.test.ts`, Discord send path tests

**Step 1: Merge fork baseline**
Run:

```bash
git merge --no-ff origin/main
```

Expected: merge commit created or conflicts opened.

**Step 2: If conflicts occur, resolve with these priorities**

1. Keep `feat/subagent-comms` behavior for subagent orchestration internals.
2. Keep upstream fix intent for Discord component send path.
3. Accept session visibility test additions unless they break local custom assertions.

**Step 3: Validate merge outcome**
Run:

```bash
pnpm test -- src/agents/openclaw-tools.sessions src/gateway/server.sessions-send src/channels/plugins/actions/discord src/infra/outbound/outbound-send-service
```

Expected: targeted suite passes.

**Step 4: Create checkpoint tag**
Run:

```bash
git tag -f backup/post-origin-main-merge-2026-02-18
```

Expected: tag at merge result.

---

### Task 3: Cherry-pick Safe Runtime Wave (Memory + Cron)

**Parallel:** no  
**Blocked by:** Task 2  
**Owned files:** `src/auto-reply/reply/memory-flush.ts`, `src/auto-reply/reply/agent-runner-memory.ts`, `src/memory/manager-embedding-ops.ts`, `src/memory/manager-sync-ops.ts`, `src/memory/*`, `src/hooks/bundled/session-memory/handler.ts`, `src/cron/service/jobs.ts`

**Files:**

- Modify: memory/session-memory/cron runtime files
- Test: memory/session-memory/cron targeted suites

**Step 1: Apply safe commits in this order**
Run:

```bash
git cherry-pick -x dd4eb8bf6
git cherry-pick -x ffbcb3734
git cherry-pick -x 13ae1ae05
git cherry-pick -x 9805ce009
git cherry-pick -x 501e89367
git cherry-pick -x b32ae6fa0
git cherry-pick -x 85430c849
git cherry-pick -x 3fff266d5
```

Expected: all picks apply; if one conflicts, stop, resolve, run tests before continuing.

**Step 2: Targeted verification**
Run:

```bash
pnpm test -- src/memory src/hooks/bundled/session-memory src/auto-reply/reply/memory-flush src/cron/service/jobs
```

Expected: no regressions in memory flush/session memory/cron timing.

**Step 3: Checkpoint tag**
Run:

```bash
git tag -f backup/post-safe-runtime-wave-2026-02-18
```

---

### Task 4: Cherry-pick Safe UX/Prompt Efficiency Wave

**Parallel:** no  
**Blocked by:** Task 3  
**Owned files:** `src/agents/tool-images.ts`, `src/agents/skills/workspace.ts`, `src/agents/skills.compact-skill-paths.test.ts`, `CHANGELOG.md`

**Files:**

- Modify: skill path formatting + image dimension default
- Test: tool images + skills path behavior

**Step 1: Apply commits**
Run:

```bash
git cherry-pick -x 5ee79f80e
git cherry-pick -x 4f2c57eb4
git cherry-pick -x 76949001e
```

Expected: clean apply.

**Step 2: Verify**
Run:

```bash
pnpm test -- src/agents/tool-images src/agents/skills/workspace
```

Expected: no prompt-compaction or image sanitization regressions.

**Step 3: Checkpoint tag**
Run:

```bash
git tag -f backup/post-safe-ux-wave-2026-02-18
```

---

### Task 5: Subagent Command Stack (Careful)

**Parallel:** no  
**Blocked by:** Task 4  
**Owned files:** `src/agents/subagent-spawn.ts`, `src/agents/tools/sessions-spawn-tool.ts`, `src/auto-reply/reply/commands-subagents.ts`, `src/auto-reply/commands-registry.data.ts`

**Files:**

- Modify: subagent spawn command and command routing
- Test: session spawn + command routing + registry behaviors

**Step 1: Apply base feature commit first**
Run:

```bash
git cherry-pick -x 5a3a448bc
```

Expected: may apply cleanly; if conflicts, preserve existing custom spawn verification hooks from branch.

**Step 2: Layer follow-up fixes**
Run:

```bash
git cherry-pick -x f24224683
git cherry-pick -x b2acfd606
```

Expected: likely conflicts in files modified by branch; resolve by preserving current branch-specific group/routing semantics and taking upstream bugfix logic.

**Step 3: Verify subagent spawn paths**
Run:

```bash
pnpm test -- src/agents/tools/sessions-spawn-tool src/agents/subagent src/auto-reply/reply/commands-subagents
```

Expected: spawn command paths and status surfaces stay intact.

**Step 4: Checkpoint tag**
Run:

```bash
git tag -f backup/post-subagent-command-stack-2026-02-18
```

---

### Task 6: Subagent Announce Stack (Careful)

**Parallel:** no  
**Blocked by:** Task 5  
**Owned files:** `src/agents/subagent-announce.ts`, `src/agents/subagent-registry.ts`, `src/web/test-helpers.ts`

**Files:**

- Modify: nested announce routing and retry guards
- Test: announce routing and registry retry behavior

**Step 1: Apply nested routing fix**
Run:

```bash
git cherry-pick -x 6931ca703
```

Expected: usually applies; verify no regression in parent-run-ended flows.

**Step 2: Apply retry hardening**
Run:

```bash
git cherry-pick -x 67014228c
```

Expected: likely conflicts; keep current registry storage lifecycle from branch, import upstream retry guard logic.

**Step 3: Verify**
Run:

```bash
pnpm test -- src/agents/subagent-announce src/agents/subagent-registry src/web/test-helpers
```

Expected: nested announce + retry loops stable.

**Step 4: Checkpoint tag**
Run:

```bash
git tag -f backup/post-subagent-announce-stack-2026-02-18
```

---

### Task 7: Compaction Context Stack (Careful)

**Parallel:** no  
**Blocked by:** Task 6  
**Owned files:** `src/agents/compaction.ts`, `src/agents/pi-extensions/compaction-safeguard.ts`, `src/auto-reply/reply/post-compaction-context.ts`, `src/auto-reply/reply/post-compaction-audit.ts`, `src/auto-reply/reply/agent-runner.ts`

**Files:**

- Modify: compaction retry + post-compaction context injection + audit
- Test: compaction and runner post-compaction behavior

**Step 1: Apply in order**
Run:

```bash
git cherry-pick -x 068b9c974
git cherry-pick -x 35a3e1b78
git cherry-pick -x c4f829411
git cherry-pick -x 811c4f5e9
```

Expected: `c4f829411` likely conflicts with branch compaction/context edits.

**Step 2: Conflict policy**

- Keep branch-specific compaction/memory instructions already added for custom behavior.
- Merge upstream additions for workspace critical rules and post-compaction audit scaffolding.
- Preserve strict system-event shape compatibility with existing runner pipeline.

**Step 3: Verify**
Run:

```bash
pnpm test -- src/agents/compaction src/agents/pi-extensions/compaction-safeguard src/auto-reply/reply/agent-runner src/auto-reply/reply/post-compaction
```

Expected: compaction no longer double-fails/silently regresses; post-compaction context present.

**Step 4: Checkpoint tag**
Run:

```bash
git tag -f backup/post-compaction-context-stack-2026-02-18
```

---

### Task 8: Large Subagent Overflow + Sticky Threading Commit (Highest Risk)

**Parallel:** no  
**Blocked by:** Task 7  
**Owned files:** `src/agents/pi-tools.read.ts`, `src/agents/pi-tools.ts`, `src/agents/system-prompt.ts`, `src/agents/subagent-announce.ts`, `src/agents/pi-embedded-runner/run/attempt.ts`, plus channel/gateway glue touched by `087dca8fa`

**Files:**

- Modify: broad subagent read-tool overflow/sticky threading logic
- Test: subagent orchestration, tool result rendering, sticky threading behavior

**Step 1: Apply commit**
Run:

```bash
git cherry-pick -x 087dca8fa
```

Expected: conflicts are very likely.

**Step 2: Resolve with strict invariants**

- Preserve existing `feat/subagent-comms` capability-routing and report-progress/report-completion lifecycle.
- Preserve branch custom compaction/memory behavior.
- Import upstream overflow guard logic and sticky threading safeguards where equivalent abstractions exist.
- Do not regress channel-specific message delivery behavior introduced on branch.

**Step 3: High-signal verification**
Run:

```bash
pnpm test -- src/agents/openclaw-tools src/agents/pi-tools src/agents/subagent src/gateway/server.sessions-send src/web/auto-reply
```

Expected: orchestration + read-tool paths pass.

**Step 4: Checkpoint tag**
Run:

```bash
git tag -f backup/post-highrisk-subagent-overflow-2026-02-18
```

---

### Task 9: Memory Ranking/Scoring Hardening Stack (Careful)

**Parallel:** no  
**Blocked by:** Task 8  
**Owned files:** `src/memory/manager.ts`, `src/memory/manager-embedding-ops.ts`, `src/memory/batch-voyage.ts`, memory search/ranking internals touched by these commits

**Files:**

- Modify: hybrid scoring, temporal decay, MMR tie-break behavior, cache collision hardening
- Test: memory retrieval ranking and cache stability

**Step 1: Apply in order**
Run:

```bash
git cherry-pick -x 6b3e0710f
git cherry-pick -x 65ad9a426
git cherry-pick -x cbf58d2e1
```

Expected: at least one conflict likely due local memory stack divergence.

**Step 2: Verify behavior-level outcomes**
Run:

```bash
pnpm test -- src/memory
```

Expected: no ranking/caching regressions; tests green.

**Step 3: Checkpoint tag**
Run:

```bash
git tag -f backup/post-memory-ranking-stack-2026-02-18
```

---

### Task 10: Full Project Gates Before Finalizing

**Parallel:** no  
**Blocked by:** Task 9  
**Owned files:** repository-wide

**Files:**

- Modify: none (validation task)
- Test: repo-wide quality gates

**Step 1: Static and type checks**
Run:

```bash
pnpm check
pnpm tsgo
pnpm build
```

Expected: all pass.

**Step 2: Main test run**
Run:

```bash
pnpm test
```

Expected: full suite passes or only known pre-existing failures documented.

**Step 3: Delta review**
Run:

```bash
git log --oneline --decorate --graph origin/main..HEAD | sed -n '1,120p'
git diff --stat origin/main...HEAD
```

Expected: commit history and changed-surface match planned waves.

---

### Task 11: Conflict Triage Checklist (Use Every Time)

**Parallel:** no  
**Blocked by:** Tasks 2-9 (as needed)  
**Owned files:** whichever file is currently conflicted

**Files:**

- Modify: conflicted files only
- Test: nearest impacted test suites

**Step 1: Inspect exact intent before editing**
Run:

```bash
git show <SHA>
git checkout --conflict=merge -- <conflicted-file>
```

Expected: clear view of upstream intent and current local context.

**Step 2: Resolve with three-way intent merge**

- Keep local custom behavior for:
  - subagent orchestration lifecycle
  - compaction + memory prompt behavior already customized in branch
  - session status projection/reporting architecture added in this branch
- Apply upstream bugfix logic where it does not remove the above.

**Step 3: Verify only impacted surface first**
Run:

```bash
pnpm test -- <related-path-or-suite>
```

Expected: immediate feedback before continuing cherry-pick chain.

---

### Task 12: Rollback/Abort Procedures

**Parallel:** no  
**Blocked by:** none  
**Owned files:** git history state only

**Files:**

- Modify: none
- Test: none

**Step 1: Abort current failed cherry-pick/merge safely**
Run:

```bash
git cherry-pick --abort || true
git merge --abort || true
```

**Step 2: Restore to last stable checkpoint tag**
Run:

```bash
git reset --hard backup/<checkpoint-tag>
```

Expected: branch restored to known-good checkpoint.

**Step 3: Reattempt only the failed wave**

- Do not re-run prior successful waves.
- Narrow to one commit at a time until stable.

---

## Recommended Execution Order (One-Line Summary)

1. Merge `origin/main` baseline.
2. Cherry-pick safe runtime wave.
3. Cherry-pick safe UX/prompt wave.
4. Cherry-pick subagent command stack.
5. Cherry-pick subagent announce stack.
6. Cherry-pick compaction context stack.
7. Cherry-pick high-risk overflow/sticky threading commit.
8. Cherry-pick memory ranking/scoring stack.
9. Run full gates and finalize.

---

## Final Acceptance Criteria

- All listed commits are integrated (or explicitly documented as intentionally skipped with reason).
- Branch-specific subagent-comms behavior remains intact.
- No regressions in subagent spawn/announce, compaction post-processing, or memory retrieval stability.
- `pnpm check`, `pnpm tsgo`, `pnpm build`, and `pnpm test` complete successfully.
