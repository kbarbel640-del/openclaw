#!/bin/bash
cd "$(dirname "$0")"
if [ -f .pid ] && kill -0 "$(cat .pid)" 2>/dev/null; then
    echo "Already running (PID $(cat .pid))"
    exit 1
fi
./venv/bin/python scripts/squad_server.py &
echo $! > .pid
echo "Started (PID $(cat .pid))"
