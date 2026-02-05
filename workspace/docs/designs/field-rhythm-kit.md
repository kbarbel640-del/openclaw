# Field Rhythm Kit — 語場節奏治理系統設計文檔

> 萃取自 `~/Documents/field-rhythm-kit/`
> 萃取日期：2025-02-15

---

## 📋 一、問題定義

### 知識工作者的日常痛點
1. **思維流失**：每日大量思考，但未被記錄，事後難以回溯
2. **任務模糊**：口頭說的「明天要做什麼」很快就忘記
3. **狀態不清**：心理狀態影響工作，但缺乏自我覺察機制
4. **協作斷裂**：團隊間的語境難以同步，每次都要重新解釋

### 目標場景
- 創作者/領導者需要記錄每日思維流動
- 團隊需要建立共享的「語場記憶庫」
- 個人需要人格化的日誌系統（不只是待辦清單）
- AI 輔助的自我引導與反思

---

## 🎯 二、解決方案

### 核心理念：「語場 = 內在頻率的外顯」

> 語場是一種內在頻率的展現，而我們要做的是建立一套能記住這些頻率的系統。

### 系統架構

```
┌─────────────────────────────────────────────────────┐
│                  使用者介面層                         │
│         Telegram Bot（語音/文字輸入）                 │
└────────────────────┬────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────┐
│                  處理引擎層                          │
│  ┌───────────┐  ┌───────────┐  ┌───────────────┐   │
│  │  Whisper  │→ │    GPT    │→ │ 人格分類器    │   │
│  │  (語音轉  │  │ (語意分析) │  │ (四人格路由) │   │
│  │   文字)   │  │           │  │              │   │
│  └───────────┘  └───────────┘  └───────────────┘   │
└────────────────────┬────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────┐
│                  語場記憶層                          │
│  PostgreSQL + pgvector                              │
│  ├── tasks (主控者)                                  │
│  ├── reflections (反思者)                            │
│  ├── contributions (協作者)                          │
│  └── perceptions (感知者)                            │
└─────────────────────────────────────────────────────┘
```

---

## 🧠 三、核心概念

### 3.1 四人格系統（Persona Classification）

系統的核心創新是將輸入自動分類到四種「語場人格」：

| 人格代號 | 角色 | 資料表 | 精華欄位 | 觸發關鍵詞 |
|---------|------|--------|---------|-----------|
| Controller | 主控者 | `tasks` | task_summary, control_focus | 任務設計、語場推進、節奏規劃 |
| Reflector | 反思者 | `reflections` | reflection_text, mood | 感受、盲點、自我察覺、心情 |
| Collaborator | 協作者 | `contributions` | collab_summary, interaction_mode | 團隊協作、進度對齊、互動片段 |
| Sensor | 感知者 | `perceptions` | location_description, mobility_state | 空間移動、地點描述、環境觸覺 |

### 3.2 語場段落分類

輸入會被進一步分類到五種「語場段落」：

| 段落名 | 模式屬性 | 角色人格 | 命名範例 |
|-------|---------|---------|---------|
| 啟動段 Start | 節奏喚醒 | 意圖設定者 | `start_2025_05_24` |
| 建構段 Build | 功能開發/進展 | 主控者 | `build_prompt_qamodel` |
| 整理段 Organize | 結構梳理/反思 | 整理者 | `organize_log_data` |
| 輸出段 Output | 對外同步/展示 | 傳訊者 | `output_notionsync` |
| 回收段 Reflect | 自我內省 | 回顧者 | `reflect_weeksummary` |

### 3.3 語意記憶區塊（Semantic Memory Block）

每個輸入最終會生成結構化的記憶區塊：

```json
{
  "persona": "controller",
  "segment": "build",
  "timestamp": "2025-05-24T09:30:00Z",
  "raw_content": "原始語音轉文字內容",
  "summary": "一句話摘要",
  "embedding": [0.123, 0.456, ...],  // 1536 維向量
  "metadata": {
    "mood": "專注",
    "task_focus": "命盤 QA 模板"
  }
}
```

---

## 📖 四、實施指南

### 4.1 技術堆疊

