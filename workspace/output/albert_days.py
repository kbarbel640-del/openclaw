import json, subprocess, os, csv

os.chdir('/Users/sulaxd/clawd/skills/bg666-db/scripts')

def q(sql):
    r = subprocess.run(['python3', 'query.py', '--json', sql], capture_output=True, text=True, timeout=300)
    if r.returncode != 0:
        print(f"STDERR: {r.stderr}")
        raise Exception(f"Query failed: {r.stderr}")
    return json.loads(r.stdout)

# Albert's request: 1/1-1/7 first deposit players + days between registration and last recharge
data = q("""
SELECT 
  sp.login_name AS account,
  DATE(sp.create_time) AS register_date,
  DATE(MAX(pro.create_time)) AS last_recharge_date,
  DATEDIFF(MAX(pro.create_time), sp.create_time) AS days_to_last_recharge,
  COUNT(*) AS recharge_count,
  SUM(pro.pay_amount) AS total_deposit
FROM sys_player sp
INNER JOIN player_recharge_order pro 
  ON sp.player_id = pro.player_id AND pro.order_status = 1
WHERE sp.player_id IN (
  SELECT player_id FROM player_recharge_order 
  WHERE order_status = 1
  GROUP BY player_id 
  HAVING MIN(create_time) >= '2026-01-01' AND MIN(create_time) < '2026-01-08'
)
GROUP BY sp.login_name, sp.create_time
ORDER BY days_to_last_recharge DESC
""")

print(f"Total: {len(data)} players")

# Sample top 5
for r in data[:5]:
    print(f"  {r['account']}: registered {r['register_date']}, last recharge {r['last_recharge_date']}, gap {r['days_to_last_recharge']} days")

outdir = '/Users/sulaxd/clawd/output'
outfile = f'{outdir}/albert_first_charge_with_days.csv'

with open(outfile, 'w', newline='') as f:
    w = csv.writer(f)
    w.writerow(['Account', 'Register Date', 'Last Recharge Date', 'Days to Last Recharge', 'Recharge Count', 'Total Deposit'])
    for r in data:
        w.writerow([r['account'], r['register_date'], r['last_recharge_date'], r['days_to_last_recharge'], r['recharge_count'], r['total_deposit']])

print(f"Saved to {outfile}")
