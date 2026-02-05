---
name: bg666-db
description: Query BG666 iGaming database (RDS). Use for player data, recharge orders, VIP logs, game statistics. Requires ZeroTier network.
---

# BG666 Database Skill

Query BG666 and Matomo databases.

## Quick Start

```bash
# BG666 (直連，需 ZeroTier)
~/clawd/skills/bg666-db/scripts/query.py "SELECT COUNT(*) FROM sys_player"

# Matomo (自動 SSH tunnel)
~/clawd/skills/bg666-db/scripts/matomo.py "SELECT COUNT(*) FROM matomo_log_visit"
```

## BG666 Tables (ry-cloud)

| Table | Description |
|-------|-------------|
| sys_player | 玩家主表 |
| player_recharge_order | 充值訂單 |
| player_withdraw_order | 提現訂單 |
| player_statistics_day | 每日統計 |
| player_logininfor | 登入記錄 |
| player_game_statistics | 遊戲統計 |
| vip_oper_log | VIP 操作日誌 |
| player_vip_reward | VIP 獎勵 |
| first_deposit_record | 首充記錄 |
| channel_data_statistics | 渠道數據統計 |
| channel_game_statistics | 渠道遊戲統計 |

## Matomo Tables

| Table | Description |
|-------|-------------|
| matomo_log_visit | 訪問記錄 |
| matomo_log_action | 動作記錄 |
| matomo_log_conversion | 轉化記錄 |
| matomo_goal | 目標定義 |
| matomo_site | 網站設定 |
| matomo_custom_dimensions | 自訂維度 |

## Examples

```bash
# BG666: VIP 等級分佈
./scripts/query.py "SELECT vip_level, COUNT(*) FROM sys_player GROUP BY vip_level"

# BG666: 今日充值總額
./scripts/query.py "SELECT SUM(amount) FROM player_recharge_order WHERE DATE(create_time) = CURDATE()"

# Matomo: 今日訪問數
./scripts/matomo.py "SELECT COUNT(*) FROM matomo_log_visit WHERE DATE(visit_first_action_time) = CURDATE()"

# JSON 輸出
./scripts/query.py --json "SELECT * FROM sys_player LIMIT 5"
```

## Telegram 操作

```bash
# 列出對話
./scripts/tg.py chats

# 讀取消息
./scripts/tg.py read -1003337225655 --limit 20

# 發送消息
./scripts/tg.py send -1003337225655 "消息內容"

# 下載媒體
./scripts/tg.py media -1003337225655 --limit 10

# 搜尋消息
./scripts/tg.py search -1003337225655 "matomo"
```

### 常用群組 ID
| 群組 | ID |
|------|-----|
| 666数据需求群 | -1003337225655 |
| 666数据日报群 | -5173465395 |
| bg666运营-策划试用组 | -5000326699 |

## Connection Info

**BG666 RDS:**
- Host: bg666-market-readonly.czsks2mguhd5.ap-south-1.rds.amazonaws.com
- Database: ry-cloud
- Access: ZeroTier required

**Matomo:**
- Host: 13.205.188.209 (SSH) → 10.188.4.51:3306 (internal)
- Database: matomo
- Access: SSH tunnel (auto-created)
