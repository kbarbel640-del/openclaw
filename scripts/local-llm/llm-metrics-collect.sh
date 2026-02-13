#!/bin/bash
#
# Local LLM Metrics Collection Script
# Collects and logs performance metrics
#

set -euo pipefail

# Configuration
METRICS_ENDPOINT="http://127.0.0.1:8765/metrics"
LOG_FILE="/var/log/llm-metrics.log"
TIMEOUT=5

timestamp() {
    date '+%Y-%m-%d %H:%M:%S'
}

collect_metrics() {
    echo "[$(timestamp)] ===== Metrics Collection ====="
    
    # Memory usage
    if ps aux | grep -q '[l]lama-server'; then
        mem_mb=$(ps aux | grep '[l]lama-server' | awk '{sum+=$6} END {printf "%.0f", sum/1024}')
        cpu_percent=$(ps aux | grep '[l]lama-server' | awk '{print $3}')
        echo "Memory Usage: ${mem_mb} MB"
        echo "CPU Usage: ${cpu_percent}%"
    else
        echo "ERROR: llama-server process not found"
        return 1
    fi
    
    # Service uptime
    if systemctl is-active --quiet local-llm; then
        uptime=$(systemctl show local-llm --property=ActiveEnterTimestamp | cut -d= -f2)
        echo "Service Uptime: ${uptime}"
    fi
    
    # Prometheus metrics (if available)
    if curl -s --max-time "$TIMEOUT" "$METRICS_ENDPOINT" > /dev/null 2>&1; then
        echo "--- Prometheus Metrics ---"
        curl -s --max-time "$TIMEOUT" "$METRICS_ENDPOINT" | grep -E "^(llama|llamacpp)" || echo "No metrics available yet"
    else
        echo "WARNING: Metrics endpoint not available"
    fi
    
    echo "=============================="
    echo
}

# Main
main() {
    mkdir -p "$(dirname "$LOG_FILE")"
    collect_metrics | tee -a "$LOG_FILE"
}

main "$@"
