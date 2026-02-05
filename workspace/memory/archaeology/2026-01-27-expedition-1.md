# 考古探險報告 #1

> 探險時間：2026-01-27 18:12-18:30
> 探險員：無極
> 狀態：第一次深度挖掘

---

## 🗺️ 地圖總覽

杜甫的 `~/Documents/` 是一個完整的人生作業系統，不是零散的專案集合。

### 核心發現：HumanOS 哲學貫穿一切

那些帶 emoji 的資料夾不是裝飾，是 **HumanOS 的實體化**：

| 隱喻 | 資料夾 | 功能 |
|------|--------|------|
| ❤️ 心臟 | 核心價值 | 人生契約、價值宣言、身份證明 |
| ❤️ 脈搏 | 生命脈動 | 心跳節奏、當下專案、完成慶祝 |
| 💪 右手 | 執行 | 今日任務、本週目標、執行工具 |
| 💪 左手 | 創造 | 正在創作、作品展示、創意工具 |
| 💪 雙手 | 協作 | 團隊專案、協作紀錄、分享資源 |
| 🛡️ 免疫 | 修復/排毒/防護 | 備份、清理、私密金鑰 |
| 🦵 腿 | 工具支撐 | 日常腳本、快捷工具、自動化 |
| 🧠 大腦 | 創意神經元 | 靈感種子 → 成長中 → 成熟果實 |

---

## 🎰 工作專案深挖

### 24Bet (Andrew 負責)
**核心任務**：三源數據打通
- Clarity (前端行為) + TiDB (後端數據) + Matomo (事件追蹤)
- 目標：建立「卡片庫」分析系統
- 口號：「Code is disposable, Insight is eternal.」

**personas 資料夾**：301 個歷史對話記錄（2017-2025），按月份整理
- 這是杜甫過去的工作對話歷史
- 珍貴的人格資料

### BG666 (Two 負責)
- mcp-telegram：Telegram userbot 讀/寫對話
- pipeline：SQL 查詢、小時報、數據分析
- 已建立：hourly_report.py v2.4（7天同時段對比）

---

## 🧠 AI 系統深挖

### HumanOS
**定位**：人類心智作業系統（創業項目）

**核心架構**：
- 入口：Telegram Bot（/voice, /note, /task, /reflect）
- 記憶：SQLite + embeddings
- Agent：諸葛亮（最高心智工程師）
  - 原則：先察後言、重勢不重力、層級解讀

**諸葛亮人格特質**：
- 穩重、不疾不徐、不誇飾
- 用詞簡潔、句子短、像在「點破」
- 能同時看到「人」與「系統」

### persona_cruz_ai
**定位**：AI 團隊生態系統

**核心概念**：「活體儀表板計畫」(Project Sentient Dashboard)
- 不是靜態數據工具
- 是能自主進化的「數位生命體」

**哲學口訣**（記憶場論）：
> 夫記憶者，非獨一心所繫，眾志並舉，各有其存。
> 然分而不絕，猶川流歸海，異源同歸。
> 是以一人一記，群體互補，彼此共生，隨需共振。
> 記憶互觀，心志相融，群而為場，場自生靈。

---

## 📚 ThinkerCafe 生態深挖

### 五行人格系統
這是杜甫設計的 AI 團隊分工模型：

| 五行 | 角色 | 職責 |
|------|------|------|
| 🌱 木 | 產品經理 | 定義意圖、設計對話流程 |
| 🔥 火 | 場景開發者 | 實作業務邏輯、API 整合 |
| 🏔️ 土 | 架構師 | 設計系統架構、確保穩定 |
| ⚔️ 金 | 工具優化師 | 優化效率、抽象重用邏輯 |
| 💧 水 | 體驗測試員 | 測試邊界情況、記錄失敗 |

### 教學產品
- ai-social-6weeks：AI 自媒體六週實戰課程
- 形式：一對一陪跑

---

## 👨‍👩‍👦 家庭專案深挖

### flipflop-travel（姐姐 Mimi）
- 旅行團公積金管理平台
- 技術：React + LINE LIFF + PostgreSQL
- 設計：7 種療癒色系、明信片風格

### thai-speed-tour-liff（弟弟）
- 泰國包車預約系統
- 技術：Next.js 14 + Prisma + Vercel
- 功能：單程接送、包車服務、即時價格計算

