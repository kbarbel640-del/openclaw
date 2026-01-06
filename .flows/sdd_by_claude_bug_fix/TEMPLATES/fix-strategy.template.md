# Fix Strategy: {BUG_ID}

> Status: {PLANNED | APPROVED | IN_PROGRESS}
> Approach: {MINIMAL_PATCH | PROPER_FIX | REFACTOR}
> Cards: {CARD_COUNT}

## Selected Approach

### Option Analysis

| Approach | Description | Pros | Cons | Risk |
|----------|-------------|------|------|------|
| A: Minimal Patch | {description} | Fast, low risk | May not be complete | Low |
| B: Proper Fix | {description} | Addresses root cause | More changes | Medium |
| C: Refactor | {description} | Improves codebase | Large scope | High |

### Decision

**Selected:** {A | B | C} - {APPROACH_NAME}

**Justification:**
{Why this approach was chosen}

## Changes Required

### Files to Modify

| File | Change Type | Description |
|------|-------------|-------------|
| `{FILE_1}` | Fix | {what changes} |
| `{FILE_2}` | Test | {add regression test} |
| `{FILE_3}` | Update | {related changes} |

### Files NOT to Touch

| File | Reason |
|------|--------|
| `{FILE_A}` | Not related |
| `{FILE_B}` | Separate concern |

## Regression Test Plan

### Test Design

```typescript
// {TEST_FILE_PATH}

describe('{BUG_ID}: {Bug Summary}', () => {

  // Main regression test
  it('should {expected_behavior} when {condition}', () => {
    // Arrange
    const input = {triggering_input}

    // Act
    const result = {function_under_test}(input)

    // Assert
    expect(result).toBe({correct_value})
    expect(result).not.toBe({buggy_value})
  })

  // Edge case from investigation
  it('should handle {edge_case}', () => {
    const result = {function_under_test}({edge_input})
    expect(result).toBe({expected})
  })

})
```

### Test Location

**File:** `{TEST_FILE_PATH}`
**Type:** {UNIT | INTEGRATION | E2E}

### TDD Verification

| Step | Expected | Command |
|------|----------|---------|
| 1. Before fix | Test FAILS | `pnpm test {test}` |
| 2. After fix | Test PASSES | `pnpm test {test}` |

## Affected Areas

### Direct Impact

| Component | Impact | Verification |
|-----------|--------|--------------|
| `{component_1}` | Modified | New test |
| `{component_2}` | Uses modified code | Existing tests |

### Indirect Impact

| Component | Relationship | Risk | Mitigation |
|-----------|--------------|------|------------|
| `{component_3}` | Imports modified | Low | Run tests |
| `{component_4}` | Shares data | Medium | Manual check |

## Verification Criteria

### Pre-Fix Verification

```bash
# All should FAIL or show bug
pnpm test {new_test}      # Expected: FAIL (test doesn't exist yet)
./reproduce-bug.sh         # Expected: Bug reproduced (exit 1)
```

### Post-Fix Verification

```bash
# ALL must pass after fix

# 1. New regression test
pnpm test {new_test}
# Expected: PASS

# 2. All existing tests
pnpm test
# Expected: All PASS, no regressions

# 3. Reproduction script
./reproduce-bug.sh
# Expected: Bug NOT reproduced (exit 0)

# 4. Type checking
pnpm type-check
# Expected: No errors

# 5. Linting
pnpm lint
# Expected: No errors

# 6. Build
pnpm build
# Expected: Success
```

### Manual Verification

- [ ] {Manual check 1}
- [ ] {Manual check 2}
- [ ] {Manual check 3}

## Card Breakdown

### Card 01: Regression Test (TDD RED)
- **SP:** 2
- **Goal:** Write failing test that exposes bug
- **Deliverable:** Test file with failing test
- **Verification:** Test fails with expected error

### Card 02: Implement Fix (TDD GREEN)
- **SP:** 2
- **Goal:** Apply minimal fix to pass test
- **Deliverable:** Code change + passing test
- **Verification:** All tests pass

### Card 03: Verify & Complete
- **SP:** 2
- **Goal:** Full verification and PR creation
- **Deliverable:** PR ready for review
- **Verification:** All criteria met

{Additional cards if needed:}

### Card 04: {TITLE} (if needed)
- **SP:** {SP}
- **Goal:** {goal}
- **Deliverable:** {deliverable}
- **Verification:** {verification}

## Rollback Plan

### If Fix Fails

**Option 1: Git Revert**
```bash
git revert {commit_hash}
```

**Option 2: Feature Flag**
```typescript
if (config.useFixedBehavior) {
  // Fixed code path
} else {
  // Original code path
}
```

**Option 3: Quick Workaround**
```
{Description of temporary workaround}
```

### Rollback Criteria

Rollback if:
- [ ] New test passes but others fail
- [ ] Performance degrades >10%
- [ ] Unexpected side effects observed
- [ ] Production issues reported

## Timeline Estimate

| Card | Description | SP |
|------|-------------|----:|
| 01 | Regression Test | 2 |
| 02 | Implement Fix | 2 |
| 03 | Verify & Complete | 2 |
| **Total** | | **{TOTAL_SP}** |

## Approval

- [ ] Approach approved by: {APPROVER}
- [ ] Test plan reviewed by: {REVIEWER}
- [ ] Ready to generate cards

---

**Strategy Created:** {DATE}
**Last Updated:** {DATE}
