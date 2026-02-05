# Heartbeat Playbook

這是 HEARTBEAT 的完整作業指引（詳細版）。
請先載入環境變數：
- `source ~/clawd/.env`
- 需要的變數：`GITHUB_TOKEN`, `DEEPSEEK_API_KEY`

---


## ⏱️ 節流與去重（必用）

1. 任務執行前先判斷是否要跑（依任務頻率）
   例：`python3 ~/clawd/scripts/heartbeat_state.py should-run pipelines 300`
2. 任務結束後記錄結果
   例：`python3 ~/clawd/scripts/heartbeat_state.py record pipelines ok`
3. 通知前先做冷卻判斷（避免重複通知）
   例：`python3 ~/clawd/scripts/heartbeat_state.py should-notify pipelines_fail:YYYY-MM-DD 3600`

## ▶️ 心跳主控腳本

快速跑 critical：
```bash
python3 ~/clawd/scripts/heartbeat_run.py --tier critical
```

跑 standard（專案輪值 + 需求追蹤）：
```bash
python3 ~/clawd/scripts/heartbeat_run.py --tier standard
```

跑 slow（低頻報告）：
```bash
python3 ~/clawd/scripts/heartbeat_run.py --tier slow
```

只看會跑哪些任務：
```bash
python3 ~/clawd/scripts/heartbeat_run.py --list
```

# HEARTBEAT.md

## 📱 Telegram 群組自動同步（每次心跳）

**每次心跳掃描杜甫的 Telegram 群組，發現新的自動加進 config**

```bash
python3 ~/clawd/scripts/telegram_group_sync.py
```

**觸發條件**：發現新群組
**動作**：
1. 自動加進 Moltbot config（requireMention: false）
2. Gateway 重啟（SIGUSR1）
3. 通知杜甫：「🆕 已自動加入群組：XXX」

**不需要杜甫確認** — 只要是他帳號裡的群組，直接同步。

**節流建議**：5 分鐘內已重啟過就跳過重啟（用 `heartbeat_state.py should-run telegram_group_sync 300`）。

---

## ⏰ 每日定時任務

### 17:30 天氣提醒
**對象**：LINE 家族群 (Cf529a05bf3b802a1ef1d4bacf9a5035e) 的夜班朋友
**內容**：查詢苗栗和新竹天氣，用溫暖的語氣問候剛起床的朋友
**格式**：簡潔、加上 emoji、問候語

---

## 🎙️ Podcast 素材品味（每次心跳做一次）

1. 讀 `podcast/metadata.json` 挑一段**未品味過**的逐字稿
2. 讀該逐字稿的前 100 字
3. 思考：這段素材可以怎麼用？有什麼金句？適合哪個系列？
4. 把心得寫到 `podcast/text/tasting-notes.md`（追加）
5. 標記已品味

**原則：不急著產出，慢慢累積，等素材夠了再壓縮成經典作品。**

---

## 🔄 專案輪值系統（核心任務）

**每次 heartbeat 必做：**

1. 讀 `PROJECT_REGISTRY.md`
2. 挑 **1-2 個專案** 推進（優先級高 + 最久沒動）
3. 做一個小步驟
4. 更新 `PROJECT_REGISTRY.md` 的輪值記錄
5. 報告結果

---

## 🔄 Session 對齊（每次心跳必做，優先級最高）

**核心目的：讓所有 session 的知識和方向保持一致**

### 步驟一：知識同步（最重要）
1. `sessions_list` 掃最近 24h 活躍 session
2. 看每個 session 最後一條訊息，找**新知識/新決策**
3. 有價值的寫入 `memory/YYYY-MM-DD.md`（供所有 session 下次啟動讀取）
4. 特別關注：工作決策、技術方案、人際動態、老闆指令

### 步驟二：願景對齊
- 每個 session 在做的事 → 是否指向「AI 員工自動運轉」？
- 偏離的不是問題（社群互動、家庭群也重要），但要意識到比例
- 記錄：今天 願景任務 vs 瑣事 的比例

### 步驟三：狀態檢查
- 哪些 session token 用很多但沒產出？（可能卡住）
- 哪些 session 超過 24h 沒動但有未完成任務？
- 需要介入的 → 報告給杜甫

