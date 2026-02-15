# Tally Prime EDU — API Notes & Limitations

> Living document. Update as we discover more.

## EDU Mode Restrictions (Confirmed)

### 1. Voucher Dates — 1st or 2nd of Month ONLY
- EDU mode **only allows voucher creation via API on the 1st, 2nd, or last day of each month**
- Specifically: 1st and 2nd always work; 3rd through 30th always fail; 31st works (last day)
- Any blocked date gives misleading error: `"Voucher date is missing for: 'Stock Journal' voucher. Verify the data, resolve errors (if any) and retry Split."`
- Tested exhaustively for July 2025: days 1,2,31 = OK; days 3-30 = FAIL
- Tested Sep: 1,2 = OK; 3,5,10,15 = FAIL
- **Multiple vouchers on the same date work fine** (tested 5 on 1-Sep)
- **Workaround:** Date all invoices from a month on the 1st of that month; narration tracks real date

### 2. Current Date Matters
- Voucher date must be **on or before** Tally's Current Date (shown top-right in GUI)
- Change Current Date via F2 in Tally GUI before creating future-dated vouchers
- Current Date is NOT the system date — it's Tally's internal working date

### 3. Period Must Cover the Date
- Current Period (shown top-left) must include the voucher date
- Period: 1-Apr-25 to 31-Mar-26 covers the financial year

### 4. API Only Works at Gateway Screen
- Tally XML API (`localhost:9000`) only responds when GUI is at the **Gateway of Tally** main screen
- If Tally is inside any sub-menu, company, or showing a dialog — API hangs/times out
- Company alter requests can trigger GUI confirmation dialogs that block the API response

## XML API Format — What Works

### Endpoint
- `http://localhost:9000` — POST XML, Content-Type: `text/xml; charset=utf-8`
- Python `urllib.request` works reliably; PowerShell `Invoke-WebRequest` also works
- Use `$` variable names in PowerShell here-strings (`@' ... '@`) to avoid interpolation issues

### Company List Query
```xml
<ENVELOPE>
<HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>CompanyList</ID></HEADER>
<BODY><DESC>
<STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES>
<TDL><TDLMESSAGE>
<COLLECTION NAME="CompanyList" ISMODIFY="No"><TYPE>Company</TYPE><FETCH>NAME</FETCH></COLLECTION>
</TDLMESSAGE></TDL>
</DESC></BODY>
</ENVELOPE>
```

### Manufacturing Journal — Working Template
Key requirements:
- `VCHTYPE="Manufacturing Journal"` + `OBJVIEW="Multi Consumption Voucher View"`
- Must include BOTH `ALLINVENTORYENTRIES.LIST` AND `INVENTORYENTRIESIN/OUT.LIST` (duplicated)
- `FORJOBCOSTING=Yes`, `VCHPROPISSTKJRNL=Yes`, `ISNEGISPOSSET=Yes`, `ISDEEMEDPOSITIVE=Yes`
- `DESTINATIONGODOWN`, `VOUCHERDESTINATIONGODOWN`, `VOUCHERSOURCEGODOWN` = "Main Location"
- Output items (finished goods): `ISDEEMEDPOSITIVE=Yes` in both ALLINVENTORY and ENTRIESIN
- Input items (raw materials): `ISDEEMEDPOSITIVE=No` in both ALLINVENTORY and ENTRIESOUT
- `BATCHALLOCATIONS.LIST` with `BATCHNAME=Primary Batch` required for all entries
- `GODOWNNAME=Main Location` in BATCHALLOCATIONS for INVENTORYENTRIESIN/OUT (not needed in ALLINVENTORY for output items)
- Amounts can be 0 (Tally calculates from rates if needed)
- Quantities use Tally format: `" 127 kg 152 gm."` (leading space, units inline)

