#!/bin/bash
# 發送 LINE 訊息的快捷腳本
# Usage: ./send_line.sh "聯繫人" "訊息"

set -e

RECIPIENT="$1"
MESSAGE="$2"

if [ -z "$RECIPIENT" ] || [ -z "$MESSAGE" ]; then
    echo "Usage: $0 <recipient> <message>"
    exit 1
fi

cd ~/Documents/LINE_pyautogui
source venv/bin/activate
line-cli send "$RECIPIENT" "$MESSAGE"
