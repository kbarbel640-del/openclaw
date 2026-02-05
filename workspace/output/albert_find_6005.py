import json, subprocess, os
os.chdir('/Users/sulaxd/clawd/skills/bg666-db/scripts')

def q(sql):
    r = subprocess.run(['python3', 'query.py', '--json', sql], capture_output=True, text=True, timeout=300)
    if r.returncode != 0:
        print(f"ERR: {r.stderr}")
        return []
    return json.loads(r.stdout)

# Hypothesis 1: Original SQL only looked at Jan orders (not full history)
# This would make players whose first Jan order is in 1/1-1/7 look like "first deposit"
h1 = q("""SELECT COUNT(DISTINCT player_id) as cnt FROM (
    SELECT player_id, MIN(create_time) as first_jan_recharge
    FROM player_recharge_order 
    WHERE order_status = 1 
      AND create_time >= '2026-01-01' AND create_time < '2026-02-01'
    GROUP BY player_id 
    HAVING first_jan_recharge >= '2026-01-01' AND first_jan_recharge < '2026-01-08'
) t""")
print(f"H1 (first Jan recharge in 1/1-1/7, ignoring history): {h1[0]['cnt']}")

# Hypothesis 2: Used first_deposit_record table
h2 = q("""SELECT COUNT(*) as cnt FROM first_deposit_record 
WHERE create_time >= '2026-01-01' AND create_time < '2026-01-08'""")
print(f"H2 (first_deposit_record table): {h2[0]['cnt']}")

# Hypothesis 3: Full history, correct (current result)
h3 = q("""SELECT COUNT(DISTINCT player_id) as cnt FROM (
    SELECT player_id
    FROM player_recharge_order 
    WHERE order_status = 1
    GROUP BY player_id 
    HAVING MIN(create_time) >= '2026-01-01' AND MIN(create_time) < '2026-01-08'
) t""")
print(f"H3 (true first deposit ever in 1/1-1/7): {h3[0]['cnt']}")

# Hypothesis 4: No order_status filter
h4 = q("""SELECT COUNT(DISTINCT player_id) as cnt FROM (
    SELECT player_id
    FROM player_recharge_order
    GROUP BY player_id 
    HAVING MIN(create_time) >= '2026-01-01' AND MIN(create_time) < '2026-01-08'
) t""")
print(f"H4 (no order_status filter): {h4[0]['cnt']}")

# Hypothesis 5: Used sys_player.create_time as register date + had Jan recharge
h5 = q("""SELECT COUNT(DISTINCT sp.player_id) as cnt
FROM sys_player sp
INNER JOIN player_recharge_order pro ON sp.player_id = pro.player_id AND pro.order_status = 1
WHERE sp.create_time >= '2026-01-01' AND sp.create_time < '2026-01-08'""")
print(f"H5 (registered 1/1-1/7 + has recharge): {h5[0]['cnt']}")
