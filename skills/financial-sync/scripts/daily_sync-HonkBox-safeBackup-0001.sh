#!/bin/bash
# Daily Financial Sync - Orchestrates all financial data sources
# Usage: daily_sync.sh [--teller-only] [--quiet]

set -euo pipefail

# Paths
TELLER_DIR="$HOME/projects/teller-sync"
TELLER_EXCEL="$HOME/bin/teller-to-excel.py"
QUICKEN_DIR="$HOME/Shared/quicken-imports"
TODAY=$(date +%Y-%m-%d)
LOG_FILE="$QUICKEN_DIR/$TODAY/daily-sync.log"

# Colors (disabled if not tty)
if [[ -t 1 ]]; then
    GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[0;33m'; NC='\033[0m'
else
    GREEN=''; RED=''; YELLOW=''; NC=''
fi

# Options
TELLER_ONLY=false
QUIET=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --teller-only) TELLER_ONLY=true; shift ;;
        --quiet) QUIET=true; shift ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

log() { [[ "$QUIET" == "false" ]] && echo -e "$1" || true; }
success() { log "${GREEN}[OK]${NC} $1"; }
warn() { log "${YELLOW}[WARN]${NC} $1"; }
fail() { log "${RED}[FAIL]${NC} $1"; }

# Ensure today's directory exists
mkdir -p "$QUICKEN_DIR/$TODAY"

# Start log
echo "=== Daily Sync $(date '+%Y-%m-%d %H:%M:%S') ===" >> "$LOG_FILE"

#############################################
# 1. Teller Bank Sync
#############################################
log "\n--- Teller Bank Sync ---"

if [[ ! -d "$TELLER_DIR" ]]; then
    fail "Teller directory not found: $TELLER_DIR"
    echo "TELLER: MISSING DIR" >> "$LOG_FILE"
else
    cd "$TELLER_DIR"

    # Source .envrc if exists (for TELLER_APP_ID)
    [[ -f .envrc ]] && source .envrc 2>/dev/null || true

    # Activate venv if exists
    [[ -f .venv/bin/activate ]] && source .venv/bin/activate

    # Check required env var
    if [[ -z "${TELLER_APP_ID:-}" ]]; then
        fail "TELLER_APP_ID not set (check $TELLER_DIR/.envrc)"
        echo "TELLER: MISSING APP_ID" >> "$LOG_FILE"
    elif python3 teller_sync.py >> "$LOG_FILE" 2>&1; then
        TELLER_COUNT=$(python3 teller_sync.py --summary 2>/dev/null | grep "Total transactions" | grep -oE '[0-9]+' || echo "?")
        success "Synced $TELLER_COUNT transactions"
        echo "TELLER: OK ($TELLER_COUNT txns)" >> "$LOG_FILE"
    else
        fail "Teller sync failed (check log)"
        echo "TELLER: FAILED" >> "$LOG_FILE"
    fi
fi

#############################################
# 2. Export to Excel
#############################################
log "\n--- Excel Export ---"

# Excel export needs openpyxl - install to teller venv if missing
if [[ -f "$TELLER_DIR/.venv/bin/python3" ]]; then
    EXCEL_PYTHON="$TELLER_DIR/.venv/bin/python3"
    # Ensure openpyxl is installed
    $EXCEL_PYTHON -c "import openpyxl" 2>/dev/null || {
        log "Installing openpyxl..."
        cd "$TELLER_DIR" && uv pip install openpyxl >> "$LOG_FILE" 2>&1
    }
else
    EXCEL_PYTHON="python3"
fi

if [[ ! -f "$TELLER_EXCEL" ]]; then
    fail "Excel export script not found: $TELLER_EXCEL"
    echo "EXCEL: MISSING SCRIPT" >> "$LOG_FILE"
else
    if output=$($EXCEL_PYTHON "$TELLER_EXCEL" 2>&1); then
        added=$(echo "$output" | grep -oE 'Added [0-9]+' | head -1 | grep -oE '[0-9]+' || echo "0")
        success "Exported to Excel (+$added new)"
        echo "EXCEL: OK (+$added)" >> "$LOG_FILE"
    else
        fail "Excel export failed (check log)"
        echo "$output" >> "$LOG_FILE"
        echo "EXCEL: FAILED" >> "$LOG_FILE"
    fi
fi

#############################################
# 3. Check Manual Export Files
#############################################
if [[ "$TELLER_ONLY" == "false" ]]; then
    log "\n--- Manual Export Status ---"

    # Fidelity
    FIDELITY_DIR="$QUICKEN_DIR/$TODAY/fidelity"
    FIDELITY_STATE="$QUICKEN_DIR/fidelity-state.json"

    if [[ -d "$FIDELITY_DIR" ]]; then
        CSV_COUNT=$(find "$FIDELITY_DIR" -name "*.csv" -type f 2>/dev/null | wc -l)
        if [[ $CSV_COUNT -gt 0 ]]; then
            success "Fidelity: $CSV_COUNT CSV file(s) found"
            echo "FIDELITY: $CSV_COUNT CSV files" >> "$LOG_FILE"
        else
            warn "Fidelity: No CSV exports (screenshots only)"
            echo "FIDELITY: No CSV" >> "$LOG_FILE"
        fi
    else
        warn "Fidelity: No exports today"
        if [[ -f "$FIDELITY_STATE" ]]; then
            LAST_FIDELITY=$(cat "$FIDELITY_STATE" 2>/dev/null | grep -oE '"last_sync"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4 || echo "unknown")
            log "    Last sync: $LAST_FIDELITY"
        fi
        echo "FIDELITY: Not exported" >> "$LOG_FILE"
    fi

    # River
    RIVER_DIR="$QUICKEN_DIR/$TODAY/river"
    RIVER_STATE="$QUICKEN_DIR/river-login-state.json"

    if [[ -d "$RIVER_DIR" ]]; then
        CSV_COUNT=$(find "$RIVER_DIR" -name "*.csv" -type f 2>/dev/null | wc -l)
        if [[ $CSV_COUNT -gt 0 ]]; then
            success "River: $CSV_COUNT CSV file(s) found"
            echo "RIVER: $CSV_COUNT CSV files" >> "$LOG_FILE"
        else
            warn "River: No CSV exports (screenshots only)"
            echo "RIVER: No CSV" >> "$LOG_FILE"
        fi
    else
        warn "River: No exports today"
        echo "RIVER: Not exported" >> "$LOG_FILE"
    fi
fi

#############################################
# Summary
#############################################
log "\n--- Summary ---"

# Check Teller DB stats
if [[ -f "$TELLER_DIR/transactions.db" ]]; then
    DB_SIZE=$(du -h "$TELLER_DIR/transactions.db" 2>/dev/null | cut -f1)
    LATEST=$(sqlite3 "$TELLER_DIR/transactions.db" "SELECT MAX(date) FROM transactions" 2>/dev/null || echo "?")
    log "Teller DB: $DB_SIZE, latest txn: $LATEST"
fi

# Check Excel
EXCEL_FILE="$HOME/OneDrive/Finance/finances.xlsx"
if [[ -f "$EXCEL_FILE" ]]; then
    EXCEL_MOD=$(date -r "$EXCEL_FILE" '+%Y-%m-%d %H:%M' 2>/dev/null || stat -c '%y' "$EXCEL_FILE" 2>/dev/null | cut -d'.' -f1)
    log "Excel: Last modified $EXCEL_MOD"
fi

log "\nLog: $LOG_FILE"
echo "=== Complete $(date '+%H:%M:%S') ===" >> "$LOG_FILE"
