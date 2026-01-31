#!/bin/sh
# Docker entrypoint for OpenClaw
# Starts the gateway with cloud-friendly defaults

echo "=== OpenClaw Docker Entrypoint ==="
echo "PORT=${PORT:-8080}"
echo "Running: node dist/index.js gateway --bind 0.0.0.0 --port ${PORT:-8080} --allow-unconfigured --verbose"
echo "=================================="

exec node dist/index.js gateway --bind 0.0.0.0 --port "${PORT:-8080}" --allow-unconfigured --verbose
