#!/bin/bash
# FETC 費用彙總 - 按車牌/月份統計
# 用法: ./fetc_summary.sh [車牌]

SUPABASE_URL="https://fgrqbbttalnpepnsozvt.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZncnFiYnR0YWxucGVwbnNvenZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NzAxMjIsImV4cCI6MjA3MzA0NjEyMn0.UtMMaS3unvkus6JbAzOoupmZzuu3JKVVND-bmQ6VS4E"

PLATE="${1:-}"

# 查詢所有記錄
QUERY_URL="${SUPABASE_URL}/rest/v1/fees?select=license_plate_number,fee_type,fee_amount,occurred_at"

if [ -n "$PLATE" ]; then
    QUERY_URL="${QUERY_URL}&license_plate_number=eq.${PLATE}"
fi

RESULT=$(curl -s "$QUERY_URL" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_KEY}")

echo "$RESULT" | python3 -c "
import sys, json
from collections import defaultdict

data = json.load(sys.stdin)
if not data:
    print('📭 沒有記錄')
    sys.exit(0)

# 按車牌和月份彙總
by_plate = defaultdict(lambda: defaultdict(float))
by_month = defaultdict(float)
by_type = defaultdict(float)

for r in data:
    plate = r.get('license_plate_number', '')
    ftype = r.get('fee_type', '')
    amount = r.get('fee_amount', 0)
    month = r.get('occurred_at', '')[:7]  # YYYY-MM
    
    by_plate[plate][ftype] += amount
    by_month[month] += amount
    by_type[ftype] += amount

print('📊 FETC 費用彙總')
print('=' * 60)

# 按車牌
print('\n🚗 按車牌：')
for plate, types in sorted(by_plate.items()):
    total = sum(types.values())
    print(f'  {plate}: \${total:.2f}')
    for t, amt in types.items():
        print(f'    └─ {t}: \${amt:.2f}')

# 按類型
print('\n📋 按類型：')
type_names = {'toll': '過路費', 'street_parking': '路邊停車', 'short_term_parking': '臨停'}
for t, amt in sorted(by_type.items(), key=lambda x: -x[1]):
    name = type_names.get(t, t)
    print(f'  {name}: \${amt:.2f}')

# 按月份
print('\n📅 按月份：')
for month, amt in sorted(by_month.items(), reverse=True)[:6]:
    print(f'  {month}: \${amt:.2f}')

print('=' * 60)
print(f'💰 總計: \${sum(by_type.values()):.2f}')
"
