import json, subprocess, os
os.chdir('/Users/sulaxd/clawd/skills/bg666-db/scripts')

def q(sql):
    r = subprocess.run(['python3', 'query.py', '--json', sql], capture_output=True, text=True, timeout=300)
    if r.returncode != 0:
        print(f"ERR: {r.stderr}")
        return []
    return json.loads(r.stdout)

# Count original scope: 1/1-1/7 first deposit players
r1 = q("""SELECT COUNT(*) as cnt FROM (
  SELECT player_id FROM player_recharge_order 
  WHERE order_status = 1
  GROUP BY player_id 
  HAVING MIN(create_time) >= '2026-01-01' AND MIN(create_time) < '2026-01-08'
) t""")
print(f"1/1-1/7 first deposit players: {r1[0]['cnt']}")

# Count with sys_player join (what my query does)
r2 = q("""SELECT COUNT(DISTINCT sp.player_id) as cnt
FROM sys_player sp
INNER JOIN player_recharge_order pro ON sp.player_id = pro.player_id AND pro.order_status = 1
WHERE sp.player_id IN (
  SELECT player_id FROM player_recharge_order 
  WHERE order_status = 1
  GROUP BY player_id 
  HAVING MIN(create_time) >= '2026-01-01' AND MIN(create_time) < '2026-01-08'
)""")
print(f"With sys_player join: {r2[0]['cnt']}")
