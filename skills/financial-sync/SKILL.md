---
name: financial-sync
description: Syncs financial data from Teller (banks), Fidelity, and River to Excel for Power BI dashboards. Use when syncing transactions, exporting to Excel, categorizing transactions, or checking sync status.
---

# Financial Sync

## Overview

Unified sync of all financial accounts to an Excel workbook for Power BI consumption.

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Teller    │     │  Fidelity   │     │   River     │
│ (Banks/CC)  │     │ (Brokerage) │     │ (Bitcoin)   │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │   teller_sync.py  │  fidelity_export  │  river_export
       ▼                   ▼                   ▼
┌──────────────────────────────────────────────────────┐
│                   SQLite / CSV                        │
│            ~/projects/teller-sync/transactions.db     │
└───────────────────────┬──────────────────────────────┘
                        │
                        │  teller-to-excel.py
                        ▼
┌──────────────────────────────────────────────────────┐
│           finances.xlsx (~/.openclaw/files/finance/documents)            │
│  ├── fact_Transactions                                │
│  ├── dim_Accounts                                     │
│  ├── dim_Categories                                   │
│  └── import_Log                                       │
└───────────────────────┬──────────────────────────────┘
                        │
                        ▼
                   Power BI
```

## Data Sources

### 1. Teller (Primary - Banks & Credit Cards)

Teller API syncs Chase, Amex, and other banks automatically.

```bash
# Sync transactions from all linked banks
cd ~/projects/teller-sync
python3 teller_sync.py

# Check status
python3 teller_sync.py --summary
```

**Covered accounts**:

- Chase Checking (7549, 7158)
- Chase Savings (8738)
- Chase Freedom (7386)
- Chase Prime Visa (0374)
- Chase Business (1564)
- American Express (1000)

### 2. Fidelity (Automated - Investment Accounts)

Fidelity uses browser automation via `fidelity-api` package.

```bash
# Run Fidelity export (opens browser, handles 2FA)
fidelity-sync

