# Shopee Seller Optimization SOP Workflow

## AI Agent Automation Guide

**Version:** 1.0
**Last Updated:** February 2026
**Based on:** Actual optimization workflow for KNEVA Sourdough Starter Kit

---

## Executive Summary

This SOP documents the complete workflow for optimizing Shopee seller performance, designed for AI agent automation. The workflow covers analysis, listing optimization, pricing strategy, voucher management, and campaign participation.

---

## Phase 1: Performance Analysis

### 1.1 Dashboard Metrics Review

**Navigation Path:** Seller Centre → Data Centre → Business Insights

**Key Metrics to Capture:**

- Page Views (trend direction)
- Conversion Rate (benchmark: >2% is healthy)
- Units Sold (period over period)
- Revenue (absolute and growth)
- Add to Cart Rate
- Checkout Rate

**Automation Touchpoints:**

```
URL: https://seller.shopee.sg/datacenter/product/overview
Data Elements: .metric-card, .trend-indicator, .conversion-rate
```

**Decision Logic:**

- If Conversion Rate < 1%: Flag for listing optimization
- If Page Views declining: Check ad spend and campaign status
- If Add-to-Cart high but Checkout low: Check pricing/shipping issues

### 1.2 Product Performance Deep Dive

**Navigation Path:** Data Centre → Product → Product Performance

**Data Points:**

- Individual product conversion rates
- Traffic sources (organic vs paid vs campaign)
- Keyword performance
- Customer demographics

**Key Questions to Answer:**

1. Which products are underperforming?
2. Where is traffic coming from?
3. What's the drop-off point in the funnel?

### 1.3 Competitor Analysis

**Process:**

1. Search for main product keywords on Shopee
2. Identify top 5 competitors by sales volume
3. Capture: Price, Rating, Reviews, Shipping options, Vouchers

**Data to Extract:**
| Competitor | Price | Rating | Reviews | Free Shipping | Vouchers |
|------------|-------|--------|---------|---------------|----------|
| Store A | $XX | X.X | XXX | Yes/No | $X off |

**Competitive Positioning:**

- Price position: Premium / Mid-range / Value
- Differentiation factors: Quality, warranty, bundling

---

## Phase 2: Listing Optimization

### 2.1 Product Title Optimization

**Format:** [Brand] + [Product Name] + [Key Feature] + [Variant/Size]

**Example:**

```
KNEVA Sourdough Starter Kit | Complete Breadmaking Set | With Proofing Basket & Banneton
```

**SEO Keywords:** Include top 3-5 search terms naturally

### 2.2 Product Description Enhancement

**Structure:**

1. **Hook** - Key benefit in first line
2. **Features** - Bullet points with benefits
3. **Specifications** - Technical details
4. **What's Included** - Complete list
5. **Warranty/Guarantee** - Trust builder
6. **FAQ** - Preempt objections

**Trust Elements to Add:**

- [ ] Warranty information (e.g., "12 Month Warranty")
- [ ] Return policy clarity
- [ ] Quality certifications
- [ ] Customer testimonials reference

### 2.3 Product Attributes

**Navigation:** Product → Edit → Product Attributes

**Critical Fields:**

- Brand: Must be filled
- Warranty Type: Select "Seller Warranty"
- Warranty Period: Set duration (e.g., "12 Months")
- Material: Specify if applicable
- Country of Origin: Required for trust

### 2.4 Image Optimization

**Requirements:**

- Main image: White background, product only
- Image 2-5: Lifestyle shots, features, scale reference
- Image 6-9: What's included, detail shots
- Video: Unboxing or usage demo (strongly recommended)

---

## Phase 3: Pricing Strategy Design

### 3.1 Price Anchoring Framework

**Components:**

1. **Original Price** - Anchor (sets perceived value)
2. **Campaign/Discount Price** - Active selling price
3. **Voucher Stacking** - Additional perceived savings
4. **Final Customer Price** - What they actually pay

