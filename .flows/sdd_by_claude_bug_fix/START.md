# SDD Bug Fix Flow - AI Agent Entry Point

> Read this file and execute the phases below to fix bugs systematically.

## Core Principle

```
┌─────────────────────────────────────────────────────────┐
│  NO FIX WITHOUT PROOF. EVIDENCE IS EVERYTHING.          │
│                                                         │
│  • Cannot fix what you cannot reproduce                 │
│  • Cannot verify without a failing test                 │
│  • Root cause or no fix                                 │
│  • Minimal change = minimal risk                        │
└─────────────────────────────────────────────────────────┘
```

## Mission

Transform bug reports into verified fixes with regression tests and executable Trello cards.

## Execution Protocol

```
PHASE 1 → PHASE 2 → PHASE 3 → PHASE 4 → PHASE 5
   │         │         │         │         │
BUG_REPORT REPRODUCE ROOT_CAUSE FIX_PLAN  OUTPUT
```

### Phase 1: Bug Report
**Read:** `FLOW/01_BUG_REPORT.md`

1. Get bug report from user
2. Validate all mandatory fields present
3. Document in `bug-report.md`

**Mandatory Fields:**
- Summary (one line)
- Expected vs Actual behavior
- Reproduction steps (numbered)
- Error output (exact)
- Severity (P0-P3)

### Phase 2: Reproduction
**Read:** `FLOW/02_REPRODUCE.md`

1. Follow reproduction steps exactly
2. Verify bug occurs
3. Create automated reproduction script (ARC)
4. Document reproduction rate

**DO NOT PROCEED without verified reproduction!**

### Phase 3: Root Cause Analysis
**Read:** `FLOW/03_ROOT_CAUSE.md`

1. Apply layer-by-layer investigation
2. Analyze logs and stack traces
3. Identify exact location (file:line)
4. Achieve ≥90% confidence

**DO NOT PROCEED without identified root cause!**

### Phase 4: Fix Strategy
**Read:** `FLOW/04_FIX_STRATEGY.md`

1. Define fix approach
2. Plan regression test (TDD RED)
3. Identify affected areas
4. Define verification criteria

### Phase 5: Output
**Read:** `FLOW/05_OUTPUT.md`

Generate bug fix package in `docs/sdd/`:
```
docs/sdd/<bug-id>/
├── KICKOFF.md                    # ⭐ ENTRY POINT - Agent starts here
├── README.md
├── bug-report.md
├── reproduction-case.md
├── root-cause-analysis.md
├── fix-strategy.md
└── trello-cards/
    ├── KICKOFF.md                # Copy of root KICKOFF.md
    ├── BOARD.md
    ├── state.json
    ├── smart_commit.sh           # Git flow tool
    ├── auto-commit-daemon.sh     # Git flow tool
    ├── AGENT_PROTOCOL.md         # State update patterns
    ├── 01-regression-test.md     # TDD RED
    ├── 02-implement-fix.md       # TDD GREEN
    └── 03-verify-fix.md          # Verification + PR
```

**KICKOFF.md Requirements:**
- ⭐ Must be in ROOT of SDD package (entry point for agent)
- Must contain: Bug summary, Git Flow Enforcement, TDD Protocol, Getting Started
- Must link to: `trello-cards/BOARD.md`, `trello-cards/state.json`, first card

## Card Count (Agent Decides)

Bug fixes are focused. Calculate based on:

| Factor | Cards |
|--------|-------|
| Simple one-file fix | 2-3 |
| Multi-file fix | 3-5 |
| Integration involved | 4-6 |
| Data migration needed | 5-7 |

**Maximum: 7 cards. If >7, split into multiple bugs.**

## TDD Cycle (Mandatory)

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  CARD 01: RED    - Write failing test (exposes bug)    │
│            ↓                                            │
│  CARD 02: GREEN  - Implement minimal fix               │
│            ↓                                            │
│  CARD 03: VERIFY - Full verification + cleanup         │
│                                                         │
│  The failing test becomes permanent regression guard!  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Templates

| Type | Location |
|------|----------|
| Bug fix docs | `TEMPLATES/*.template.md` |
| Trello cards | `TRELLO_TEMPLATES/*.template.md` |

## Rules

1. **ARC mandatory** - No fix without reproduction
2. **Root cause required** - No blind fixes
3. **Test BEFORE fix** - TDD RED first
4. **Minimal change** - Fix only what's broken
5. **Max 7 cards** - Bug fixes are focused
6. **Evidence based** - All conclusions need proof

## Start Now

1. Ask user for bug report
2. Read `FLOW/01_BUG_REPORT.md`
3. Execute phases in order
4. Generate fix package
