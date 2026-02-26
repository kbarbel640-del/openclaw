#!/bin/bash
export PATH=$PATH:/usr/local/bin:/root/.local/bin:/root/.nvm/versions/node/v22.12.0/bin:/root/.npm-global/bin
cd /root/openclaw-deploy
echo "Pulling latest code..."
git fetch origin
git checkout feat/feishu-reaction-state
git pull origin feat/feishu-reaction-state
echo "Installing dependencies..."
pnpm install
echo "Building project..."
pnpm build
echo "Restarting service..."
systemctl --user restart openclaw-gateway
echo "Done!"
