# River Financial Transaction Export Research

## Overview

River Financial (river.com) is a Bitcoin-only financial services platform founded in 2019. They offer Bitcoin buying, selling, custody, and Lightning Network services.

## 1. API for Transaction Export

### Consumer API

**No public consumer API exists for transaction export.** River does not provide a direct API for individual users to programmatically export their transaction history.

### Read-Only API (via Third-Party Integrations)

River offers a **read-only API integration with CoinLedger** for tax reporting purposes:

- Allows automatic sync of transaction data
- Read-only access (no trade/withdrawal permissions)
- Used for importing transaction history into tax software

### River Lightning Services (RLS) API

River offers an enterprise-grade Lightning Network API at [rls.dev](https://rls.dev/):

- Designed for businesses integrating Lightning payments
- Powers services like El Salvador's Chivo wallet
- Not intended for personal transaction export
- Developer documentation available at rls.dev

## 2. Export Formats Supported

### CSV Export (Primary Method)

River supports CSV export with two report types:

| Report Type          | Contents                                             |
| -------------------- | ---------------------------------------------------- |
| **Bitcoin Activity** | All completed Bitcoin transactions                   |
| **Account Activity** | Complete record of all Bitcoin and cash transactions |

**Note:** Exact CSV column headers not publicly documented. The Bitcoin Activity CSV is designed for tax/performance tracking software with minimal edits needed for import.

### PDF Account Statements

- Monthly account statements available
- Includes: monthly account summary, Bitcoin details, cash details
- Contains "Summary of Gains and Losses" table
- Email notification sent when new statement available
- Downloadable from web portal and iOS app

## 3. Web Automation Feasibility

### Export Location

From river.com web portal:

1. Click "Taxes & Documents" in left sidebar
2. Select report type dropdown (Bitcoin Activity or Account Activity)
3. Select time period dropdown
4. Click "Download CSV"

### Automation Considerations

**Feasible via browser automation (Playwright/Puppeteer):**

- Standard web UI with identifiable elements
- No documented anti-bot measures for authenticated sessions
- CSV download triggers standard browser download

**Limitations:**

- Export only available via web browser (not mobile app)
- Requires authenticated session
- No official automation API
- Cost basis info limited if unknown lots exist for deposited Bitcoin

### Web Portal Navigation Structure

```
river.com (authenticated)
|
+-- Homepage/Dashboard
|   +-- Buy Bitcoin
|   +-- Receive Bitcoin
|   +-- Send Bitcoin
|
+-- Taxes & Documents (left sidebar)
|   +-- Report Type dropdown
|   |   +-- Bitcoin Activity
|   |   +-- Account Activity
|   +-- Time Period dropdown
|   |   +-- All Time
|   |   +-- Custom date ranges
|   +-- Download CSV button
|   +-- Account Statements (monthly PDFs)
|
+-- Profile & Settings (bottom-left)
    +-- Automatic Withdrawals
    +-- Tax lot settings
    +-- Cost basis method configuration
```

## 4. Web Portal Structure

### Main Navigation Elements

- **Left Sidebar:** Primary navigation including Taxes & Documents
- **Homepage:** Dashboard with Bitcoin balance, price, and quick actions
- **Profile & Settings:** Bottom-left corner, account configuration

### Key Features Accessible

- Bitcoin price chart and performance tracking
- Cumulative and annualized returns
- Tax lot tracking
- Cost basis method selection (default: FIFO)
- Beneficiary planning
- Lightning Network send/receive

### Platforms

- Web portal: river.com (full functionality)
- iOS app: Limited export features
- Android app: Available

## 5. Export Workflow for Automation

### Recommended Approach

```
1. Navigate to river.com/login
2. Authenticate (manual or saved session)
3. Navigate to Taxes & Documents section
4. Select "Account Activity" from report type dropdown
5. Select "All Time" or date range from time period dropdown
6. Click "Download CSV"
7. Wait for download to complete
8. Parse CSV file
```

### Technical Notes

- Download takes "a few moments to generate"
- Success indicated by "Download Successful" message
- File saved to browser's downloads folder
- CSV format compatible with CoinLedger, TurboTax, and other tax software

## 6. Third-Party Integration Options

### CoinLedger

- Direct River integration available
- Both API sync and CSV import supported
- Generates tax reports automatically

### General Tax Software Compatibility

- TurboTax (via CSV import)
- TaxAct (via CSV import)
- CoinTracking (via CSV import)

## Sources

- [River Help Center - Download Account Activity](https://support.river.com/hc/en-us/articles/45513824178963-How-do-I-download-my-account-activity)
- [CoinLedger River Integration](https://coinledger.io/integrations/river)
- [CoinLedger River File Import Guide](https://help.coinledger.io/en/articles/8977397-river-file-import-guide)
- [River Bitcoin Account Statements Announcement](https://river.com/content/bitcoin-account-statements-are-now-available-with-river)
- [River Lightning Services](https://rls.dev/)
- [River Financial GitHub](https://github.com/RiverFinancial)

## Summary

| Feature                      | Status          |
| ---------------------------- | --------------- |
| Public API for transactions  | No              |
| CSV Export                   | Yes (web only)  |
| PDF Statements               | Yes (monthly)   |
| Web automation feasible      | Yes             |
| Third-party API integrations | CoinLedger only |
| Export formats               | CSV, PDF        |
