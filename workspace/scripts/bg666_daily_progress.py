#!/usr/bin/env python3
"""
BG666 每日進度日報 - 自動化版本
- 每天早上發送到 666数据日报群
- Pin 新消息，Unpin 舊消息
"""
import subprocess, json, sys, os
from datetime import datetime, date, timedelta
import requests

QUERY = "/Users/sulaxd/clawd/skills/bg666-db/scripts/query.py"
BOT_TOKEN = "8327498414:AAFVEs7Ouf6JESIWGpLnD77GvJkxe9uXp68"  # 無極 bot
CHAT_ID = "-5173465395"  # 666数据日报群
STATE_FILE = "/Users/sulaxd/clawd/output/daily_progress_state.json"

# 日均基準值 (12/1-1/30)
BASELINE = {
    "recharge_amount": 4080000,      # ₹408万
    "recharge_number": 6749,         # 充值人数 (6428 * 1.05)
    "first_recharge_number": 586,    # 首充人数 (558 * 1.05)
    "register_number": 1090,         # 注册人数 (1038 * 1.05)
    "net_income": 538000,            # 充提差 ₹53.8万
}

# 2月目標 (+5%)
FEB_TARGETS = {
    "recharge": 120000000,   # ₹1.2亿
    "register": 30505,
    "first_charge": 16410,
    "net_income": 15810000,  # ₹1,581万
}

def query(sql, timeout=60):
    r = subprocess.run(["python3", QUERY, "--json", sql],
                       capture_output=True, text=True, timeout=timeout)
    if r.returncode != 0:
        return []
    return json.loads(r.stdout)

def format_inr(amount):
    if amount is None:
        return "N/A"
    wan = float(amount) / 10000
    return f"₹{wan:,.1f}万"

def get_status_emoji(pct):
    if pct >= 100:
        return "✅"
    elif pct >= 80:
        return "🟡"
    else:
        return "🔴"

def get_yesterday_data():
    yesterday = (date.today() - timedelta(days=1)).strftime("%Y-%m-%d")
    rows = query(f"""
        SELECT 
            SUM(register_number) as reg,
            SUM(recharge_amount) as recharge,
            SUM(first_recharge_number) as first_charge,
            SUM(recharge_number) as recharge_users,
            SUM(withdraw_amount) as withdraw
        FROM channel_data_statistics
        WHERE statistics_day = '{yesterday}'
    """)
    return rows[0] if rows else {}, yesterday

def get_month_cumulative():
    today = date.today().strftime("%Y-%m-%d")
    rows = query(f"""
        SELECT 
            SUM(register_number) as reg,
            SUM(recharge_amount) as recharge,
            SUM(first_recharge_number) as first_charge,
            SUM(withdraw_amount) as withdraw
        FROM channel_data_statistics
        WHERE statistics_day BETWEEN '2026-02-01' AND '{today}'
    """)
    return rows[0] if rows else {}

