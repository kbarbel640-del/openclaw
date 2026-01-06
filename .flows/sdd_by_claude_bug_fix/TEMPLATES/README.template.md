# Bug Fix: {BUG_ID}

> Status: {STATUS}
> Severity: {SEVERITY}
> Cards: {CARD_COUNT}
> Story Points: {TOTAL_SP}

## Summary

**Bug:** {SUMMARY}

**Root Cause:** {ROOT_CAUSE_SUMMARY}

**Fix:** {FIX_SUMMARY}

## Quick Start

```bash
# Navigate to Trello cards
cd trello-cards

# Read entry point
cat KICKOFF.md

# Execute cards in order
# 01 → 02 → 03 (→ additional if present)
```

## Pipeline

```
┌─────────────────────────────────────────────────────────┐
│                  BUG FIX PIPELINE                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐            │
│  │    01    │ → │    02    │ → │    03    │            │
│  │  {SP1}   │   │  {SP2}   │   │  {SP3}   │            │
│  └──────────┘   └──────────┘   └──────────┘            │
│  Regression     Implement      Verify                   │
│  Test (RED)     Fix (GREEN)    & PR                     │
│                                                         │
│  Total: {TOTAL_SP} Story Points                         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Documents

| Document | Purpose |
|----------|---------|
| [bug-report.md](./bug-report.md) | Original bug report |
| [reproduction-case.md](./reproduction-case.md) | ARC documentation |
| [root-cause-analysis.md](./root-cause-analysis.md) | Investigation findings |
| [fix-strategy.md](./fix-strategy.md) | Fix approach |
| [fix-verification.md](./fix-verification.md) | Verification checklist |

## Trello Cards

| Card | Title | SP | Status |
|------|-------|---:|--------|
| [01](./trello-cards/01-regression-test.md) | Regression Test (TDD RED) | {SP1} | {STATUS} |
| [02](./trello-cards/02-implement-fix.md) | Implement Fix (TDD GREEN) | {SP2} | {STATUS} |
| [03](./trello-cards/03-verify-fix.md) | Verify & PR | {SP3} | {STATUS} |

## Key Information

### Affected Files

| File | Change |
|------|--------|
| `{FILE_1}` | {change_description} |
| `{FILE_2}` | {change_description} |

### Root Cause Location

- **File:** `{FILE_PATH}`
- **Line:** {LINE_NUMBER}
- **Function:** `{FUNCTION_NAME}`

### Regression Test

- **File:** `{TEST_FILE_PATH}`
- **Test Name:** `{TEST_NAME}`

## Verification

### Automated

```bash
pnpm test {TEST_FILE}     # Regression test
pnpm test                  # All tests
pnpm type-check           # Type checking
pnpm lint                 # Linting
pnpm build                # Build
```

### Manual

1. {Manual verification step 1}
2. {Manual verification step 2}
3. {Manual verification step 3}

## For AI Agents

**Entry Point:** `trello-cards/KICKOFF.md`

```
1. Read KICKOFF.md
2. Execute cards 01 → 02 → 03
3. Update state.json after each card
4. Create PR after Card 03
```

## Generated

- **Date:** {DATE}
- **Generator:** SDD Bug Fix Flow
- **Version:** 1.0

---

**Status:** {READY_FOR_IMPLEMENTATION | IN_PROGRESS | COMPLETE}
