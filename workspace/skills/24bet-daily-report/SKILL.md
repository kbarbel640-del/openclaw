---
name: 24bet-daily-report
description: Generate 24Bet daily work reports and standup scripts for Andrew (Cruz). Use when asked to prepare daily report (日報), weekly report, standup meeting script (站立會議), or update 24Bet work progress. Covers report formatting, Google Sheet updates, and standup preparation.
---

# 24Bet Daily Report

## Context

- **Identity**: Andrew (Data PM at 24Bet)
- **Manager**: Jack (PM), Kim (PM)
- **Telegram group**: 24 (id: -5299944691)
- **Google Sheet**: Use `gsheet-updater` skill for progress updates
- **Timezone**: Asia/Taipei (UTC+8)

## Report Formats

### Weekday Daily Report (平日日報)

```
【本周工作进度】
1.【类型】任务名称——进度%
2.【类型】任务名称——进度%
...

【今日工作内容】
1. 具体完成事项——100%
2. 具体完成事项——100%

【次日工作计划】
1. 明天要做的事
2. 明天要做的事
```

### Weekend/Friday Report (週末日報 — 加上下週計劃)

```
下週計劃
1. 下週主線任務
2. 下週主線任務

本週計劃
1. 本週完成的主線
2. 本週完成的主線

今天完成
1. 今日具體完成事項
2. 今日具體完成事項

次日工作
1. 下週一要做的事
```

### Standup Script (站立會議稿 — 週一用，≤1 分鐘)

Structure: 上週 30% + 本月 20% + 本週 50%

```
上周：[上週完成的核心成果，1-2句]
本月：[本月目標一句話]
本週：[本週具體計劃，按天拆]
```

**Important**: Standup happens in the morning (~10:00 TPE). Do NOT prepare standup scripts after the meeting is over.

## Current Sprint Structure (Feb 2026)

| Week | Dates | Theme |
|------|-------|-------|
| Week1 | 2/2-2/6 | 架構重構 Foundation |
| Week2 | 2/9-2/13 | 互動核心 Interaction |
| Week3 | 2/16-2/20 | 春節輕量迭代 Monitoring |
| Week4 | 2/23-2/27 | 日期篩選 Production |

## Existing Report System (Phase 0-3)

Andrew built an automated Telegram daily report bot:

| Phase | Report | Data Source | Content |
|-------|--------|-------------|---------|
| Phase 0 | Funnel 日報 | TiDB | 註冊/首投/首充/復充 |
| Phase 1 | Cohort 日報 | TiDB | D7 留存追蹤 |
| Phase 2.0 | 渠道週報 | TiDB | TOP10 渠道 P&L |
| Phase 2.1 | 用戶價值日報 | TiDB | 高/中/低/沉默分層 + Matomo 行為 |

**Code location**: `~/Documents/24Bet/release_candidates/telegram_daily/src/`

```
src/
├── main.py              # v3.0 entry point (CLI: --report, --date, --dry-run, --simple)
├── fetchers/            # Data fetching layer
│   ├── base.py
│   ├── tidb_funnel.py
│   ├── tidb_cohort.py
│   ├── tidb_channel_pnl.py
│   ├── tidb_user_ltv.py
│   └── matomo_behavior.py  # SSH tunnel to Matomo DB
├── formatters/          # Output formatting
│   ├── telegram_funnel.py
│   ├── telegram_cohort.py
│   ├── telegram_channel_pnl.py
│   └── telegram_user_ltv.py
└── bot/
    └── sender.py        # Telegram push
```

**Data sources** (only 2, no Clarity):
- **TiDB**: `goplay_games` / `goplay_stat` — user retention, deposits, LTV, channels
- **Matomo**: Via SSH tunnel → MySQL — behavior funnels, device distribution, activity

## Pace Control (控速原則)

Cruz's rule: **一天只 commit 一個功能**. Don't over-deliver. Monthly salary = slow is profitable.

- Don't finish early and show it
- Keep OpenClaw/AI agent upgrade as Q2 weapon
- Present steady, predictable progress to Jack

## Workflow

1. **Check time** — Is it morning (before standup) or evening (daily report)?
2. **Check what was done today** — Read recent conversation in this group
3. **Generate report** in the correct format (weekday vs weekend)
4. **Update Google Sheet** — Use `gsheet-updater` skill
5. **Output as plain text** — Ready to paste into Telegram, NOT as markdown file
