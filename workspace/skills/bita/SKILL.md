---
name: bita
description: 處理幣塔客服群訊息。員工用標記 (80/20/NB) 指定角色，bot 自動套用 prompt 並輸出校準報告。
---

# 幣塔客服處理流程

## 新工作流程（標記制）

員工不再需要貼整段 prompt，只要這樣發：

```
80
[截圖或對話內容]
```

Bot 收到後：
1. 看標記決定用哪個角色的 prompt
2. 自動解析內容
3. 輸出校準報告

### 標記對照表

| 標記 | 角色 | 覆蓋 | 用途 |
|------|------|------|------|
| `80` | 氣質美女 | 80% | 一線客服，標準問題 |
| `20` | 貴賓狗 | 20% | 升級語氣，奧客處理 |
| `NB` | 社交NB | 拉新 | 漏斗追蹤，貼文私訊 |

### 無標記時（⚠️ 重要：不可 NO_REPLY）

- 有截圖但沒標記 → **主動提醒發送者加標記**，例如：「收到截圖了～請補個標記（80/20/NB）我才能產校準報告喔 🙏」
- 有「對答案」關鍵字 → 預設用 80
- 其他文字無截圖 → 判斷是否需要回應

> **永久規則**：在幣塔 1:1 客服群收到圖片/截圖時，**絕對不能 NO_REPLY**。人類隨手一個標記對準確性幫助很大，但如果忘了加，bot 的職責是提醒，不是沉默。

---

## 群組識別

### 員工 1:1 群組

| 員工 | 群組 ID | 群組名稱 |
|------|---------|----------|
| 兔兔 | -5148508655 | 幣塔AI工作回報(兔) |
| 小峻 | -5159438640 | 幣塔AI工作回報(俊) |
| QQ | -5030731997 | 幣塔AI工作回報(QQ) |
| Z | -5070604096 | 幣塔AI工作回報(子) |
| 茂 | -5186655303 | 幣塔AI工作回報(茂) |
| 小周 | -5295280162 | 幣塔AI工作回報(周) |
| 葦葦 | -5023713246 | 幣塔AI工作回報(緯) |

### 管理群組

| 群組 | ID | 用途 |
|------|-----|------|
| 幣塔管理群 | -1003849990504 | 策略討論（身份：無極） |
| 幣塔-營銷客服 | -5297227033 | 員工日常（身份：嫦娥） |

---

## 訊息處理邏輯

```python
def handle_message(msg):
    text = msg.text or ""
    first_line = text.split('\n')[0].strip()

    # 1. 檢查標記
    if first_line in ['80', '20', 'NB']:
        marker = first_line
        content = '\n'.join(text.split('\n')[1:])
        return process_with_role(marker, content, msg.media)

    # 2. 檢查強制關鍵字
    if '退水' in text:
        return "你爆分，我發包！爆越大，拿越多！"
    if '紅包' in text:
        return get_红包活动内容()

    # 3. 有截圖但沒標記 → 提醒加標記（不可 NO_REPLY！）
    if msg.media and not text.strip():
        return "收到截圖了～請補個標記（80/20/NB）我才能產校準報告喔 🙏"

    # 4. 有「對答案」→ 用 80 校準
    if '對答案' in text or '校準' in text:
        return process_with_role('80', text, msg.media)

    # 5. 其他 → 判斷是否回應
    return maybe_respond(msg)
```

---

## 校準報告格式

```markdown
**📋 校準報告**

**對話摘要：**
| 項目 | 內容 |
|------|------|
| 會員 | {member_id} |
| 金額 | ${amount} |
| 匯率 | {amount} × {rate} = {total} |
| 方式 | {method} |

**流程步驟：**
{flow_steps}

**✅ 全流程完整！** 或 **⚠️ 缺少：{missing}**

**📊 今日累計（{date}）**
| 流程類型 | 次數 | 狀態 |
|----------|------|------|
| 儲值入金（銀行轉帳） | {n} | ✅×n |
| 儲值入金（超商代碼） | {n} | ✅×n |
| 出金（無卡提款） | {n} | ✅×n |
```

---

## 四大角色規則速查

### 氣質美女 (80)
- 標準回覆 + 代打後補對答案
- 常見問題、流程教學、輕度抱怨
- 查詢類必須先說「正在查詢中」

