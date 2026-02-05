#!/usr/bin/env python3
"""
Red 召回活動分析 v1
用 player_statistics_day 判斷活躍狀態（避免 sys_player 權限問題）
"""
import pymysql
import json
from datetime import date

# DB config
DB = dict(host='bg666-market-readonly.czsks2mguhd5.ap-south-1.rds.amazonaws.com',
          port=3306, user='market', password='hBVoVVm&)aZtW0t6',
          db='ry-cloud', charset='utf8mb4',
          cursorclass=pymysql.cursors.DictCursor, connect_timeout=30, read_timeout=300)

def q(sql):
    with pymysql.connect(**DB) as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
            return cur.fetchall()

print("=" * 60)
print("1. 重建召回名單（Sheet1: 1月首充 + 流失）")
print("=" * 60)

# Sheet1: first deposit in Jan, no activity after 1/22
# Use LEFT JOIN approach instead of NOT IN
sheet1 = q("""
    SELECT fdr.player_id, SUM(psd.recharge_amount) as jan_deposit
    FROM first_deposit_record fdr
    LEFT JOIN player_statistics_day psd 
        ON fdr.player_id = psd.player_id 
        AND psd.statistics_day BETWEEN '2026-01-01' AND '2026-01-31'
    WHERE fdr.create_time BETWEEN '2026-01-01' AND '2026-01-31 23:59:59'
    AND fdr.player_id NOT IN (
        SELECT DISTINCT player_id FROM player_statistics_day 
        WHERE statistics_day >= '2026-01-23' AND statistics_day <= '2026-01-29'
        AND (bet_amount > 0 OR recharge_amount > 0)
    )
    GROUP BY fdr.player_id
""")
sheet1_ids = [r['player_id'] for r in sheet1]
print(f"Sheet1 重建人數: {len(sheet1_ids)}")

print("\n" + "=" * 60)
print("2. 重建召回名單（Sheet2: 活躍後流失）")
print("=" * 60)

sheet2 = q("""
    SELECT psd.player_id, SUM(psd.bet_amount) as bet_total
    FROM player_statistics_day psd
    WHERE psd.statistics_day BETWEEN '2026-01-18' AND '2026-01-25'
    GROUP BY psd.player_id
    HAVING SUM(psd.bet_amount) >= 1500
    AND psd.player_id NOT IN (
        SELECT DISTINCT player_id FROM player_statistics_day
        WHERE statistics_day >= '2026-01-26' AND statistics_day <= '2026-01-29'
        AND (bet_amount > 0 OR recharge_amount > 0)
    )
""")
sheet2_ids = [r['player_id'] for r in sheet2]
print(f"Sheet2 重建人數: {len(sheet2_ids)}")

# Combined
all_ids = list(set(sheet1_ids + sheet2_ids))
overlap = set(sheet1_ids) & set(sheet2_ids)
print(f"\n合併: {len(all_ids)} 人 (交集: {len(overlap)})")

print("\n" + "=" * 60)
print("3. 活動效果分析")
print("=" * 60)

