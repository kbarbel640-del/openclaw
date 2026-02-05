#!/bin/bash
# 列出所有車輛帳號
# 用法: ./accounts.sh [guest|member]

ACCOUNT_FILE=~/Documents/fetc/.account_info

if [ ! -f "$ACCOUNT_FILE" ]; then
    echo "❌ 找不到帳號檔案: $ACCOUNT_FILE"
    exit 1
fi

TYPE_FILTER="${1:-}"

echo "🚗 FETC 車輛帳號清單"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 跳過 header，解析 TSV
tail -n +2 "$ACCOUNT_FILE" | while IFS=$'\t' read -r plate type username password rest; do
    if [ -n "$TYPE_FILTER" ] && [ "$type" != "$TYPE_FILTER" ]; then
        continue
    fi
    
    if [ "$type" = "guest" ]; then
        echo "🔓 $plate (guest) — 統編: $username"
    else
        echo "🔐 $plate (member) — 帳號: $username"
    fi
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
TOTAL=$(tail -n +2 "$ACCOUNT_FILE" | wc -l | tr -d ' ')
GUEST=$(tail -n +2 "$ACCOUNT_FILE" | grep -c "guest" || echo 0)
MEMBER=$(tail -n +2 "$ACCOUNT_FILE" | grep -c "member" || echo 0)
echo "📊 共 $TOTAL 台車 | Guest: $GUEST | Member: $MEMBER"
