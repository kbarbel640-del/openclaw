import json, subprocess, os, csv

os.chdir('/Users/sulaxd/clawd/skills/bg666-db/scripts')

def q(sql):
    r = subprocess.run(['python3', 'query.py', '--json', sql], capture_output=True, text=True, timeout=300)
    if r.returncode != 0:
        raise Exception(f"Query failed: {r.stderr}")
    return json.loads(r.stdout)

# Read original Albert CSV to get account list
accounts = []
src = '/Users/sulaxd/Documents/albert_first_charge_2026-01-01_to_2026-01-07.csv'
# Try multiple encodings
for enc in ['utf-8', 'utf-8-sig', 'gb18030', 'big5', 'latin1']:
    try:
        with open(src, encoding=enc) as f:
            reader = csv.DictReader(f)
            headers = reader.fieldnames
            print(f"Encoding: {enc}, Headers: {headers}")
            # Find the account column (first column)
            acct_col = headers[0]
            for row in reader:
                accounts.append(row[acct_col])
        break
    except (UnicodeDecodeError, KeyError) as e:
        print(f"  {enc} failed: {e}")
        accounts = []
        continue

print(f"Original accounts: {len(accounts)}")

# Query in batches of 500
all_results = {}
batch_size = 500
for i in range(0, len(accounts), batch_size):
    batch = accounts[i:i+batch_size]
    acct_list = ",".join(a for a in batch)
    data = q(f"""
        SELECT sp.player_id AS account,
               DATE(sp.create_time) AS register_date,
               DATE(MAX(pro.create_time)) AS last_recharge_date,
               DATEDIFF(MAX(pro.create_time), sp.create_time) AS days_to_last_recharge
        FROM sys_player sp
        INNER JOIN player_recharge_order pro 
          ON sp.player_id = pro.player_id AND pro.order_status = 1
        WHERE sp.player_id IN ({acct_list})
        GROUP BY sp.player_id, sp.create_time
    """)
    for r in data:
        all_results[str(r['account'])] = r
    print(f"  Batch {i//batch_size + 1}: got {len(data)} results (total: {len(all_results)})")

print(f"\nMatched: {len(all_results)} / {len(accounts)}")

# Merge with original CSV
outfile = '/Users/sulaxd/clawd/output/albert_first_charge_with_days.csv'
with open(src, encoding=enc) as fin, open(outfile, 'w', newline='', encoding='utf-8-sig') as fout:
    reader = csv.DictReader(fin)
    fieldnames = reader.fieldnames + ['最后充值日期', '注册到最后充值天数']
    writer = csv.DictWriter(fout, fieldnames=fieldnames)
    writer.writeheader()
    
    missing = 0
    for row in reader:
        acct = row[acct_col]
        if acct in all_results:
            row['最后充值日期'] = all_results[acct]['last_recharge_date']
            row['注册到最后充值天数'] = all_results[acct]['days_to_last_recharge']
        else:
            row['最后充值日期'] = ''
            row['注册到最后充值天数'] = ''
            missing += 1
        writer.writerow(row)

print(f"Missing: {missing}")
print(f"Saved to {outfile}")