### 對齊頻率
| 時機 | 深度 | 做什麼 |
|------|------|--------|
| 每次心跳 | 快掃 | 看最後 1 條，找關鍵變化 |
| 每 4 小時 | 中掃 | 看最近 5 條，同步知識 |
| 每日冥想 | 全掃 | 回顧所有 session，蒸餾到 MEMORY.md |

---

## 🧠 記憶系統監控（每次心跳必做）

**核心目的：確保「清 session ≠ 失憶」**

### 監控指標

| 指標 | 計算方式 | 紅線 | 修復動作 |
|------|----------|------|----------|
| Bootstrap 執行率 | 今日 bootstrapped:true / 總新 session 數 | < 80% | 檢查 AGENTS.md 是否被跳過 |
| 記憶檔案新鮮度 | `memory/YYYY-MM-DD.md` 最後更新時間 | > 4h 沒更新 | 主動蒸餾近期對話 |
| 記憶遺失事件 | 被糾正「你應該知道」的次數 | > 0 就記錄 | 記錄到 error registry，找模式 |

### Bootstrap Log
位置：`memory/bootstrap-log.json`
```json
{
  "2026-02-04": {
    "sessions": [
      {"sessionKey": "...", "bootstrapped": true, "ts": 1234567890, "filesRead": ["memory/2026-02-04.md", "SOUL.md"]}
    ],
    "rate": 1.0,
    "memoryLossEvents": []
  }
}
```

### 心跳檢查流程
1. 讀 `memory/bootstrap-log.json`
2. 計算今日 Bootstrap 執行率
3. 檢查 `memory/YYYY-MM-DD.md` 最後更新時間
4. 如果有紅線觸發 → 報告給杜甫

### 記憶遺失事件記錄
當被糾正「你應該知道這個」時，立刻記錄：
```json
{
  "ts": 1234567890,
  "sessionKey": "...",
  "whatWasForgotten": "描述",
  "whereItShouldBe": "memory/xxx.md 或 MEMORY.md",
  "rootCause": "沒讀 bootstrap / 沒蒸餾 / 其他"
}
```

---

## 📊 自動化管線監控（每次心跳必做，最小間隔 5 分鐘）

**核心原則：管線失敗 = 立刻通知杜甫，不等人問**

### 檢查方式
```bash
# 一次拉所有 repo 的最近一次 Action 狀態
curl -s -H "Authorization: token ${GITHUB_TOKEN}" \
  "https://api.github.com/repos/ThinkerCafe-tw/thinker-news/actions/runs?per_page=1"
curl -s -H "Authorization: token ${GITHUB_TOKEN}" \
  "https://api.github.com/repos/ThinkerCafe-tw/maryos/actions/runs?per_page=1"
curl -s -H "Authorization: token ${GITHUB_TOKEN}" \
  "https://api.github.com/repos/ThinkerCafe-tw/paomateng/actions/runs?per_page=1"
```

**節流建議（5 分鐘）**

```bash
if python3 ~/clawd/scripts/heartbeat_state.py should-run pipelines 300; then
  # 執行以上 curl 檢查
  python3 ~/clawd/scripts/heartbeat_state.py record pipelines ok
fi
```
curl -s -H "Authorization: token ${GITHUB_TOKEN}" \
  "https://api.github.com/repos/ThinkerCafe-tw/thinker-news/actions/runs?per_page=1"
curl -s -H "Authorization: token ${GITHUB_TOKEN}" \
  "https://api.github.com/repos/ThinkerCafe-tw/maryos/actions/runs?per_page=1"
curl -s -H "Authorization: token ${GITHUB_TOKEN}" \
  "https://api.github.com/repos/ThinkerCafe-tw/paomateng/actions/runs?per_page=1"
```

### 管線清單
| 管線 | Repo | 頻率 | 失敗處理 |
|------|------|------|----------|
| thinker-news | ThinkerCafe-tw/thinker-news | 每日 06:00 UTC | 自動重跑 + 通知杜甫 |
| maryos | ThinkerCafe-tw/maryos | 每日多次 | 通知杜甫 |
| paomateng | ThinkerCafe-tw/paomateng | 每 5 分鐘 | 連續失敗 3+ 次才通知 |

### 資源監控
| 資源 | 檢查方式 | 紅線 |
|------|----------|------|
| DeepSeek 餘額 | `curl -s -H "Authorization: Bearer ${DEEPSEEK_API_KEY}" https://api.deepseek.com/user/balance` | < $2 通知 |

