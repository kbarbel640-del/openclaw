---
name: tax-research
description: Researches tax optimization opportunities to maximize deductions and refunds. Tracks Potential vs Verified savings in a central tracker. Use when asked to find tax savings, research deductions, analyze tax documents, or check on tax research progress.
invocation: user
arguments: "[run|status|summary]"
---

# Tax Research

Automated tax research to find money-saving opportunities. Tracks Potential vs Verified savings.

## ⛔ FILING GATE - READ THIS FIRST

**DO NOT mention filing, Form 1040-X, amended returns, or "ready to file" until ALL of the following are true:**

1. **All available documents reviewed** - Every document in `~/OneDrive/Finance/Taxes/` has been read and analyzed
2. **Documents Needed list is empty** - `documents-needed.md` has no outstanding items
3. **All research targets exhausted** - Every item in [Research Targets](#research-targets) is marked complete
4. **Document review status = COMPLETE** - Tracker shows "Document Review: COMPLETE"

**Until then, the focus is RESEARCH ONLY.** Keep finding opportunities, keep requesting missing documents, keep analyzing.

**To check readiness:**

```bash
# Count unreviewed documents
cat ~/OneDrive/Finance/Taxes/document-index.json | jq '[.documents[] | select(.status != "reviewed")] | length'

# Check documents needed
cat ~/Shared/notes/personal/taxes/documents-needed.md
```

If either shows items remaining → **NOT READY TO FILE**.

---

## Quick Reference

| Command                 | Action                                         |
| ----------------------- | ---------------------------------------------- |
| `/tax-research run`     | Execute one research cycle now                 |
| `/tax-research status`  | Show current savings total and recent activity |
| `/tax-research summary` | Generate and send daily summary via Telegram   |

## Contents

- [Workflow](#workflow)
- [File Locations](#file-locations)
- [Research Targets](#research-targets)
- [Sub-Agent Strategy](#sub-agent-strategy)
- [Updating the Tracker](#updating-the-tracker)
- **References:**
  - [references/research-targets.md](references/research-targets.md) - Detailed target areas
  - [references/tax-calculations.md](references/tax-calculations.md) - Rate tables and formulas

## Workflow

### 0. Check for New Documents (ALWAYS FIRST)

```bash
# Run document scanner to detect new files
~/.claude/skills/tax-research/scripts/scan-documents.sh

# Or manually check
find ~/OneDrive/Finance/Taxes/ -type f \( -name "*.pdf" -o -name "*.csv" \) | head -50
cat ~/OneDrive/Finance/Taxes/document-index.json | jq '.documents[] | select(.status == "new")'
```

If new documents found → investigate them first, update status to "reviewed" in index.

### 1. Read Current State

```bash
# Check current savings (Potential vs Verified)
head -20 ~/Shared/notes/personal/taxes/Tax\ Savings\ Tracker.md

# Review recent research logs
ls -lt ~/Shared/notes/personal/taxes/logs/ | head -5
```

Note the current TOTAL. Your job is to **increase VERIFIED savings**.

### 2. Pick ONE High-Value Target

Select from [Research Targets](#research-targets) based on:

- Has deadline approaching (amendments)
- Hasn't been researched yet (check logs)
- High potential dollar value
- Documents available to analyze

### 3. Launch 3 Sub-Agents

| Agent                   | Task                                    |
| ----------------------- | --------------------------------------- |
| **Document Analyzer**   | Read relevant tax docs, extract numbers |
| **Tax Code Researcher** | Find IRS rules, limits, requirements    |
| **Savings Calculator**  | Compute actual dollar benefit           |

### 4. Update the Tracker

When savings found:

1. Add row to category table (Item, Amount, Tax Benefit, Status, Eligibility Confirmed, Sources)
2. Mark as **Potential** until eligibility checklist complete
3. Move to **Verified** only after all requirements confirmed
4. Update SUMMARY table totals

### 5. Log the Run

Append to `~/Shared/notes/personal/taxes/logs/runs.md`:

```markdown
## YYYY-MM-DD HH:MM

- **Target:** [what was researched]
- **Found:** $X deduction / $Y tax benefit
- **Status:** Potential / Verified
- **New Verified Total:** $Z
- **Next:** [suggested follow-up]
- **Skill Critique:** [1-2 sentences on how to improve this skill]
```

### 6. Update Documents Needed (CRITICAL)

Update `~/Shared/notes/personal/taxes/documents-needed.md` with:

- Documents you think exist but haven't been shared
- Forms needed to complete a deduction
- Evidence to support claims

### 7. Self-Critique the Skill

After each run, add to `~/Shared/notes/personal/taxes/logs/skill-improvements.md`:

```markdown
## YYYY-MM-DD HH:MM

**What went well:** [brief note]
**What was hard:** [friction points]
**Suggested improvement:** [specific actionable change to SKILL.md or scripts]
```

### 8. Save Detailed Research

Write findings to: `~/Shared/notes/personal/taxes/research/Research - [Topic] - YYYY-MM-DD.md`

Include citations: IRS publication numbers, URLs, effective dates.

## File Locations

**Notes & Tracking (Obsidian):**
| File | Purpose |
|------|---------|
| `~/Shared/notes/personal/taxes/Tax Savings Tracker.md` | Potential vs Verified savings |
| `~/Shared/notes/personal/taxes/Tax File Index.md` | Document inventory |
| `~/Shared/notes/personal/taxes/2024 Self-Filing Checklist.md` | Filing guide |
| `~/Shared/notes/personal/taxes/documents-needed.md` | Documents to request from user |
| `~/Shared/notes/personal/taxes/research/` | Research documents |
| `~/Shared/notes/personal/taxes/logs/` | Run logs |

**Tax Documents (OneDrive):**
| File | Purpose |
|------|---------|
| `~/OneDrive/Finance/Taxes/` | Tax documents (PDFs, returns, W2s, 1099s) |
| `~/OneDrive/Finance/Taxes/document-index.json` | Structured document index with status |
| `~/OneDrive/Finance/Taxes/Tax Returns/` | Filed returns and IRS transcripts |
| `~/OneDrive/Finance/Taxes/Crypto/` | Bitcoin/crypto transaction records |

### Scripts

| Script                          | Purpose                          |
| ------------------------------- | -------------------------------- |
| `scripts/run-research.sh`       | Main runner (run/status/summary) |
| `scripts/send-daily-summary.sh` | 8pm Telegram summary             |
| `scripts/scan-documents.sh`     | Update document-index.json       |
| `scripts/notify-failure.sh`     | Alert on job failure             |

## Research Targets

### Current Year (2024 → filing 2025)

- Home office deduction (LLC, work from home)
- LLC business expenses (software, equipment)
- Retirement contributions (Solo 401k)
- Self-employed health insurance
- QBI deduction (Section 199A)
- ESPP optimization (Form 3922)

### Amended Returns (Priority by Deadline)

1. **2022 childcare credit** - Deadline: April 15, 2026 (URGENT)
2. 2023 crypto/deduction review

### Key Documents

- Coinbase cost basis + transaction CSV
- River 1099-B (2023, 2024)
- McElroy daycare invoices (2022)
- Form 3922 ESPP records

See [references/research-targets.md](references/research-targets.md) for detailed analysis.

## Sub-Agent Strategy

Launch 3 agents using Task tool:

```
Task 1: Document Analyzer
- Read specific docs from ~/OneDrive/Finance/Taxes/
- Extract dollar amounts, dates, categories
- Output: structured data with page references

Task 2: Tax Code Researcher
- WebSearch for current IRS rules
- Find limits, phase-outs, requirements
- Output: applicable rules + IRS publication citations

Task 3: Savings Calculator
- Combine doc data + tax rules
- Verify eligibility criteria
- Calculate deduction amount
- Apply marginal rate (~40% combined Fed+CA)
- Output: estimated tax benefit + confidence
```

**Coordinator step:** Merge outputs, check for conflicts, only then update tracker.

## Eligibility Checklist (Potential → Verified)

Before moving savings from Potential to Verified:

- [ ] Applicable tax year confirmed
- [ ] Filing status compatible (MFJ/Single/etc)
- [ ] Income limits checked (not phased out)
- [ ] Required documents obtained
- [ ] No overlap with other deductions/credits
- [ ] IRS rule/publication cited
- [ ] Confidence: High

## Updating the Tracker

### Add to Category Table

```markdown
| Home office (simplified) | $1,500 | $525 | Verified | ✅ | IRS Pub 587, Rev Proc 2013-13 |
```

### Update Summary

```markdown
| **TOTAL** | **$0** | **$525** | Active | 2026-02-01 |
```

(First column = Potential, Second column = Verified)

## Success Metric

**THREE GATES:**

1. **Document Coverage** - % of available documents reviewed (target: 100%)
2. **Documents Needed** - Outstanding document requests (target: 0)
3. **Research Targets** - % of targets investigated (target: 100%)

**TWO NUMBERS:**

1. **Verified savings** - confirmed, can claim
2. **Potential savings** - identified, needs verification

**Run succeeds if:**

- Document coverage increases, OR
- Documents needed list shrinks, OR
- A research target gets completed, OR
- Either savings number increases

**Goal progression:**

1. First: Review ALL documents
2. Second: Request ALL missing documents
3. Third: Complete ALL research targets
4. Finally: Convert Potential → Verified
5. ONLY THEN: Mention filing

**Reporting rule:** Always state which tax years are complete and which are still pending.

## Scheduled Execution

Timer runs every 3 hours via systemd:

- Service: `~/.config/systemd/user/tax-research.service`
- Timer: `~/.config/systemd/user/tax-research.timer`
- Failure alert: `~/.config/systemd/user/tax-research-failure@.service`

Daily summary sent at 8pm via Telegram.

## Failure Handling

On failure:

- systemd OnFailure triggers notify-failure.sh
- Telegram alert sent
- Logged to `research-logs/failures.log`
