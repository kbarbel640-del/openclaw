import json, subprocess, os
os.chdir('/Users/sulaxd/clawd/skills/bg666-db/scripts')

def q(sql):
    r = subprocess.run(['python3', 'query.py', '--json', sql], capture_output=True, text=True, timeout=60)
    if r.returncode != 0:
        print(f"ERR: {r.stderr}")
        return []
    return json.loads(r.stdout)

# Check if 37133431 is login_name or player_id
print("By login_name:")
print(q("SELECT player_id, login_name FROM sys_player WHERE login_name = '37133431' LIMIT 1"))
print("By player_id:")
print(q("SELECT player_id, login_name FROM sys_player WHERE player_id = 37133431 LIMIT 1"))

# Check first few from original file
import csv
src = '/Users/sulaxd/Documents/albert_first_charge_2026-01-01_to_2026-01-07.csv'
with open(src, encoding='utf-8') as f:
    reader = csv.reader(f)
    header = next(reader)
    row1 = next(reader)
    row2 = next(reader)
    print(f"\nHeader: {header}")
    print(f"Row1: {row1}")
    print(f"Row2: {row2}")
    acct1 = row1[0].strip().replace('\ufeff','')
    print(f"\nAccount1 repr: {repr(acct1)}")
    print("By player_id for acct1:")
    r = q(f"SELECT player_id, login_name FROM sys_player WHERE player_id = {acct1} LIMIT 1")
    print(r)
