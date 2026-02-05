#!/usr/bin/env python3
"""
Red 召回活動分析 v2 - 分步查詢，避免慢 subquery
"""
import pymysql
from datetime import date

DB = dict(host='bg666-market-readonly.czsks2mguhd5.ap-south-1.rds.amazonaws.com',
          port=3306, user='market', password='hBVoVVm&)aZtW0t6',
          db='ry-cloud', charset='utf8mb4',
          cursorclass=pymysql.cursors.DictCursor, connect_timeout=30, read_timeout=300)

conn = pymysql.connect(**DB)
cur = conn.cursor()

def q(sql):
    cur.execute(sql)
    return cur.fetchall()

# Step 1: Get all Jan first deposit player IDs
print("Step 1: 取得1月首充玩家...")
jan_fdr = q("SELECT DISTINCT player_id FROM first_deposit_record WHERE create_time BETWEEN '2026-01-01' AND '2026-01-31 23:59:59'")
jan_ids = set(r['player_id'] for r in jan_fdr)
print(f"  1月首充: {len(jan_ids)} 人")

# Step 2: Get players active after 1/22 (to exclude)
print("Step 2: 取得1/23後仍活躍的玩家...")
active_after = q("""
    SELECT DISTINCT player_id FROM player_statistics_day 
    WHERE statistics_day BETWEEN '2026-01-23' AND '2026-01-29'
    AND (bet_amount > 0 OR recharge_amount > 0)
""")
active_ids = set(r['player_id'] for r in active_after)
print(f"  1/23-29 活躍: {len(active_ids)} 人")

# Sheet1 = Jan first deposit - active after 1/22
sheet1_ids = jan_ids - active_ids
print(f"  Sheet1 (首充流失): {len(sheet1_ids)} 人")

# Step 3: Get Sheet2 - active betters 1/18-25
print("Step 3: 取得1/18-25活躍玩家...")
active_period = q("""
    SELECT player_id, SUM(bet_amount) as total_bet
    FROM player_statistics_day 
    WHERE statistics_day BETWEEN '2026-01-18' AND '2026-01-25'
    GROUP BY player_id
    HAVING SUM(bet_amount) >= 1500
""")
active_betters = set(r['player_id'] for r in active_period)
print(f"  1/18-25 投注>=1500: {len(active_betters)} 人")

# Get players active after 1/25
active_after_25 = q("""
    SELECT DISTINCT player_id FROM player_statistics_day
    WHERE statistics_day BETWEEN '2026-01-26' AND '2026-01-29'
    AND (bet_amount > 0 OR recharge_amount > 0)
""")
active_26_ids = set(r['player_id'] for r in active_after_25)

sheet2_ids = active_betters - active_26_ids
print(f"  Sheet2 (活躍流失): {len(sheet2_ids)} 人")

overlap = sheet1_ids & sheet2_ids
all_ids = sheet1_ids | sheet2_ids
print(f"\n全部召回目標: {len(all_ids)} 人 (交集: {len(overlap)})")

# Step 4: Analyze deposit behavior
print("\n" + "=" * 60)
print("4. 存款行為分析")
print("=" * 60)

