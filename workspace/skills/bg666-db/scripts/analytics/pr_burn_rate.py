#!/usr/bin/env python3
"""
PR Burn Rate Analysis - 快速輸錢玩家分群
用法: python3 pr_burn_rate.py [--month 2026-01] [--output /path/to/output.csv]
"""
import subprocess, csv, sys, argparse
from collections import defaultdict

def main():
    parser = argparse.ArgumentParser(description='PR Burn Rate Analysis')
    parser.add_argument('--month', default='2026-01', help='Month to analyze (YYYY-MM)')
    parser.add_argument('--output', default=None, help='Output CSV path')
    parser.add_argument('--query-script', default='/Users/sulaxd/clawd/skills/bg666-db/scripts/query.py')
    args = parser.parse_args()

    year_month = args.month
    parts = year_month.split('-')
    start_date = f"{year_month}-01"
    # Last day of month
    import calendar
    last_day = calendar.monthrange(int(parts[0]), int(parts[1]))[1]
    end_date = f"{year_month}-{last_day}"
    
    output_path = args.output or f"/Users/sulaxd/clawd/output/pr_burn_rate_{year_month.replace('-','')}.csv"

    sql = f"""
    WITH player_month AS (
      SELECT 
        player_id,
        COUNT(DISTINCT statistics_day) AS active_days,
        SUM(recharge_amount) AS total_recharge,
        SUM(profit_amount) AS total_profit,
        SUM(bet_amount) AS total_bet,
        SUM(win_amount) AS total_win,
        MIN(statistics_day) AS first_active,
        MAX(statistics_day) AS last_active
      FROM player_statistics_day
      WHERE statistics_day >= '{start_date}' AND statistics_day <= '{end_date}'
      GROUP BY player_id
      HAVING total_recharge > 0 AND total_profit < 0
    )
    SELECT 
      p.player_id,
      p.active_days,
      ROUND(p.total_recharge, 2) AS total_recharge,
      ROUND(p.total_profit, 2) AS total_profit,
      ROUND(p.total_bet, 2) AS total_bet,
      ROUND(ABS(p.total_profit) / p.active_days, 2) AS burn_per_day,
      ROUND(ABS(p.total_profit) / p.total_recharge * 100, 1) AS loss_pct,
      p.first_active,
      p.last_active,
      sp.vip_level,
      ROUND(sp.recharge_amounts, 2) AS lifetime_recharge,
      ROUND(sp.withdraw_amounts, 2) AS lifetime_withdraw
    FROM player_month p
    JOIN sys_player sp ON sp.player_id = p.player_id
    ORDER BY burn_per_day DESC
    """

    print(f"Querying {start_date} ~ {end_date}...")
    result = subprocess.run(
        ['python3', args.query_script, sql],
        capture_output=True, text=True, timeout=120
    )

    lines = result.stdout.strip().split('\n')
    if len(lines) < 2:
        print(f"Error: {result.stderr}")
        sys.exit(1)

    headers = lines[0].split('\t')
    rows = [line.split('\t') for line in lines[1:]]
    print(f"Total players: {len(rows)}")

    # Calculate percentiles
    burn_idx = headers.index('burn_per_day')
    burns = sorted([float(r[burn_idx]) for r in rows])
    n = len(burns)

    percentiles = {}
    for pct in [25, 50, 75, 85, 95]:
        idx = int(n * pct / 100)
        percentiles[pct] = burns[min(idx, n-1)]
        print(f"PR{pct}: burn_per_day = {percentiles[pct]}")

    # Write CSV with PR group
    headers.append('pr_group')
    with open(output_path, 'w', newline='') as f:
        w = csv.writer(f)
        w.writerow(headers)
        for r in rows:
            b = float(r[burn_idx])
            if b <= percentiles[25]: grp = 'PR0-25_slow'
            elif b <= percentiles[50]: grp = 'PR25-50'
            elif b <= percentiles[75]: grp = 'PR50-75'
            elif b <= percentiles[85]: grp = 'PR75-85'
            elif b <= percentiles[95]: grp = 'PR85-95_fast'
            else: grp = 'PR95+_fastest'
            r.append(grp)
            w.writerow(r)

    print(f"\nCSV saved: {output_path}")

    # Summary
    groups = defaultdict(lambda: {'cnt':0, 'recharge':0, 'profit':0, 'bet':0})
    recharge_idx = headers.index('total_recharge')
    profit_idx = headers.index('total_profit')
    bet_idx = headers.index('total_bet')

    for r in rows:
        g = r[-1]
        groups[g]['cnt'] += 1
        groups[g]['recharge'] += float(r[recharge_idx])
        groups[g]['profit'] += float(r[profit_idx])
        groups[g]['bet'] += float(r[bet_idx])

    print(f"\n{'Group':<20} {'Count':>6} {'Avg Recharge':>14} {'Avg Loss':>12} {'Avg Bet':>14}")
    for g in ['PR0-25_slow','PR25-50','PR50-75','PR75-85','PR85-95_fast','PR95+_fastest']:
        d = groups[g]
        c = d['cnt'] or 1
        print(f"{g:<20} {d['cnt']:>6} {d['recharge']/c:>14.2f} {d['profit']/c:>12.2f} {d['bet']/c:>14.2f}")

if __name__ == '__main__':
    main()
