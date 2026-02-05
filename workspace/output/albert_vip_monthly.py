#!/usr/bin/env python3
"""Albert VIP Monthly Report: 11月/12月/1月 VIP1+ 玩家的充值/投注/VIP階級/VIP獎金"""

import pymysql
import csv
import sys

DB_CONFIG = {
    'host': 'bg666-market-readonly.czsks2mguhd5.ap-south-1.rds.amazonaws.com',
    'port': 3306,
    'user': 'market',
    'password': 'hBVoVVm&)aZtW0t6',
    'database': 'ry-cloud',
    'charset': 'utf8mb4',
    'connect_timeout': 30,
    'read_timeout': 120,
}

MONTHS = [
    ('2025-11', '2025-11-01', '2025-12-01'),
    ('2025-12', '2025-12-01', '2026-01-01'),
    ('2026-01', '2026-01-01', '2026-02-01'),
]

def main():
    conn = pymysql.connect(**DB_CONFIG)
    cur = conn.cursor()
    
    # Step 1: Find all players who reached VIP1+ in any month Nov-Jan
    print("Finding VIP1+ players...", file=sys.stderr)
    cur.execute("""
        SELECT DISTINCT player_id 
        FROM player_vip_reward 
        WHERE vip_level >= 1 
        AND create_time >= '2025-11-01' 
        AND create_time < '2026-02-01'
    """)
    player_ids = [r[0] for r in cur.fetchall()]
    print(f"Found {len(player_ids)} players", file=sys.stderr)
    
    if not player_ids:
        print("No players found!")
        return
    
    # Step 2: For each month, get max VIP level reached and total VIP reward
    vip_data = {}  # player_id -> {month: {vip_level, reward_amount}}
    for month_label, start, end in MONTHS:
        print(f"Querying VIP for {month_label}...", file=sys.stderr)
        # Process in chunks
        for i in range(0, len(player_ids), 5000):
            chunk = player_ids[i:i+5000]
            placeholders = ','.join(['%s'] * len(chunk))
            cur.execute(f"""
                SELECT player_id, MAX(vip_level) as max_vip, SUM(reward_amount) as total_reward
                FROM player_vip_reward
                WHERE player_id IN ({placeholders})
                AND create_time >= %s AND create_time < %s
                AND vip_level >= 1
                GROUP BY player_id
            """, chunk + [start, end])
            for pid, max_vip, total_reward in cur.fetchall():
                if pid not in vip_data:
                    vip_data[pid] = {}
                vip_data[pid][month_label] = {
                    'vip_level': max_vip,
                    'reward': float(total_reward) if total_reward else 0
                }
    
    # Step 3: For each month, get recharge and bet amounts
    stats_data = {}  # player_id -> {month: {recharge, bet}}
    for month_label, start, end in MONTHS:
        print(f"Querying stats for {month_label}...", file=sys.stderr)
        for i in range(0, len(player_ids), 5000):
            chunk = player_ids[i:i+5000]
            placeholders = ','.join(['%s'] * len(chunk))
            cur.execute(f"""
                SELECT player_id, 
                       SUM(recharge_amount) as total_recharge,
                       SUM(bet_amount) as total_bet
                FROM player_statistics_day
                WHERE player_id IN ({placeholders})
                AND statistics_day >= %s AND statistics_day < %s
                GROUP BY player_id
            """, chunk + [start, end])
            for pid, recharge, bet in cur.fetchall():
                if pid not in stats_data:
                    stats_data[pid] = {}
                stats_data[pid][month_label] = {
                    'recharge': float(recharge) if recharge else 0,
                    'bet': float(bet) if bet else 0
                }
    
    # Step 4: Output CSV
    outfile = '/tmp/albert_vip_monthly.csv'
    with open(outfile, 'w', newline='', encoding='utf-8-sig') as f:
        w = csv.writer(f)
        # Header row 1
        w.writerow(['', '11月', '', '', '', '12月', '', '', '', '2026/1月', '', '', ''])
        # Header row 2
        w.writerow(['player_id', 
                     '充值', '投注', 'VIP阶级', 'VIP奖金总和',
                     '充值', '投注', 'VIP阶级', 'VIP奖金总和',
                     '充值', '投注', 'VIP阶级', 'VIP奖金总和'])
        
        # All unique player_ids
        all_pids = sorted(set(list(vip_data.keys())))
        
        count = 0
        for pid in all_pids:
            row = [pid]
            for month_label, _, _ in MONTHS:
                vip = vip_data.get(pid, {}).get(month_label, {})
                stats = stats_data.get(pid, {}).get(month_label, {})
                row.extend([
                    stats.get('recharge', ''),
                    stats.get('bet', ''),
                    vip.get('vip_level', ''),
                    vip.get('reward', ''),
                ])
            w.writerow(row)
            count += 1
    
    print(f"Done! {count} players written to {outfile}", file=sys.stderr)
    print(f"Output: {outfile}")
    
    conn.close()

if __name__ == '__main__':
    main()
