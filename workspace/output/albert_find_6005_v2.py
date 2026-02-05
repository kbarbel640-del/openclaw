import json, subprocess, os
os.chdir('/Users/sulaxd/clawd/skills/bg666-db/scripts')

def q(sql):
    r = subprocess.run(['python3', 'query.py', '--json', sql], capture_output=True, text=True, timeout=300)
    if r.returncode != 0:
        print(f"ERR: {r.stderr}")
        return []
    return json.loads(r.stdout)

# H6: first_deposit_record with different date range
h6 = q("""SELECT COUNT(*) as cnt FROM first_deposit_record 
WHERE create_time >= '2025-12-31' AND create_time < '2026-01-08'""")
print(f"H6 (first_deposit_record 12/31-1/7): {h6[0]['cnt']}")

# H7: registered in 1/1-1/7 (sys_player.create_time), no recharge filter
h7 = q("""SELECT COUNT(*) as cnt FROM sys_player 
WHERE create_time >= '2026-01-01' AND create_time < '2026-01-08'""")
print(f"H7 (registered 1/1-1/7, all): {h7[0]['cnt']}")

# H8: first_deposit_record broader range
h8 = q("""SELECT COUNT(*) as cnt FROM first_deposit_record 
WHERE create_time >= '2026-01-01' AND create_time < '2026-01-09'""")
print(f"H8 (first_deposit_record 1/1-1/8): {h8[0]['cnt']}")

# H9: Check what columns first_deposit_record has
h9 = q("SELECT * FROM first_deposit_record LIMIT 1")
print(f"H9 (first_deposit_record columns): {list(h9[0].keys()) if h9 else 'empty'}")

# H10: Maybe it's player_id count from first_deposit_record for the week
h10 = q("""SELECT COUNT(DISTINCT player_id) as cnt FROM first_deposit_record 
WHERE create_time >= '2026-01-01' AND create_time < '2026-01-08'""")
print(f"H10 (first_deposit_record distinct player_id 1/1-1/7): {h10[0]['cnt']}")

# H11: Maybe used recharge_time not create_time in first_deposit_record
cols = list(h9[0].keys()) if h9 else []
print(f"Available columns: {cols}")
for col in cols:
    if 'time' in col.lower() or 'date' in col.lower():
        r = q(f"SELECT COUNT(DISTINCT player_id) as cnt FROM first_deposit_record WHERE {col} >= '2026-01-01' AND {col} < '2026-01-08'")
        print(f"  first_deposit_record by {col}: {r[0]['cnt']}")
