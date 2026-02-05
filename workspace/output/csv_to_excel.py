#!/usr/bin/env python3
import pandas as pd
import sys

csv_path = sys.argv[1] if len(sys.argv) > 1 else '/Users/sulaxd/clawd/output/recharge_success_rate_7days.csv'
xlsx_path = csv_path.replace('.csv', '.xlsx')

df = pd.read_csv(csv_path)
df.to_excel(xlsx_path, index=False)
print(f"Excel saved: {xlsx_path}")