def generate_report():
    today = date.today()
    feb_start = date(2026, 2, 1)
    day_num = (today - feb_start).days + 1
    progress_pct = day_num / 28 * 100
    
    # Yesterday data
    yd, yd_date = get_yesterday_data()
    yd_recharge = float(yd.get('recharge') or 0)
    yd_reg = int(yd.get('reg') or 0)
    yd_first = int(yd.get('first_charge') or 0)
    yd_users = int(yd.get('recharge_users') or 0)
    yd_withdraw = float(yd.get('withdraw') or 0)
    yd_net = yd_recharge - yd_withdraw
    
    # Calculate percentages vs daily target
    pct_recharge = yd_recharge / (BASELINE["recharge_amount"] * 1.05) * 100
    pct_users = yd_users / BASELINE["recharge_number"] * 100
    pct_reg = yd_reg / BASELINE["register_number"] * 100
    pct_first = yd_first / BASELINE["first_recharge_number"] * 100
    pct_net = yd_net / (BASELINE["net_income"] * 1.05) * 100
    
    # Month cumulative
    mc = get_month_cumulative()
    mc_recharge = float(mc.get('recharge') or 0)
    mc_reg = int(mc.get('reg') or 0)
    mc_first = int(mc.get('first_charge') or 0)
    mc_withdraw = float(mc.get('withdraw') or 0)
    mc_net = mc_recharge - mc_withdraw
    
    # Month progress percentages
    mpct_recharge = mc_recharge / FEB_TARGETS["recharge"] * 100
    mpct_reg = mc_reg / FEB_TARGETS["register"] * 100
    mpct_first = mc_first / FEB_TARGETS["first_charge"] * 100
    mpct_net = mc_net / FEB_TARGETS["net_income"] * 100
    
    # Format date
    yd_short = datetime.strptime(yd_date, "%Y-%m-%d").strftime("%-m/%-d")
    
    report = f"""📊 BG666 進度日報
📅 {today.strftime('%Y-%m-%d')} | 2月第{day_num}天

▸ 昨日達標（{yd_short}）
💰 充值 {format_inr(yd_recharge)} → {get_status_emoji(pct_recharge)} {pct_recharge:.0f}%
👤 充值人数 {yd_users:,} → {get_status_emoji(pct_users)} {pct_users:.0f}%
👥 注册 {yd_reg:,} → {get_status_emoji(pct_reg)} {pct_reg:.0f}%
🆕 首充 {yd_first:,} → {get_status_emoji(pct_first)} {pct_first:.0f}%
💵 充提差 {format_inr(yd_net)} → {get_status_emoji(pct_net)} {pct_net:.0f}%

▸ 2月累計（進度{progress_pct:.1f}%）
💰 {format_inr(mc_recharge)} / ₹1.2亿 → {mpct_recharge:.1f}%
👥 {mc_reg:,} / 30,505 → {mpct_reg:.1f}%
🆕 {mc_first:,} / 16,410 → {mpct_first:.1f}%
💵 {format_inr(mc_net)} / ₹1,581万 → {mpct_net:.1f}%"""
    
    # Add observation
    observations = []
    if pct_users >= 100:
        observations.append("充值人數超標")
    if pct_reg < 70:
        observations.append("注册落後")
    if pct_first < 70:
        observations.append("首充落後")
    
    if observations:
        report += f"\n\n📝 {', '.join(observations)}"
    
    return report

def send_and_pin(text):
    """Send message, pin it, unpin previous"""
    # Load previous pinned message ID
    prev_msg_id = None
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE) as f:
            state = json.load(f)
            prev_msg_id = state.get("pinned_msg_id")
    
    # Send new message
    resp = requests.post(
        f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage",
        json={"chat_id": CHAT_ID, "text": text}
    )
    result = resp.json()
    
    if not result.get("ok"):
        print(f"Failed to send: {result}")
        return False
    
    new_msg_id = result["result"]["message_id"]
    
    # Pin new message
    requests.post(
        f"https://api.telegram.org/bot{BOT_TOKEN}/pinChatMessage",
        json={"chat_id": CHAT_ID, "message_id": new_msg_id, "disable_notification": True}
    )
    
    # Unpin previous
    if prev_msg_id:
        requests.post(
            f"https://api.telegram.org/bot{BOT_TOKEN}/unpinChatMessage",
            json={"chat_id": CHAT_ID, "message_id": prev_msg_id}
        )
    
    # Save new pinned message ID
    with open(STATE_FILE, "w") as f:
        json.dump({"pinned_msg_id": new_msg_id, "date": str(date.today())}, f)
    
    print(f"✅ Sent and pinned message {new_msg_id}")
    return True

def main():
    print("Generating daily progress report...")
    report = generate_report()
    print(report)
    print("\n" + "="*50)
    
    if "--send" in sys.argv:
        send_and_pin(report)
    else:
        print("(Dry run - use --send to actually send)")

if __name__ == "__main__":
    main()
