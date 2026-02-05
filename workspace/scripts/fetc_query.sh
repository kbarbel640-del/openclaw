#!/bin/bash
# FETC 費用查詢腳本 - 直接查 Supabase REST API
# 用法: ./fetc_query.sh [車牌] [類型] [天數]
# 範例: ./fetc_query.sh REC-0335 toll 30

SUPABASE_URL="https://fgrqbbttalnpepnsozvt.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZncnFiYnR0YWxucGVwbnNvenZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NzAxMjIsImV4cCI6MjA3MzA0NjEyMn0.UtMMaS3unvkus6JbAzOoupmZzuu3JKVVND-bmQ6VS4E"

PLATE="${1:-}"
FEE_TYPE="${2:-}"
DAYS="${3:-30}"

# 構建查詢 URL
QUERY_URL="${SUPABASE_URL}/rest/v1/fees?select=license_plate_number,fee_type,fee_amount,occurred_at"

# 添加車牌篩選
if [ -n "$PLATE" ]; then
    QUERY_URL="${QUERY_URL}&license_plate_number=eq.${PLATE}"
fi

# 添加類型篩選
if [ -n "$FEE_TYPE" ]; then
    QUERY_URL="${QUERY_URL}&fee_type=eq.${FEE_TYPE}"
fi

# 添加日期篩選（最近 N 天）
if [ -n "$DAYS" ]; then
    START_DATE=$(date -d "-${DAYS} days" +%Y-%m-%dT00:00:00 2>/dev/null || date -v-${DAYS}d +%Y-%m-%dT00:00:00)
    QUERY_URL="${QUERY_URL}&occurred_at=gte.${START_DATE}"
fi

# 排序
QUERY_URL="${QUERY_URL}&order=occurred_at.desc"

# 執行查詢
RESULT=$(curl -s "$QUERY_URL" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_KEY}")

# 輸出結果
echo "$RESULT" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    if not data:
        print('📭 沒有找到記錄')
        sys.exit(0)
    
    total = 0
    print(f'📊 找到 {len(data)} 筆記錄：')
    print('-' * 60)
    for r in data:
        plate = r.get('license_plate_number', '')
        ftype = r.get('fee_type', '')
        amount = r.get('fee_amount', 0)
        date = r.get('occurred_at', '')[:10]
        total += amount
        print(f'{date} | {plate} | {ftype:20} | \${amount:.2f}')
    print('-' * 60)
    print(f'💰 總計: \${total:.2f}')
except Exception as e:
    print(f'解析錯誤: {e}')
    print(sys.stdin.read())
" 2>/dev/null || echo "$RESULT"