### Company Feature Alter
```xml
<COMPANY NAME="PAVISHA POLYMERS" ACTION="Alter">
<NAME.LIST><NAME>PAVISHA POLYMERS</NAME></NAME.LIST>
<USEMANUFJOURNAL>Yes</USEMANUFJOURNAL>
<ISBILLOFMATERIALSENABLED>Yes</ISBILLOFMATERIALSENABLED>
</COMPANY>
```

### BOM Data — Correct Fetch Field
- **WRONG:** `COMPONENTLIST.LIST` — always returns empty
- **RIGHT:** `MULTICOMPONENTLIST.LIST` — contains actual BOM data
- Components inside: `MULTICOMPONENTITEMLIST.LIST` with `STOCKITEMNAME`, `ACTUALQTY`, `NATUREOFITEM`

## PAVISHA POLYMERS — Company Details
- **Period:** 1-Apr-25 to 31-Mar-26
- **Finished Products:** 95 items in "Finish Products" stock group
- **Raw Materials:** 18 items in "RAW MATERIALS" group (PET PREFORMS is primary)
- **BOMs:** 81 items have BOM configured — all use PET PREFORMS as base; some also use caps
- **Existing vouchers:** ~189 (120 GST Invoice, 33 Mfg Journal, 23 Purchase, 6 Payment, 4 Receipt, 2 Stock Journal, 1 Journal)

## Current Task — Manufacturing Journals from Sales PDF
- **Source:** `E:\sale poly.pdf` — 61 invoices (#38-#98), Jul 2025 - Jan 2026
- **Skip items with "Charge" in name** (blowing charges, not products)
- **Date rule:** 1st of sale month (EDU limitation)
- **BOM mapping:** Each finished product → PET PREFORMS (by weight) + caps if applicable
- **Narration format:** `Manufacturing for Sale Invoice #XX dated DD-Mon-YY (Party Name)`

### Items to Skip (Charge items)
- 40gm PET Bottle Blowing Charge
- Bottle Blowing Charge  
- Jar Blowling Charges

### BOM Component Reference (from PAVISHA POLYMERS)
| Finished Product | PET PREFORMS (per pc) | Cap Component |
|---|---|---|
| 47gm. 1lt. Pet Bottle | 47 gm | — |
| 45gm. Pet Bottle+Flip Top Cap | 45 gm | Cap 46mm Flip Top × 1 |
| 34gm. 500ml. Pet Bottle | 34 gm | — |
| 34gm. 700ml. PET Jar | 34 gm | — |
| 30gm. 1lt. Round PET Jar | 30 gm | — |
| 75gm. 5lt PET Jar | 75 gm | — |
| 18.5gm. PET Jar | 18.5 gm | — |
| 95gm.7lt.Pet Jar | 95 gm | — |
| (etc — full list in poly_bom_real.xml) | | |

### Progress
- [x] Invoice #43 created (1-Jul-25): 47gm bottle 2016pc + 45gm flip top 720pc
- [ ] Remaining invoices (batch creation pending)

### Test Vouchers to Clean Up
- Multiple "DATE TEST" Manufacturing Journals (1pc each) on various 1st-of-month dates
- 1 test Journal voucher (Cash ₹100, 1-Jan-26, narration "API TEST - DELETE ME")
- 1 test Manufacturing Journal (47gm bottle 2016pc, 1-Jan-26, narration "Test MFG - Invoice #43")

## Gotchas & Lessons Learned
1. **Error messages are misleading** — "Voucher date is missing" actually means "date not allowed in EDU mode"
2. **Each failed voucher attempt creates phantom masters** — godowns, stock items, tax units, voucher number series get auto-created even when voucher fails
3. **Data exceptions (e) appear** after failed attempts due to phantom masters
4. **BOM field name mismatch** — Tally uses `MULTICOMPONENTLIST.LIST` internally but documentation often references `COMPONENTLIST.LIST`
5. **Company alter can block** — if Tally shows a GUI confirmation dialog, the API request hangs until dialog is dismissed
6. **Python urllib works better than PowerShell** for Tally API — avoid `$` escaping issues
