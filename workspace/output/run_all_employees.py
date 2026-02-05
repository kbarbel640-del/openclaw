#!/usr/bin/env python3
"""Run daily_report analysis per employee sequentially"""
import sys, json, time
sys.path.insert(0, '/Users/sulaxd/Documents/幣塔/analytics')

import daily_report as dr
from pathlib import Path
import sqlite3

target = "2026-01-30"
out = Path("/Users/sulaxd/Documents/幣塔/data/daily") / target / "screenshots"
out.mkdir(parents=True, exist_ok=True)
conn = sqlite3.connect(str(dr.DB_PATH), timeout=30)

results = {}
for chat_id, emp in dr.EMPLOYEES.items():
    print(f"\n=== {emp['name']} ({chat_id}) ===", flush=True)
    try:
        r = dr.analyze_employee(chat_id, emp, target, out, conn)
        results[chat_id] = r
        conn.commit()
        print(f"  -> {r['status']} screenshots={r.get('screenshots',0)} completed={r.get('completed',0)} amt={r.get('total_amount',0)}", flush=True)
    except Exception as e:
        print(f"  ERROR: {e}", flush=True)
        results[chat_id] = {"name": emp["name"], "id": emp["id"], "status": "錯誤", "error": str(e)}

# Generate and send report
print("\n=== REPORT ===", flush=True)
report = dr.generate_report(results, target)
print(report, flush=True)

# Save JSON
json_path = out.parent / "analysis.json"
with open(json_path, 'w', encoding='utf-8') as f:
    json.dump({"date": target, "employees": results}, f, ensure_ascii=False, indent=2)
print(f"\nJSON saved: {json_path}", flush=True)

# Send
dr.send_report(report)
conn.close()
