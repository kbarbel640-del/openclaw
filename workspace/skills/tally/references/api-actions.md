# Tally API Actions Reference

## Quick Reference

| Action | Required Params | Description |
|--------|----------------|-------------|
| `list_companies` | — | List all loaded companies |
| `list_ledgers` | `company` | List ledgers with balances |
| `list_stock_items` | `company` | List stock items with units/closing |
| `list_vouchers` | `company`, opt: `voucher_type`, `from_date`, `to_date` | List vouchers |
| `get_bom` | `company`, opt: `item` | Get Bill of Materials |
| `create_voucher` | `company`, `voucher_type`, `date`, `entries[]` | Create a voucher |
| `create_master` | `company`, `master_xml` | Create/alter ledger, stock item, group |
| `alter_company` | `company`, `settings_xml` | Change company features (F11 settings) |
| `export_report` | `company`, `report`, opt: `from_date`, `to_date` | Export report (Trial Balance, etc.) |
| `export_collection` | `company`, `collection`, `type`, `fields[]`, opt: `fetch[]` | Custom TDL collection export |
| `raw_xml` | `xml` or `xml_file` | Send raw XML to Tally |

## Date Format
All dates: `YYYYMMDD` (e.g., `20260215`)

## Voucher Entry Structure

### Accounting voucher (Journal, Payment, Receipt, Contra)
```json
{
  "action": "create_voucher",
  "company": "PAVISHA POLYMERS",
  "voucher_type": "Journal",
  "date": "20260215",
  "narration": "Test entry",
  "entries": [
    {"tag": "ALLLEDGERENTRIES.LIST", "LEDGERNAME": "Cash", "ISDEEMEDPOSITIVE": "Yes", "AMOUNT": "-100"},
    {"tag": "ALLLEDGERENTRIES.LIST", "LEDGERNAME": "Profit & Loss A/c", "ISDEEMEDPOSITIVE": "No", "AMOUNT": "100"}
  ]
}
```
Note: In Tally, DEBIT amounts are NEGATIVE and CREDIT amounts are POSITIVE.

### Sales voucher
```json
{
  "action": "create_voucher",
  "company": "PAVISHA POLYMERS",
  "voucher_type": "Sales",
  "date": "20260215",
  "narration": "Invoice #99",
  "entries": [
    {"tag": "ALLLEDGERENTRIES.LIST", "LEDGERNAME": "Party Name", "ISDEEMEDPOSITIVE": "Yes", "AMOUNT": "-1000"},
    {"tag": "ALLLEDGERENTRIES.LIST", "LEDGERNAME": "Sales Account", "ISDEEMEDPOSITIVE": "No", "AMOUNT": "1000"},
    {"tag": "ALLINVENTORYENTRIES.LIST", "STOCKITEMNAME": "Product Name", "RATE": "10/pc", "AMOUNT": "1000", "ACTUALQTY": "100 pc", "BILLEDQTY": "100 pc"}
  ]
}
```

### Manufacturing Journal
```json
{
  "action": "create_voucher",
  "company": "PAVISHA POLYMERS",
  "voucher_type": "Manufacturing Journal",
  "date": "20260215",
  "objview": "Multi Consumption Voucher View",
  "narration": "Production batch",
  "entries": [
    {
      "tag": "INVENTORYENTRIESIN.LIST",
      "STOCKITEMNAME": "47gm. 1lt. Pet Bottle",
      "ISDEEMEDPOSITIVE": "Yes",
      "RATE": "0/pc",
      "AMOUNT": "0",
      "ACTUALQTY": " 2016 pc",
      "BILLEDQTY": " 2016 pc",
      "children": [
        {"tag": "BATCHALLOCATIONS.LIST", "GODOWNNAME": "Main Location", "BATCHNAME": "Primary Batch", "AMOUNT": "0", "ACTUALQTY": " 2016 pc", "BILLEDQTY": " 2016 pc"}
      ]
    },
    {
      "tag": "INVENTORYENTRIESOUT.LIST",
      "STOCKITEMNAME": "PET PREFORMS",
      "ISDEEMEDPOSITIVE": "No",
      "RATE": "0/kg",
      "AMOUNT": "0",
      "ACTUALQTY": " 94 kg 752 gm.",
      "BILLEDQTY": " 94 kg 752 gm.",
      "children": [
        {"tag": "BATCHALLOCATIONS.LIST", "GODOWNNAME": "Main Location", "BATCHNAME": "Primary Batch", "AMOUNT": "0", "ACTUALQTY": " 94 kg 752 gm.", "BILLEDQTY": " 94 kg 752 gm."}
      ]
    }
  ]
}
```

### Stock Journal
```json
{
  "action": "create_voucher",
  "company": "PAVISHA POLYMERS",
  "voucher_type": "Stock Journal",
  "date": "20260215",
  "entries": [
    {"tag": "INVENTORYENTRIESIN.LIST", "STOCKITEMNAME": "Item A", "ISDEEMEDPOSITIVE": "Yes", "ACTUALQTY": "10 pc", "RATE": "100/pc", "AMOUNT": "1000"},
    {"tag": "INVENTORYENTRIESOUT.LIST", "STOCKITEMNAME": "Item B", "ISDEEMEDPOSITIVE": "No", "ACTUALQTY": "10 pc", "RATE": "100/pc", "AMOUNT": "1000"}
  ]
}
```

## Common Reports
- `Trial Balance` — Trial Balance
- `Balance Sheet` — Balance Sheet
- `Profit and Loss A/c` — P&L Statement
- `Stock Summary` — Stock Summary
- `Day Book` — Day Book

## Master Creation Examples

### Create Ledger
```json
{
  "action": "create_master",
  "company": "PAVISHA POLYMERS",
  "master_xml": "<LEDGER NAME=\"New Supplier\" ACTION=\"Create\"><NAME>New Supplier</NAME><PARENT>Sundry Creditors</PARENT><ISBILLWISEON>Yes</ISBILLWISEON></LEDGER>"
}
```

### Create Stock Item
```json
{
  "action": "create_master",
  "company": "PAVISHA POLYMERS",
  "master_xml": "<STOCKITEM NAME=\"New Product\" ACTION=\"Create\"><NAME>New Product</NAME><PARENT>Finished Goods</PARENT><BASEUNITS>pc</BASEUNITS></STOCKITEM>"
}
```

## Company Feature Flags (alter_company)
```json
{
  "action": "alter_company",
  "company": "PAVISHA POLYMERS",
  "settings_xml": "<COMPANY NAME=\"PAVISHA POLYMERS\" ACTION=\"Alter\"><USEMANUFJOURNAL>Yes</USEMANUFJOURNAL><ISBILLOFMATERIALSENABLED>Yes</ISBILLOFMATERIALSENABLED></COMPANY>"
}
```

⚠️ WARNING: alter_company may trigger GUI confirmation dialogs that block the API. If request times out, use gui_screenshot to check, then gui_keys to dismiss (ENTER or Y).

## EDU Mode Limitations
- Period is locked to current financial year in GUI
- API can set SVFROMDATE/SVTODATE for queries, but vouchers outside GUI period may silently fail
- Use today's date for voucher creation to avoid issues
