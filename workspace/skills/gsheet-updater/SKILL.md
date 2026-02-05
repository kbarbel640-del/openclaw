---
name: gsheet-updater
description: Update Google Sheets via browser automation. Use when asked to fill, update, or read data in Google Sheets. Supports navigating to cells, typing values, and reading current content. Requires the clawd browser profile to be logged into a Google account with edit access.
---

# Google Sheets Updater

## Prerequisites

- Browser profile `clawd` must be logged into a Google account with edit access to the target sheet.
- Default account: `2077doss@gmail.com` (Andrew / 24Bet work account)
- If access denied, ask user to share the sheet with the logged-in account or switch accounts.

## Core Workflow

### 1. Open the Sheet

```
browser action=open profile=clawd targetUrl=<sheet_url>
```

Wait for load, then take a screenshot to confirm the correct sheet/tab is visible.

### 2. Navigate to a Cell

Use the **Name Box** (aria ref for the Name Box textbox) to jump to any cell:

```
browser action=act → click on Name Box textbox
browser action=act → type cell reference (e.g. "D141"), submit=true
```

This is the most reliable way to navigate — do NOT try to click cells directly (they don't have stable aria refs in Google Sheets).

### 3. Type a Value into the Selected Cell

After navigating to a cell via Name Box, type directly into the **formula bar textbox** (the second textbox in the toolbar area, NOT the Name Box):

```
browser action=act → type value into formula bar, slowly=true
browser action=act → press Tab (to confirm and move right) or Enter (to confirm and move down)
```

**Important patterns:**
- `Tab` confirms the value and moves to the next cell RIGHT
- `Enter` confirms the value and moves to the next cell DOWN
- After Tab/Enter, you can immediately type the next value (no need to re-navigate if filling adjacent cells)
- Use `slowly=true` for reliable character input

### 4. Fill Multiple Cells in a Row

For efficiency, navigate to the first cell, then use Tab to chain across columns:

```
Navigate to D141 → type "100%" → Tab
(now at E141) → type "1" → Tab
(now at F141) → type "02/02/2026" → Tab
...
```

### 5. Read Current Values

Take a screenshot or use the Name Box to navigate to a cell, then read the formula bar content from the snapshot.

### 6. Verify Changes

Always take a screenshot after completing edits to confirm values were saved. Look for "已保存到云端硬盘" (Saved to Drive) in the toolbar.

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "您需要访问权限" | Wrong Google account or no access. Switch account or ask user to share. |
| Value not appearing in cell | Ensure you pressed Tab or Enter to confirm. Type into formula bar, not Name Box. |
| Cell shows formula instead of value | Prefix with a single quote `'` to force text mode. |
| Name Box navigation not working | Click Name Box first, clear existing text, then type new cell ref + Enter. |

## Known Sheet: 24Bet G9 Project Management

- **URL**: `https://docs.google.com/spreadsheets/d/1TNgJZXUeF5aDQ5w-bDS44I8_qVFDWYYzu4ojpQx3wlU/edit?gid=1414559093`
- **Tab**: 数据分析每日工作进度
- **Account**: 2077doss@gmail.com
- **Structure** (Row 140 = header for current sprint):

| Column | Field | Example |
|--------|-------|---------|
| A | 任务名称 | 【架构】服务化框架设计（模块拆分） |
| B | Jira | — |
| C | 负责人 | Andrew |
| D | 当前进度 | 100% |
| E | 预计工时D | 1 |
| F | 开始时间 | 02/02/2026 |
| G | 结束时间 | 02/02/2026 |
| H | 实际用时D | 1 |
| I | 状态 | 正常 / 取消 |
| J | 备注 | Free text |

Sprint sections are separated by blue header rows with week labels (e.g. "第31周 (2/2/2026-2/6/2026)").