def analyze_group(ids, label):
    if not ids:
        return
    id_list = list(ids)
    
    # Process in chunks
    all_rows = []
    chunk_size = 3000
    for i in range(0, len(id_list), chunk_size):
        chunk = id_list[i:i+chunk_size]
        id_str = ','.join(str(x) for x in chunk)
        rows = q(f"""
            SELECT statistics_day, player_id, recharge_amount, bet_amount, withdraw_amount
            FROM player_statistics_day
            WHERE player_id IN ({id_str})
            AND statistics_day BETWEEN '2026-01-01' AND '2026-02-02'
        """)
        all_rows.extend(rows)
        if (i // chunk_size) % 3 == 0:
            print(f"  ... {label} 進度 {min(i+chunk_size, len(id_list))}/{len(id_list)}")
    
    # Aggregate
    periods = {
        'jan_full': (date(2026,1,1), date(2026,1,31)),
        'jan_w1': (date(2026,1,1), date(2026,1,7)),
        'jan_w2': (date(2026,1,8), date(2026,1,14)),
        'jan_w3': (date(2026,1,15), date(2026,1,21)),
        'jan_w4': (date(2026,1,22), date(2026,1,31)),
        'pre_7d': (date(2026,1,25), date(2026,1,31)),
        'activity': (date(2026,2,1), date(2026,2,2)),
    }
    
    stats = {}
    daily_data = {}
    
    for p_name, (start, end) in periods.items():
        stats[p_name] = {'deposit': 0, 'depositors': set(), 'bet': 0, 'active': set(), 'withdraw': 0}
    
    for r in all_rows:
        d = r['statistics_day']
        pid = r['player_id']
        dep = float(r['recharge_amount'] or 0)
        bet = float(r['bet_amount'] or 0)
        wd = float(r['withdraw_amount'] or 0)
        
        # Daily
        if d not in daily_data:
            daily_data[d] = {'deposit': 0, 'depositors': set(), 'active': set(), 'bet': 0}
        daily_data[d]['deposit'] += dep
        daily_data[d]['bet'] += bet
        if dep > 0: daily_data[d]['depositors'].add(pid)
        if bet > 0: daily_data[d]['active'].add(pid)
        
        for p_name, (start, end) in periods.items():
            if start <= d <= end:
                stats[p_name]['deposit'] += dep
                stats[p_name]['bet'] += bet
                stats[p_name]['withdraw'] += wd
                if dep > 0: stats[p_name]['depositors'].add(pid)
                if bet > 0: stats[p_name]['active'].add(pid)
    
    print(f"\n{'='*60}")
    print(f"【{label}】({len(ids)} 人)")
    print(f"{'='*60}")
    
    print(f"\n📊 時段對比:")
    print(f"{'時段':<20} {'存款金額':>14} {'存款人數':>8} {'人均存款':>12} {'活躍人數':>8}")
    print("-" * 66)
    
    for p_name, p_label in [('jan_full','1月全月'), ('jan_w1','1月W1(1-7)'), 
                             ('jan_w2','1月W2(8-14)'), ('jan_w3','1月W3(15-21)'),
                             ('jan_w4','1月W4(22-31)'), ('pre_7d','活動前7天(1/25-31)'),
                             ('activity','活動期(2/1-2)')]:
        s = stats[p_name]
        n_dep = len(s['depositors'])
        avg = s['deposit'] / n_dep if n_dep > 0 else 0
        print(f"{p_label:<20} ₹{s['deposit']:>12,.0f} {n_dep:>8} ₹{avg:>10,.0f} {len(s['active']):>8}")
    
    # Daily trend
    print(f"\n📈 每日趨勢 (1/20-2/2):")
    print(f"{'日期':<12} {'存款人數':>8} {'存款金額':>14} {'活躍人數':>8} {'投注金額':>14}")
    print("-" * 60)
    for d in sorted(daily_data.keys()):
        if d >= date(2026,1,20):
            dd = daily_data[d]
            print(f"{str(d):<12} {len(dd['depositors']):>8} ₹{dd['deposit']:>12,.0f} {len(dd['active']):>8} ₹{dd['bet']:>12,.0f}")
    
    # Lift calculation
    pre_daily = stats['pre_7d']['deposit'] / 7
    act_daily = stats['activity']['deposit'] / 2
    if pre_daily > 0:
        lift = (act_daily - pre_daily) / pre_daily * 100
        print(f"\n🎯 日均存款: 活動前 ₹{pre_daily:,.0f} → 活動後 ₹{act_daily:,.0f} ({lift:+.1f}%)")
    
    pre_dep_daily = len(stats['pre_7d']['depositors']) / 7
    act_dep_daily = len(stats['activity']['depositors']) / 2
    if pre_dep_daily > 0:
        dep_lift = (act_dep_daily - pre_dep_daily) / pre_dep_daily * 100
        print(f"🎯 日均存款人數: 活動前 {pre_dep_daily:.0f} → 活動後 {act_dep_daily:.0f} ({dep_lift:+.1f}%)")
    
    return stats, daily_data

r1 = analyze_group(sheet1_ids, "Sheet1 首充流失組")
r2 = analyze_group(sheet2_ids, "Sheet2 活躍流失組")
r_all = analyze_group(all_ids, "全部召回目標")

conn.close()
print("\n✅ 分析完成")
