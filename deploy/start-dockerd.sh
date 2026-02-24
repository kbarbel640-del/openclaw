#!/usr/bin/env bash
# start-dockerd.sh — Start Docker daemon in the background (requires root).
#
# Designed to run as root before dropping to the node user.
# Exits 0 immediately if dockerd is not installed.

set -euo pipefail

if ! command -v dockerd &>/dev/null; then
  exit 0
fi

echo "[setup] Starting Docker daemon..."
dockerd &>/var/log/dockerd.log &

for i in $(seq 1 30); do
  if docker info &>/dev/null; then
    echo "[setup] Docker daemon ready."
    exit 0
  fi
  if [ "$i" -eq 30 ]; then
    echo "[setup] ERROR: Docker daemon failed to start. Check /var/log/dockerd.log" >&2
    exit 1
  fi
  sleep 1
done