### 貴賓狗 (20)
- **嚴禁**說「我已接手」「我是主管」
- **必須**說「我正在幫您跟主管確認」
- 辱罵/威脅/投訴/要找主管 → 用這個

### 社交NB (NB)
- 每日 20 觸及（L0 目標）
- A/B/C 分類管理帳號安全
- 貼文、私訊、漏斗追蹤

### 嫦娥
- 打卡模板 + 下班匯總
- 不直接對客，只做內部管理

---

## 強制關鍵字

| 關鍵字 | 強制回覆 |
|--------|----------|
| 退水 | 你爆分，我發包！爆越大，拿越多！ |
| 紅包 | [完整紅包活動內容] |

---

## 截圖解析輸出

```markdown
【交易記錄】
- 類型：買幣/賣幣/轉帳
- 金額：NT$ ___
- 匯率：___
- 幣量：___
- 時間：___
- 帳號：___
- 狀態：成功/待確認/異常
```

---

## 文字探勘腳本

```bash
# 從 ~/Documents/幣塔/ 執行
python analytics/text_mining.py              # 今日
python analytics/text_mining.py 2026-01-28   # 指定日期
```

---

---

## 成長培育系統（Growth System）

### 校準後自動化 Pipeline（⚡ 核心流程）

**每次校準報告輸出後，session 必須執行以下步驟：**

#### Step 0: AI 自動評分
在生成校準報告的同時，AI 必須自己產出：
- **score**（0-1）：這次校準的整體品質
  - 1.0 = 完美，流程完整 + 語氣正確 + 無遺漏
  - 0.7 = 合格，有小瑕疵但整體 OK
  - 0.5 = 勉強，有明顯遺漏或語氣偏差
  - 0.3 = 不及格，多處錯誤
- **tags**（列表）：標記這次校準的特徵
  - 正面：`tone_ok`, `flow_complete`, `proactive_confirm`, `escalation_handled`
  - 負面：`missing_confirm`, `tone_mismatch`, `wrong_flow`, `missing_greeting`, `missing_amount_check`
- **feedback**（一句話摘要）：如「流程完整但缺少結尾確認」

#### Step 1: 調用 Pipeline
```python
# 在 ~/Documents/幣塔/analytics/ 目錄下執行
from calibration_pipeline import process_calibration

result = process_calibration(
    employee_id="BT-001",    # 從群組 ID 對照（見下方群組識別表）
    role="80",               # 員工用的標記
    raw_report="完整校準報告文字...",
    score=0.85,              # Step 0 產出的分數
    tags=["flow_complete", "tone_ok"],  # Step 0 產出的 tags
    feedback_text="流程完整，語氣自然",    # Step 0 產出的摘要
)
```

#### Step 2: 檢查結果並決定是否推送
```python
if result["should_push"] and result["coach_context"]:
    # 把 coach_context 餵給螺旋教練 prompt 生成回饋
    # Prompt 位置：skills/bita/prompts/spiral_coach.md
    # 輸入：result["coach_context"]
    # 輸出：1-2 句溫暖的回饋文字（不含分數/術語）
    coach_message = generate_with_spiral_coach(result["coach_context"])
    
    # 在同一個 1:1 群組發送（用 message 工具）
    # ⚠️ 語氣像好主管關心，不是系統通知
    # ⚠️ 不要加「📊」「系統」「分數」等字眼
    send_to_group(chat_id, coach_message)

if result["milestones"]:
    # 里程碑也融入回饋中，不要另外發
    pass

if result["phase_changed"]:
    # Phase 變動 → 通知杜甫（管理群）
    notify_dufu(f"{employee_name} Phase 變動！")
```

#### 群組 ID → 員工 ID 對照
| 群組 ID | 員工 ID | 暱稱 |
|---------|---------|------|
| -5148508655 | BT-001 | 兔兔 |
| -5159438640 | BT-002 | 小峻 |
| -5030731997 | BT-003 | QQ |
| -5070604096 | BT-004 | Z |
| -5186655303 | BT-005 | 茂 |
| -5295280162 | BT-006 | 小周 |
| -5023713246 | BT-007 | 葦葦 |