**Formula:**

```
Final Price = Discount Price - Shop Voucher - Campaign Voucher - Follower Voucher
```

### 3.2 Pricing Calculation Template

**Example (KNEVA Kit):**

```
Original Price:        $129.00
Campaign Discount:     -$42.10 (32.6% off)
Displayed Price:       $86.90
-------------------------------------
Shop Voucher:          -$12.00 (JOECKNE12)
Campaign Voucher:      -$5.00  (20% max $5)
Follower Voucher:      -$10.00 (new followers)
-------------------------------------
Best Case Final:       $59.90
Standard Final:        $74.90 (without follower)
```

### 3.3 Constraints & Guardrails

**Minimum Price Rule:**

- Define floor price (e.g., $80 minimum to honor existing customers)
- Never go below landed cost + margin threshold

**Stacking Rules:**

- Verify voucher stacking eligibility
- Campaign vouchers may have exclusions
- Some vouchers are mutually exclusive

---

## Phase 4: Voucher Management

### 4.1 Voucher Types Overview

| Voucher Type     | Purpose          | Typical Discount | Visibility    |
| ---------------- | ---------------- | ---------------- | ------------- |
| Shop Voucher     | General discount | $5-20 fixed      | All customers |
| Product Voucher  | Specific SKU     | 10-20%           | Product page  |
| Follow Prize     | New followers    | $5-10            | After follow  |
| Campaign Voucher | Platform events  | 10-20% (capped)  | Campaign page |

### 4.2 Shop Voucher Creation

**Navigation:** Marketing Centre → Vouchers → Create New Voucher

**Form Fields:**

```
Voucher Type: Shop Voucher
Voucher Name: [Internal reference - not visible to buyers]
Voucher Code: JOEC[IDENTIFIER] (5 chars after prefix)
Discount Type: Fix Amount / Percentage
Discount Value: $XX or XX%
Minimum Basket: $XX (set above product price for single-item validity)
Usage Period: Start Date - End Date
Usage Quantity: Total vouchers available
```

**Best Practices:**

- Code format: BRAND + PURPOSE + NUMBER (e.g., JOECKNE12)
- Set minimum basket just above product price
- Align expiry with campaign end dates

### 4.3 Follow Prize Voucher Creation

**Navigation:** Marketing Centre → Vouchers → More Voucher Types → Follow Prize Voucher

**Purpose:** Incentivize shop follows, build customer base

**Recommended Settings:**

```
Discount: $10 (sweet spot for conversion)
Minimum Basket: $80 (ensure profitability)
Validity: 7-14 days (creates urgency)
Quantity: 100-500 (test and scale)
```

### 4.4 Voucher Stacking Strategy

**Stack Order (customer perspective):**

1. Product discount (if any)
2. Shop/Product voucher (highest value)
3. Campaign voucher (platform subsidized)
4. Follower voucher (if applicable)
5. Coins cashback (platform program)

**Verification:**

- Test checkout flow as customer
- Confirm all vouchers can stack
- Document any exclusions

---

## Phase 5: Campaign Participation

### 5.1 Campaign Discovery

**Navigation:** Marketing Centre → Campaigns → Available Campaigns

**Campaign Types:**

- Flash Sales
- Category Sales (Health & Wellness, Home & Living)
- Platform Events (9.9, 11.11, 12.12)
- Thematic Campaigns (Back to School, CNY)

### 5.2 Campaign Evaluation Criteria

**Join if:**

- [ ] Category matches product
- [ ] Commission rate acceptable (<10% ideal)
- [ ] Discount requirement within margin
- [ ] Campaign duration aligns with inventory

**Skip if:**

- Commission exceeds 15%
- Required discount below floor price
- Low visibility campaign

### 5.3 Campaign Price Setting

**Navigation:** Campaigns → Manage Products → Set Campaign Price

**Strategy:**

- Meet minimum discount requirement
- Stay above floor price
- Consider voucher stacking for final price

