# Category Rules Reference

Reference for transaction categorization in the financial sync system.

---

## Category Taxonomy

### Food & Dining

| CategoryID      | Display Name   | Notes                               |
| --------------- | -------------- | ----------------------------------- |
| FOOD_GROCERY    | Groceries      | Supermarkets, specialty food stores |
| FOOD_RESTAURANT | Restaurants    | Dining out, takeout                 |
| FOOD_ALCOHOL    | Bars & Alcohol | Bars, liquor stores, wine           |

### Transportation

| CategoryID          | Display Name   | Notes                |
| ------------------- | -------------- | -------------------- |
| TRANSPORT_GAS       | Gas & Fuel     | Gas stations         |
| TRANSPORT_RIDESHARE | Rideshare      | Uber, Lyft, taxis    |
| TRANSPORT_PUBLIC    | Public Transit | Bus, train, subway   |
| TRANSPORT_PARKING   | Parking        | Parking lots, meters |

### Housing

| CategoryID        | Display Name   | Notes                           |
| ----------------- | -------------- | ------------------------------- |
| HOUSING_MORTGAGE  | Mortgage       | Primary/secondary home loans    |
| HOUSING_RENT      | Rent           | Monthly rent payments           |
| HOUSING_UTILITIES | Utilities      | Electric, gas, water            |
| HOUSING_REPAIR    | Home Repair    | Maintenance, repairs            |
| HOUSING_INSURANCE | Home Insurance | Property insurance              |
| HOUSING_TAX       | Property Tax   | Annual/quarterly property taxes |

### Health & Wellness

| CategoryID      | Display Name     | Notes                            |
| --------------- | ---------------- | -------------------------------- |
| HEALTH_MEDICAL  | Medical / Dental | Doctor, dentist, hospital        |
| HEALTH_GYM      | Fitness          | Gym memberships, fitness classes |
| HEALTH_PHARMACY | Pharmacy         | Prescriptions, OTC drugs         |
| HEALTH_VISION   | Vision           | Eye exams, glasses, contacts     |

### Shopping

| CategoryID       | Display Name     | Notes                       |
| ---------------- | ---------------- | --------------------------- |
| SHOP_GENERAL     | General Shopping | Mixed retail                |
| SHOP_CLOTHING    | Clothing         | Apparel, shoes              |
| SHOP_ELECTRONICS | Electronics      | Computers, phones, tech     |
| SHOP_HOME        | Home Goods       | Furniture, decor, household |

### Entertainment

| CategoryID    | Display Name | Notes                   |
| ------------- | ------------ | ----------------------- |
| ENT_HOBBIES   | Hobbies      | General entertainment   |
| ENT_STREAMING | Streaming    | Netflix, Spotify, etc.  |
| ENT_SPORTS    | Sports       | Events, equipment       |
| ENT_TRAVEL    | Travel       | General travel expenses |

### Travel

| CategoryID    | Display Name | Notes                   |
| ------------- | ------------ | ----------------------- |
| TRAVEL_HOTEL  | Hotels       | Lodging, accommodations |
| TRAVEL_FLIGHT | Flights      | Airfare                 |
| TRAVEL_CAR    | Car Rental   | Vehicle rentals         |
| TRAVEL_OTHER  | Other Travel | Miscellaneous travel    |

### Bills & Subscriptions

| CategoryID         | Display Name  | Notes                   |
| ------------------ | ------------- | ----------------------- |
| BILLS_PHONE        | Phone         | Cellular, landline      |
| BILLS_INTERNET     | Internet      | Home internet service   |
| BILLS_INSURANCE    | Insurance     | Non-home/auto insurance |
| BILLS_SUBSCRIPTION | Subscriptions | Recurring services      |

### Financial

| CategoryID   | Display Name | Notes                    |
| ------------ | ------------ | ------------------------ |
| FIN_TAXES    | Taxes        | Income/other taxes       |
| FIN_INTEREST | Interest     | Loan interest, fees      |
| FIN_FEES     | Bank Fees    | Account fees, overdrafts |
| FIN_TRANSFER | Transfer     | Inter-account transfers  |

### Income

| CategoryID      | Display Name    | Notes                |
| --------------- | --------------- | -------------------- |
| INCOME_SALARY   | Salary          | Regular paychecks    |
| INCOME_DIVIDEND | Dividends       | Investment dividends |
| INCOME_INTEREST | Interest Income | Savings interest     |
| INCOME_OTHER    | Other Income    | Misc income          |

### Investments

