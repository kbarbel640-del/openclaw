#!/usr/bin/env python3
"""Quick test: analyze one employee for 2026-01-30"""
import sys
sys.path.insert(0, '/Users/sulaxd/Documents/幣塔/analytics')

import daily_report as dr
from pathlib import Path
import sqlite3

target = "2026-01-30"
out = Path("/Users/sulaxd/Documents/幣塔/data/daily") / target / "screenshots"
out.mkdir(parents=True, exist_ok=True)
conn = sqlite3.connect(str(dr.DB_PATH))

# Just test 兔兔
result = dr.analyze_employee("-5148508655", {"name": "兔兔", "id": "BT-001"}, target, out, conn)
print("RESULT:", result)
conn.commit()
conn.close()
