import json, subprocess, os, csv

os.chdir('/Users/sulaxd/clawd/skills/bg666-db/scripts')

def q(sql):
    r = subprocess.run(['python3', 'query.py', '--json', sql], capture_output=True, text=True, timeout=300)
    return json.loads(r.stdout)

# Sheet1
s1 = q("""SELECT sp.login_name AS account, SUM(pro.pay_amount) AS jan_total_deposit
FROM sys_player sp
INNER JOIN player_recharge_order pro ON sp.player_id = pro.player_id AND pro.order_status = 1
  AND pro.create_time >= '2026-01-01' AND pro.create_time < '2026-02-01'
WHERE sp.player_id IN (
  SELECT player_id FROM player_recharge_order WHERE order_status = 1
  GROUP BY player_id HAVING MIN(create_time) >= '2026-01-01' AND MIN(create_time) < '2026-02-01'
) AND sp.last_login_day < '2026-01-23'
GROUP BY sp.login_name ORDER BY jan_total_deposit DESC""")

# Sheet2
s2 = q("""SELECT sp.login_name AS account, SUM(pro.pay_amount) AS total_deposit,
SUM(CASE WHEN pro.create_time >= '2026-01-18' AND pro.create_time < '2026-01-26' THEN pro.pay_amount ELSE 0 END) AS jan18_25_deposit
FROM sys_player sp
INNER JOIN player_recharge_order pro ON sp.player_id = pro.player_id AND pro.order_status = 1
WHERE sp.player_id IN (
  SELECT player_id FROM player_game_statistics
  WHERE statistics_day >= '2026-01-18' AND statistics_day <= '2026-01-25'
  GROUP BY player_id HAVING SUM(bet_amount) >= 1500
) AND sp.last_login_day < '2026-01-26'
GROUP BY sp.login_name ORDER BY total_deposit DESC""")

print(f"Sheet1: {len(s1)} rows")
print(f"Sheet2: {len(s2)} rows")

set1 = {r['account'] for r in s1}
set2 = {r['account'] for r in s2}
overlap = set1 & set2
print(f"Overlap: {len(overlap)} accounts")

outdir = '/Users/sulaxd/clawd/output'
os.makedirs(outdir, exist_ok=True)

with open(f'{outdir}/sheet1_jan_first_deposit_dormant.csv', 'w', newline='') as f:
    w = csv.writer(f)
    w.writerow(['Account', 'Jan Total Deposit'])
    for r in s1:
        w.writerow([r['account'], r['jan_total_deposit']])

with open(f'{outdir}/sheet2_bet1500_dormant.csv', 'w', newline='') as f:
    w = csv.writer(f)
    w.writerow(['Account', 'Total Deposit', 'Jan 18-25 Deposit'])
    for r in s2:
        w.writerow([r['account'], r['total_deposit'], r['jan18_25_deposit']])

with open(f'{outdir}/overlap_both_conditions.csv', 'w', newline='') as f:
    w = csv.writer(f)
    w.writerow(['Account', 'Jan Total Deposit (Sheet1)', 'Total Deposit (Sheet2)', 'Jan 18-25 Deposit (Sheet2)'])
    s2_dict = {r['account']: r for r in s2}
    s1_dict = {r['account']: r for r in s1}
    for acct in sorted(overlap):
        w.writerow([acct, s1_dict[acct]['jan_total_deposit'], s2_dict[acct]['total_deposit'], s2_dict[acct]['jan18_25_deposit']])

print(f"\nFiles saved to {outdir}/")
