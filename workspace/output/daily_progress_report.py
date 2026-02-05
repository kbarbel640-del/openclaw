#!/usr/bin/env python3
"""
BG666 每日進度日報
基準期：2025/12/01 - 2026/01/30 (61天)
增長假設：每月複利 5%
"""
import subprocess, json, sys
from datetime import datetime, date

QUERY = "/Users/sulaxd/clawd/skills/bg666-db/scripts/query.py"

# 日均基準值
BASELINE = {
    "recharge_amount": 4080000,      # ₹408万
    "recharge_number": 6428,         # 充值人数
    "first_recharge_number": 558,    # 首充人数
    "register_number": 1038,         # 注册人数
    "active_number": 40296,          # 活跃人数
    "withdraw_amount": 3540000,      # ₹354万
    "net_income": 538000,            # 充提差 ₹53.8万
    "bet_amount": 33930000,          # 总投注 ₹3,393万
}

# 2月週目標（累計）
FEB_WEEKLY_TARGETS = {
    "2026-02-01": {"progress": 0.036, "recharge": 4290000, "register": 1089, "first_charge": 586, "net": 560000},
    "2026-02-08": {"progress": 0.286, "recharge": 34300000, "register": 8716, "first_charge": 4689, "net": 4520000},
    "2026-02-15": {"progress": 0.536, "recharge": 64300000, "register": 16342, "first_charge": 8791, "net": 8470000},
    "2026-02-22": {"progress": 0.786, "recharge": 94310000, "register": 23968, "first_charge": 12894, "net": 12430000},
    "2026-02-28": {"progress": 1.0, "recharge": 120000000, "register": 30505, "first_charge": 16410, "net": 15810000},
}

def query(sql, timeout=60):
    r = subprocess.run(["python3", QUERY, "--json", sql],
                       capture_output=True, text=True, timeout=timeout)
    if r.returncode != 0:
        print(f"Query error: {r.stderr[:200]}", file=sys.stderr)
        return []
    return json.loads(r.stdout)

def get_feb_cumulative(end_date):
    """Get cumulative data from 2/1 to end_date"""
    rows = query(f"""
        SELECT 
            SUM(register_number) as total_register,
            SUM(active_number) as total_active,
            SUM(recharge_amount) as total_recharge,
            SUM(recharge_number) as total_recharge_users,
            SUM(first_recharge_number) as total_first_charge,
            SUM(withdraw_amount) as total_withdraw
        FROM channel_data_statistics
        WHERE statistics_day BETWEEN '2026-02-01' AND '{end_date}'
    """)
    if rows:
        return rows[0]
    return {}

def get_today_data(today):
    """Get today's data"""
    rows = query(f"""
        SELECT 
            SUM(register_number) as register,
            SUM(active_number) as active,
            SUM(recharge_amount) as recharge,
            SUM(recharge_number) as recharge_users,
            SUM(first_recharge_number) as first_charge,
            SUM(withdraw_amount) as withdraw
        FROM channel_data_statistics
        WHERE statistics_day = '{today}'
    """)
    if rows:
        return rows[0]
    return {}

def format_inr(amount):
    """Format as INR with 万 unit"""
    if amount is None:
        return "N/A"
    wan = float(amount) / 10000
    return f"₹{wan:,.1f}万"

def format_pct(actual, target):
    """Format percentage with color indicator"""
    if target == 0 or actual is None:
        return "N/A"
    pct = float(actual) / target * 100
    if pct >= 100:
        return f"✅ {pct:.1f}%"
    elif pct >= 80:
        return f"🟡 {pct:.1f}%"
    else:
        return f"🔴 {pct:.1f}%"

def main():
    today = date.today().strftime("%Y-%m-%d")
    
    # Calculate days into February
    feb_start = date(2026, 2, 1)
    today_date = date.today()
    days_in_feb = (today_date - feb_start).days + 1
    
    # Expected progress (linear for simplicity)
    expected_progress = days_in_feb / 28  # Feb has 28 days
    
    # Get data
    print(f"📊 拉取 {today} 數據中...")
    today_data = get_today_data(today)
    cumulative = get_feb_cumulative(today)
    
    # Calculate targets for today (pro-rated)
    daily_target_recharge = BASELINE["recharge_amount"] * 1.05  # 5% growth
    daily_target_register = BASELINE["register_number"] * 1.05
    daily_target_first = BASELINE["first_recharge_number"] * 1.05
    
    # Feb cumulative target (pro-rated)
    feb_target_recharge = 120000000 * expected_progress  # ₹1.2亿 total
    feb_target_register = 30505 * expected_progress
    feb_target_first = 16410 * expected_progress
    feb_target_net = 15810000 * expected_progress
    
    # Calculate actuals
    recharge = float(cumulative.get('total_recharge') or 0)
    register = int(cumulative.get('total_register') or 0)
    first_charge = int(cumulative.get('total_first_charge') or 0)
    withdraw = float(cumulative.get('total_withdraw') or 0)
    net_income = recharge - withdraw
    
    today_recharge = float(today_data.get('recharge') or 0)
    today_register = int(today_data.get('register') or 0)
    today_first = int(today_data.get('first_charge') or 0)
    
    # Build report
    report = f"""📊 **BG666 每日進度日報**
📅 {today} | 2月第 {days_in_feb} 天 | 進度 {expected_progress*100:.1f}%

━━━ 今日數據 ━━━
💰 充值: {format_inr(today_recharge)} (目標 {format_inr(daily_target_recharge)})
👥 注册: {int(today_register):,} (目標 {int(daily_target_register):,})
🆕 首充: {int(today_first):,} (目標 {int(daily_target_first):,})

━━━ 2月累計 vs 目標 ━━━
💰 充值累計: {format_inr(recharge)}
   目標: {format_inr(feb_target_recharge)} {format_pct(recharge, feb_target_recharge)}

👥 注册累計: {register:,}
   目標: {int(feb_target_register):,} {format_pct(register, feb_target_register)}

🆕 首充累計: {first_charge:,}
   目標: {int(feb_target_first):,} {format_pct(first_charge, feb_target_first)}

💵 充提差累計: {format_inr(net_income)}
   目標: {format_inr(feb_target_net)} {format_pct(net_income, feb_target_net)}
"""
    
    print(report)
    
    # Save to file
    with open("/Users/sulaxd/clawd/output/daily_progress.txt", "w") as f:
        f.write(report)
    
    print(f"\n✅ 報告已保存")
    return report

if __name__ == "__main__":
    main()