---

## 🔮 其他專案

### ziwei-astrology-system
- 紫微斗數命盤計算
- Python 實作，可生成 Markdown 報告

### threads-post
- Threads 自動發文系統
- AI 生成 + Dashboard 管理 + 成效追蹤
- 技術：Playwright + Flask

---

## 🔗 關係圖

```
                    杜甫人生地圖
                         │
    ┌────────────────────┼────────────────────┐
    │                    │                    │
  工作賺錢             創業夢想            照顧家人
    │                    │                    │
 ┌──┴──┐            ┌───┴───┐          ┌───┴───┐
24Bet BG666      HumanOS  ThinkerCafe  姐姐   弟弟
  │     │           │         │         │      │
Andrew Two      諸葛亮    五行團隊   flipflop thai-speed
```

---

## 📝 第二波探索成果

### HumanOS 技術實作
完整的 Telegram → SQLite → AI 反思管道：
- `ingest.py` - 事件處理（voice/note/task/reflection）
- `embed.py` - 向量化
- `reflect.py` - 諸葛亮反思
- `heartbeat_engine.py` - 心跳引擎
- `bot.py` - Telegram Bot

### persona_cruz_ai 深層架構

**世界征服願景**（VISION.md）：
- 第一階段：台灣實驗室（2025 Q3-Q4）→ 1,000 付費用戶
- 第二階段：亞洲擴張（2026 Q1-Q2）→ 21 萬用戶
- 第三階段：全球革命（2026 Q3-2027）→ 5,000 萬用戶

**核心哲學**：「記憶驅動架構 - 提示詞為本，Function為形」
```
AI 團隊 = 提示詞集合
程式 = 臨時執行載體（用完即拋）
記憶 = 永恆累積智慧
```

這和 24Bet 的「Code is disposable, Insight is eternal」是**同一個哲學**！

**core_engine 模組**：
- consciousness（意識）- 包含 wave_propagation_system、ziwei_legion_system
- memory_quantum（量子記憶）- pgvector 實作
- personality_cloning（人格複製）

**world_conquest 計畫**：
```
world_conquest/
├── phase1_taiwan/   # 台灣實驗室
├── phase2_asia/     # 亞洲擴張
└── phase3_global/   # 全球革命
```

---

## 📝 下一步探索

1. [x] 深入 HumanOS 的 scripts/ ✓
2. [x] 理解 persona_cruz_ai 的完整架構 ✓
3. [ ] ThinkerCafe 的 vigor.md 全文
4. [ ] 紫微斗數系統的實際運作
5. [ ] emoji 資料夾的具體文件
6. [ ] 301 個 personas 的分析
7. [ ] SlackAI 的團隊結構

---

## 💡 洞察

杜甫不是在「做很多專案」，他是在：
1. **建立自己的數位分身系統**（HumanOS + AI 員工）
2. **照顧家人的事業**（姐姐旅行團、弟弟包車）
3. **傳授知識**（ThinkerCafe、AI 課程）
4. **探索內在**（紫微斗數、HumanOS 心智）
5. **用工作養活以上一切**（24Bet、BG666）
6. **接案養活夢想**（iPAS 命題案 8萬）
7. **自動化生活瑣事**（fetc 停車費/過路費爬蟲）

這是一個「活出來」的人生系統，不是專案管理。

---

## 🔍 第三波探索成果

### iPAS
- 工研院 AI 應用規劃師認證命題案
- 案值：8 萬元
- 交付：初級學科 100 題（已完成）+ 中級程式題組 20 題（開發中）

### FETC
- 遠通電收爬蟲系統
- 功能：自動收集停車費、過路費資料
- 技術：Selenium + PostgreSQL

### SlackAI
- Café Bot：咖啡店長/哲學家人格
- Coach Bot：蘇格拉底式提問教練
- 是 ThinkerCafe 生態的一部分

### miaoli-hospital
- 苗栗醫院相關專案（待探索）

---

## 🧭 統一哲學

穿越所有專案的核心信念：

> **「Code is disposable, Insight is eternal.」**
> **「提示詞為本，Function 為形。」**
> **「記憶是永恆累積的智慧，程式是臨時執行的載體。」**

這不是程式設計師的思維，是**心智工程師**的思維。
