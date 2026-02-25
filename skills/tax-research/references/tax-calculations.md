# Tax Calculations Reference

Quick reference for tax rates, limits, and formulas.

## Marginal Tax Rates (2024)

### Federal (Married Filing Jointly)

| Taxable Income      | Rate |
| ------------------- | ---- |
| $0 - $23,200        | 10%  |
| $23,201 - $94,300   | 12%  |
| $94,301 - $201,050  | 22%  |
| $201,051 - $383,900 | 24%  |
| $383,901 - $487,450 | 32%  |
| $487,451 - $731,200 | 35%  |
| $731,201+           | 37%  |

### California (Married Filing Jointly)

| Taxable Income        | Rate  |
| --------------------- | ----- |
| $0 - $20,824          | 1%    |
| $20,825 - $49,368     | 2%    |
| $49,369 - $77,918     | 4%    |
| $77,919 - $108,162    | 6%    |
| $108,163 - $136,700   | 8%    |
| $136,701 - $698,274   | 9.3%  |
| $698,275 - $837,922   | 10.3% |
| $837,923 - $1,396,542 | 11.3% |
| $1,396,543+           | 12.3% |

### Combined Rates (Common Brackets)

| Income Level | Fed | CA   | Combined |
| ------------ | --- | ---- | -------- |
| ~$200k       | 24% | 9.3% | 33.3%    |
| ~$400k       | 32% | 9.3% | 41.3%    |
| ~$500k       | 35% | 9.3% | 44.3%    |

**Use 40% as default combined rate** for typical high-income estimates.

---

## Deduction vs Credit

| Type          | How It Works           | Value                     |
| ------------- | ---------------------- | ------------------------- |
| **Deduction** | Reduces taxable income | Deduction × Marginal Rate |
| **Credit**    | Reduces tax owed       | Dollar for dollar         |

### Examples

**$1,000 Deduction at 40% marginal rate:**

- Tax savings = $1,000 × 0.40 = **$400**

**$1,000 Credit:**

- Tax savings = **$1,000** (direct reduction)

---

## Self-Employment Tax

- Rate: 15.3% (12.4% Social Security + 2.9% Medicare)
- Social Security cap: $168,600 (2024)
- Deduction: 50% of SE tax is deductible

**For Solo 401(k) planning:**

- Contribution reduces both income tax AND SE tax
- True benefit = Contribution × (Income tax rate + 7.65%)

---

## Key Limits (2024/2025)

### Retirement

| Account         | Employee                 | Total                            |
| --------------- | ------------------------ | -------------------------------- |
| Solo 401(k)     | $23,000 ($30,500 if 50+) | $69,000                          |
| Traditional IRA | $7,000 ($8,000 if 50+)   | Same                             |
| SEP-IRA         | N/A                      | 25% of compensation, max $69,000 |

### Credits

| Credit                 | Max                      | Phase-out Starts |
| ---------------------- | ------------------------ | ---------------- |
| Child Tax Credit       | $2,000/child             | $400,000 MFJ     |
| Child & Dependent Care | $3,000 (1) / $6,000 (2+) | N/A              |
| CA CDCC                | 50% of federal credit    | N/A              |

### Deductions

| Deduction                | Limit      | Notes                    |
| ------------------------ | ---------- | ------------------------ |
| Home Office (simplified) | $1,500     | $5 × 300 sq ft max       |
| SALT                     | $10,000    | State + local taxes      |
| Charitable               | 60% of AGI | Cash to public charities |

---

## Amendment Deadlines

| Tax Year | Standard Deadline | Extensions      |
| -------- | ----------------- | --------------- |
| 2021     | April 15, 2025    | EXPIRED         |
| 2022     | April 15, 2026    | Use Form 1040-X |
| 2023     | April 15, 2027    | Use Form 1040-X |
| 2024     | April 15, 2028    | Not yet filed   |

---

## Quick Formulas

### Home Office Deduction

```
Simplified: sq ft × $5 (max 300 sq ft = $1,500)
Actual: (sq ft / total home sq ft) × total home expenses
```

### Child & Dependent Care Credit

```
Qualifying expenses: min(actual paid, $3,000 per child, $6,000 total)
Credit rate: 20% (at higher incomes)
Federal credit: expenses × rate
CA credit: federal credit × 50%
```

### Capital Loss Carryforward

```
Annual deduction: min($3,000, remaining loss)
Carryforward: remaining loss - $3,000
Tax savings: $3,000 × marginal rate = ~$1,200/year
```

### QBI Deduction (Section 199A)

```
Deduction: 20% × qualified business income
Subject to: W-2 wage limits, SSTB phase-outs
Tax savings: deduction × marginal rate
```
