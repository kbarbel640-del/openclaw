# {BUG_ID} Bug Fix - AI Agent Kickoff

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║   🐛 BUG FIX INSTRUCTION                                                     ║
║                                                                              ║
║   Execute ALL {CARD_COUNT} cards below in LINEAR order.                      ║
║   Follow TDD: RED (test) → GREEN (fix) → VERIFY                             ║
║   Update state.json after EACH card.                                         ║
║   Do NOT stop until all cards are "completed".                               ║
║                                                                              ║
║   START NOW. First action: Read state.json, find first pending card.         ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

> **ENTRY POINT**: This is the ONLY file you need. Everything is linked from here.
> This file is SELF-CONTAINED. Do not ask for clarification - all info is here.

## Mission

Fix bug {BUG_ID} by executing {CARD_COUNT} Trello cards in linear order using TDD.
Track progress in `state.json`. Update after each card. Never skip cards.

## Bug Summary

- **ID:** {BUG_ID}
- **Summary:** {SUMMARY}
- **Severity:** {SEVERITY}
- **Root Cause:** {ROOT_CAUSE_SUMMARY}

## Git Flow Enforcement - MANDATORY

### ⚡ Phase 1: Start Auto-Commit Daemon (REQUIRED)

**This is NOT optional. DO NOT skip this step.**

```bash
# Navigate to trello-cards directory
cd trello-cards

# Start auto-commit daemon (5-minute intervals)
nohup ./auto-commit-daemon.sh --feature "{BUG_ID}" &

# Verify daemon is running
ps aux | grep auto-commit-daemon
```

**What this does:**
- ✅ Auto-commits every 5 minutes
- ✅ Never lose work
- ✅ Incremental commit history
- ✅ Zero cognitive overhead

**Manage daemon:**
```bash
# Check status
ps aux | grep auto-commit-daemon

# Stop daemon (when done)
./auto-commit-daemon.sh --stop
```

### 📋 Phase 2: During Implementation

Each card will remind you to check git status. The daemon handles commits automatically.

### 🎯 Phase 3: Final PR Creation (REQUIRED)

**After completing ALL cards:**

```bash
# 1. Verify all changes committed
git status

# 2. Run smart_commit to ensure all changes are captured
./smart_commit.sh --feature "{BUG_ID}"

# 3. Push branch
git push -u origin "$(git rev-parse --abbrev-ref HEAD)"

# 4. Create PR (MANDATORY - THIS IS NOT OPTIONAL)
gh pr create \
  --title "fix: {BUG_ID} - {SUMMARY}" \
  --body "$(cat <<'EOF'
## Bug Fix: {BUG_ID}

**Severity:** {SEVERITY}
**Summary:** {SUMMARY}

### Root Cause
{ROOT_CAUSE_SUMMARY}

### Fix
{FIX_SUMMARY}

### Testing
- [x] Regression test added and passes
- [x] All existing tests pass
- [x] Reproduction script confirms fix
- [x] Type check passes
- [x] Lint passes
- [x] Build succeeds

---
🐛 Generated with SDD Bug Fix Flow
EOF
)"

# 5. Verify PR created
echo "PR URL: $(gh pr view --json url -q .url)"
```

### ⚠️ PR Requirements

- [ ] PR title starts with "fix:"
- [ ] PR body contains bug ID and summary
- [ ] PR has testing checklist
- [ ] All cards referenced in PR

### 🚨 FAILURE TO CREATE PR = INCOMPLETE IMPLEMENTATION

**DO NOT mark this implementation as complete until PR is created.**

## TDD Protocol

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        TDD BUG FIX CYCLE                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  CARD 01: RED                                                           │
│  ├── Write failing test that exposes the bug                           │
│  ├── Run test - it MUST fail                                           │
│  ├── git add + ./smart_commit.sh --feature "{BUG_ID}"                  │
│  └── Commit: "test: add failing test for {BUG_ID}"                     │
│                                                                         │
│  CARD 02: GREEN                                                         │
│  ├── Write minimal code to make test pass                              │
│  ├── Run test - it MUST pass                                           │
│  ├── Run ALL tests - no regressions                                    │
│  └── git add + ./smart_commit.sh --feature "{BUG_ID}"                  │
│                                                                         │
│  CARD 03: VERIFY                                                        │
│  ├── Run full verification checklist                                   │
│  ├── Run reproduction script - bug should NOT reproduce                │
│  ├── Create PR (see Git Flow Enforcement above)                       │
│  └── Commit: "chore: verification complete for {BUG_ID}"               │
│                                                                         │
│  ON ERROR: Set card to "failed", add error message, STOP for help       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Files

| File | Purpose | Agent Action |
|------|---------|--------------|
| [BOARD.md](./BOARD.md) | Card overview and pipeline | Read once at start |
| [state.json](./state.json) | Progress tracking | Read+write each card |
| [AGENT_PROTOCOL.md](./AGENT_PROTOCOL.md) | State update patterns | Reference when needed |
| [smart_commit.sh](./smart_commit.sh) | Smart commit tool | Use for all commits |
| [auto-commit-daemon.sh](./auto-commit-daemon.sh) | Auto-commit daemon | Start at beginning |
| [01-regression-test.md](./01-regression-test.md) | TDD RED | **Execute first** |
| [02-implement-fix.md](./02-implement-fix.md) | TDD GREEN | **Execute second** |
| [03-verify-fix.md](./03-verify-fix.md) | Verification | **Execute last** |

## Key Locations

| Item | Path |
|------|------|
| Bug Location | `{FILE_PATH}:{LINE_NUMBER}` |
| Test Location | `{TEST_FILE_PATH}` |
| Reproduction Script | `./reproduce-{BUG_ID}.sh` |

## Getting Started

```bash
# 1. Start auto-commit daemon (REQUIRED)
cd trello-cards
nohup ./auto-commit-daemon.sh --feature "{BUG_ID}" &

# 2. Read current state
cat state.json

# 3. Read board
cat BOARD.md
```

**First action:** Read [BOARD.md](./BOARD.md) to understand card sequence.

**Second action:** Read [state.json](./state.json) to find current card.

**Then:** Execute cards: 01 → 02 → 03

## Completion Criteria

- [ ] Auto-commit daemon started (REQUIRED)
- [ ] Card 01: Regression test written and FAILS
- [ ] Card 02: Fix applied, regression test PASSES
- [ ] Card 03: All verification passed
- [ ] state.json shows all cards "completed"
- [ ] Reproduction script shows bug NOT reproducible
- [ ] **PR created on GitHub (MANDATORY)**

## Success Definition

This bug fix is **SUCCESSFUL** when:

1. ✅ Auto-commit daemon ran throughout implementation
2. ✅ Regression test exists and passes
3. ✅ All existing tests pass
4. ✅ Reproduction script shows bug fixed
5. ✅ Type checking passes
6. ✅ Linting passes
7. ✅ Build succeeds
8. ✅ **PR created on GitHub**

---

**NOW BEGIN.**

1. Start daemon: `nohup ./auto-commit-daemon.sh --feature "{BUG_ID}" &`
2. Read state.json: `cat state.json`
3. First card: [01-regression-test.md](./01-regression-test.md)