**節流建議（15 分鐘）**

```bash
if python3 ~/clawd/scripts/heartbeat_state.py should-run deepseek_balance 900; then
  # 執行以上餘額檢查
  python3 ~/clawd/scripts/heartbeat_state.py record deepseek_balance ok
fi
```

**通知冷卻（1 小時）**

```bash
python3 ~/clawd/scripts/heartbeat_state.py should-notify deepseek_low:YYYY-MM-DD 3600
```

### 失敗時的行動
1. **thinker-news 失敗** → 自動重跑 workflow dispatch → 通知杜甫
2. **餘額不足** → 立刻通知杜甫充值
3. **任何管線連續失敗 2 天** → 升級為🔴緊急通知

---

## 📋 報告格式

```
【心跳報告】
📍 輪值專案：{專案名}
✅ 完成：{做了什麼}
⏭️ 下一步：{接下來要做什麼}
📊 專案狀態：{更新了什麼}
```

---

## 📊 系統健康檢查（每次心跳必做）

**每次心跳第一步**：跑 `python3 ~/clawd/scripts/health_check.py`
- 結果精簡顯示在心跳報告裡
- 異常項（⚠️）需要在報告中標記為「需注意」
- 同時跑 `python3 ~/clawd/scripts/growth_tracker.py` 更新成長指標

---

## 🔍 主動問題偵測（每次心跳輪流做一項）

| 偵測項 | 怎麼做 | 頻率 |
|--------|--------|------|
| 📦 交付卡住 | 讀 TASKS.md，找 📦/📤 超過 24h 沒動的 | 每次 |
| 💬 未回訊息 | 讀 telegram unread，找被 @ 沒回的 | 每次 |
| 📊 數據異常 | 檢查 BG666 日報是否正常產出 | 每日 1 次 |
| 🔧 服務健康 | exec-bridge / telegram-bridge 狀態 | awareness 已做 |
| 📝 記憶蒸餾 | 見 #7 記憶整理 | 每 3 天 |

發現問題 → 加入 TASKS.md 或直接處理。

---

## 🔧 Skill Metrics（每次心跳必做）

**檢查項目**：
1. `find ~/clawd/skills/ -name "*.md" -newer /tmp/skill-check-marker 2>/dev/null` → 有哪些 skill 被新增/修改
2. 更新 marker：`touch /tmp/skill-check-marker`
3. 統計：總 skill 數、今日新增、今日修改、最近使用的 skill

**報告格式**：
```
🔧 Skills: 共X個 | 今日+Y新增 | Z修改 | 最近使用: [skill名]
```

---

## 📋 BG666 需求追蹤（每次心跳必做）

**流程：**
1. 掃 Telegram 關鍵對話（Brandon, Albert, Red, Fendi, lusu, 數據需求群, 運營群, 日報群）
2. 掃 Lark 瀏覽器（https://xjpr2wuiezaq.jp.larksuite.com/next/messenger）— 帳號 6
3. 對比 `BG666_TASKS.md`，有變動就更新
4. 有變動 → 推送彙整到 Telegram 66 群（用彩色標籤格式）
5. 沒變動 → 不推

**推送格式：**
```
📋 BG666 需求彙整（HH:MM 更新）

🔴 緊急
• [人] — [需求]（交付日期）

🟡 本週
• [人] — [需求]（狀態）

🟢 進行中
• [項目]（狀態）

🔵 關注
• [事項]
```

---

## ⚠️ 規則

1. **不要只回 HEARTBEAT_OK** — 至少推進一個專案
2. **雨露均沾** — 不要連續兩次 heartbeat 做同一個專案
3. **小步快跑** — 每次做一個可完成的小任務
4. **記錄更新** — 一定要更新 PROJECT_REGISTRY.md
5. **Dashboard 記錄** — 每次心跳結束前，用 `heartbeat_dashboard.py` 記錄產出
6. **Token 要節流** — 目標成本降低 50%，低價值任務需冷卻或降頻
7. **空跑要避免** — 若任務在冷卻期，改做輕量整理或回報 HEARTBEAT_OK

---

## 🚨 例外情況

如果真的沒事做（所有專案都在等外部輸入），才回：
```
HEARTBEAT_OK
📝 所有專案等待中：[列出原因]
```
