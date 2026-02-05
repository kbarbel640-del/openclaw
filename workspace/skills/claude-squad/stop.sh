#!/bin/bash
cd "$(dirname "$0")"
if [ -f .pid ]; then
    PID=$(cat .pid)
    if kill -0 "$PID" 2>/dev/null; then
        kill "$PID"
        echo "Stopped (PID $PID)"
    else
        echo "Process $PID not running"
    fi
    rm .pid
else
    echo "No .pid file found"
fi
