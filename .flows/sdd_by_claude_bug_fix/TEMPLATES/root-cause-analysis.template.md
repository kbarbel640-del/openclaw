# Root Cause Analysis: {BUG_ID}

> RCA Status: {IDENTIFIED | IN_PROGRESS | BLOCKED}
> Confidence: {PERCENT}%
> Analyst: {ANALYST}

## Executive Summary

**Root Cause:** {One sentence summary of root cause}

**Location:** `{FILE_PATH}:{LINE_NUMBER}` in function `{FUNCTION_NAME}`

**Fix Complexity:** {LOW | MEDIUM | HIGH}

## Investigation Timeline

| Time | Action | Finding |
|------|--------|---------|
| {T1} | Initial analysis | {finding} |
| {T2} | Log review | {finding} |
| {T3} | Code inspection | {finding} |
| {T4} | Root cause identified | {finding} |

## Layer-by-Layer Analysis

### Layer 1: Entry Point (API/UI)

**Status:** {OK | SUSPECT | ROOT_CAUSE}

**Investigation:**
```bash
# Commands used
{investigation_commands}
```

**Findings:**
- {finding_1}
- {finding_2}

**Evidence:**
```
{logs, output, or code snippets}
```

**Conclusion:** {Ruled out / Confirmed / Needs more investigation}

---

### Layer 2: Service/Business Logic

**Status:** {OK | SUSPECT | ROOT_CAUSE}

**Investigation:**
```bash
# Commands used
{investigation_commands}
```

**Findings:**
- {finding_1}
- {finding_2}

**Evidence:**
```
{logs, output, or code snippets}
```

**Conclusion:** {Ruled out / Confirmed / Needs more investigation}

---

### Layer 3: Data/Infrastructure

**Status:** {OK | SUSPECT | ROOT_CAUSE}

**Investigation:**
```bash
# Commands used
{investigation_commands}
```

**Findings:**
- {finding_1}
- {finding_2}

**Evidence:**
```
{logs, output, or code snippets}
```

**Conclusion:** {Ruled out / Confirmed / Needs more investigation}

---

## Root Cause

### Summary

{Detailed explanation of why the bug occurs}

### Location

| Property | Value |
|----------|-------|
| File | `{FILE_PATH}` |
| Line | {LINE_NUMBER} |
| Function | `{FUNCTION_NAME}` |
| Module | `{MODULE_NAME}` |

### Buggy Code

```typescript
// {FILE_PATH}:{LINE_NUMBER}
// BEFORE (buggy)
{buggy_code}
```

### Technical Explanation

{Detailed technical explanation of the bug mechanism}

### Why It Wasn't Caught

- {reason_1} (e.g., "No test for null input case")
- {reason_2} (e.g., "Edge case not considered")

## Code Smell Analysis

### Identified Smells

| Smell | Location | Severity |
|-------|----------|----------|
| {SMELL_TYPE} | {location} | {HIGH/MEDIUM/LOW} |

### Refactoring Opportunity

**Recommended:** {YES | NO | FUTURE}

If YES:
- **Refactoring Type:** {Extract Method / Add Null Check / etc.}
- **Benefits:** {benefits}
- **Scope:** {In this fix / Separate task}

## Related Test Coverage

### Existing Tests

| Test File | Covers Bug Area | Current Status |
|-----------|-----------------|----------------|
| `{test_file_1}` | {YES/PARTIAL/NO} | {PASS/FAIL} |
| `{test_file_2}` | {YES/PARTIAL/NO} | {PASS/FAIL} |

### Coverage Gap

**Missing Test:** {Description of what test was missing}

## Confidence Assessment

### Evidence Strength

| Evidence Type | Present | Weight |
|---------------|---------|--------|
| Stack trace matches code | {YES/NO} | 25% |
| Can reproduce with fix | {YES/NO} | 25% |
| Code logic confirms theory | {YES/NO} | 25% |
| All symptoms explained | {YES/NO} | 25% |

### Calculation

| Factor | Weight | Score | Weighted |
|--------|--------|-------|----------|
| Stack trace | 25% | {0-100} | {result} |
| Reproducibility | 25% | {0-100} | {result} |
| Code analysis | 25% | {0-100} | {result} |
| Symptom coverage | 25% | {0-100} | {result} |
| **Total** | 100% | | **{TOTAL}%** |

### Confidence Level

- [ ] ≥90%: Proceed to fix
- [ ] 80-89%: Gather more evidence
- [ ] 70-79%: Review with team
- [ ] <70%: Need deeper investigation

**Current Confidence:** {PERCENT}%

## Recommendations

### Immediate Fix

{What code change is needed}

### Preventive Measures

1. {Add test for this case}
2. {Consider defensive coding}
3. {Documentation update}

### Future Improvements

1. {Long-term improvement 1}
2. {Long-term improvement 2}

---

**RCA Completed:** {DATE}
**Reviewed by:** {REVIEWER}
**Approved for Fix:** {YES/NO}
