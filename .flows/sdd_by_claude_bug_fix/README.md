# SDD Bug Fix Flow

> Transform bug reports into verified fixes with regression tests and executable Trello cards.

## Quick Start

```bash
# Generate Bug Fix SDD from bug report
./generate-bug-fix.sh --bug-report <file.md>

# Preview without creating files
./generate-bug-fix.sh --bug-report <file.md> --dry-run

# With validation
./generate-bug-fix.sh --bug-report <file.md> --validate
```

## Flow Overview

```
BUG_REPORT → REPRODUCE → ROOT_CAUSE → FIX_STRATEGY → OUTPUT
     │           │            │             │            │
     v           v            v             v            v
  bug info    ARC case    diagnosis     fix plan    fix cards
                                                    + tests
```

## Phases

| Phase | Description | Details |
|-------|-------------|---------|
| 1 | Bug Report | Collect structured bug information |
| 2 | Reproduce | Create Automated Reproduction Case (ARC) |
| 3 | Root Cause | Investigate and diagnose |
| 4 | Fix Strategy | Plan fix + regression tests |
| 5 | Output | Generate fix cards (TDD: RED→GREEN) |

See `FLOW/` for detailed phase documentation.

## Key Principles

```
┌─────────────────────────────────────────────────────────┐
│  BUG FIX FLOW PRINCIPLES                                │
│                                                         │
│  1. ARC FIRST      - No fix without reproduction        │
│  2. ROOT CAUSE     - Diagnose before fixing             │
│  3. TEST BEFORE    - Write failing test FIRST (TDD RED) │
│  4. MINIMAL FIX    - Change only what's broken          │
│  5. REGRESSION     - Every fix needs a guard test       │
└─────────────────────────────────────────────────────────┘
```

## Structure

```
sdd_by_claude_bug_fix/
├── README.md              # This file
├── START.md               # Entry point for AI agents
├── FLOW/                  # Phase documentation
│   ├── 01_BUG_REPORT.md
│   ├── 02_REPRODUCE.md
│   ├── 03_ROOT_CAUSE.md
│   ├── 04_FIX_STRATEGY.md
│   └── 05_OUTPUT.md
├── TEMPLATES/             # Bug fix document templates
├── TRELLO_TEMPLATES/      # Card templates
├── SYSTEM/                # System documentation
├── prompts/               # Investigation prompts
├── examples/              # Sample bug fixes
└── scripts (*.sh)         # Automation
```

## Output

Generated Bug Fix package:

```
<bug-id>-fix/
├── README.md              # Entry point
├── bug-report.md          # Structured bug report
├── reproduction-case.md   # ARC documentation
├── root-cause-analysis.md # Investigation findings
├── fix-strategy.md        # Fix plan
├── fix-verification.md    # Test checklist
└── trello-cards/
    ├── KICKOFF.md         # Agent entry point
    ├── BOARD.md           # Card index
    ├── state.json         # Progress tracking
    ├── 01-regression-test.md  # TDD RED
    ├── 02-implement-fix.md    # TDD GREEN
    └── 03-verify-fix.md       # Verification
```

## Card Count

**Bug fixes are focused.** Typical: 2-7 cards.

| Bug Type | Cards | Pattern |
|----------|-------|---------|
| Simple logic error | 2-3 | Test → Fix → Verify |
| Missing edge case | 3-4 | Test → Fix → Edges → Verify |
| Integration bug | 4-5 | Isolate → Test → Fix → Verify |
| Race condition | 4-6 | Reproduce → Fix → Stress test |

See `CARD_COUNT_GUIDELINES.md` for details.

## Scripts

| Script | Purpose |
|--------|---------|
| `generate-bug-fix.sh` | Main bug fix generator |
| `validate-bug-report.sh` | Bug report validation |
| `validate-bug-fix-sdd.sh` | Quality validation |

## For AI Agents

**Entry point:** `START.md`

```
Read START.md and follow the execution protocol.
```

Or execute generated fix:
```
Read <bug-id>-fix/trello-cards/KICKOFF.md
```
