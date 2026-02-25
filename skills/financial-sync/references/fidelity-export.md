# Fidelity Transaction Export Research

## Summary

Fidelity offers limited official export options. CSV is the primary manual export format from their web portal. OFX/QFX access is available through third-party tools but not directly from the website. No official API exists for individual retail investors.

---

## 1. Programmatic Export Options

### Official Export (Manual)

- **Format**: CSV only from web portal
- **Location**: Activity & Orders > History > Download button
- **Limitations**:
  - 90 days per download
  - Up to 5 years of history available
  - Recommended to download one quarter at a time
  - Prices reported to 2 decimal places (previously 4 decimals, changed May 2024)

### OFX/QFX Access via ofxtools

The [ofxtools](https://github.com/csingley/ofxtools) Python library provides programmatic OFX downloads.

**Fidelity OFX Server Configuration:**

```ini
[fidelity]
url = https://ofx.fidelity.com:443/ftgw/OFX/clients/download
fid = 7776
brokerid = fidelity.com
org = fidelity.com
version = 220
appid = QWIN
appver = 2700
language = ENG
```

**Command-line usage:**

```bash
# Install
pip install ofxtools

# Download statements
ofxget stmt fidelity -u <username> --all
```

**Python API usage:**

```python
from ofxtools.Client import OFXClient, InvStmtRq

client = OFXClient(
    'https://ofx.fidelity.com:443/ftgw/OFX/clients/download',
    org='fidelity.com',
    fid='7776',
    brokerid='fidelity.com',
    version=220,
    appid='QWIN',
    appver='2700'
)

stmtrq = InvStmtRq(acctid='YOUR_ACCOUNT_NUMBER')
response = client.request_statements(
    user='username',
    password='password',
    invstmtrqs=[stmtrq]
)
```

**Account Support:**

- Brokerage accounts: Working
- HSA accounts: Working
- NetBenefits (401k): Problematic - often returns "Access Denied"

**Advantages of QFX over CSV:**

- Includes positions list
- Account balance
- Current ticker prices
- Standardized format

---

## 2. OFX/QFX Support

### Direct OFX Server

Fidelity maintains an OFX server at `ofx.fidelity.com` that supports:

- Investment statements (INVSTMT)
- Account info requests (ACCTINFO)
- Profile requests (PROF)

### QFX for Quicken

- First download: 90 days of history
- Quicken 2010+: Up to 24 months of history
- Direct Connect requires Quicken software

### CSV to OFX Conversion

[F2O Converter](https://microsoftmoneyoffline.wordpress.com/2024/02/03/cals-fidelity-specific-csv-to-ofx-converter/) converts Fidelity CSV exports to OFX format when direct OFX fails.

---

## 3. API Access for Individual Investors

### Official APIs

**No direct API for retail investors.** Fidelity's API offerings are limited to:

1. **WorkplaceXchange API** - For employers and third-party vendors (retirement plan administration)
2. **Integration Xchange** - For institutional partners with relationship managers
3. **Fidelity Access** (via Finicity/Mastercard) - Data aggregation API for authorized third parties

### Third-Party Data Aggregators

- **Finicity/Mastercard** - First aggregator to sign Fidelity Access agreement
- **SnapTrade** - Read-only access via developer API (no trading)
- **Plaid** - Screen scraping (not official API)

### Unofficial Automation

[fidelity-api](https://github.com/kennyboy106/fidelity-api) - Playwright-based Python package

```bash
pip install fidelity-api
playwright install
```

```python
from fidelity_api import FidelityAutomation

fidelity = FidelityAutomation(headless=True, save_state=True)
step_1, step_2 = fidelity.login(username, password)

if not step_2:
    fidelity.login_2FA(totp_code)

# Get account info, positions, etc.
```

**Features:**

- Login with 2FA support
- Account positions
- Place orders
- Nickname accounts

**Dependencies:** playwright, playwright-stealth, pyotp

**Warning:** Unofficial, use at own risk, not affiliated with Fidelity

---

## 4. Playwright Selectors for Activity/History Page

### Navigation Path

```
Fidelity.com > Activity & Orders > History
```

Or direct URL: `https://digital.fidelity.com/ftgw/digital/activity`

### Recommended Selector Strategy

Fidelity's web portal does not publish stable test IDs. Use accessibility-based selectors:

```python
# Role-based selectors (most stable)
page.get_by_role("link", name="Activity & Orders")
page.get_by_role("button", name="Download")
page.get_by_role("combobox", name="Time Period")

# Text-based selectors
page.get_by_text("History")
page.get_by_text("Download")

# Aria labels (if available)
page.locator('[aria-label="Download transactions"]')
```

### Known Selectors (from fidelity-api patterns)

```python
# Login flow
page.locator('#userId')           # Username field
page.locator('#password')         # Password field
page.locator('#fs-login-button')  # Login button

# 2FA
page.locator('input[type="tel"]') # OTP input

# Navigation
page.get_by_role("link", name="Activity & Orders")
page.get_by_role("link", name="History")

# History page
page.locator('select[name="timeperiod"]')  # Date range dropdown
page.locator('button:has-text("Download")') # Download button

# Account selector
page.locator('[data-testid="account-selector"]')  # May change
```

### Filtering Options Available

- **Time Period**: Custom date ranges, preset periods (90 days max per request)
- **Security Type**: All, Stocks, Options, Mutual Funds, etc.
- **Transaction Type**: All, Buy, Sell, Dividend, etc.

### Headless Mode Issue

Known Playwright bug: Fidelity statements page times out in headless mode ([Issue #8085](https://github.com/microsoft/playwright/issues/8085)). May need `headless=False` or use playwright-stealth.

### Best Practices

1. Use `playwright-stealth` to avoid bot detection
2. Add realistic delays between actions
3. Handle session timeouts (Fidelity sessions expire)
4. Save browser state to avoid repeated logins
5. Use role/text selectors over CSS class selectors (more stable)

---

## 5. Recommended Approach

### For Automation

**Tier 1 - Most Reliable:**

```
ofxtools + OFX server → Direct OFX download
```

- Works for brokerage and HSA
- Standardized format
- No browser automation needed

**Tier 2 - Fallback:**

```
Playwright + fidelity-api → Browser automation
```

- For accounts where OFX fails (NetBenefits)
- More fragile, requires maintenance

**Tier 3 - Manual + Script:**

```
Manual CSV download → F2O converter → OFX
```

- When all else fails
- Reliable but not fully automated

### Data Flow Architecture

```
                    ┌─────────────────┐
                    │ Fidelity Account │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
   ┌──────────┐       ┌──────────┐       ┌──────────┐
   │ OFX API  │       │ Playwright│       │ Manual   │
   │ (ofxtools)│       │ Automation│       │ CSV      │
   └────┬─────┘       └────┬─────┘       └────┬─────┘
        │                  │                  │
        ▼                  ▼                  ▼
   ┌──────────┐       ┌──────────┐       ┌──────────┐
   │ .ofx file│       │ .csv file│       │ .csv file│
   └────┬─────┘       └────┬─────┘       └────┬─────┘
        │                  │                  │
        └──────────────────┼──────────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │ Transaction  │
                    │ Parser       │
                    └──────────────┘
```

---

## References

- [Fidelity Export FAQ](https://www.fidelity.com/customer-service/faqs-exporting-account-information)
- [ofxtools Documentation](https://ofxtools.readthedocs.io/en/latest/)
- [ofxtools GitHub](https://github.com/csingley/ofxtools)
- [fidelity-api GitHub](https://github.com/kennyboy106/fidelity-api)
- [F2O CSV to OFX Converter](https://microsoftmoneyoffline.wordpress.com/2024/02/03/cals-fidelity-specific-csv-to-ofx-converter/)
- [Bogleheads Fidelity QFX Discussion](https://www.bogleheads.org/forum/viewtopic.php?t=419061)
- [ofxtools Fidelity Issue #140](https://github.com/csingley/ofxtools/issues/140)
