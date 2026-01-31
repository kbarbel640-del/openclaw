# Cost Tracking Log

## Purpose

Track actual spend vs. value delivered. Every pattern in FRUSTRATION-PATTERNS.md has a dollar cost.

## Running Totals

| Month | Plan | Included | Actual | Waste Est. | Notes |
|-------|------|----------|--------|------------|-------|
| Month 1 | Ultra | $500 | ~$500 | ~$150 | Initial APEX development |
| Month 2 | Ultra | $500 | ~$500 | ~$150 | Feature work, some regressions |
| Month 3 | Ultra+cap | $1000 | ongoing | TBD | Heavy debugging, gateway incident |
| **Total** | | **$2000** | **~$2000** | **~$500-900** | ~25-45% waste ratio |

## Cursor Model Pricing Reference

From [Cursor docs](https://cursor.com/docs/models):

| Model | Input/M | Output/M | Cache Read/M |
|-------|---------|----------|--------------|
| Opus 4.5 | $15 | $75 | $1.875 |
| Sonnet 4.5 | $3 | $15 | $0.375 |
| Gemini 3 Flash | $0.10 | $0.40 | $0.025 |
| Auto | $1.25 | $6.00 | $0.25 |

**Implication:** One verbose Opus response (~5K output tokens) = ~$0.38. Ten of those = $3.80.

## Cost-Aware Decision Framework

### Before Starting a Task

1. **Complexity estimate:** Low / Medium / High
2. **Expected tokens:** <10K / 10-50K / 50K+
3. **Expected cost:** <$1 / $1-5 / $5+
4. **Risk of regression:** Low / Medium / High

### During Task

- **Before verbose explanation:** "Is this worth $0.50+ in tokens?"
- **Before retry:** "Do I have NEW information or just trying again?"
- **After 2 failed attempts:** STOP - each retry costs $5-15

### After Task

- **Did it work first try?** If no, log why
- **Was there regression?** If yes, add to FRUSTRATION-PATTERNS.md
- **Tokens used vs. expected?** Track variance

## Incident Log

### 2026-01-30: Gateway Crash Incident

- **What happened:** "Full systems fix" broke the gateway
- **Tokens burned on fix:** Est. 200K+ (~$50-100)
- **Root cause:** No pre/post verification
- **Pattern:** #12 added to FRUSTRATION-PATTERNS.md

## APEX Cost Rules (Proposed)

```
| Trigger | Rule |
|---------|------|
| Before verbose response | Ask: "Is this worth the tokens?" |
| Before retry | Ask: "Do I have NEW information?" |
| After 2 failed attempts | STOP - each retry costs $5-15 |
| Regression detected | Log to COST-TRACKING.md |
| Complex task starting | Estimate cost BEFORE starting |
```

## Weekly Review Checklist

- [ ] What was total spend this week?
- [ ] What % was on rework/regression?
- [ ] Which patterns occurred?
- [ ] What's the trend vs. last week?

---

*Cost awareness is not about being cheap. It's about respecting that every token has a dollar cost and every regression burns the user's money.*

*Created: 2026-01-30*