| CategoryID      | Display Name | Notes                |
| --------------- | ------------ | -------------------- |
| INVEST_BUY      | Purchase     | Security purchases   |
| INVEST_SELL     | Sale         | Security sales       |
| INVEST_DIVIDEND | Dividend     | Reinvested dividends |

### Business

| CategoryID       | Display Name          | Notes                    |
| ---------------- | --------------------- | ------------------------ |
| BIZ_PROFESSIONAL | Professional Services | Contractors, consultants |
| BIZ_OFFICE       | Office Supplies       | Business supplies        |
| BIZ_SOFTWARE     | Software              | Business software, SaaS  |
| BIZ_TRAVEL       | Business Travel       | Work-related travel      |

### Special Categories

| CategoryID    | Display Name  | Notes               |
| ------------- | ------------- | ------------------- |
| UNCATEGORIZED | Uncategorized | Needs manual review |

---

## Quicken Category Mappings

Categories used in Quicken Web (actual user categories):

### Income & Transfers

| Quicken Category     | Description                     |
| -------------------- | ------------------------------- |
| Income               | General income                  |
| Transfer             | Inter-account transfers         |
| Banking Interest     | Interest earned on accounts     |
| Bitcoin Buddy Income | River referral rewards, bonuses |

### Banking & Finance

| Quicken Category     | Description                   |
| -------------------- | ----------------------------- |
| Banking Services     | Account fees, management fees |
| Credit Card Interest | CC interest charges           |
| Credit Card Payment  | CC bill payments              |

### Housing & Utilities

| Quicken Category                | Description             |
| ------------------------------- | ----------------------- |
| Mortgage                        | Home loan payments      |
| Home Insurance                  | Property insurance      |
| Property Tax                    | Real estate taxes       |
| Power                           | Electricity             |
| Water                           | Water service           |
| Internet                        | Home internet           |
| Recology                        | Trash/recycling         |
| Simplisafe                      | Home security           |
| Pool                            | Pool maintenance        |
| Gardening                       | Landscaping, garden     |
| House Cleaning                  | Cleaning services       |
| Home (Amazon/Target/Costco etc) | General household items |

### Transportation

| Quicken Category                    | Description          |
| ----------------------------------- | -------------------- |
| Gas                                 | Fuel                 |
| Car Insurance                       | Auto insurance       |
| Car Payment                         | Auto loan            |
| Cars (Maintenance/Wash/Parking etc) | Car maintenance, DMV |

### Food & Daily

| Quicken Category                      | Description           |
| ------------------------------------- | --------------------- |
| Groceries                             | Food shopping         |
| Entertainment / Restaurants / Sitters | Dining, babysitters   |
| Nicotine                              | Tobacco/vape products |

### Health & Personal

| Quicken Category | Description                   |
| ---------------- | ----------------------------- |
| Medical / Dental | Healthcare expenses           |
| Fitness          | Gym, fitness classes          |
| Claire Self Care | Personal care (Claire)        |
| Claire Clothing  | Clothing (Claire)             |
| Claire To Do     | Misc tasks (Claire)           |
| Joel Self Care   | Therapy, personal care (Joel) |
| Joel Clothing    | Clothing (Joel)               |

### Family & Kids

| Quicken Category | Description         |
| ---------------- | ------------------- |
| Kids             | Children's expenses |
| Kids Clothing    | Children's apparel  |
| Childcare        | Daycare, nanny      |
| Enrichment       | Classes, activities |
| Pets             | Pet expenses        |

### Subscriptions & Services

| Quicken Category      | Description           |
| --------------------- | --------------------- |
| Streaming             | Video/music streaming |
| Family Cloud Services | iCloud, Google, etc.  |
| Cellular              | Phone service         |

### Lifestyle

| Quicken Category                                 | Description          |
| ------------------------------------------------ | -------------------- |
| Vacations                                        | Travel, Disney, etc. |
| Gifts (not Xmas)                                 | Non-holiday gifts    |
| Holidays (Gifts/Hosting/Decor/Birthdays/Parties) | Holiday expenses     |
| Cash                                             | ATM withdrawals      |
| Cash Back                                        | Cash back rewards    |

### Investments

| Quicken Category      | Description               |
| --------------------- | ------------------------- |
| Bitcoin               | Bitcoin purchases (River) |
| Bitcoin Buddy         | Bitcoin-related misc      |
| Loans                 | Loan payments             |
| Personal Loan Payment | Personal loans            |

### Administrative

| Quicken Category   | Description             |
| ------------------ | ----------------------- |
| Balance Adjustment | Manual adjustments      |
| Opening Balance    | Initial account balance |

