#!/bin/bash

################################################################################
# Auto-Commit Daemon for SDD Flow
#
# Purpose: Periodically checks for changes and auto-commits using smart_commit
# Spawns as background subagent, runs independently
################################################################################

set -e

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
GRAY='\033[0;90m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[AUTO-COMMIT]${NC} $1"; }
log_success() { echo -e "${GREEN}[AUTO-COMMIT]${NC} ✅ $1"; }
log_warning() { echo -e "${YELLOW}[AUTO-COMMIT]${NC} ⚠️  $1"; }
log_error() { echo -e "${RED}[AUTO-COMMIT]${NC} ❌ $1"; }
log_debug() { echo -e "${GRAY}[AUTO-COMMIT DEBUG]${NC} $1"; }

# Configuration
INTERVAL_SECONDS=300  # 5 minutes default
FEATURE_NAME=""
DRY_RUN=false
PID_FILE="/tmp/auto-commit-daemon.pid"

usage() {
    cat << 'EOF'
Auto-Commit Daemon - Background subagent for periodic commits

USAGE:
    ./auto-commit-daemon.sh --feature <name> [--interval <seconds>] [--dry-run]
    ./auto-commit-daemon.sh --stop

OPTIONS:
    --feature <name>    Feature name (required)
    --interval <sec>    Check interval in seconds (default: 300)
    --dry-run           Preview only, don't actually commit
    --stop              Stop running daemon
    --help, -h          Show this help

EXAMPLES:
    # Start daemon with 5-minute intervals
    ./auto-commit-daemon.sh --feature auto-archive-old-conversations

    # Start daemon with custom interval
    ./auto-commit-daemon.sh --feature my-feature --interval 600

    # Stop daemon
    ./auto-commit-daemon.sh --stop

BEHAVIOR:
    - Runs in background as independent subagent
    - Checks git status every INTERVAL seconds
    - Auto-commits changes using smart_commit.sh
    - Logs all actions to stdout (capture if needed)
    - Creates PID file for management
EOF
}

# Check if daemon is already running
check_running() {
    if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
        return 0  # Running
    fi
    return 1  # Not running
}

# Stop daemon
stop_daemon() {
    if check_running; then
        PID=$(cat "$PID_FILE")
        log_info "Stopping daemon (PID: $PID)..."
        kill "$PID"
        rm -f "$PID_FILE"
        log_success "Daemon stopped"
    else
        log_warning "No daemon running"
    fi
    exit 0
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --feature)
            FEATURE_NAME="$2"
            shift 2
            ;;
        --interval)
            INTERVAL_SECONDS="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --stop)
            stop_daemon
            ;;
        --help|-h)
            usage
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Validation
if [ -z "$FEATURE_NAME" ]; then
    log_error "Feature name is required (--feature <name>)"
    usage
    exit 1
fi

if [ "$INTERVAL_SECONDS" -lt 60 ]; then
    log_warning "Interval too short (< 60s), setting to 60 seconds"
    INTERVAL_SECONDS=60
fi

# Check if already running
if check_running; then
    log_error "Daemon already running (PID: $(cat "$PID_FILE"))"
    log_info "Use --stop to stop it first"
    exit 1
fi

# Daemon main loop
run_daemon() {
    log_info "Starting auto-commit daemon for: $FEATURE_NAME"
    log_info "Check interval: ${INTERVAL_SECONDS}s"
    log_info "PID: $$"
    log_info ""
    
    # Save PID
    echo $$ > "$PID_FILE"
    
    # Main loop
    while true; do
        TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
        log_debug "[$TIMESTAMP] Checking for changes..."
        
        # Check git status
        if git diff --quiet && git diff --cached --quiet; then
            log_debug "No changes detected"
        else
            log_info "Changes detected, committing..."
            
            if [ "$DRY_RUN" = true ]; then
                log_warning "DRY-RUN mode: Would commit changes:"
                git status --short
            else
                # Run smart commit
                if [ -x "./smart_commit.sh" ]; then
                    log_info "Executing smart_commit.sh..."
                    if ./smart_commit.sh --feature "$FEATURE_NAME" --auto; then
                        log_success "Auto-commit successful"
                    else
                        log_error "Auto-commit failed (exit code: $?)"
                    fi
                else
                    log_error "smart_commit.sh not found or not executable"
                fi
            fi
            
            log_info "Waiting ${INTERVAL_SECONDS}s until next check..."
        fi
        
        sleep "$INTERVAL_SECONDS"
    done
}

# Fork to background if not in dry-run
if [ "$DRY_RUN" = false ]; then
    log_info "Forking to background..."
    log_info "Output will continue here. Use Ctrl+C to stop (or --stop command)."
    log_info ""
    
    # Run in foreground but as independent process
    # Caller can use nohup or & if they want true background
    run_daemon
else
    log_warning "DRY-RUN mode: Running once and exiting"
    INTERVAL_SECONDS=0
    run_daemon
fi
