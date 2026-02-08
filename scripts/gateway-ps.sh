#!/usr/bin/env bash
# List all running OpenClaw gateway/watchdog processes across the OS.
# Usage: bash scripts/gateway-ps.sh [--port PORT]

set -euo pipefail

port=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --port) port="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# --- Gateway processes ---
echo "=== Gateway Processes ==="

procs=$(ps aux | grep -E "(openclaw|watchdog/cli).*gateway|gateway.*(openclaw|watchdog)" | grep -v "grep" | grep -v "gateway-ps" || true)
if [ -n "$procs" ]; then
  echo "$procs"
else
  echo "(none found)"
fi

# --- Port listeners ---
echo ""
if [ -n "$port" ]; then
  echo "=== Port $port ==="
  listeners=$(lsof -iTCP:"$port" -sTCP:LISTEN -P 2>/dev/null | tail -n +2 || true)
else
  echo "=== Gateway Port Listeners ==="
  # Discover ports from running gateway processes by checking their
  # OPENCLAW_GATEWAY_PORT env var and open listening sockets.
  gateway_pids=$(pgrep -f "(openclaw\.mjs|dist/index\.js|dist/index\.mjs|dist/entry\.js) gateway|openclaw-gateway" 2>/dev/null || true)
  if [ -n "$gateway_pids" ]; then
    listeners=$(lsof -iTCP -sTCP:LISTEN -P 2>/dev/null | awk -v pids="$gateway_pids" '
      BEGIN { split(pids, p); for (i in p) pidset[p[i]] = 1 }
      NR > 1 && ($2 in pidset) { print }
    ' || true)
  else
    listeners=""
  fi
fi

if [ -n "$listeners" ]; then
  echo "$listeners"
else
  echo "(none found)"
fi

# --- Watchdog PID files ---
echo ""
echo "=== Watchdog PID Files ==="

pid_found=0
for pidfile in .watchdog/gateway.pid; do
  if [ -f "$pidfile" ]; then
    pid=$(cat "$pidfile" 2>/dev/null || true)
    if [ -n "$pid" ]; then
      pid_found=1
      if kill -0 "$pid" 2>/dev/null; then
        echo "$pidfile: PID $pid (running)"
      else
        echo "$pidfile: PID $pid (stale)"
      fi
    fi
  fi
done

# Check watchdog port lock files
watchdog_lock_dir="$HOME/.openclaw/watchdog"
if [ -d "$watchdog_lock_dir" ]; then
  for lockfile in "$watchdog_lock_dir"/port-*.lock; do
    [ -f "$lockfile" ] || continue
    lock_pid=$(sed -n 's/.*"pid": *\([0-9]*\).*/\1/p' "$lockfile" 2>/dev/null || true)
    lock_port=$(sed -n 's/.*"port": *\([0-9]*\).*/\1/p' "$lockfile" 2>/dev/null || true)
    if [ -n "$lock_pid" ]; then
      pid_found=1
      if kill -0 "$lock_pid" 2>/dev/null; then
        echo "$lockfile: PID $lock_pid, port $lock_port (running)"
      else
        echo "$lockfile: PID $lock_pid, port $lock_port (stale)"
      fi
    fi
  done
fi

if [ "$pid_found" -eq 0 ]; then
  echo "(none found)"
fi