#### 推送規則
- **開關**：`~/Documents/幣塔/config.json` → `push_enabled`（true/false）
- **每日上限**：`max_daily_pushes`（預設 2）
- **冷靜期**：降級後 3 天不推負面回饋
- **格式**：螺旋教練回饋 1-2 句話，溫暖語氣，不含系統術語

#### 螺旋教練回饋範例
- ✅ 「兔兔，今天的銀行轉帳流程你抓到重點了 👍 繼續保持這個節奏！」
- ✅ 「小峻，多角色切換的意識很好！下次結尾多問一句就更完美了。」
- ❌ 「你的準確率是 76%，趨勢為 plateau。」（禁止！）
- ❌ 「系統檢測到連續錯誤。」（禁止！）

#### Pipeline 完整流程圖
```
員工發截圖+標記 → AI 校準報告 → AI 自動評分（score/tags）
                                      ↓
                            calibration_pipeline.process_calibration()
                                      ↓
                    ┌─ calibration_store.save_calibration() → JSON 存檔
                    ├─ growth_engine.on_calibration()
                    │   ├─ 更新技能分數（指數移動平均）
                    │   ├─ 更新連續錯誤追蹤
                    │   ├─ 檢查觸發條件（連錯≥3/平台期/破紀錄）
                    │   ├─ Phase 升降判斷
                    │   └─ 里程碑檢查
                    └─ 返回 result
                                      ↓
                    should_push=True? → 螺旋教練 prompt → 發送回饋
                    phase_changed? → 通知杜甫
```

### 螺旋教練觸發條件

| 觸發 | 條件 | 行為 |
|------|------|------|
| 校準完成 | 每次校準後 | 生成 1 句個人化回饋 |
| 連續錯誤 | 同類錯誤 ≥ 3 次 | 推送專項提醒 + 通知杜甫 |
| 平台期 | 趨勢 plateau > 7 天 | 換角度刺激 |
| 突破紀錄 | 分數超越歷史最高 | 正向強化 🎉 |
| 里程碑達成 | 見里程碑定義 | 慶祝 + 徽章 |

**推送規則**：
- 每日上限 2 則主動推送
- 降級後 3 天冷靜期不推負面回饋
- 推送開關：`~/Documents/幣塔/config.json` → `push_enabled`

### /dashboard 指令

杜甫在任何群組發 `/dashboard`，bot 回覆團隊儀表板：

```
📊 幣塔團隊儀表板
📅 2026-02-01 14:30 (TPE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔥 Z [Phase 3 拓展] ↑ 準確率88% | 校準15次 | 80✓ 20✓
🟢 兔兔 [Phase 2 穩定] → 準確率72% | 校準12次 | 80✓ | NB=0 ⚠️
🟢 小峻 [Phase 2 穩定] → 準確率68% | 校準8次 | 20✓ NB✓
🟢 小周 [Phase 2 穩定] ↑ 準確率65% | 校準6次 | 80✓
🟡 QQ [Phase 1 紮根] ↓ 準確率48% | 校準5次
🟡 葦葦 [Phase 1 紮根] → 準確率30% | 校準2次
🟡 茂 [Phase 1 紮根] → 準確率0% | 校準0次

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 建議關注：茂（完成率=0）、QQ（趨勢下降）
📈 團隊平均準確率：54%
📊 Phase 分佈：P1:3人 | P2:3人 | P3:1人
```

使用方式：
```python
from analytics.dashboard import generate_dashboard
text = generate_dashboard()
# 發送到 Telegram
```

### 里程碑徽章

| 徽章 | 名稱 | 條件 |
|------|------|------|
| 🔥 | 校準七連勝 | 連續 7 筆分數 ≥ 0.7 |
| 🛡️ | 奧客處理零失誤 | 連續 5 次奧客校準無錯 |
| 🌱 | 首次NB成功 | 首次 NB 校準 ≥ 0.7 |
| 🎯 | 準確率破八成 | 校準準確率首次 ≥ 0.8 |
| 💪 | 單日十校準 | 一天完成 10+ 次校準 |
| ⬆️ | 階段晉升 | Phase 成功升級 |

---

## 金流口徑釐清（進行中）

### 背景
日報金額來自 Gemini Vision 分析截圖，但 amount 欄位混了 TWD 和遊戲幣值，且重複記錄問題嚴重。

