#!/usr/bin/env bash
# 依 OpenClaw Docker 安裝計畫匯出環境變數，供 docker/setup.sh 使用。
# 使用方式： source docker/install-env.sh && ./docker/setup.sh
# 或：        . docker/install-env.sh && ./docker/setup.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="${ROOT_DIR}/data"

# 將 config/workspace 放在 data 下，與 /home/node 綁定一致
export OPENCLAW_CONFIG_DIR="${DATA_DIR}/.openclaw"
export OPENCLAW_WORKSPACE_DIR="${DATA_DIR}/.openclaw/workspace"

# /home/node 綁定到 data（等同 persist 到本機目錄）
export OPENCLAW_HOME_VOLUME="${DATA_DIR}"

# 映像內預裝 apt 套件
export OPENCLAW_DOCKER_APT_PACKAGES="git curl jq"

# 額外掛載（格式：主機路徑:容器路徑:ro 或 :rw，多個以逗號分隔）
export OPENCLAW_EXTRA_MOUNTS="${HOME}/.codex:/home/node/.codex:ro"

echo "OPENCLAW_CONFIG_DIR=$OPENCLAW_CONFIG_DIR"
echo "OPENCLAW_WORKSPACE_DIR=$OPENCLAW_WORKSPACE_DIR"
echo "OPENCLAW_HOME_VOLUME=$OPENCLAW_HOME_VOLUME"
echo "OPENCLAW_DOCKER_APT_PACKAGES=$OPENCLAW_DOCKER_APT_PACKAGES"
echo "OPENCLAW_EXTRA_MOUNTS=$OPENCLAW_EXTRA_MOUNTS"
