#!/bin/bash

# OpenClaw 中国用户一键安装脚本
echo "==========================================="
echo "  OpenClaw 中国用户一键安装程序"
echo "  支持钉钉、飞书、企业微信等国内平台"
echo "==========================================="

# 检查是否为root用户
if [ "$EUID" -ne 0 ]; then
  echo "请使用root权限运行此脚本"
  exit 1
fi

echo "开始安装 OpenClaw..."

# 使用国内镜像安装 Node.js (如果未安装)
if ! command -v node &> /dev/null; then
    echo "安装 Node.js (使用国内镜像)..."
    curl -o node-v22.22.0-linux-x64.tar.xz https://npmmirror.com/mirrors/node/latest-v22.x/node-v22.22.0-linux-x64.tar.xz
    tar -xJf node-v22.22.0-linux-x64.tar.xz
    export PATH=$PWD/node-v22.22.0-linux-x64/bin:$PATH
    echo 'export PATH=$PWD/node-v22.22.0-linux-x64/bin:$PATH' >> ~/.bashrc
else
    echo "Node.js 已安装:"
    node --version
fi

# 配置 npm 镜像
echo "配置 npm 镜像..."
npm config set registry https://registry.npmmirror.com

# 全局安装 OpenClaw
echo "安装 OpenClaw..."
npm install -g openclaw@latest

# 初始化 OpenClaw
echo "初始化 OpenClaw..."
mkdir -p ~/.openclaw
cd ~/
openclaw onboard --install-daemon

# 配置防火墙 (如果使用防火墙)
if command -v ufw &> /dev/null; then
    echo "配置 UFW 防火墙..."
    ufw allow 18789
elif command -v firewall-cmd &> /dev/null; then
    echo "配置 Firewalld 防火墙..."
    firewall-cmd --permanent --add-port=18789/tcp
    firewall-cmd --reload
fi

echo "==========================================="
echo "  安装完成!"
echo "==========================================="
echo "使用方法:"
echo "  启动服务: openclaw gateway --port 18789 --verbose"
echo "  查看状态: openclaw gateway status"
echo "  与助手对话: openclaw agent --message \"你好\" --thinking high"
echo ""
echo "集成国内平台:"
echo "  钉钉: 配置 channels.dingtalk 在 ~/.openclaw/openclaw.json"
echo "  飞书: 配置 channels.feishu 在 ~/.openclaw/openclaw.json"
echo "  企业微信: 配置 channels.wechatWork 在 ~/.openclaw/openclaw.json"
echo "==========================================="