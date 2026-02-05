import json, subprocess, os, csv

os.chdir('/Users/sulaxd/clawd/skills/bg666-db/scripts')

def q(sql):
    r = subprocess.run(['python3', 'query.py', '--json', sql], capture_output=True, text=True, timeout=300)
    if r.returncode != 0:
        raise Exception(f"Query failed: {r.stderr}")
    return json.loads(r.stdout)

# Read original CSV
src = '/Users/sulaxd/clawd/output/albert_first_charge_with_days.csv'
accounts = []
with open(src, encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    orig_cols = reader.fieldnames
    rows = list(reader)
    acct_col = orig_cols[0]
    accounts = [r[acct_col] for r in rows]

print(f"Total accounts: {len(accounts)}")

# Query 1: Latest login info
login_data = {}
batch_size = 500
for i in range(0, len(accounts), batch_size):
    batch = accounts[i:i+batch_size]
    acct_list = ",".join(batch)
    data = q(f"""
        SELECT player_id,
               MAX(create_time) as last_login,
               COUNT(DISTINCT DATE(create_time)) as login_days
        FROM player_logininfor
        WHERE player_id IN ({acct_list})
        GROUP BY player_id
    """)
    for r in data:
        login_data[str(r['player_id'])] = r
    print(f"  Login batch {i//batch_size+1}: {len(data)} results")

print(f"Login matched: {len(login_data)}/{len(accounts)}")

# Query 2: First and last recharge dates
recharge_data = {}
for i in range(0, len(accounts), batch_size):
    batch = accounts[i:i+batch_size]
    acct_list = ",".join(batch)
    data = q(f"""
        SELECT player_id,
               DATE(MIN(create_time)) as first_recharge,
               DATE(MAX(create_time)) as last_recharge,
               DATEDIFF(MAX(create_time), MIN(create_time)) as first_to_last_recharge_days
        FROM player_recharge_order
        WHERE player_id IN ({acct_list}) AND order_status = 1
        GROUP BY player_id
    """)
    for r in data:
        recharge_data[str(r['player_id'])] = r
    print(f"  Recharge batch {i//batch_size+1}: {len(data)} results")

print(f"Recharge matched: {len(recharge_data)}/{len(accounts)}")

# Merge and write new CSV
outfile = '/Users/sulaxd/clawd/output/albert_first_charge_v3.csv'
new_cols = orig_cols.copy()
# Remove old added columns if present
for c in ['最后充值日期', '注册到最后充值天数']:
    if c in new_cols:
        new_cols.remove(c)

# Replace login columns with fresh data, add new columns
new_cols.extend(['最后登入日期_更新', '总登入天数_更新', '第一次充值日期', '最后充值日期', '首充到末充天数'])

with open(outfile, 'w', newline='', encoding='utf-8-sig') as fout:
    writer = csv.DictWriter(fout, fieldnames=new_cols, extrasaction='ignore')
    writer.writeheader()
    
    for row in rows:
        acct = row[acct_col]
        # Fresh login data
        if acct in login_data:
            row['最后登入日期_更新'] = login_data[acct]['last_login']
            row['总登入天数_更新'] = login_data[acct]['login_days']
        else:
            row['最后登入日期_更新'] = ''
            row['总登入天数_更新'] = ''
        
        # Recharge data
        if acct in recharge_data:
            row['第一次充值日期'] = recharge_data[acct]['first_recharge']
            row['最后充值日期'] = recharge_data[acct]['last_recharge']
            row['首充到末充天数'] = recharge_data[acct]['first_to_last_recharge_days']
        else:
            row['第一次充值日期'] = ''
            row['最后充值日期'] = ''
            row['首充到末充天数'] = ''
        
        writer.writerow(row)

print(f"\nSaved to {outfile}")

# Verify a few samples
print("\n=== Sample verification (1/1 registered) ===")
with open(outfile, encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    count = 0
    for r in reader:
        if '2026-01-01' in r.get(orig_cols[9], ''):
            print(f"ID={r[reader.fieldnames[0]]} login={r['最后登入日期_更新'][:10]} days={r['总登入天数_更新']} 1st_charge={r['第一次充值日期']} last_charge={r['最后充值日期']} span={r['首充到末充天数']}")
            count += 1
            if count >= 5: break
