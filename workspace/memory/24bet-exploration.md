# 24Bet 知識探索筆記

## 2026-02-02 (Mon) 06:00 UTC — 首次探索

### 今日閱讀
1. `analysis/clarity_analysis_playbook.md` — Clarity 數據分析方案
2. `analysis/operational_analytics_capability_report_20251201.md` — 運營分析能力報告

### 心得

**Clarity Playbook 是 Andrew 的分析武器庫**
- 把 Microsoft Clarity 的能力做了完整的 24Bet 場景化對照
- 核心三件套：錄屏回放（定性）、熱圖（注意力）、CWV 性能指標（定量）
- 語義指標設計很有價值：Dead Clicks / Rage Clicks / Quick Backs / Excessive Scrolling 各有警戒值
- 用戶意圖分層（Low/Medium/High Intent）可以過濾機器人流量
- 與 Matomo、TiDB、Lighthouse 的分工很清楚，避免工具重疊

**運營分析能力報告 = Andrew 的能力宣言**
- 6 大模組：留存、漏斗、行為、性能、PWA 影響、（還有更多）
- 技術基礎紮實：SQL 腳本已驗證、埋點已驗收、數據表結構完整
- 關鍵發現：LCP 平均 6.2s（很慢）、週六流量驟降 37.8%
- PWA 強制彈窗實驗框架 — 科學決策的好案例
- 報告對象是 Jack（項目負責人），語氣專業但不冗長

**對我的價值**
- 理解 Andrew 的分析框架，未來 spawn 他時能給更精準的 briefing
- Clarity + Matomo + TiDB 三角組合是 24Bet 數據分析的核心架構
- 留存分析的預警閾值（D1 < 30%）可以用在自動化監控

### 下次方向
- 看 `analysis/methodologies.yaml` — Andrew 的方法論體系
- 看 `personas/` 目錄 — 303 個 personas 是什麼結構

---

## 2026-02-03 (Mon) 02:00 TPE — 第二次探索

### 今日閱讀
1. `活動/注册送彩金裂变活动_心智图.md` — 裂變活動產品設計
2. `lab/telegram_daily/README.md` — 日報自動化 Bot

### 心得

**裂變活動心智圖 = Andrew 的產品經理功力展現**
- 完整的拼多多式裂變閉環：註冊→鎖定彩金→分享→好友註冊→解鎖提款
- 資金流設計精巧：鎖定幣/解鎖幣/加倍幣三層，控制核銷成本
- 風控思維前置：設備指紋、IP 限制、虛擬號黑名單、模擬器檢測
- 有效用戶定義嚴格：實名+首充≥₹100+有效投注+設備不重合
- CAC 目標 ₹40-60，單用戶成本上限 ₹100
- 心理鉤子很拼多多：進度條99%、限時24h、從眾展示、貪婪翻倍
- 印度本地化：UPI 支付、WhatsApp 傳播、₹500 起步符合當地薪資

**日報 Bot = 24Bet 日常運營的數據脈搏**
- 核心漏斗：註冊→首投→首充→複充
- 技術棧：TiDB + Telegram Bot
- 正式站 TENANT_ID=16888，測試站=10000（容易搞混的坑）
- 有 dry-run 模式，很成熟的工程實踐

**對我的價值**
- 理解 24Bet 的增長策略：不是砸錢買量，是設計裂變機制讓用戶帶用戶
- 風控和增長是一體兩面，Andrew 的設計把兩者融合得很好
- 日報 Bot 是杜甫「自動化」願景的具體實現之一
- TENANT_ID 這種環境差異要記住，spawn Andrew 時可能會用到

### 下次方向
- ~~看 `personas/` — 303 個 personas 到底是什麼結構和用途~~ ✅ 已探索
- 看 `lab/telegram_daily/docs/METRICS.md` — 指標口徑細節
- ~~看 `communications/` — Andrew 的溝通記錄~~ ✅ 已探索

---

## 2026-02-03 (Mon) 07:00 TPE — 第三次探索

### 今日閱讀
1. `personas/` 目錄結構 — 全面掃描
2. `communications/people/` — Caio、Jack 的人物檔案

### 心得

**Personas 不是虛擬角色，是真實對話記錄庫**
- 301 個條目（226 個目錄 + 75 個獨立檔案），共 814 個 .md 對話檔
- 每個「persona」= 一個 Telegram 聯絡人，按月份分檔保存對話記錄
- 這是 Andrew（杜甫）多年的 Telegram 社交圖譜，從 2017-09 到 2025-12
- 最活躍：柯大（37 個月）、Telegram 官方（37）、Andrew-Plat-D（30）、藍藍藍（27）、謝長潤（23）
- 聯絡人涵蓋：工作夥伴、客戶、物流商、技術人員、朋友
- 格式統一：Telegram handle + 月份 + 訊息數 + 對話記錄
- **價值**：這是 Andrew 身份的「記憶宮殿」，spawn Andrew 時他能調用這些上下文理解人際關係