---

## Teller-to-Excel Category Mapping

Automatic mapping from Teller API categories to internal CategoryIDs:

| Teller Category | Internal CategoryID |
| --------------- | ------------------- |
| accommodation   | TRAVEL_HOTEL        |
| advertising     | BIZ_PROFESSIONAL    |
| bar             | FOOD_ALCOHOL        |
| charity         | UNCATEGORIZED       |
| clothing        | SHOP_CLOTHING       |
| dining          | FOOD_RESTAURANT     |
| education       | UNCATEGORIZED       |
| electronics     | SHOP_ELECTRONICS    |
| entertainment   | ENT_HOBBIES         |
| fuel            | TRANSPORT_GAS       |
| general         | UNCATEGORIZED       |
| groceries       | FOOD_GROCERY        |
| gym             | HEALTH_GYM          |
| health          | HEALTH_MEDICAL      |
| home            | HOUSING_REPAIR      |
| income          | INCOME_OTHER        |
| insurance       | BILLS_INSURANCE     |
| investment      | INVEST_BUY          |
| loan            | FIN_INTEREST        |
| office          | BIZ_OFFICE          |
| phone           | BILLS_PHONE         |
| service         | UNCATEGORIZED       |
| shopping        | SHOP_GENERAL        |
| software        | BIZ_SOFTWARE        |
| sport           | ENT_SPORTS          |
| tax             | FIN_TAXES           |
| transport       | TRANSPORT_RIDESHARE |
| travel          | TRAVEL_OTHER        |
| utilities       | HOUSING_UTILITIES   |

---

## Payee-Based Auto-Categorization Rules

Rules for matching transaction descriptions to categories:

### Food & Grocery

| Payee Pattern           | Category  | Notes                     |
| ----------------------- | --------- | ------------------------- |
| SP GRUNS                | Groceries | Gruns specialty store     |
| CTLP\*NORTH BAY WHOLESA | Groceries | North Bay Wholesale       |
| Marley Spoon            | Groceries | Meal kit delivery         |
| Hungryroot              | Groceries | Meal kit/grocery delivery |

### Healthcare

| Payee Pattern        | Category         | Notes                  |
| -------------------- | ---------------- | ---------------------- |
| KAISER               | Medical / Dental | Kaiser Permanente      |
| OTC BRANDS           | Medical / Dental | Over-the-counter items |
| Function Health      | Medical / Dental | Health testing service |
| DANIEL ODONNELL LMFT | Joel Self Care   | Therapist              |

### Entertainment & Dining

| Payee Pattern | Category                              | Notes           |
| ------------- | ------------------------------------- | --------------- |
| AYAWASKA      | Entertainment / Restaurants / Sitters | Restaurant      |
| Davidson      | Entertainment / Restaurants / Sitters | Restaurant      |
| YouTubePremi  | Streaming                             | YouTube Premium |

### Kids & Family

| Payee Pattern | Category | Notes                         |
| ------------- | -------- | ----------------------------- |
| Wal-Mart      | Kids     | Usually kid-related purchases |
| Enrichment    | Kids     | Kids activities               |

### Travel

| Payee Pattern           | Category  | Notes             |
| ----------------------- | --------- | ----------------- |
| WDTC RESORT PKG INT WDW | Vacations | Walt Disney World |

### Home & Services

| Payee Pattern | Category                            | Notes                |
| ------------- | ----------------------------------- | -------------------- |
| MOOTSH PHOTOS | Home                                | Photo service        |
| DMV           | Cars (Maintenance/Wash/Parking etc) | Vehicle registration |

### Banking

| Payee Pattern               | Category         | Notes                   |
| --------------------------- | ---------------- | ----------------------- |
| OVERDRAFT FEE               | Banking          | Overdraft charges       |
| CHECK #                     | Transfer         | Check payments          |
| PETALUMA...Banking Interest | Banking Interest | Branch-related interest |

### Lifestyle

| Payee Pattern | Category | Notes                        |
| ------------- | -------- | ---------------------------- |
| 7-ELEVEN      | Nicotine | Convenience store (nicotine) |

### Fidelity (Investment)

