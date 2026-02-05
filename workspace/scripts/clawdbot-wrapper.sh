#!/bin/bash
# Clawdbot wrapper - 減少 fd 洩漏風險
#
# 設置環境變數來減少 Node.js 子進程的 fd 繼承問題

# 限制最大 open files (可選，防止失控)
ulimit -n 8192

# 啟動 gateway
exec /opt/homebrew/bin/clawdbot "$@"