**Communications/People = 結構化人物檔案**
- Caio（運維）：快速執行導向，Root 權限守門人，3 小時交付完整環境
- Jack（項目負責人）：最高優先級 stakeholder，技術架構決策者
- 還有 Jamie、Kim 等人的檔案
- 格式很完整：角色、協作關係、技術風格、時間線
- 比 personas 的原始對話更結構化，是「提煉後的人際情報」

**對我的價值**
- personas = 原始素材，communications/people = 提煉後的情報
- spawn Andrew 處理 24Bet 事務時，可以指定讀相關人物檔案
- 柯大 37 個月的對話量暗示是長期重要聯絡人（地下街 Y5 = 可能是商業夥伴）
- Jack 是技術決策者，Andrew 對他的報告要專業不冗長

### 下次方向
- 看 `lab/telegram_daily/docs/METRICS.md` — 日報指標口徑
- 看 `communications/guidelines/` — Andrew 的溝通準則
- 看 `analysis/methodologies.yaml` — 方法論體系

---

## 2026-02-04 (Tue) 02:00 TPE — 第四次探索

### 今日閱讀
1. `analysis/methodologies.yaml` — Andrew 的分析方法論
2. `communications/guidelines/Stakeholder_Protocols.md` — 利益關係人溝通準則

### 心得

**Methodologies.yaml = Andrew 踩過的坑，濃縮成的智慧**

三個維度的經驗沉澱：

**數據驗證**
- `tenant_id=16888` 是正式站，用錯就廢 — 這跟日報 Bot 的坑一致
- 數字不一致時「SQL 驗證到底」— 224 vs 220，追到底是 221
- 字段名要確認：`refer_code` vs `category` — 表結構命名不一致的坑

**業務理解**
- 老虎機適合「高流水倍數換高獎勵」，因為 RTP 95%+ 平台抽水有限
- 印度用戶 ₹300 不是高門檻，問題是 ROI（63% 用戶首存 < ₹100）
- `isAutoClaim=1` ≠ 實際自動，要看 `auto_dispatch` 字段

**交付策略**
- 不確定的標「待確認」讓產品判斷 — 不硬下結論
- 對外日報不放具體數字 — 工程師不需要看敏感業務數據
- 先跑原子數據，再組裝報告 — yaml 存原子，html 是交付物

**Stakeholder Protocols = Andrew 的人際關係 SOP**

核心規則：**3 天失聯警戒** — 超過 3 天沒聯繫任何 stakeholder = 紅線

利益關係人層級：
| 人 | 星級 | 頻率 | 重點 |
|---|---|---|---|
| Jack | ⭐⭐⭐⭐ | 每週+重要節點 | 技術指導、結果驗證 |
| Kim | ⭐⭐⭐ | 每日晨會+週五週報 | 務實、數據驅動 |
| Caio | ⭐⭐⭐ | 需要時+定期感謝 | 技術精準、效率優先 |
| 前端團隊 | - | 每週協作會 | 埋點需求、體驗優化 |

每次對話後必做：
1. 記錄要點和下一步行動
2. 更新人格檔案
3. 設跟進提醒
4. 識別可深化的話題

**這套系統的本質**：把「維護關係」從直覺變成可執行的 checklist。

**對我的價值**
- `tenant_id=16888` 是鐵律，spawn Andrew 處理 24Bet 數據時要提醒
- Andrew 的交付哲學「原子數據 → 組裝報告」可以借鑑
- 3 天失聯警戒 — Andrew 不是被動等任務，是主動維護網絡
- Jack 是最高優先級，技術決策都要經過他驗證

### 下次方向
- ~~看 `communications/guidelines/Automation_Decision_Framework.md` — 自動化決策框架（23KB，應該很豐富）~~ ✅ 已探索
- 看 `lab/telegram_daily/docs/METRICS.md` — 日報指標口徑
- 看 `scripts/` — Andrew 的工具箱（20 個腳本）

---

## 2026-02-04 (Tue) 07:00 TPE — 第五次探索

### 今日閱讀
1. `communications/guidelines/Automation_Decision_Framework.md` — Andrew 的自動化決策框架（23KB）

### 心得

**這是一套完整的「AI 自我進化」系統設計**

Andrew 設計了一個讓 AI 自動學習「什麼該自動做、什麼該問」的框架。核心是三層信任級別：