| Payee Pattern           | Category         |
| ----------------------- | ---------------- |
| Fidelity Dividend       | Income           |
| FIDELITY DIVIDEND       | Income           |
| Fidelity Interest       | Banking Interest |
| FIDELITY INTEREST       | Banking Interest |
| Fidelity Management Fee | Banking Services |
| Fidelity Advisory Fee   | Banking Services |
| Fidelity Fund Fee       | Banking Services |
| Fidelity Service Fee    | Banking Services |
| Fidelity Transfer       | Transfer         |
| Fidelity Contribution   | Transfer         |
| Fidelity Withdrawal     | Transfer         |
| Fidelity Reinvestment   | Transfer         |
| Fidelity Buy            | Transfer         |
| Fidelity Sell           | Transfer         |
| Fidelity Distribution   | Income           |
| Fidelity Capital Gain   | Income           |

### River (Bitcoin)

| Payee Pattern          | Category             |
| ---------------------- | -------------------- |
| River Financial        | Bitcoin              |
| River DCA              | Bitcoin              |
| River Recurring Buy    | Bitcoin              |
| River Purchase         | Bitcoin              |
| River Buy              | Bitcoin              |
| River Bitcoin Purchase | Bitcoin              |
| River Reward           | Bitcoin Buddy Income |
| River Rewards          | Bitcoin Buddy Income |
| River Referral         | Bitcoin Buddy Income |
| River Referral Bonus   | Bitcoin Buddy Income |
| River Bonus            | Bitcoin Buddy Income |
| River Interest         | Bitcoin Buddy Income |
| River Withdrawal       | Transfer             |
| River Deposit          | Transfer             |
| River Transfer         | Transfer             |

---

## Business vs Personal Classification

### Account-Level Classification

Transactions inherit entity type from their account:

| Account               | Entity     | Notes               |
| --------------------- | ---------- | ------------------- |
| CHASE_7549            | Personal   | Personal checking   |
| CHASE_7158            | Personal   | Personal checking   |
| CHASE_8738            | Personal   | Personal savings    |
| CHASE_7386            | Personal   | Freedom credit card |
| CHASE_374             | Personal   | Prime Visa          |
| CHASE_1564            | Business   | Business checking   |
| AMERICAN_EXPRESS_1000 | Personal   | Personal Amex       |
| FIDELITY\_\*          | Investment | Investment accounts |
| RIVER\_\*             | Investment | Bitcoin holdings    |

### Override Rules

Use `EntityOverride` column to reclassify individual transactions:

1. **Business expense on personal card**: Set EntityOverride = "Business"
2. **Personal expense on business card**: Set EntityOverride = "Personal"
3. **Mixed-use**: Split transaction or use dominant category

### Tax-Deductible Categories (Business)

When account is Business or EntityOverride = Business:

| Category         | Deductible | Notes                          |
| ---------------- | ---------- | ------------------------------ |
| BIZ_PROFESSIONAL | Yes        | Contractors, legal, accounting |
| BIZ_OFFICE       | Yes        | Supplies, equipment            |
| BIZ_SOFTWARE     | Yes        | Software subscriptions         |
| BIZ_TRAVEL       | Yes        | Work travel                    |
| BILLS_PHONE      | Partial    | Business portion only          |
| BILLS_INTERNET   | Partial    | Home office portion            |

---

## Auto-Categorization Priority

Order of precedence for automatic categorization:

1. **Exact payee match** (from category-rules.json)
2. **Partial payee match** (case-insensitive contains)
3. **Teller category mapping** (from API)
4. **Account default** (e.g., Fidelity = Investment)
5. **UNCATEGORIZED** (requires manual review)

---

## Adding New Rules

### In category-rules.json

```json
{
  "PAYEE_PATTERN": "Category Name",
  "Starbucks": "Entertainment / Restaurants / Sitters",
  "COSTCO": "Home (Amazon/Target/Costco etc)"
}
```

### Pattern Matching Tips

- Use UPPERCASE for all-caps patterns
- Include partial merchant codes (e.g., "SP GRUNS" not full string)
- Add both upper and lowercase variants for reliability
- Test patterns against existing transactions before adding

### Common Uncategorized Sources

Review these regularly for new rule candidates:

- New subscription services
- Infrequent merchants
- One-time purchases
- ATM/cash transactions

---

## File Locations

| File                   | Path                                             | Purpose               |
| ---------------------- | ------------------------------------------------ | --------------------- |
| Teller-to-Excel script | `~/bin/teller-to-excel.py`                       | Main category mapping |
| Category rules         | `~/Shared/quicken-imports/category-rules.json`   | Payee auto-rules      |
| Category options       | `~/Shared/quicken-imports/category-options.json` | Quicken categories    |
| Excel workbook         | `~/OneDrive/Finance/finances.xlsx`               | Transaction storage   |
| Teller database        | `~/projects/teller-sync/transactions.db`         | Raw transaction data  |