| 組件 | 技術選擇 | 用途 |
|-----|---------|------|
| 用戶介面 | Telegram Bot | 語音/文字輸入 |
| 語音轉文字 | Whisper API | 高品質轉錄 |
| 語意分析 | GPT-4 | 分類與摘要 |
| 向量資料庫 | PostgreSQL + pgvector | 語意搜尋 |
| 後端框架 | FastAPI | RESTful API |
| 容器化 | Docker Compose | 一鍵部署 |

### 4.2 API 端點設計

```
POST /api/voice/         # 上傳語音訊息
GET  /api/prompt/{id}    # 取得提示詞詳情
POST /api/segment/create # 建立語意段落
GET  /api/semantic-memory/search  # 向量相似搜尋
GET  /api/daily-summary/{date}    # 取得每日摘要
```

### 4.3 部署步驟

```bash
# 1. 建立環境變數
cat > .env << EOF
OPENAI_API_KEY=sk-xxxxxx
TELEGRAM_BOT_TOKEN=123456:ABC-xyz
BACKEND_URL=http://backend:8000
EOF

# 2. 啟動服務
docker-compose up --build
```

### 4.4 人格 Prompt 設計

每個人格需要定義：
- `agent_id`: 人格識別碼
- `target_table`: 對應資料表
- `description`: 人格描述
- `fields`: 需要萃取的欄位
- `prompt_keywords`: 觸發關鍵詞

範例（主控者）：
```json
{
  "agent_id": "controller",
  "target_table": "tasks",
  "description": "主控者，專注於任務設計、節奏掌握、語場布局。",
  "fields": [
    {"name": "task_summary", "type": "TEXT", "description": "一句話描述任務重點"},
    {"name": "control_focus", "type": "TEXT", "description": "該段語場的核心主導邏輯"}
  ],
  "prompt_keywords": ["任務設計", "語場推進", "節奏規劃", "任務主軸"]
}
```

---

## 🎭 五、適用場景

### ✅ 適合
- 創作者/領導者的個人日誌系統
- 需要語意搜尋歷史記錄的知識工作者
- 想用語音快速記錄想法的人
- 需要心理狀態追蹤的自我管理者

### ⚠️ 需調整
- 團隊協作場景（需增加多用戶支援）
- 企業級部署（需增加權限控制）
- 多語言環境（Whisper 支援但需調參）

### ❌ 不適合
- 純結構化任務管理（用 Notion/Todoist 更好）
- 不習慣語音輸入的用戶
- 對隱私極度敏感（需自建 LLM）

---

## 🔮 六、可重用模式

### 模式 1：人格路由系統
```
輸入 → LLM 分類 → 路由到對應處理器 → 存入對應資料表

適用於：任何需要多維度分類的輸入處理系統
```

### 模式 2：語音優先日誌
```
語音 → 轉文字 → 萃取結構 → 存儲

比打字更快，適合移動中記錄
```

### 模式 3：向量化記憶召回
```
新輸入 → embedding → 搜尋相似記憶 → 提供上下文

讓 AI 「記得」過去說過什麼
```

### 模式 4：段落分類法
```
Start → Build → Organize → Output → Reflect

一天的思維流動可以被分類成有意義的段落
```

---

## 🔄 七、與 Builder Governance 的整合可能

| Builder Governance 概念 | Field Rhythm Kit 對應 |
|------------------------|----------------------|
| 語場紀錄撰寫 (+10 EXP) | 每日語音日誌 |
| 週結反思 (+30 EXP) | Reflect 段落彙整 |
| 技能模組完成 | Build 段落追蹤 |
| 教學支援 | Collaborator 互動記錄 |

**整合想法**：
- 語場節奏系統可以自動生成 Builder Governance 需要的紀錄
- 每日語音輸入自動累積 EXP
- 反思段落對應週結反思
- 協作段落對應教學支援

---

## 📝 八、關鍵語錄

> 「語場是一種內在頻率的展現，而我們要做的是建立一套能記住這些頻率的系統。」

> 「每段語音都會被分類到對應的語場人格，不再只是一串文字。」

> 「Codex，如果你正在處理語音提示轉為 BuilderSession 的任務，請依照段落分類進行，並為每段產出 Semantic Memory Block。」

---

## 🏷️ 標籤

`#語音日誌` `#人格分類` `#向量搜尋` `#自我管理` `#AI輔助` `#Telegram Bot`
