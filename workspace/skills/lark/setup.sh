#!/bin/bash
# Lark Skill 安裝腳本

cd "$(dirname "$0")"

echo "📦 建立 Python venv..."
python3 -m venv venv

echo "📥 安裝依賴..."
source venv/bin/activate
pip install --upgrade pip
pip install httpx

echo "✅ 完成！"
echo ""
echo "使用方式："
echo "  cd ~/clawd/skills/lark"
echo "  source venv/bin/activate"
echo "  python scripts/lark.py token"