# Or with Python directly
cd ~/projects/fidelity-sync
source .venv/bin/activate
python3 fidelity_export.py
```

**Features**:

- Auto-login with 1Password credentials (Agents vault → Fidelity)
- Waits for 2FA completion in browser
- Selects 90-day history range automatically
- Downloads CSV to `~/.openclaw/files/finance/imports/YYYY-MM-DD/fidelity/`
- Tracks sync state for incremental exports

**Import to Excel**:

```bash
cd ~/projects/teller-sync && source .venv/bin/activate
python3 ~/bin/teller-to-excel.py --fidelity ~/.openclaw/files/finance/imports/$(date +%Y-%m-%d)/fidelity/*.csv
```

State file: `~/.openclaw/files/finance/imports/fidelity-state.json`
Project: `~/projects/fidelity-sync/`

### 3. River (Manual - Bitcoin)

River Financial for Bitcoin purchases/withdrawals.

**Export steps**:

1. Log in at https://river.com
2. Go to Activity
3. Export transactions
4. Save to `~/.openclaw/files/finance/inbox/` (inbox)
5. Move CSVs into `~/.openclaw/files/finance/imports/YYYY-MM-DD/river/` for import

### Financial Document Inbox (Manual Docs)

Drop any downloaded PDFs/CSVs (statements, tax forms, manual exports) into:

`~/.openclaw/files/finance/inbox/`

The daily sync checks this folder and reports if files are waiting to be processed.

## Daily Sync Workflow

### Quick Sync (Teller only)

```bash
# 1. Sync Teller to SQLite
cd ~/projects/teller-sync && python3 teller_sync.py

# 2. Export to Excel
~/bin/teller-to-excel.py
```

### Full Sync (All sources)

```bash
# 1. Sync Teller (banks)
cd ~/projects/teller-sync && source .venv/bin/activate && source .envrc
python3 teller_sync.py

# 2. Export Teller to Excel
python3 ~/bin/teller-to-excel.py

# 3. Sync Fidelity (opens browser for 2FA)
fidelity-sync

# 4. Import Fidelity to Excel
python3 ~/bin/teller-to-excel.py --fidelity ~/.openclaw/files/finance/imports/$(date +%Y-%m-%d)/fidelity/*.csv

# 5. Review uncategorized in Excel
# Filter CategoryID = UNCATEGORIZED
```

Or use the daily sync script:

```bash
~/code/openclaw/skills/financial-sync/scripts/daily_sync.sh
```

## Excel Workbook Structure

Location: `~/.openclaw/files/finance/documents/finances.xlsx`

### fact_Transactions (Main Table)

| Column         | Type   | Description                        |
| -------------- | ------ | ---------------------------------- |
| TxnID          | Text   | Unique ID from source (txn_xxx)    |
| Date           | Date   | Transaction date                   |
| AccountID      | Text   | FK to dim_Accounts                 |
| Description    | Text   | Payee/merchant description         |
| Amount         | Number | Signed amount (negative = expense) |
| CategoryID     | Text   | FK to dim_Categories               |
| EntityOverride | Text   | Personal/Business override         |
| Memo           | Text   | User notes                         |
| ImportBatch    | Text   | TELLER_YYYYMMDD_HHMMSS             |

### dim_Accounts

| AccountID     | Institution | Name      | Type        | Last4 | Entity     |
| ------------- | ----------- | --------- | ----------- | ----- | ---------- |
| CHASE_7549    | Chase       | Checking  | checking    | 7549  | Personal   |
| CHASE_7386    | Chase       | Freedom   | credit_card | 7386  | Personal   |
| CHASE_1564    | Chase       | Business  | checking    | 1564  | Business   |
| FIDELITY_1234 | Fidelity    | Brokerage | investment  | 1234  | Investment |
| RIVER_BTC     | River       | Bitcoin   | crypto      | -     | Investment |

### dim_Categories

| CategoryID      | Name                | Group          | ReportSign |
| --------------- | ------------------- | -------------- | ---------- |
| FOOD_GROCERY    | Groceries           | Food & Dining  | -1         |
| FOOD_RESTAURANT | Restaurants         | Food & Dining  | -1         |
| TRANSPORT_GAS   | Gas & Fuel          | Transportation | -1         |
| INCOME_SALARY   | Salary              | Income         | 1          |
| INVEST_BUY      | Investment Purchase | Investments    | -1         |

## Category Mapping

Teller provides basic categories. Map to our detailed categories:

```python
CATEGORY_MAP = {
    "accommodation": "TRAVEL_HOTEL",
    "dining": "FOOD_RESTAURANT",
    "entertainment": "ENT_HOBBIES",
    "fuel": "TRANSPORT_GAS",
    "groceries": "FOOD_GROCERY",
    "gym": "HEALTH_GYM",
    "shopping": "SHOP_GENERAL",
    "transport": "TRANSPORT_RIDESHARE",
    "utilities": "HOUSING_UTILITIES",
}
```

Uncategorized transactions: Review in Excel, add to category rules.

## Troubleshooting

### Teller token expired

```bash
cd ~/projects/teller-sync
python3 teller_sync.py --enroll
# Re-link the expired bank account
```

### Check sync status

```bash
# Teller summary
cd ~/projects/teller-sync && python3 teller_sync.py --summary

# Check state files
cat ~/.openclaw/files/finance/imports/fidelity-state.json
```

### Excel locked

Close Excel before running `teller-to-excel.py`. OneDrive sync can also lock files.

## Scheduling

Daily sync via crontab:

```bash
# Edit: crontab -e
0 6 * * * cd ~/projects/teller-sync && source .envrc && python teller_sync.py && ~/bin/teller-to-excel.py >> ~/.openclaw/files/finance/imports/sync.log 2>&1
```

## References

- Architecture doc: `~/Desktop/docs/excel-financial-data-architecture-power-bi.md`
- Teller project: `~/projects/teller-sync/`
- Fidelity project: `~/projects/fidelity-sync/`
- Export script: `~/bin/teller-to-excel.py`
- Fidelity CLI: `~/bin/fidelity-sync`
- Status dashboard: `~/code/openclaw/skills/financial-sync/scripts/status.py`
- Daily sync: `~/code/openclaw/skills/financial-sync/scripts/daily_sync.sh`
