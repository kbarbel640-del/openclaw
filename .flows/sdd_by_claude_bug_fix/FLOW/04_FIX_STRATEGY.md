# Phase 4: Fix Strategy

Goal: Plan the fix approach, regression tests, and verification criteria.

## The TDD Principle for Bugs

```
┌─────────────────────────────────────────────────────────┐
│  TDD FOR BUG FIXES                                      │
│                                                         │
│  1. RED:    Write a failing test that exposes the bug  │
│  2. GREEN:  Write minimal code to make test pass       │
│  3. VERIFY: Ensure no regressions introduced           │
│                                                         │
│  The failing test becomes a PERMANENT regression guard │
│  that prevents this bug from ever returning.           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Step 1: Define Fix Approach

### Option Analysis

Consider multiple fix approaches:

| Approach | Pros | Cons | Risk |
|----------|------|------|------|
| **A: Minimal patch** | Fast, low risk | May not address root cause | Low |
| **B: Proper fix** | Addresses root cause | More changes | Medium |
| **C: Refactor** | Improves overall code | Larger scope | High |

### Decision Criteria

- **Minimal change principle**: Fix only what's broken
- **No over-engineering**: Resist the urge to "improve" nearby code
- **Risk assessment**: Consider blast radius

### Recommended Approach

```markdown
## Selected Approach

**Approach:** {A/B/C}

**Justification:**
{Why this approach was chosen}

**Changes Required:**
1. File: `{file1}` - {what changes}
2. File: `{file2}` - {what changes}

**Files NOT to touch:**
- {file3} - {why not}
```

## Step 2: Plan Regression Test

The regression test MUST:

1. **Fail** before the fix (proves bug exists)
2. **Pass** after the fix (proves bug fixed)
3. **Be permanent** (prevents regression)

### Test Design Template

```typescript
describe('BUG-YYYY-MM-DD-NNN: {Bug Summary}', () => {
  it('should {expected_behavior} when {condition}', () => {
    // Arrange: Set up the exact conditions that trigger the bug
    const input = {triggering_input}

    // Act: Execute the code that was buggy
    const result = {buggy_function}(input)

    // Assert: Verify expected behavior (not the buggy behavior)
    expect(result).toBe({expected_correct_value})
    expect(result).not.toBe({buggy_value})  // Explicit: NOT the bug
  })

  // Edge cases revealed by investigation
  it('should handle {edge_case}', () => {
    // ...
  })
})
```

### Test Location

```
tests/
├── unit/
│   └── {module}/
│       └── {function}.test.ts  ← Add test here
├── integration/
│   └── {feature}.test.ts       ← Or here for integration bugs
└── regression/
    └── BUG-YYYY-MM-DD-NNN.test.ts  ← Or dedicated regression file
```

## Step 3: Identify Affected Areas

### Direct Impact

Files that will be modified:

| File | Change Type | Risk |
|------|-------------|------|
| `{file1}` | Fix logic | Low |
| `{test1}` | Add test | None |

### Indirect Impact

Files that might be affected:

| File | Dependency | Verification |
|------|------------|--------------|
| `{file2}` | Imports {file1} | Run existing tests |
| `{file3}` | Uses same function | Manual check |

## Step 4: Define Verification Criteria

### Pre-Fix State

```bash
# Document current state (all should fail/show bug)
pnpm test {test_file}  # Should FAIL (no regression test yet)
./reproduce-bug.sh     # Should show bug
```

### Post-Fix Verification

```bash
# All of these MUST pass after fix:

# 1. New regression test passes
pnpm test {new_test_file}

# 2. All existing tests still pass
pnpm test

# 3. Reproduction script no longer shows bug
./reproduce-bug.sh  # Should exit 0 (bug not reproduced)

# 4. Type checking passes
pnpm type-check

# 5. Linting passes
pnpm lint

# 6. Build succeeds
pnpm build
```

## Step 5: Plan Card Breakdown

### Standard Bug Fix Cards (3 cards)

```
Card 01: Regression Test (TDD RED)
├── Write failing test that exposes bug
├── Verify test fails
└── Document failure output

Card 02: Implement Fix (TDD GREEN)
├── Apply minimal fix
├── Verify regression test passes
└── Verify all existing tests pass

Card 03: Verify & Cleanup
├── Run full verification checklist
├── Update documentation if needed
└── Create PR
```

### Extended Cards (if needed)

```
Card 04: Additional Edge Cases
├── Add tests for related edge cases
└── Fix any discovered issues

Card 05: Integration Verification
├── Run integration tests
├── Manual verification
└── Performance check

Card 06: Documentation
├── Update README if behavior changed
├── Add inline comments if complex
└── Update changelog
```

## Step 6: Rollback Plan

If fix doesn't work or introduces new issues:

```bash
# Option 1: Git revert
git revert {fix_commit_hash}

# Option 2: Feature flag
# Add config option to disable fix
if (config.useNewBehavior) {
  // Fixed code
} else {
  // Original code
}

# Option 3: Quick patch
# Keep failing test, apply temporary workaround
```

## Output

Create `fix-strategy.md` with:
- Selected approach with justification
- Regression test plan
- Affected areas analysis
- Verification criteria
- Card breakdown
- Rollback plan

Template: `TEMPLATES/fix-strategy.template.md`

## Completion Gate

Only proceed to Phase 5 when:
- [ ] Fix approach selected and justified
- [ ] Regression test designed
- [ ] Affected areas identified
- [ ] Verification criteria defined
- [ ] Card count determined (2-7)
- [ ] Rollback plan documented

## Critical Rules

```
┌─────────────────────────────────────────────────────────┐
│  FIX STRATEGY RULES                                     │
│                                                         │
│  1. MINIMAL CHANGE - Fix only what's broken            │
│  2. TEST FIRST - Regression test before fix            │
│  3. VERIFY ALL - Run full test suite after             │
│  4. DOCUMENT - Record what was changed and why         │
│  5. ROLLBACK READY - Always have a way back            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```
