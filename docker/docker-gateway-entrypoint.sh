#!/usr/bin/env bash
set -euo pipefail

# Gateway 專用 entrypoint：前置 + exec
# 以 exec 結束讓 node 成為 PID 1，正確接收 Docker SIGTERM 並持續運行
# （just start 會讓 just 成為 PID 1，導致 signal 處理異常、容器異常終止）

# Step 1: tailscale/credentials 等前置
bash /app/docker/docker-entrypoint.sh --setup-only "$@"

# Step 2: 清理 anti-timeout queue 的殘留 lock（容器重啟後可自動恢復）
rm -rf /home/node/.openclaw/workspace/queues/anti-timeout-orchestrator/lock || true

# Step 3: exec 取代本腳本，node 成為 PID 1
exec "$@"