---

## Phase 6: Performance Monitoring

### 6.1 Daily Checks

- [ ] Order processing queue
- [ ] Chat response rate
- [ ] Voucher redemption rates
- [ ] Stock levels

### 6.2 Weekly Review

- [ ] Sales vs target
- [ ] Conversion rate trend
- [ ] Top traffic sources
- [ ] Competitor price changes

### 6.3 Campaign Post-Mortem

After each campaign:

1. Total units sold
2. Revenue generated
3. Voucher redemption rate
4. New followers gained
5. ROI calculation

---

## Automation Architecture

### Key URLs for Agent Navigation

```python
SHOPEE_URLS = {
    "login": "https://seller.shopee.sg/account/signin",
    "dashboard": "https://seller.shopee.sg/portal/dashboard",
    "products": "https://seller.shopee.sg/portal/product/list",
    "vouchers": "https://seller.shopee.sg/portal/marketing/vouchers",
    "voucher_new": "https://seller.shopee.sg/portal/marketing/vouchers/new",
    "campaigns": "https://seller.shopee.sg/portal/marketing/campaigns",
    "data_center": "https://seller.shopee.sg/datacenter/product/overview",
    "orders": "https://seller.shopee.sg/portal/sale/order",
}
```

### DOM Selectors (Common Elements)

```python
SELECTORS = {
    "voucher_name": "input[placeholder*='Voucher Name']",
    "voucher_code": "input[placeholder*='INPUT']",
    "discount_amount": "input[placeholder='$']",
    "min_basket": "input[placeholder*='Minimum']",
    "date_picker": ".eds-react-date-picker",
    "confirm_btn": "button:contains('Confirm')",
    "campaign_list": ".campaign-card",
}
```

### Agent Decision Tree

```
START
  │
  ├── Analyze Performance
  │     ├── If conversion < 1% → Optimize Listing
  │     ├── If traffic down → Check Ads/Campaigns
  │     └── If healthy → Monitor Only
  │
  ├── Check Campaigns
  │     ├── If eligible campaign found → Evaluate & Join
  │     └── If no campaigns → Check voucher strategy
  │
  ├── Manage Vouchers
  │     ├── If expiring soon → Create replacement
  │     ├── If redemption low → Increase discount
  │     └── If no follower voucher → Create one
  │
  └── Daily Operations
        ├── Process orders
        ├── Respond to chats
        └── Update inventory
```

---

## Appendix: Quick Reference

### Shopee Seller Centre Navigation

| Task           | Path                            |
| -------------- | ------------------------------- |
| Edit product   | Products → All Products → Edit  |
| Create voucher | Marketing → Vouchers → Create   |
| Join campaign  | Marketing → Campaigns → Browse  |
| View analytics | Data Centre → Business Insights |
| Process orders | Orders → To Ship                |

### Common Issues & Solutions

| Issue                | Solution                               |
| -------------------- | -------------------------------------- |
| Voucher not stacking | Check campaign exclusions              |
| Price below minimum  | Adjust base discount                   |
| Low conversion       | Add trust elements (warranty, reviews) |
| Traffic drop         | Check ad budget, join campaigns        |

### Key Performance Benchmarks

| Metric          | Poor    | Average  | Good     | Excellent |
| --------------- | ------- | -------- | -------- | --------- |
| Conversion Rate | <0.5%   | 0.5-1%   | 1-3%     | >3%       |
| Chat Response   | >12h    | 4-12h    | 1-4h     | <1h       |
| Rating          | <4.5    | 4.5-4.7  | 4.7-4.9  | >4.9      |
| Ship Time       | >3 days | 2-3 days | 1-2 days | Same day  |

---

## Document History

| Version | Date     | Changes                                 |
| ------- | -------- | --------------------------------------- |
| 1.0     | Feb 2026 | Initial SOP based on KNEVA optimization |

---

_This SOP is designed for AI agent automation. Human review recommended for strategic decisions._
