#!/usr/bin/env bash
# Tax Research Runner
# Invokes Claude Code to execute one research cycle
# Usage: ./run-research.sh [run|status|summary]

set -euo pipefail

# Force PST/PDT timestamps regardless of caller environment.
export TZ="America/Los_Angeles"

TAXES_DIR="$HOME/Shared/notes/personal/taxes"
LOG_DIR="$TAXES_DIR/logs"
TRACKER="$TAXES_DIR/Tax Savings Tracker.md"
RUNS_LOG="$LOG_DIR/runs.md"
LOCK_FILE="/tmp/tax-research.lock"

mkdir -p "$LOG_DIR"

TIMESTAMP=$(date +%Y-%m-%d_%H%M)
LOG_FILE="$LOG_DIR/research-$TIMESTAMP.log"

MODE="${1:-run}"

case "$MODE" in
  status)
    echo "=== Tax Research Status ==="
    echo ""
    echo "Current Savings (Potential | Verified):"
    grep -A1 "TOTAL" "$TRACKER" 2>/dev/null | tail -1 || echo "No total found"
    echo ""
    echo "Recent Runs:"
    tail -30 "$RUNS_LOG" 2>/dev/null || echo "No runs yet"
    exit 0
    ;;

  summary)
    echo "=== Daily Summary ==="
    TOTAL=$(grep -A1 "TOTAL" "$TRACKER" 2>/dev/null | tail -1 | awk -F'|' '{print $4}' | tr -d ' ')
    TOTAL="${TOTAL:-Unknown}"
    LAST_RUN=$(ls -t "$LOG_DIR"/research-*.log 2>/dev/null | head -1)

    if [ -n "$LAST_RUN" ]; then
      LAST_TIME=$(basename "$LAST_RUN" .log | sed 's/research-//')
    else
      LAST_TIME="never"
    fi

    cat <<EOF
Tax Research Daily Summary

Current Verified Savings: $TOTAL
Last Run: $LAST_TIME

Recent Activity:
$(tail -20 "$RUNS_LOG" 2>/dev/null || echo "No activity")
EOF
    exit 0
    ;;

  run)
    echo "Starting tax research cycle at $(date)" | tee "$LOG_FILE"
    ;;

  *)
    echo "Usage: $0 [run|status|summary]"
    exit 1
    ;;
esac

# Prevent concurrent execution
exec 200>"$LOCK_FILE"
if ! flock -n 200; then
    echo "Another tax research instance is running, exiting" | tee -a "$LOG_FILE"
    exit 0
fi

# Prefer Claude CLI if it works, otherwise fall back to Codex CLI.
RUNNER=""
if command -v claude >/dev/null 2>&1 && timeout 15 claude -p "ping" --output-format json >/dev/null 2>&1; then
  RUNNER="claude"
elif command -v codex >/dev/null 2>&1; then
  RUNNER="codex"
else
  echo "ERROR: Neither claude nor codex is available; aborting run" | tee -a "$LOG_FILE"
  exit 1
fi

# Initialize runs log if needed
if [ ! -f "$RUNS_LOG" ]; then
  cat > "$RUNS_LOG" <<EOF
# Tax Research Run Log

Tracks what was researched and found in each run.

---

EOF
fi

# Run the selected runner.
cd "$HOME" || true

# 30 minute timeout
SECONDS=0
PROMPT_TEXT=$(cat <<'PROMPT'
You are executing a scheduled tax research cycle.

## YOUR GOAL: Increase VERIFIED tax savings

Read the skill at ~/.claude/skills/tax-research/SKILL.md for full instructions.

## STEP 0: Check for NEW Documents (ALWAYS DO THIS FIRST)

```bash
~/.claude/skills/tax-research/scripts/scan-documents.sh --quiet
```

Or manually:
```bash
find ~/OneDrive/Finance/Taxes/ -type f \( -name "*.pdf" -o -name "*.csv" \) | head -50
cat ~/OneDrive/Finance/Taxes/document-index.json | jq '.documents[] | select(.status == "new")'
```

If new documents found → investigate them first.

## Quick Steps

1. Read current totals from ~/Shared/notes/personal/taxes/Tax Savings Tracker.md
2. Check ~/Shared/notes/personal/taxes/logs/runs.md for what's been done
3. Pick ONE high-value target not yet researched
4. Launch 3 sub-agents using the Task tool:
   - Document Analyzer: Read relevant tax docs, extract numbers
   - Tax Code Researcher: WebSearch for IRS rules, limits, requirements
   - Savings Calculator: Compute actual dollar benefit + verify eligibility
5. UPDATE the Tax Savings Tracker with findings
   - Mark as Potential until eligibility checklist complete
   - Move to Verified when all requirements confirmed
6. Append to runs.md with what you found
7. Update documents-needed.md with docs that would help
8. Append skill critique to skill-improvements.md
9. Save detailed research to ~/Shared/notes/personal/taxes/research/Research - [Topic] - YYYY-MM-DD.md

## Priority Order (deadlines matter!)

1. 2022 childcare credit (amendment deadline April 15, 2026 - URGENT)
2. Solo 401(k) contribution eligibility
3. Home office deduction
4. Self-employed health insurance deduction
5. QBI deduction (Section 199A)
6. Crypto loss carryforward verification

## REQUIRED: Update Documents Needed

Update ~/Shared/notes/personal/taxes/documents-needed.md with documents that would help:
- Documents you think exist but haven't been shared
- Forms needed to complete a deduction
- Evidence to support claims

## REQUIRED: Self-Critique the Skill

After each run, append to ~/Shared/notes/personal/taxes/logs/skill-improvements.md:

```markdown
## YYYY-MM-DD HH:MM
**What went well:** [brief note]
**What was hard:** [friction points]
**Suggested improvement:** [specific actionable change to SKILL.md or scripts]
```

## Success Criteria

- Potential savings increased = partial success
- Verified savings increased = full success
- Potential → Verified conversion = great success

## Output Format

At the end, output:
RESEARCH_TARGET: [what you researched]
NEW_POTENTIAL_FOUND: $X
NEW_VERIFIED_FOUND: $Y
TOTAL_VERIFIED: $Z
STATUS: SUCCESS|PARTIAL|FAILED

START NOW.
PROMPT
)

RUN_EXIT=0
if [[ "$RUNNER" == "claude" ]]; then
  printf '%s\n' "$PROMPT_TEXT" | timeout 1800 claude --print --dangerously-skip-permissions 2>&1 | tee -a "$LOG_FILE" || RUN_EXIT=$?
else
  timeout 1800 codex exec "$PROMPT_TEXT" 2>&1 | tee -a "$LOG_FILE" || RUN_EXIT=$?
fi

RUN_EXIT="${RUN_EXIT:-0}"

echo "" | tee -a "$LOG_FILE"
echo "Research completed at $(date)" | tee -a "$LOG_FILE"
echo "Duration: $SECONDS seconds" | tee -a "$LOG_FILE"
echo "Exit code: $RUN_EXIT" | tee -a "$LOG_FILE"

if [[ $RUN_EXIT -ne 0 ]]; then
    echo "WARNING: Runner exited with non-zero status" | tee -a "$LOG_FILE"
fi
