# Bug Fix Flow - System Overview

## Purpose

Bug Fix Flow is an **AI Agent Friendly system** that transforms bug reports into verified fixes with regression tests using TDD methodology.

## System Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    BUG FIX FLOW PIPELINE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐                                               │
│  │  Bug Report  │  ← User provides bug details                  │
│  └──────┬───────┘                                               │
│         │                                                       │
│         ▼                                                       │
│  ┌──────────────────┐                                           │
│  │  Reproduction    │  ← Verify bug, create ARC                 │
│  │  (ARC Protocol)  │                                           │
│  └────────┬─────────┘                                           │
│           │                                                     │
│           ▼                                                     │
│  ┌──────────────────┐                                           │
│  │  Root Cause      │  ← Layer-by-layer investigation           │
│  │  Analysis        │                                           │
│  └────────┬─────────┘                                           │
│           │                                                     │
│           ▼                                                     │
│  ┌──────────────────┐                                           │
│  │  Fix Strategy    │  ← Plan fix + regression test             │
│  │                  │                                           │
│  └────────┬─────────┘                                           │
│           │                                                     │
│           ▼                                                     │
│  ┌──────────────────┐                                           │
│  │  TDD Execution   │  ← RED → GREEN → VERIFY                   │
│  │  (3 Cards)       │                                           │
│  └────────┬─────────┘                                           │
│           │                                                     │
│           ▼                                                     │
│  ┌──────────────────┐                                           │
│  │  Pull Request    │  ← Fix ready for review                   │
│  └──────────────────┘                                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Key Principles

### 1. ARC Protocol (Automated Reproduction Case)

**Rule:** No fix without verified reproduction

- Create automated script that reproduces bug
- Verify bug is reproducible (>70% rate)
- Use as verification after fix

### 2. Root Cause Analysis

**Rule:** Diagnose before fixing

- Layer-by-layer investigation
- Evidence-based conclusions
- 90%+ confidence required

### 3. TDD for Bug Fixes

**Rule:** Test before fix

```
RED   → Write failing test (exposes bug)
GREEN → Apply minimal fix (test passes)
VERIFY → Full verification + PR
```

### 4. Minimal Change

**Rule:** Fix only what's broken

- No refactoring (unless directly related)
- No "improvements"
- No scope creep

### 5. Regression Guard

**Rule:** Every fix has a permanent test

- Regression test prevents bug from returning
- Test is part of the fix commit
- Runs in CI forever

## Output Structure

```
bug-fix-{BUG_ID}/
├── README.md                # Entry point
├── bug-report.md           # Original bug report
├── reproduction-case.md    # ARC documentation
├── root-cause-analysis.md  # Investigation findings
├── fix-strategy.md         # Fix approach
├── fix-verification.md     # Verification checklist
└── trello-cards/
    ├── KICKOFF.md          # Agent entry point
    ├── BOARD.md            # Card overview
    ├── state.json          # Progress tracking
    ├── 01-regression-test.md  # TDD RED
    ├── 02-implement-fix.md    # TDD GREEN
    └── 03-verify-fix.md       # VERIFY
```

## Card Count

Bug fixes are focused: typically 3 cards.

| Bug Type | Cards |
|----------|-------|
| Simple fix | 3 |
| Multi-file | 4-5 |
| Integration | 5-6 |
| Complex | 6-7 |

Maximum: 7 cards (if more, split bug)

## For AI Agents

Entry point: `START.md` or `trello-cards/KICKOFF.md`

Execute cards in order: 01 → 02 → 03

Update state.json after each card.

Create PR after final card.

---

**System Version:** 1.0
**Last Updated:** 2026-01-06
