#!/usr/bin/env python3
"""
BG666 站會日報生成器
Usage: python daily_report.py [--send <chat_id>]
"""

import pymysql
import sys
from datetime import datetime, timedelta

DB_CONFIG = {
    'host': 'bg666-market-readonly.czsks2mguhd5.ap-south-1.rds.amazonaws.com',
    'port': 3306,
    'user': 'market',
    'password': 'hBVoVVm&)aZtW0t6',
    'database': 'ry-cloud',
    'connect_timeout': 30,
    'charset': 'utf8mb4'
}

def query(sql):
    conn = pymysql.connect(**DB_CONFIG)
    cursor = conn.cursor(pymysql.cursors.DictCursor)
    cursor.execute(sql)
    rows = cursor.fetchall()
    conn.close()
    return rows

def generate_report():
    today = datetime.now().strftime('%Y-%m-%d')
    
    # 1. 新增會員 (7天)
    members = query("""
        SELECT DATE(create_time) as 日期,
               COUNT(*) as 新增會員,
               SUM(CASE WHEN whether_recharge = 0 THEN 1 ELSE 0 END) as 有充值
        FROM sys_player 
        WHERE create_time >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        GROUP BY DATE(create_time) ORDER BY 日期 DESC
    """)
    
    # 2. 充值 (7天) - 用 pay_date 與小時報一致
    recharge = query("""
        SELECT DATE(pay_date) as 日期,
               COUNT(*) as 筆數,
               ROUND(SUM(pay_amount),0) as 金額
        FROM player_recharge_order 
        WHERE order_status = 1 AND pay_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        GROUP BY DATE(pay_date) ORDER BY 日期 DESC
    """)
    
    # 3. 提現 (7天) - order_status = 3 是已完成，與小時報一致
    withdraw = query("""
        SELECT DATE(create_time) as 日期,
               COUNT(*) as 筆數,
               ROUND(SUM(withdraw_amount),0) as 金額
        FROM player_withdraw_order 
        WHERE order_status = 3 AND create_time >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        GROUP BY DATE(create_time) ORDER BY 日期 DESC
    """)
    
    # 合併數據
    data = {}
    for m in members:
        d = str(m['日期'])
        data[d] = {'新會員': m['新增會員'], '有充值': m['有充值']}
    for r in recharge:
        d = str(r['日期'])
        if d in data:
            data[d]['充值筆數'] = r['筆數']
            data[d]['充值金額'] = int(r['金額'])
    for w in withdraw:
        d = str(w['日期'])
        if d in data:
            data[d]['提現筆數'] = w['筆數']
            data[d]['提現金額'] = int(w['金額'])
    
    # 排序
    dates = sorted(data.keys(), reverse=True)
    
    # 昨日數據
    yesterday = dates[1] if len(dates) > 1 else dates[0]
    yd = data[yesterday]
    conversion = round(yd.get('有充值', 0) / yd['新會員'] * 100, 1) if yd['新會員'] > 0 else 0
    net_flow = yd.get('充值金額', 0) - yd.get('提現金額', 0)
    
    # 趨勢分析
    if len(dates) >= 7:
        first_members = data[dates[-1]]['新會員']
        last_members = data[dates[0]]['新會員']
        trend_pct = round((last_members - first_members) / first_members * 100, 1)
        trend_alert = "⚠️" if trend_pct < -20 else "✅"
    else:
        trend_pct = 0
        trend_alert = "ℹ️"
    
    # 生成報告
    report = f"""📊 BG666 站會日報 | {today}

━━━━━━━━ 昨日總結 ({yesterday[5:]}) ━━━━━━━━
👥 新增會員：{yd['新會員']:,} 人（有充值：{yd.get('有充值', 0):,} 人，轉化率 {conversion}%）
💰 充值：{yd.get('充值筆數', 0):,} 筆 / ₹{yd.get('充值金額', 0):,}
💸 提現：{yd.get('提現筆數', 0):,} 筆 / ₹{yd.get('提現金額', 0):,}
📈 淨流入：₹{net_flow:,}

━━━━━━━━ 7 日趨勢 ━━━━━━━━"""
    
    for i, d in enumerate(dates[:7]):
        dd = data[d]
        mark = "*" if i == 0 else " "
        date_short = d[5:].replace('-', '/')
        net = dd.get('充值金額', 0) - dd.get('提現金額', 0)
        report += f"\n{date_short}{mark}| {dd['新會員']:>5} | ₹{dd.get('充值金額', 0):>10,} | ₹{dd.get('提現金額', 0):>8,} | ₹{net:>10,}"
    
    report += f"""
* 今日截至目前

━━━━━━━━ 關鍵指標 ━━━━━━━━
{trend_alert} 新會員 7 日趨勢：{trend_pct:+.1f}%
✅ 新會員轉化率：{conversion}%
"""
    return report

if __name__ == '__main__':
    print(generate_report())
