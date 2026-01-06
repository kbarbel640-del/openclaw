# Card 02: {BUG_ID} - Implement Fix (TDD GREEN)

| Field | Value |
|-------|-------|
| **ID** | {BUG_ID}-02 |
| **Story Points** | 2 |
| **Type** | 🟢 TDD GREEN |
| **Depends On** | 01 |

## Objective

Write **minimal code** to make the failing test pass. The fix should:
1. Be minimal - change only what's necessary
2. Make the regression test pass
3. Not break any existing tests

## Context

Read before starting:
- [../root-cause-analysis.md](../root-cause-analysis.md) - Root cause details
- [../fix-strategy.md](../fix-strategy.md) - Fix approach

## Root Cause

**Location:** `{FILE_PATH}:{LINE_NUMBER}`

**Problem:** {ROOT_CAUSE_DESCRIPTION}

## ⚡ Pre-Card Checklist

```bash
# 1. Verify auto-commit daemon is running
ps aux | grep auto-commit-daemon

# 2. Verify state.json shows current card is 02
cat state.json | jq '.current_card'
# Expected: "02"

# 3. Verify Card 01 is completed
cat state.json | jq '.cards."01".status'
# Expected: "completed"
```

## Instructions

### Step 1: Open Bug Location

```bash
# Navigate to file
{EDITOR} {FILE_PATH}

# Go to line {LINE_NUMBER}
```

### Step 2: Review Current Code

```typescript
// {FILE_PATH}:{LINE_NUMBER}
// BEFORE (buggy code)
{BUGGY_CODE}
```

### Step 3: Apply Fix

```typescript
// {FILE_PATH}:{LINE_NUMBER}
// AFTER (fixed code)
{FIXED_CODE}
```

**Explanation:**
{WHY_THIS_FIX_WORKS}

### Step 4: Run Regression Test - Verify it PASSES

```bash
# Run the regression test
pnpm test {TEST_FILE_PATH}

# Expected output: PASS
```

**Expected success:**
```
PASS  {TEST_FILE_PATH}
  {BUG_ID}: {BUG_SUMMARY}
    ✓ should {EXPECTED_BEHAVIOR_DESCRIPTION}
```

### Step 5: Run All Tests - No Regressions

```bash
# Run all tests
pnpm test

# Expected: All tests pass
```

**Check for regressions:**
- [ ] No new failures
- [ ] Same pass count as before
- [ ] No skipped tests that were passing

### Step 6: Run Type Check

```bash
pnpm type-check

# Expected: No errors
```

### Step 7: Run Lint

```bash
pnpm lint

# Expected: No errors
```

### Step 8: Commit Fix

**Use smart_commit.sh (auto-commit daemon will also capture changes):**

```bash
# Option A: Use smart_commit.sh (RECOMMENDED)
./smart_commit.sh --feature "{BUG_ID}"

# Option B: Manual commit
git add {FILE_PATH}
git commit -m "fix: resolve {BUG_ID} - {BUG_SUMMARY}

Root cause: {ROOT_CAUSE_BRIEF}

Fix: {FIX_DESCRIPTION}

- Regression test now passes
- All existing tests pass
- No breaking changes

🐛 TDD GREEN phase complete"
```

### Step 9: Update state.json

```bash
# Mark card 02 as completed
jq '.cards."02".status = "completed" | .cards."02".completed_at = "'$(date -Iseconds)'" | .tdd_phase = "VERIFY" | .current_card = "03"' state.json > state.json.tmp && mv state.json.tmp state.json

cat state.json | jq '.cards."02"'
```

## Acceptance Criteria

- [ ] Auto-commit daemon is running
- [ ] Fix applied at `{FILE_PATH}:{LINE_NUMBER}`
- [ ] Regression test **PASSES** (was failing in Card 01)
- [ ] All existing tests still pass
- [ ] Type check passes
- [ ] Lint passes
- [ ] Fix is minimal (only necessary changes)
- [ ] No unrelated changes
- [ ] Changes committed (via smart_commit.sh or manual)
- [ ] state.json updated (card 02 = "completed")

## Verification

```bash
# Verify regression test passes
pnpm test {TEST_FILE_PATH}
# Expected: PASS

# Verify all tests pass
pnpm test
# Expected: All PASS

# Verify git status (changes should be committed)
git status
git log --oneline -3

# Verify only necessary files changed
git diff --name-only HEAD~1
# Expected: {FILE_PATH} only (or minimal set)

# Verify state.json updated
cat state.json | jq '.current_card'
# Expected: "03"
```

## What NOT To Do

- ❌ Don't refactor unrelated code
- ❌ Don't add features
- ❌ Don't change code style
- ❌ Don't add unnecessary comments
- ❌ Don't over-engineer

## Next Steps

After completing this card:
1. ✅ Verify all tests pass
2. ✅ Commit changes (smart_commit.sh)
3. ✅ Update state.json: set card 02 to "completed"
4. 📖 Proceed to Card 03: [03-verify-fix.md](./03-verify-fix.md)
   - **This card creates the PR (MANDATORY)**

---

**TDD Phase:** 🟢 GREEN (Make Test Pass)

**Remember:** Minimal change. If it's not needed for the fix, don't change it.

**Git Flow:** Auto-commit daemon running? ✅