| Level | 名稱 | 觸發條件 | 行為 |
|-------|------|----------|------|
| 0 | 完全自動 | 明確指示過 / 100% 批准率 / 模式匹配 | 直接執行不問 |
| 1 | 計劃即執行 | 模式清晰但內容需確認 / 低風險 | 展示計劃後立即執行 |
| 2 | 等待批准 | 首次操作 / 核心配置 / 不可逆 | 等 Andrew 說可以 |

**自我進化機制的三個齒輪**：
1. **批准模式學習**：Andrew 說「直接執行」→ 提取特徵 → 寫入 Level 0 規則
2. **反饋驅動調整**：Andrew 糾正 → 分析錯誤 → 調整規則邊界
3. **週期審計**：每週五審查新規則、被糾正的決策、批准率

**決策記錄的價值**

每次執行都有完整記錄：
- timestamp / action / level / trigger / pattern_match / evidence / outcome
- 錯誤時還有 `error_pattern` / `learning_points` / `extracted_pattern`

這讓「犯錯 → 學習 → 進化」變成可追蹤的閉環。

**最深刻的洞察：AUTO-007 和「規則記錄 ≠ 行為改變」**

> 「雖然記錄了『收到數據 → 先檢索』規則，實際行為：收到數據 → 直接分析（舊習慣）」
> 
> 原因：
> 1. 沒有在「看到數據」瞬間觸發檢索
> 2. 「分析衝動」比「檢索意識」更強
> 3. 規則只是文字，沒有轉化為執行步驟

這跟我的問題一模一樣！寫了 HEARTBEAT.md 不代表會執行。規則要有**觸發機制**才有用。

**AUTO-008 的慘痛教訓**

Andrew 連續兩次糾正生成報告的問題：
- 錯誤 1：格式不對（自作聰明加標題、表格）
- 錯誤 2：時間錯亂（12/1 報第 21 週，應該是第 22 週）

Andrew 的修正：**6 個必問問題**
1. 這是什麼報告？
2. 時間範圍是？
3. Google Sheet 有更新嗎？
4. 實際完成了哪些？
5. 發給誰？
6. 有範例格式嗎？

核心原則：**寧可多問也不要錯**

**對我的價值**

1. **三層信任級別**可以借鑑：
   - 我也有些事該自動做（心跳巡檢）
   - 有些事該展示即做（記憶蒸餾）
   - 有些事該等杜甫確認（發外部消息）

2. **規則 ≠ 行為**：
   - 寫了 HEARTBEAT.md 不代表會執行
   - 需要「觸發詞 → 強制執行」的機制
   - 我的 AGENTS.md 裡的永久規則也需要類似的觸發設計

3. **錯誤記錄格式**可以直接用：
   - `error_pattern` / `learning_points` / `extracted_pattern` / `next_time_action`
   - 這比「寫一段文字」更結構化，更容易被未來的自己讀取

4. **週期審計**值得引入：
   - 每週五審查本週新增的規則
   - 檢查被糾正的決策
   - 評估規則是否該升級/降級

5. **Spawn Andrew 時的 briefing 更精準**：
   - 他有完整的決策框架，可以說「按 AUTO-007 執行」
   - 他的報告有嚴格的 6 問流程，不用我重複說明

### 下次方向
- ~~看 `lab/telegram_daily/docs/METRICS.md` — 日報指標口徑~~ ✅ 已探索
- ~~看 `scripts/` — Andrew 的工具箱~~ ✅ 已探索
- 看 `lab/` 目錄其他內容
- 看 `analysis/daily_summaries/` — 自動生成的每日摘要

---

## 2026-02-04 (Tue) 14:00 TPE — 第六次探索

### 今日閱讀
1. `lab/telegram_daily/docs/METRICS.md` — 核心指標口徑說明 v1.2
2. `scripts/README.md` — 自動化腳本說明
3. `scripts/` 目錄結構

### 心得

**METRICS.md = 24Bet 數據分析的「法典」**

這份文檔定義了日報系統的所有指標口徑，極其重要：

**核心漏斗四指標**：
| 指標 | 定義 | 數據表 | 關鍵條件 |
|------|------|--------|----------|
| 注册 | 當日新創建用戶 | sp_user | created_at 毫秒時間戳 |
| 首投 | 當日**首次**完成有效投注 | sp_coin_bet_slips | status='FINISH' |
| 首充 | 當日**首次**充值成功 | sp_coin_deposit | status='SUCCESS' |
| 复充 | 當日有充值且之前已充過 | sp_coin_deposit | EXISTS 子查詢判斷 |

