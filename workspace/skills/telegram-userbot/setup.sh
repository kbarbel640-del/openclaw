#!/bin/bash
# Telegram HTTP Bridge 安裝腳本

cd "$(dirname "$0")"

echo "📦 建立 Python venv..."
python3 -m venv venv

echo "📥 安裝依賴..."
source venv/bin/activate
pip install --upgrade pip
pip install telethon aiohttp

echo "✅ 完成！"
echo ""
echo "啟動方式："
echo "  cd ~/clawd/skills/telegram-userbot"
echo "  source venv/bin/activate"
echo "  python scripts/http_bridge.py"
