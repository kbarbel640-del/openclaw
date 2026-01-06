# {BUG_ID} Bug Fix - Trello Board

> Scrum Master: AI Agent | Sprint: Linear Execution
> Story Point Cap: 4 SP per card | Method: TDD (RED→GREEN→VERIFY)

## TDD Pipeline

```
┌─────────────────────────────────────────────────────────┐
│                  BUG FIX PIPELINE                       │
│                                                         │
│         TDD: RED → GREEN → VERIFY                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐            │
│  │    01    │ → │    02    │ → │    03    │            │
│  │   2 SP   │   │   2 SP   │   │   2 SP   │            │
│  └──────────┘   └──────────┘   └──────────┘            │
│  🔴 RED        🟢 GREEN       ✅ VERIFY                │
│  Regression    Implement      Full                      │
│  Test          Fix            Verification              │
│                                                         │
│  Total: {TOTAL_SP} Story Points                         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Card Index

| Card | Title | SP | Status | Description |
|------|-------|---:|--------|-------------|
| [01](./01-regression-test.md) | Regression Test | 2 | {STATUS} | 🔴 Write failing test (TDD RED) |
| [02](./02-implement-fix.md) | Implement Fix | 2 | {STATUS} | 🟢 Make test pass (TDD GREEN) |
| [03](./03-verify-fix.md) | Verify & PR | 2 | {STATUS} | ✅ Full verification + PR |

## Bug Information

| Property | Value |
|----------|-------|
| Bug ID | {BUG_ID} |
| Summary | {SUMMARY} |
| Severity | {SEVERITY} |
| Root Cause | {ROOT_CAUSE_SUMMARY} |
| Location | `{FILE_PATH}:{LINE_NUMBER}` |

## Key Files

| File | Purpose |
|------|---------|
| `smart_commit.sh` | Smart commit tool |
| `auto-commit-daemon.sh` | Auto-commit daemon |
| `{FILE_PATH}` | File with bug |
| `{TEST_FILE_PATH}` | New regression test |
| `reproduce-{BUG_ID}.sh` | Reproduction script |

## ⚡ Auto-Commit Daemon (MANDATORY)

**Activate before starting cards:**
```bash
cd trello-cards
nohup ./auto-commit-daemon.sh --feature "{BUG_ID}" &
```

**This ensures:**
- ✅ Changes committed every 5 minutes automatically
- ✅ Never lose work
- ✅ Incremental commit history
- ✅ Zero cognitive overhead

**Manage daemon:**
```bash
# Check status
ps aux | grep auto-commit-daemon

# Stop when done
./auto-commit-daemon.sh --stop
```

## Git Commit Workflow

**Use smart_commit.sh for all commits:**
```bash
# After making changes
./smart_commit.sh --feature "{BUG_ID}"

# For manual commits
git add <files>
git commit -m "test: add failing test for {BUG_ID}"
```

## Execution Order

```
START
  │
  ├─→ Phase 1: Start Auto-Commit Daemon (REQUIRED)
  │   nohup ./auto-commit-daemon.sh --feature "{BUG_ID}" &
  │
  ├─→ Card 01: Regression Test
  │   ├── Write test that exposes bug
  │   ├── Verify test FAILS
  │   └── Commit: ./smart_commit.sh --feature "{BUG_ID}"
  │
  ├─→ Card 02: Implement Fix
  │   ├── Apply minimal fix
  │   ├── Verify test PASSES
  │   ├── Run all tests
  │   └── Commit: ./smart_commit.sh --feature "{BUG_ID}"
  │
  └─→ Card 03: Verify & PR
      ├── Run full verification
      ├── Check reproduction script
      ├── Push branch: git push -u origin "$(git rev-parse --abbrev-ref HEAD)"
      ├── Create PR (MANDATORY)
      └── Commit: ./smart_commit.sh --feature "{BUG_ID}"
```

## Sprint Summary

| Metric | Value |
|--------|-------|
| Total Cards | {CARD_COUNT} |
| Total Story Points | {TOTAL_SP} |
| Method | TDD (RED → GREEN → VERIFY) |
| Auto-Commit | 5-minute intervals |

## Verification Commands

```bash
# Quick status check
pnpm test {TEST_FILE}     # Regression test
pnpm test                  # All tests
./reproduce-{BUG_ID}.sh    # Should exit 0 (no bug)

# Git status
git status
./smart_commit.sh --feature "{BUG_ID}"
```

## 🎯 Final PR Creation (CARD 03)

**After completing final card, execute:**
```bash
# 1. Verify all committed
git status

# 2. Run smart_commit to ensure all changes are captured
./smart_commit.sh --feature "{BUG_ID}"

# 3. Push branch
git push -u origin "$(git rev-parse --abbrev-ref HEAD)"

# 4. Create Pull Request (MANDATORY)
gh pr create \
  --title "fix: {BUG_ID} - {SUMMARY}" \
  --body "## Bug Fix: {BUG_ID}

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
🐛 Generated with SDD Bug Fix Flow"

# 5. Verify PR created
PR_URL=$(gh pr view --json url -q .url)
echo "PR Created: $PR_URL"
```

---

**⚠️ DO NOT MARK COMPLETE WITHOUT PR ⚠️**
**⚠️ DO NOT SKIP AUTO-COMMIT DAEMON ⚠️**
