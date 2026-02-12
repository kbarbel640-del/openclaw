#!/usr/bin/env bash
# apt-get 操作整合：repo ops、update、install、clean
# 供 Dockerfile 使用；須以 root 執行
set -e

# 前置：需 ca-certificates、curl、gnupg 才能加入第三方 repo
APT_REPO_PREQS="ca-certificates curl gnupg"
# 主套件：Docker CLI/buildx/compose、Tailscale、Homebrew 相依
APT_PACKAGES="docker-ce-cli docker-buildx-plugin docker-compose-plugin jq tailscale build-essential procps file git"

# === repo ops ===
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends $APT_REPO_PREQS

# Docker CLI/buildx/compose：gateway 容器需用主機 Docker 跑 sandbox
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian bookworm stable" \
  > /etc/apt/sources.list.d/docker.list

# Tailscale CLI/runtime：gateway --tailscale 模式
curl -fsSL https://pkgs.tailscale.com/stable/debian/bookworm.noarmor.gpg \
  | tee /usr/share/keyrings/tailscale-archive-keyring.gpg >/dev/null
curl -fsSL https://pkgs.tailscale.com/stable/debian/bookworm.tailscale-keyring.list \
  | tee /etc/apt/sources.list.d/tailscale.list >/dev/null

# === update ===
apt-get update

# === install ===
INSTALL_LIST="$APT_PACKAGES"
[ -n "${OPENCLAW_DOCKER_APT_PACKAGES:-}" ] && INSTALL_LIST="$INSTALL_LIST $OPENCLAW_DOCKER_APT_PACKAGES"
DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends $INSTALL_LIST

# === clean ===
apt-get clean
rm -rf /var/lib/apt/lists/* /var/cache/apt/archives/*