### 已知問題
1. **口徑不統一**：Gemini 有時記 TWD，有時記遊戲幣值
2. **重複記錄**：同一筆交易多張截圖 → 多筆 DB 記錄
3. **去重邏輯粗糙**：`DISTINCT tx_type, tx_amount` 會誤合併不同交易
4. **缺少識別欄位**：DB 沒記會員名、遊戲、匯率

### 待釐清事項（在校準互動中自然確認）

**匯率機制**：
- [ ] 匯率 1.3 是什麼遊戲？1 TWD = 1.3 幣？
- [ ] 匯率 130/132 的遊戲（我要賺/星城），1 TWD = 132 幣？
- [ ] 匯率 13,000/14,400 的遊戲（天狐宴），1 TWD = 13,000 幣？
- [ ] 買入和回收匯率差異的意義（利差 = 幣塔利潤？）

**記帳口徑**：
- [ ] 內部記帳用 TWD 還是遊戲幣？
- [ ] 「成交金額」的定義：客戶付的 TWD？遊戲幣值？
- [ ] 活動加碼（周加碼 500）算不算成交？

**交易結構**：
- [ ] 一筆完整交易通常幾張截圖？
- [ ] 有沒有固定的結案截圖格式？
- [ ] 「續」報告（同一筆交易的後續）怎麼識別？

### 釐清方式
**不要直接丟問卷給員工。** 在每次校準報告時：
1. 遇到金額不確定的交易 → 順帶問一句確認
2. 遇到新的匯率/遊戲 → 記錄下來
3. 逐步累積理解，更新此區塊

### 已確認的口徑（持續更新）
| 項目 | 確認值 | 確認日期 | 來源 |
|------|--------|---------|------|
| 日報金額口徑 | TWD（台幣） | 2026-02-03 | 杜甫確認 |

### 2026-02-03 修復：TWD/幣值分離
**已完成的修改：**

1. **Gemini prompt 升級** (`hybrid_analyzer.py`)
   - 新增欄位：`customer_name`, `game`, `rate`, `twd_amount`, `coin_amount`
   - 自動判斷：金額 < 10萬視為 TWD，> 10萬視為遊戲幣
   
2. **DB schema 升級**
   - `conversations` 表新增：customer_name, game, rate, twd_amount, coin_amount
   - `transactions` 表新增：同上
   
3. **日報統計邏輯修改** (`daily_report.py`)
   - 優先使用 `twd_amount`，沒有才用舊的 `tx_amount`
   - 去重邏輯改用 `customer_name + tx_type + amount`（更精確）

**影響**：
- 今天（2/3）之後的日報會用 TWD 口徑
- 歷史資料仍是混合口徑，需另外處理

### 相關程式碼
- **Gemini 分析**：`~/Documents/幣塔/analytics/hybrid_analyzer.py`
  - `VISION_PROMPT`：控制 Gemini 提取什麼欄位
  - 目前只要求：type, method, amount, status, funnel_stage, summary
  - **待升級**：加入 customer_name, game, rate, twd_amount, coin_amount
- **DB 寫入**：`hybrid_analyzer.py` → `analyze_and_save()`
- **日報統計**：`~/Documents/幣塔/analytics/daily_report.py`
  - 去重 SQL：`SELECT DISTINCT tx_type, tx_amount`
  - **待修**：改用更精確的去重邏輯
- **DB 位置**：`~/Documents/幣塔/data/bita.db`
  - 表：`conversations`（原始分析）、`transactions`（交易）、`daily_reports`（日報）

---

## 參考資料

- Prompts: `~/Documents/幣塔/prompts/`
- 員工資料: `~/Documents/幣塔/data/employees.json`
- Growth Profiles: `~/Documents/幣塔/data/growth-profiles/`
- 校準記錄: `~/Documents/幣塔/data/calibrations/`
- 螺旋教練 Prompt: `skills/bita/prompts/spiral_coach.md`
- 成長引擎: `~/Documents/幣塔/analytics/growth_engine.py`
- 儀表板: `~/Documents/幣塔/analytics/dashboard.py`
- 校準存儲: `~/Documents/幣塔/analytics/calibration_store.py`
- 設定檔: `~/Documents/幣塔/config.json`
- 探勘腳本: `~/Documents/幣塔/analytics/text_mining.py`
