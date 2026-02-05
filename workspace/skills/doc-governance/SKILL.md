---
name: doc-governance
description: Multi-role document governance system for ThinkerCafe strategic documents. Use when modifying operation plans, brand strategy, or any strategic document. Triggers on changes to files in output/ that are strategic docs (thinkercafe-operation-plan.md, cruz-brand-strategy.md). Automatically convenes a committee of 5 roles to review changes before applying them.
---

# Document Governance Skill

## Purpose
Ensure strategic documents are reviewed from multiple perspectives before modification. Prevent single-viewpoint bias by simulating a committee review process.

## Governed Documents
- `output/thinkercafe-operation-plan.md` — 營運計劃書
- `output/cruz-brand-strategy.md` — 品牌策略書
- Any future strategic document registered in `references/registry.md`

## Committee Roles

| Role | Emoji | Perspective | Owned Sections | Review Question |
|------|-------|-------------|----------------|-----------------|
| 策略長 (CSO) | 🧠 | 全局一致性 | 執行摘要、北極星、使命願景 | 這個改動偏離方向了嗎？ |
| 營運長 (COO) | 📊 | 可執行性 | 90天計劃、飛輪、KPI、組織架構 | 做得到嗎？數字合理嗎？ |
| 財務長 (CFO) | 💰 | 成本效益 | 財務模型、風險對策 | 花得起嗎？划算嗎？ |
| 學院長 (Dean) | 🎓 | 教學品質 | 學院事業部、課程產品線 | 學員體驗好嗎？課程邏輯通嗎？ |
| 增長長 (CGO) | 🔥 | 流量轉化 | 內容策略、互助商會、增長部 | 能帶來人嗎？能變現嗎？ |

## Workflow

### 1. 收到修改請求
When Cruz or a system event proposes a change to a governed document:
- Identify which document and sections are affected
- Determine which committee roles are relevant (any role whose owned sections are impacted)

### 2. 影響評估
Briefly state:
- What is being changed
- Which sections are affected
- Which roles need to weigh in

### 3. 委員會審議
For each relevant role, generate a brief opinion (2-3 sentences max) from that role's perspective. Use the role's review question as the lens.

Format:
```
📋 修改提案：[一句話描述]

🧠 策略長：[意見]
📊 營運長：[意見]
💰 財務長：[意見]
🎓 學院長：[意見]
🔥 增長長：[意見]

✅ 共識：[通過/有條件通過/需討論]
⚠️ 爭議點：[如有]
```

### 4. 衝突處理
If roles disagree:
- Summarize each side's position in one sentence
- Present the trade-off clearly to Cruz
- Wait for Cruz to decide

### 5. 執行修改
After Cruz approves (or if all roles agree):
- Apply changes to the document
- Add entry to modification log (see below)
- Commit with message: `[doc-governance] 修改摘要`

### 6. 修改日誌
Append to `references/changelog.md`:
```
### [YYYY-MM-DD HH:MM] 修改記錄
- **提案**：[什麼改動]
- **影響範圍**：[哪些章節]
- **委員意見**：[摘要]
- **決策**：[Cruz的決定]
- **執行**：[已完成/待執行]
```

## Quick Mode
For minor changes (typo fixes, date corrections, factual corrections):
- Skip full committee review
- Just note: `🧠 策略長：小幅修正，免審。` and apply directly.

## Meeting Mode
When Cruz explicitly requests a "meeting" or when a change fundamentally alters the business direction:
- Each role presents a longer position (5-8 sentences)
- Roles can respond to each other's points
- Generate a meeting transcript
- Save transcript to `references/meetings/YYYY-MM-DD-topic.md`

## Registering New Documents
To add a new governed document, append to `references/registry.md`:
```
| document path | owner role | description |
```