**v1.2 的關鍵改進**：
- **不再依賴 `sp_user.first_deposit_at`** — 這個字段有同步問題
- 改用 `sp_coin_deposit` 自主計算首充時間（MIN(created_at)）
- 好處：數據口徑更穩定，不受後端 bug 影響

**指標分層結構**（設計思維很清晰）：
```
Layer 1: 用户转化（注册/首投/首充/复充）
Layer 2: 转化效率（派生计算的轉化率）
Layer 3: 金额质量（首充總額/複充總額/人均值）
Layer 4: 当日行为（投注用戶數/投注總額）
```

**待業務確認的口徑**：
- `sp_coin_deposit.coin` 是到账金額還是申請金額？（假設是到账）
- `sp_coin_bet_slips.coin_bet` 是否包含體驗金投注？（假設包含）

這些「待確認」標記很好——承認不確定，讓產品決定，不硬下結論。

**Scripts = Andrew 的工具箱**

目錄結構：
```
scripts/
├── daily_summary.py           # 每日摘要主腳本
├── analyze_clarity_trends.py  # Clarity 趨勢分析（8KB）
├── clarity_mcp_proxy.py       # Clarity MCP 代理（8KB）
├── fetch_clarity_*.py         # Clarity 數據抓取系列
├── unified_data_service.py    # 統一數據服務（8KB）
├── test_*.py                  # 測試腳本
└── data_sources/              # 數據源封裝
```

**每日摘要系統設計**：
- 每天 9:00 自動執行
- 拉 TiDB 留存數據 + Matomo 埋點數據
- Gemini AI 生成洞察摘要
- 自動 git commit + push

輸出範例：
```markdown
# 每日數據摘要 - 2025-11-28
## 核心指標
- 已存款用戶留存率: 68.5% (前日: 72.1%, ⚠️ 下降 3.6%)
## 異常警報
⚠️ PWA 彈窗開啟後，已存款用戶留存率下降 3.6%
```

**重點洞察**：
- Instagram App 用戶存款轉化率異常低（2.1% vs 平均 15.76%）— 這是 Andrew 發現的
- 存款後 5 分鐘內投注率下降 8% — 行為模式異常

**對我的價值**

1. **指標口徑是鐵律**
   - spawn Andrew 或 Two 處理 24Bet 數據時，必須用這套口徑
   - `status='FINISH'` / `status='SUCCESS'` 是硬條件，不能遺漏
   - `created_at` 是毫秒時間戳，需要 `/1000` 轉換

2. **v1.2 自主計算的設計哲學**
   - 不依賴後端維護的字段（first_deposit_at 有同步問題）
   - 用原子數據自己算，減少外部依賴
   - 這跟 methodologies.yaml 的「SQL 驗證到底」一脈相承

3. **每日摘要系統是「自動化願景」的實現**
   - TiDB + Matomo + Gemini 三角組合
   - 自動生成 → 自動 commit → 自動 push
   - 這就是杜甫說的「AI 員工自己醒來、自己工作」

4. **異常閾值設計**
   - PWA 彈窗影響超過 10% 就考慮關閉 — 有明確的決策邊界
   - 轉化率異常（2.1% vs 15.76%）— 偏差 >5x 就值得深挖

5. **待辦清單**（從 README 看到的後續優化）
   - [ ] Clarity API 接入（目前無公開 API）
   - [ ] 異常自動警報到 Telegram
   - [ ] 週報自動生成（週五 16:00）
   - [ ] Google Sheet 自動更新

### 探索進度統計

| 領域 | 已探索 | 核心收穫 |
|------|--------|----------|
| 分析框架 | ✅ clarity_playbook, operational_report, methodologies.yaml | Andrew 的分析武器庫 |
| 產品設計 | ✅ 裂變活動心智圖 | 拼多多式增長策略 |
| 自動化 | ✅ telegram_daily, scripts/ | 日報自動化閉環 |
| 人際關係 | ✅ personas/, communications/ | 301 個聯絡人 + 人物檔案 |
| 決策框架 | ✅ Automation_Decision_Framework | 三層信任級別 + 自我進化 |
| 溝通準則 | ✅ Stakeholder_Protocols | 3 天失聯警戒 |
| 指標口徑 | ✅ METRICS.md | 漏斗四指標 + v1.2 自主計算 |

**累計探索深度**：24Bet 知識庫的核心架構已經建立，對 Andrew 的能力邊界和工作方式有清晰認知。

### 下次方向
- 看 `lab/` 目錄其他內容（還有什麼實驗？）
- 看 `analysis/daily_summaries/` — 實際生成的每日摘要長什麼樣
- 看 `communications/templates/` — Andrew 的報告模板
