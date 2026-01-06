# Phase 5: Output Generation

Goal: Generate complete bug fix package with executable Trello cards.

## Output Location

Default: `docs/sdd/bug-fix-{bug-id}/` in the project root.

Example: `docs/sdd/bug-fix-BUG-2026-01-06-001/`

## Required Files (Top Level)

- `README.md` (entry point)
- `bug-report.md`
- `reproduction-case.md`
- `root-cause-analysis.md`
- `fix-strategy.md`
- `fix-verification.md`
- `trello-cards/` (folder)

## trello-cards/ Required Files

- `KICKOFF.md` - Entry point for implementation agent
- `BOARD.md` - Card index and pipeline visualization
- `AGENT_PROTOCOL.md` - State update patterns
- `state.json` - Machine-readable progress
- `progress.md` - Visual progress tracking
- `01-regression-test.md` - TDD RED
- `02-implement-fix.md` - TDD GREEN
- `03-verify-fix.md` - Verification
- `[04-07]-*.md` - Additional cards if needed

## Card Structure for Bug Fixes

### Standard 3-Card Fix

```
┌─────────────────────────────────────────────────────────┐
│                   BUG FIX PIPELINE                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────┐   ┌─────────┐   ┌─────────┐               │
│  │   01    │ → │   02    │ → │   03    │               │
│  │  2 SP   │   │  2 SP   │   │  2 SP   │               │
│  └─────────┘   └─────────┘   └─────────┘               │
│  Regression    Implement     Verify                     │
│  Test (RED)    Fix (GREEN)   & PR                       │
│                                                         │
│  Total: 6 Story Points                                  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Extended Pipeline (if needed)

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐      │
│  │ 01  │→│ 02  │→│ 03  │→│ 04  │→│ 05  │→│ 06  │      │
│  │ 2SP │ │ 2SP │ │ 2SP │ │ 2SP │ │ 2SP │ │ 2SP │      │
│  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘      │
│  Test    Fix     Edges   Integ   Docs    Verify        │
│                                                         │
│  Total: 12 Story Points (Complex Bug)                   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Templates to Use

| Output File | Template Location |
|-------------|-------------------|
| `README.md` | `TEMPLATES/README.template.md` |
| `bug-report.md` | `TEMPLATES/bug-report.template.md` |
| `reproduction-case.md` | `TEMPLATES/reproduction-case.template.md` |
| `root-cause-analysis.md` | `TEMPLATES/root-cause-analysis.template.md` |
| `fix-strategy.md` | `TEMPLATES/fix-strategy.template.md` |
| `fix-verification.md` | `TEMPLATES/fix-verification.template.md` |
| `trello-cards/KICKOFF.md` | `TRELLO_TEMPLATES/KICKOFF.template.md` |
| `trello-cards/BOARD.md` | `TRELLO_TEMPLATES/BOARD.template.md` |
| `trello-cards/01-*.md` | `TRELLO_TEMPLATES/card-01-regression-test.template.md` |
| `trello-cards/02-*.md` | `TRELLO_TEMPLATES/card-02-implement-fix.template.md` |
| `trello-cards/03-*.md` | `TRELLO_TEMPLATES/card-03-verify-fix.template.md` |

## Placeholder Replacement

Replace all placeholders in templates:

| Placeholder | Source |
|-------------|--------|
| `{BUG_ID}` | Bug report (Phase 1) |
| `{SUMMARY}` | Bug report |
| `{SEVERITY}` | Bug report |
| `{ROOT_CAUSE}` | Root cause analysis (Phase 3) |
| `{FILE_PATH}` | Root cause analysis |
| `{LINE_NUMBER}` | Root cause analysis |
| `{FIX_APPROACH}` | Fix strategy (Phase 4) |
| `{CARD_COUNT}` | Fix strategy |
| `{DATE}` | Current date |

## Final README Status

The generated README.md must show:

```markdown
# Bug Fix: {BUG_ID}

> Status: ✅ FIX READY FOR IMPLEMENTATION
> Severity: {SEVERITY}
> Cards: {CARD_COUNT}
> Estimated: {TOTAL_SP} Story Points

## Quick Start

```bash
cd trello-cards
cat KICKOFF.md
# Execute cards 01 → 02 → 03
```
```

## Generation Commands

```bash
# Generate bug fix package
./generate-bug-fix.sh --bug-report bug-report.md

# With validation
./generate-bug-fix.sh --bug-report bug-report.md --validate

# Custom output
./generate-bug-fix.sh --bug-report bug-report.md --output ./custom-path/
```

## Validation Checklist

Before marking as complete:

- [ ] All template placeholders replaced
- [ ] All mandatory files present
- [ ] Cards numbered sequentially (01, 02, 03, ...)
- [ ] Each card has 1-4 Story Points
- [ ] Regression test card is Card 01
- [ ] Fix implementation card is Card 02
- [ ] Verification card is last card
- [ ] state.json initialized correctly
- [ ] README shows FIX READY status

## Completion Rule

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  DO NOT FINALIZE until:                                 │
│                                                         │
│  ✓ All phases completed (1-5)                           │
│  ✓ Root cause identified with evidence                  │
│  ✓ Reproduction case verified                           │
│  ✓ All templates properly filled                        │
│  ✓ No placeholders remaining                            │
│  ✓ Validation passes                                    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Success Criteria

Bug fix package is **COMPLETE** when:

1. All 5 documentation files present
2. All Trello cards generated
3. Card 01 contains regression test
4. Card 02 contains fix implementation
5. Card 03 contains verification
6. README shows FIX READY status
7. AI agent can execute cards without asking questions
