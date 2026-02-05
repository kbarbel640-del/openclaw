#!/usr/bin/env python3
"""生成充值渠道成功率 Excel 報表"""

import json
import sys
from datetime import datetime

# 讀取數據
with open('/tmp/recharge_data.json') as f:
    data = json.load(f)

# pay_type 名稱對照（待確認）
PAY_TYPE_NAMES = {
    1: "渠道1（待確認）",
    5: "UPI（主力）",
    6: "渠道6（待確認）",
    17: "渠道17（待確認）",
    24: "渠道24（待確認）",
    31: "渠道31（高成功率）",
    40: "渠道40（低成功率）",
}

# 生成 CSV
print("日期,渠道代碼,渠道名稱,總訂單數,成功訂單,待處理,其他,成功金額(₹),成功率(%)")
for row in data:
    date = row['date']
    pay_type = row['pay_type']
    name = PAY_TYPE_NAMES.get(pay_type, f"未知({pay_type})")
    total = row['total_orders']
    success = row['success_orders']
    pending = row['pending_orders']
    other = row['other_orders']
    amount = row['success_amount']
    rate = row['success_rate']
    print(f"{date},{pay_type},{name},{total},{success},{pending},{other},{amount},{rate}")
