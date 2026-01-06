# Card 01: {BUG_ID} - Regression Test (TDD RED)

| Field | Value |
|-------|-------|
| **ID** | {BUG_ID}-01 |
| **Story Points** | 2 |
| **Type** | 🔴 TDD RED |
| **Depends On** | - |

## Objective

Write a **failing test** that exposes the bug. This test MUST:
1. FAIL before the fix is applied
2. PASS after the fix is applied
3. Become a permanent regression guard

## Context

Read before starting:
- [../bug-report.md](../bug-report.md) - Bug details
- [../reproduction-case.md](../reproduction-case.md) - Reproduction steps
- [../root-cause-analysis.md](../root-cause-analysis.md) - Root cause

## Bug Summary

- **Expected:** {EXPECTED_BEHAVIOR}
- **Actual:** {ACTUAL_BEHAVIOR}
- **Location:** `{FILE_PATH}:{LINE_NUMBER}`

## ⚡ Pre-Card Checklist

```bash
# 1. Verify auto-commit daemon is running
ps aux | grep auto-commit-daemon

# 2. If not running, start it NOW
nohup ./auto-commit-daemon.sh --feature "{BUG_ID}" &

# 3. Check current state
cat state.json
```

## Instructions

### Step 1: Create Test File

```bash
# Navigate to test directory
cd {TEST_DIRECTORY}

# Create or edit test file
{EDITOR} {TEST_FILE_PATH}
```

### Step 2: Write Failing Test

```typescript
// {TEST_FILE_PATH}

import { describe, it, expect } from 'vitest'
import { {FUNCTION_NAME} } from '{IMPORT_PATH}'

describe('{BUG_ID}: {BUG_SUMMARY}', () => {

  /**
   * Regression test for {BUG_ID}
   *
   * This test exposes the bug where:
   * {BUG_DESCRIPTION}
   *
   * Root cause: {ROOT_CAUSE_BRIEF}
   */
  it('should {EXPECTED_BEHAVIOR_DESCRIPTION}', () => {
    // Arrange: Set up conditions that trigger the bug
    {ARRANGE_CODE}

    // Act: Execute the buggy code path
    {ACT_CODE}

    // Assert: Verify correct behavior (NOT the buggy behavior)
    expect(result).toBe({EXPECTED_VALUE})

    // Explicit: This should NOT happen (the bug)
    expect(result).not.toBe({BUGGY_VALUE})
  })

  // Optional: Edge cases discovered during investigation
  it('should handle {EDGE_CASE}', () => {
    {EDGE_CASE_TEST}
  })

})
```

### Step 3: Run Test - Verify it FAILS

```bash
# Run the new test
pnpm test {TEST_FILE_PATH}

# Expected output: FAIL
# The test should fail because the bug exists
```

**Expected failure message:**
```
FAIL  {TEST_FILE_PATH}
  {BUG_ID}: {BUG_SUMMARY}
    ✕ should {EXPECTED_BEHAVIOR_DESCRIPTION}

    AssertionError: expected {BUGGY_VALUE} to be {EXPECTED_VALUE}
```

### Step 4: Document Failure

```bash
# Save failure output
pnpm test {TEST_FILE_PATH} 2>&1 | tee test-failure-{BUG_ID}.log
```

### Step 5: Commit Test

**Use smart_commit.sh (auto-commit daemon will also capture changes):**

```bash
# Option A: Use smart_commit.sh (RECOMMENDED)
./smart_commit.sh --feature "{BUG_ID}"

# Option B: Manual commit
git add {TEST_FILE_PATH}
git commit -m "test: add failing regression test for {BUG_ID}

- Test exposes bug: {BUG_SUMMARY}
- Location: {FILE_PATH}:{LINE_NUMBER}
- This test will pass after fix is applied

🐛 TDD RED phase complete"
```

### Step 6: Update state.json

```bash
# Mark card 01 as completed
jq '.cards."01".status = "completed" | .cards."01".completed_at = "'$(date -Iseconds)'" | .tdd_phase = "GREEN" | .current_card = "02"' state.json > state.json.tmp && mv state.json.tmp state.json

cat state.json | jq '.cards."01"'
```

## Acceptance Criteria

- [ ] Auto-commit daemon is running (check with `ps aux | grep auto-commit`)
- [ ] Test file created at `{TEST_FILE_PATH}`
- [ ] Test describes the bug scenario accurately
- [ ] Test **FAILS** before fix (proves bug exists)
- [ ] Failure message is descriptive
- [ ] Changes committed (via smart_commit.sh or manual)
- [ ] state.json updated (card 01 = "completed")
- [ ] No changes to production code (test only)

## Verification

```bash
# Verify test fails
pnpm test {TEST_FILE_PATH}
# Expected: FAIL

# Verify git status (changes should be committed)
git status
git log --oneline -3

# Verify state.json updated
cat state.json | jq '.current_card'
# Expected: "02"
```

## Next Steps

After completing this card:
1. ✅ Verify test fails with expected error
2. ✅ Commit changes (smart_commit.sh)
3. ✅ Update state.json: set card 01 to "completed"
4. 📖 Proceed to Card 02: [02-implement-fix.md](./02-implement-fix.md)

---

**TDD Phase:** 🔴 RED (Failing Test)

**Remember:** The test MUST fail. If it passes, the bug is not being tested correctly.

**Git Flow:** Auto-commit daemon running? ✅
