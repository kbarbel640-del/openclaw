#!/usr/bin/env python3
"""
BG666 每日進度日報
每天早上發送，追蹤目標達成情況
"""
import os
import sys
import json
import pymysql
import requests
from datetime import datetime, date, timedelta
from pathlib import Path
from dotenv import load_dotenv

env_path = Path(__file__).parent / ".env"
load_dotenv(env_path)

CHAT_ID = -5173465395
BOT_TOKEN = "8373560386:AAEqeKPKNAhT0afPcCR4TntbbyhzMOJg3VE"
STATE_FILE = Path(__file__).parent / "progress_state.json"

# 日均目標 (+5%)
TARGETS = {
    "recharge": 4284000,
    "recharge_users": 6749,
    "register": 1090,
    "first_charge": 586,
    "net_income": 565000,
}

FEB_TARGETS = {
    "recharge": 120000000,
    "register": 30505,
    "first_charge": 16410,
    "net_income": 15810000,
}

def get_db():
    return pymysql.connect(
        host=os.getenv("MYSQL_HOST"),
        port=int(os.getenv("MYSQL_PORT", 3306)),
        user=os.getenv("MYSQL_USER"),
        password=os.getenv("MYSQL_PASSWORD"),
        database="ry-cloud",
        charset="utf8mb4"
    )

def query(sql):
    conn = get_db()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cur:
            cur.execute(sql)
            return cur.fetchall()
    finally:
        conn.close()

def fmt_inr(amt):
    return f"₹{amt/10000:,.1f}万"

def status(pct):
    if pct >= 100: return "✅"
    if pct >= 80: return "🟡"
    return "🔴"

def generate_report():
    today = date.today()
    yesterday = today - timedelta(days=1)
    feb_start = date(2026, 2, 1)
    day_num = (today - feb_start).days + 1
    progress = day_num / 28 * 100
    
    # Yesterday data
    yd = query(f"""SELECT SUM(register_number) reg, SUM(recharge_amount) recharge,
        SUM(first_recharge_number) first_charge, SUM(recharge_number) users,
        SUM(withdraw_amount) withdraw FROM channel_data_statistics
        WHERE statistics_day = '{yesterday}' """)
    yd = yd[0] if yd else {}
    
    # Month cumulative
    mc = query(f"""SELECT SUM(register_number) reg, SUM(recharge_amount) recharge,
        SUM(first_recharge_number) first_charge, SUM(withdraw_amount) withdraw
        FROM channel_data_statistics WHERE statistics_day BETWEEN '2026-02-01' AND '{today}' """)
    mc = mc[0] if mc else {}
    
    yd_recharge = float(yd.get("recharge") or 0)
    yd_reg = int(yd.get("reg") or 0)
    yd_first = int(yd.get("first_charge") or 0)
    yd_users = int(yd.get("users") or 0)
    yd_net = yd_recharge - float(yd.get("withdraw") or 0)
    
    mc_recharge = float(mc.get("recharge") or 0)
    mc_reg = int(mc.get("reg") or 0)
    mc_first = int(mc.get("first_charge") or 0)
    mc_net = mc_recharge - float(mc.get("withdraw") or 0)
    
    p1 = yd_recharge/TARGETS["recharge"]*100
    p2 = yd_users/TARGETS["recharge_users"]*100
    p3 = yd_reg/TARGETS["register"]*100
    p4 = yd_first/TARGETS["first_charge"]*100
    p5 = yd_net/TARGETS["net_income"]*100
    
    mp1 = mc_recharge/FEB_TARGETS["recharge"]*100
    mp2 = mc_reg/FEB_TARGETS["register"]*100
    mp3 = mc_first/FEB_TARGETS["first_charge"]*100
    mp4 = mc_net/FEB_TARGETS["net_income"]*100
    
    obs = []
    if p2 >= 100: obs.append("充值人數超標")
    if p3 < 70: obs.append("注册落後")
    if p4 < 70: obs.append("首充落後")
    
    report = f"""📊 BG666 進度日報
📅 {today} | 2月第{day_num}天

▸ 昨日達標（{yesterday.month}/{yesterday.day}）
💰 充值 {fmt_inr(yd_recharge)} → {status(p1)} {p1:.0f}%
👤 充值人数 {yd_users:,} → {status(p2)} {p2:.0f}%
👥 注册 {yd_reg:,} → {status(p3)} {p3:.0f}%
🆕 首充 {yd_first:,} → {status(p4)} {p4:.0f}%
💵 充提差 {fmt_inr(yd_net)} → {status(p5)} {p5:.0f}%

▸ 2月累計（進度{progress:.1f}%）
💰 {fmt_inr(mc_recharge)} / ₹1.2亿 → {mp1:.1f}%
👥 {mc_reg:,} / 30,505 → {mp2:.1f}%
🆕 {mc_first:,} / 16,410 → {mp3:.1f}%
💵 {fmt_inr(mc_net)} / ₹1,581万 → {mp4:.1f}%"""
    
    if obs: report += f"\n\n📝 {', '.join(obs)}"
    return report

def send_and_pin(text):
    prev_id = None
    if STATE_FILE.exists():
        prev_id = json.loads(STATE_FILE.read_text()).get("msg_id")
    
    r = requests.post(f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage",
        json={"chat_id": CHAT_ID, "text": text}).json()
    if not r.get("ok"): return False
    
    msg_id = r["result"]["message_id"]
    requests.post(f"https://api.telegram.org/bot{BOT_TOKEN}/pinChatMessage",
        json={"chat_id": CHAT_ID, "message_id": msg_id, "disable_notification": True})
    
    if prev_id:
        requests.post(f"https://api.telegram.org/bot{BOT_TOKEN}/unpinChatMessage",
            json={"chat_id": CHAT_ID, "message_id": prev_id})
    
    STATE_FILE.write_text(json.dumps({"msg_id": msg_id, "date": str(date.today())}))
    print(f"Sent and pinned: {msg_id}")
    return True

if __name__ == "__main__":
    report = generate_report()
    print(report)
    if "--dry" not in sys.argv:
        send_and_pin(report)
