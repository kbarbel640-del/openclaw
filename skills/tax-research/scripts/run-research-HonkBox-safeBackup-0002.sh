#!/usr/bin/env bash
# Tax Research Runner
# Invokes delegate (LM proxy) to execute one research cycle
# Usage: ./run-research.sh [run|status|summary]

set -euo pipefail

NOTES_DIR="$HOME/Shared/notes/personal/taxes"
LOG_DIR="$NOTES_DIR/logs"
TRACKER="$NOTES_DIR/Tax Savings Tracker.md"
RUNS_LOG="$LOG_DIR/runs.md"
DELEGATE_SCRIPT="$HOME/bin/tax-research-delegate.sh"
SCAN_SCRIPT="$HOME/Shared/skills/tax-research/scripts/scan-documents.sh"
STATE_DIR="$HOME/.openclaw/workspace/tmp"
LOCK_FILE="$STATE_DIR/tax-research.lock"

mkdir -p "$LOG_DIR" "$STATE_DIR"

TIMESTAMP=$(date +%Y-%m-%d_%H%M)
LOG_FILE="$LOG_DIR/research-$TIMESTAMP.log"

MODE="${1:-run}"

acquire_lock() {
  if command -v flock >/dev/null 2>&1; then
    exec 9>"$LOCK_FILE"
    if ! flock -n 9; then
      echo "Another tax research run is already in progress."
      exit 1
    fi
  else
    if [ -f "$LOCK_FILE" ]; then
      echo "Another tax research run is already in progress (lock file exists)."
      exit 1
    fi
    echo "$$" > "$LOCK_FILE"
    trap 'rm -f "$LOCK_FILE"' EXIT
  fi
}

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

    cat <<EOF_SUMMARY
Tax Research Daily Summary

Current Verified Savings: $TOTAL
Last Run: $LAST_TIME

Recent Activity:
$(tail -20 "$RUNS_LOG" 2>/dev/null || echo "No activity")
EOF_SUMMARY
    exit 0
    ;;

  run)
    acquire_lock

    {
      echo "=== Tax Research Run ==="
      echo "Started: $(date)"
      echo ""
      echo "== Document Scan =="
      if [ -x "$SCAN_SCRIPT" ]; then
        "$SCAN_SCRIPT" || echo "Document scan failed"
      else
        echo "Document scan script not found: $SCAN_SCRIPT"
      fi
      echo ""
      echo "== Delegate Run =="
      if [ -x "$DELEGATE_SCRIPT" ]; then
        "$DELEGATE_SCRIPT" || echo "Delegate run failed"
      else
        echo "Delegate script not found: $DELEGATE_SCRIPT"
        exit 1
      fi
      echo ""
      echo "Completed: $(date)"
    } | tee "$LOG_FILE"

    echo "Run log: $LOG_FILE"
    ;;

  *)
    echo "Usage: $0 [run|status|summary]"
    exit 1
    ;;
esac
