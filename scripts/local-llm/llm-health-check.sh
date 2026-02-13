#!/bin/bash
#
# Local LLM Health Check Script
# Checks if the local LLM service is responding
#

set -euo pipefail

# Configuration
ENDPOINT="http://127.0.0.1:8765/health"
TIMEOUT=5
LOG_FILE="/var/log/llm-health.log"

# Exit codes
OK=0
WARNING=1
CRITICAL=2
UNKNOWN=3

# Timestamp
timestamp() {
    date '+%Y-%m-%d %H:%M:%S'
}

# Log function
log() {
    echo "[$(timestamp)] $1" | tee -a "$LOG_FILE"
}

# Main health check
check_health() {
    # Try to reach the health endpoint
    http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" "$ENDPOINT" 2>/dev/null || echo "000")
    
    case "$http_code" in
        200)
            log "OK: Local LLM is healthy (HTTP $http_code)"
            return $OK
            ;;
        000)
            log "CRITICAL: Local LLM not responding (connection failed)"
            return $CRITICAL
            ;;
        *)
            log "WARNING: Local LLM returned unexpected status (HTTP $http_code)"
            return $WARNING
            ;;
    esac
}

# Check if service is running
check_service() {
    if systemctl is-active --quiet local-llm; then
        log "Service is active"
        return $OK
    else
        log "CRITICAL: Service is not active"
        return $CRITICAL
    fi
}

# Check memory usage
check_memory() {
    mem_usage=$(ps aux | grep '[l]lama-server' | awk '{sum+=$6} END {print sum/1024}')
    
    if [ -z "$mem_usage" ]; then
        log "WARNING: Could not determine memory usage (process not found)"
        return $WARNING
    fi
    
    # Convert to integer for comparison
    mem_usage_int=${mem_usage%.*}
    
    if [ "$mem_usage_int" -gt 3000 ]; then
        log "CRITICAL: Memory usage too high: ${mem_usage} MB"
        return $CRITICAL
    elif [ "$mem_usage_int" -gt 2800 ]; then
        log "WARNING: Memory usage elevated: ${mem_usage} MB"
        return $WARNING
    else
        log "OK: Memory usage normal: ${mem_usage} MB"
        return $OK
    fi
}

# Main execution
main() {
    local exit_code=$OK
    
    # Create log directory if it doesn't exist
    mkdir -p "$(dirname "$LOG_FILE")"
    touch "$LOG_FILE"
    
    log "===== Health Check Start ====="
    
    # Check service status
    if ! check_service; then
        exit_code=$CRITICAL
    fi
    
    # Check API health
    if ! check_health; then
        if [ $exit_code -eq $OK ]; then
            exit_code=$CRITICAL
        fi
    fi
    
    # Check memory
    check_memory
    mem_check=$?
    if [ $mem_check -gt $exit_code ]; then
        exit_code=$mem_check
    fi
    
    log "===== Health Check Complete (Exit: $exit_code) ====="
    echo
    
    exit $exit_code
}

# Run if executed directly (not sourced)
if [ "${BASH_SOURCE[0]}" -eq "${0}" ]; then
    main "$@"
fi
