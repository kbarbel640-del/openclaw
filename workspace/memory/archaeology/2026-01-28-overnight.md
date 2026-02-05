# 🔍 考古任務過程記錄

> 日期：2026-01-28
> 任務：建立杜甫數位資產概念地圖

---

## 📋 任務概要

作為無極的 sub-agent，執行深度考古任務，探索杜甫的所有數位資產並建立完整地圖。

---

## ⏱️ 執行時間軸

### Phase 1：初始探索
1. 創建 `memory/archaeology/` 目錄
2. 列出 `~/Documents` 所有資料夾（145 個項目）
3. 查詢 ThinkerCafe-tw GitHub org 的 60 個 repos

### Phase 2：高優先專案深挖

#### thinker-news ✅
- 發現 163 個檔案，包含每日 HTML 新聞檔
- 確認 `latest.json` 結構：`line_content`, `notion_content`, `website_url`
- 找到 GitHub Actions workflow: `daily-news.yml`
- 理解 `/news` 指令流程：Telegram → 讀取 latest.json → 回傳

#### paomateng ✅
- 確認是台鐵公告監控系統
- 找到 `monitor.yml` workflow（每 5 分鐘，實際 3-4 小時）
- 發現 n8n 整合方案（穩定 5-10 分鐘監控）
- 理解結構化資料提取：報別、事件類型、預估恢復時間等

#### maryos ✅
- 確認是 Mary 情緒支持系統
- 找到三個 GitHub Actions：morning, evening, monthly-bonus
- 理解 Gemini AI 日記解析流程
- 發現獎金計算公式：`(replied_days / 30) × (avg_score / 80) × 1000`

### Phase 3：中優先專案探索

#### 24bet ✅
- Andrew 的 Obsidian 知識圖譜工作區
- 找到 Telegram session 位置
- 發現 mcp-matomo 整合
- 理解留存分析知識網絡架構

#### two ✅
- 杜甫的主要工作區
- 找到 mcp-telegram session
- 發現 BG666 相關資料需求文件
- 理解 npc-agent-selector 和 weekly_report 系統

#### persona_cruz_ai ✅
- 歷史 AI 人格系統遺跡
- 發現 35 個 ai_diary 反思記錄
- 理解五行人格系統（金木水火土 + 無極 + CRUZ + Serena + 蘇軾）
- 確認已停止更新但有參考價值

#### flipflop-travel ✅
- 姐姐的 LINE LIFF 應用
- 理解技術棧：React + Tailwind + Vercel + Neon PostgreSQL
- 發現「療癒紫配色」設計系統

#### iPAS ✅
- 工研院 AI 應用規劃師命題專案（8 萬元）
- 初級學科 100 題已完成
- 中級程式題組 20 題開發中
- 理解知識庫驅動生成 + Point/Line/Surface 品質控制

#### ai-social-6weeks ✅
- AI 自媒體六週課程
- 發現兩位學生：Cruz、沛綺
- 有完整課程大綱和網站

### Phase 4：GitHub Repos 掃描

完成 60 個 repos 的狀態標記：
- 🟢 活躍：~15 個
- 🟡 維護/設計未跑：~15 個
- 🔴 擱置/歷史：~10 個

### Phase 5：低優先專案快速標記

- HumanOS：設計未跑
- field-rhythm-kit：設計未跑
- builder-governance：設計未跑
- ziwei-astrology-system：合約限制
- threads-playwright-publisher：穩定運行
- company_scrawler：偶爾使用
- fetc：偶爾使用
- thinker_official_website：活躍

---

## 📊 關鍵發現

### 1. 自動化架構模式
杜甫偏好的自動化模式：
- **GitHub Actions** 為核心定時任務引擎
- **n8n** 作為 workflow 觸發器和整合器
- **Telegram Bot** 作為用戶介面
- **Google Sheets/Drive** 作為輕量資料存儲

### 2. 專案生命週期
大量專案遵循這個模式：
1. **概念設計**（CLAUDE.md, README.md）
2. **快速原型**（Python/Node.js）
3. **自動化部署**（GitHub Actions + Vercel）
4. **可能擱置**（如果沒有持續需求）

### 3. 技術偏好
- **語言**：Python (爬蟲/AI), TypeScript (前端/Bot)
- **平台**：GitHub Pages, Vercel, Telegram
- **AI**：OpenAI, Gemini, Claude
- **資料庫**：SQLite (簡單), PostgreSQL (生產)

### 4. 自媒體素材金礦
最有價值的內容素材來自：
- **接案故事**：iPAS, paomateng, pt-liff-app
- **工具分享**：thinker-news, threads-playwright-publisher
- **溫暖科技**：maryos, flipflop-travel
- **課程內容**：ai-social-6weeks

---

## ⚠️ 注意事項

### 敏感資訊位置
- `.telegram_session` 檔案多處存在
- `.env` 檔案包含 API keys
- 24bet 和 two 有商業機密資料

### 需要更新的文件
- CONTACTS.md 可能需要補充專案相關聯絡人
- TOOLS.md 可以補充更多本地工具路徑

---

## ✅ 任務完成

輸出檔案：
1. `memory/archaeology/CONCEPT_MAP.md` — 完整地圖
2. `memory/archaeology/2026-01-28-overnight.md` — 本文件

---

## 📝 給主 Agent 的建議

1. **thinker-news** 是最成熟的自動化系統，可以作為模板
2. **maryos** 的設計哲學值得學習（溫暖優先）
3. **iPAS** 的 AI 命題流程可以複製到其他專案
4. **persona_cruz_ai** 的五行系統雖然擱置，概念有參考價值
5. 很多「設計未跑」的專案核心概念不錯，可能只是缺乏持續動力

---

*考古完成時間：2026-01-28*
