import json, subprocess, os, csv

os.chdir('/Users/sulaxd/clawd/skills/bg666-db/scripts')

def q(sql):
    r = subprocess.run(['python3', 'query.py', '--json', sql], capture_output=True, text=True, timeout=300)
    if r.returncode != 0:
        raise Exception(f"Query failed: {r.stderr}")
    return json.loads(r.stdout)

# Read original 6005 player_ids
src = '/Users/sulaxd/Documents/albert_first_charge_2026-01-01_to_2026-01-07.csv'
original_ids = set()
with open(src, encoding='utf-8') as f:
    reader = csv.reader(f)
    next(reader)  # skip header
    for row in reader:
        original_ids.add(row[0].strip().replace('\ufeff',''))

print(f"Original CSV: {len(original_ids)} player_ids")

# Get current 3835 set
current_ids = set()
batch_size = 500
all_ids = list(original_ids)
for i in range(0, len(all_ids), batch_size):
    batch = all_ids[i:i+batch_size]
    id_list = ",".join(batch)
    data = q(f"""
        SELECT player_id FROM (
            SELECT player_id, MIN(create_time) as first_recharge
            FROM player_recharge_order 
            WHERE order_status = 1 AND player_id IN ({id_list})
            GROUP BY player_id
            HAVING first_recharge >= '2026-01-01' AND first_recharge < '2026-01-08'
        ) t
    """)
    for r in data:
        current_ids.add(str(r['player_id']))
    print(f"  Batch {i//batch_size+1}: checked {len(batch)}, qualified {len(data)}")

print(f"\nCurrently qualify as 1/1-1/7 first deposit: {len(current_ids)}")
print(f"No longer qualify: {len(original_ids - current_ids)}")

# Investigate the difference
diff_ids = original_ids - current_ids
diff_sample = list(diff_ids)[:20]
print(f"\nSample of {len(diff_sample)} no-longer-qualifying players:")

for pid in diff_sample:
    data = q(f"""
        SELECT player_id, 
               MIN(create_time) as first_recharge,
               MAX(create_time) as last_recharge,
               COUNT(*) as recharge_count
        FROM player_recharge_order 
        WHERE order_status = 1 AND player_id = {pid}
        GROUP BY player_id
    """)
    if data:
        r = data[0]
        print(f"  {pid}: first={r['first_recharge']}, last={r['last_recharge']}, count={r['recharge_count']}")
    else:
        print(f"  {pid}: NO recharge records found!")
