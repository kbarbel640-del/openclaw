# Fix Verification Checklist: {BUG_ID}

> Status: {PENDING | IN_PROGRESS | VERIFIED | FAILED}
> Verifier: {VERIFIER}
> Date: {DATE}

## Prerequisites

- [ ] Bug fix implemented (Card 02 completed)
- [ ] Code committed to feature branch
- [ ] Local environment matches production config
- [ ] Test data available

## Automated Verification

### 1. Regression Test

```bash
pnpm test {NEW_TEST_FILE}
```

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Test exists | Yes | {YES/NO} | {PASS/FAIL} |
| Test passes | Pass | {PASS/FAIL} | {PASS/FAIL} |
| Covers bug scenario | Yes | {YES/NO} | {PASS/FAIL} |

### 2. All Tests

```bash
pnpm test
```

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| All tests run | Yes | {YES/NO} | {PASS/FAIL} |
| Pass count | {N} | {N} | {PASS/FAIL} |
| Fail count | 0 | {N} | {PASS/FAIL} |
| Skip count | {N} | {N} | {PASS/FAIL} |

### 3. Reproduction Script

```bash
./reproduce-{BUG_ID}.sh
```

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Script runs | Yes | {YES/NO} | {PASS/FAIL} |
| Exit code | 0 (no bug) | {CODE} | {PASS/FAIL} |
| Bug pattern NOT found | Yes | {YES/NO} | {PASS/FAIL} |

### 4. Type Check

```bash
pnpm type-check
```

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| No errors | 0 errors | {N} | {PASS/FAIL} |

### 5. Lint

```bash
pnpm lint
```

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| No errors | 0 errors | {N} | {PASS/FAIL} |
| No warnings | 0 warnings | {N} | {PASS/WARN} |

### 6. Build

```bash
pnpm build
```

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Build succeeds | Yes | {YES/NO} | {PASS/FAIL} |
| No warnings | Minimal | {N} | {PASS/WARN} |

## Manual Verification

### Original Bug Scenario

**Steps:**
1. [ ] {Original step 1}
2. [ ] {Original step 2}
3. [ ] {Original step 3}
4. [ ] Verify: Bug no longer occurs

**Expected Result:** {Expected correct behavior}

**Actual Result:** {Observed behavior}

**Status:** {PASS / FAIL}

### Related Scenarios

#### Scenario 1: {Description}

1. [ ] {Step 1}
2. [ ] {Step 2}
3. [ ] Verify: {Expected}

**Status:** {PASS / FAIL}

#### Scenario 2: {Description}

1. [ ] {Step 1}
2. [ ] {Step 2}
3. [ ] Verify: {Expected}

**Status:** {PASS / FAIL}

## Regression Check

### Affected Features

| Feature | Test Method | Status |
|---------|-------------|--------|
| {Feature 1} | Automated test | {PASS/FAIL} |
| {Feature 2} | Manual check | {PASS/FAIL} |
| {Feature 3} | Integration test | {PASS/FAIL} |

### Performance Check

| Metric | Before Fix | After Fix | Acceptable |
|--------|------------|-----------|------------|
| Response time | {N}ms | {N}ms | {YES/NO} |
| Memory usage | {N}MB | {N}MB | {YES/NO} |
| CPU usage | {N}% | {N}% | {YES/NO} |

## Code Review Checklist

- [ ] Fix is minimal (only changes what's necessary)
- [ ] No unrelated changes included
- [ ] Code follows project conventions
- [ ] Comments added where logic is non-obvious
- [ ] No new warnings introduced
- [ ] No security issues introduced

## Documentation Check

- [ ] README updated (if behavior changed)
- [ ] Changelog entry added
- [ ] API docs updated (if applicable)
- [ ] Comments explain the fix

## Final Summary

### Verification Results

| Category | Status |
|----------|--------|
| Automated Tests | {PASS/FAIL} |
| Manual Verification | {PASS/FAIL} |
| Regression Check | {PASS/FAIL} |
| Code Review | {PASS/FAIL} |
| Documentation | {PASS/FAIL} |

### Overall Status

**{VERIFIED | FAILED}**

### If FAILED

**Reason:** {failure_reason}

**Action Required:** {what_needs_to_be_fixed}

### If VERIFIED

**Ready for:** {PR Creation / Merge / Deploy}

**Notes:** {any_observations}

---

**Verification Completed:** {DATE}
**Verified by:** {VERIFIER}
**Approved for PR:** {YES/NO}