# Build ID list for SQL (in chunks if needed)
def chunked_analysis(ids, label):
    if not ids:
        print(f"{label}: 無數據")
        return
    
    # Use chunks of 5000
    chunk_size = 5000
    results = {'pre': {'deposit': 0, 'depositors': set(), 'active': set()},
               'activity': {'deposit': 0, 'depositors': set(), 'active': set()},
               'jan': {'deposit': 0, 'depositors': set()}}
    
    for i in range(0, len(ids), chunk_size):
        chunk = ids[i:i+chunk_size]
        id_str = ','.join(str(x) for x in chunk)
        
        rows = q(f"""
            SELECT statistics_day, player_id, recharge_amount, bet_amount
            FROM player_statistics_day
            WHERE player_id IN ({id_str})
            AND statistics_day BETWEEN '2026-01-01' AND '2026-02-02'
        """)
        
        for r in rows:
            d = r['statistics_day']
            pid = r['player_id']
            dep = float(r['recharge_amount'] or 0)
            bet = float(r['bet_amount'] or 0)
            
            # Jan total
            if date(2026,1,1) <= d <= date(2026,1,31):
                results['jan']['deposit'] += dep
                if dep > 0: results['jan']['depositors'].add(pid)
            
            # Pre-activity (1/25-1/31)
            if date(2026,1,25) <= d <= date(2026,1,31):
                results['pre']['deposit'] += dep
                if dep > 0: results['pre']['depositors'].add(pid)
                if bet > 0: results['pre']['active'].add(pid)
            
            # Activity period (2/1-2/2)
            if date(2026,2,1) <= d <= date(2026,2,2):
                results['activity']['deposit'] += dep
                if dep > 0: results['activity']['depositors'].add(pid)
                if bet > 0: results['activity']['active'].add(pid)
    
    print(f"\n--- {label} ({len(ids)} 人) ---")
    print(f"1月全月存款: ₹{results['jan']['deposit']:,.0f} ({len(results['jan']['depositors'])} 人存款)")
    print(f"1月日均存款: ₹{results['jan']['deposit']/31:,.0f}")
    print(f"活動前7天(1/25-31): ₹{results['pre']['deposit']:,.0f} ({len(results['pre']['depositors'])} 人存款, {len(results['pre']['active'])} 人活躍)")
    print(f"活動期(2/1-2): ₹{results['activity']['deposit']:,.0f} ({len(results['activity']['depositors'])} 人存款, {len(results['activity']['active'])} 人活躍)")
    
    # Calculate lift
    pre_daily = results['pre']['deposit'] / 7 if results['pre']['deposit'] else 0
    act_daily = results['activity']['deposit'] / 2 if results['activity']['deposit'] else 0
    if pre_daily > 0:
        lift = (act_daily - pre_daily) / pre_daily * 100
        print(f"日均存款變化: ₹{pre_daily:,.0f} → ₹{act_daily:,.0f} ({lift:+.1f}%)")
    
    return results

r1 = chunked_analysis(sheet1_ids, "Sheet1 首充流失組")
r2 = chunked_analysis(sheet2_ids, "Sheet2 活躍流失組")
r_all = chunked_analysis(all_ids, "全部召回目標")

print("\n" + "=" * 60)
print("4. 每日趨勢")
print("=" * 60)

# Daily trend for all recall targets
id_str = ','.join(str(x) for x in all_ids[:10000])
daily = q(f"""
    SELECT statistics_day,
        COUNT(DISTINCT CASE WHEN recharge_amount > 0 THEN player_id END) as depositors,
        SUM(recharge_amount) as total_deposit,
        COUNT(DISTINCT CASE WHEN bet_amount > 0 THEN player_id END) as active_players,
        SUM(bet_amount) as total_bet
    FROM player_statistics_day
    WHERE player_id IN ({id_str})
    AND statistics_day BETWEEN '2026-01-20' AND '2026-02-02'
    GROUP BY statistics_day
    ORDER BY statistics_day
""")

print(f"{'日期':<12} {'存款人數':>8} {'存款金額':>14} {'活躍人數':>8} {'投注金額':>14}")
print("-" * 60)
for r in daily:
    print(f"{str(r['statistics_day']):<12} {r['depositors']:>8} ₹{float(r['total_deposit']):>12,.0f} {r['active_players']:>8} ₹{float(r['total_bet']):>12,.0f}")

print("\n" + "=" * 60)
print("5. 回流玩家詳情（2/1後有存款的）")
print("=" * 60)

returned = q(f"""
    SELECT psd.player_id, 
        SUM(psd.recharge_amount) as feb_deposit,
        SUM(psd.bet_amount) as feb_bet
    FROM player_statistics_day psd
    WHERE psd.player_id IN ({id_str})
    AND psd.statistics_day BETWEEN '2026-02-01' AND '2026-02-02'
    AND psd.recharge_amount > 0
    GROUP BY psd.player_id
    ORDER BY feb_deposit DESC
    LIMIT 20
""")

print(f"2/1-2 有存款的玩家 TOP 20:")
print(f"{'player_id':<15} {'存款':>12} {'投注':>12}")
for r in returned:
    print(f"{r['player_id']:<15} ₹{float(r['feb_deposit']):>10,.0f} ₹{float(r['feb_bet']):>10,.0f}")
