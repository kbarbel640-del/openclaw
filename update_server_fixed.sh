#!/bin/bash
export PATH=$PATH:/usr/local/bin:/root/.local/bin:/root/.nvm/versions/node/v22.12.0/bin:/root/.npm-global/bin
cd /root/openclaw-deploy

echo "Updating code from GitHub..."
git fetch origin
git checkout feat/feishu-reaction-state
git pull origin feat/feishu-reaction-state

# 如果本地提交没推上去，这里强制同步一下我们刚才的修改（如果是本地编辑并推送到服务器）
# 其实我是在本地代码库编辑的，所以我需要把本地改动推送到 GitHub 或者直接 scp 到服务器。
# 考虑到我拥有 GitHub 提交权限，我会先推送到 GitHub。

echo "Installing dependencies..."
pnpm install

echo "Building project..."
pnpm build

echo "Restarting service..."
systemctl --user stop openclaw-gateway
fuser -k 18789/tcp || true
sleep 1
systemctl --user start openclaw-gateway

echo "Verification..."
systemctl --user status openclaw-gateway -n 20

echo "Done!"
