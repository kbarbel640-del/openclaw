# 專案消化 Pipeline

> 不是歸檔，是萃取價值後再歸檔

## 消化流程（每個專案都要跑）

### Phase 1: 理解
1. **讀 README**（如果有）
2. **掃目錄結構** — 識別核心文件
3. **讀核心代碼** — 理解它在做什麼
4. **找 TODO/FIXME** — 未完成的意圖
5. **產出**：`專案摘要卡`（100字內）

### Phase 2: 萃取
1. **可重用代碼** → 提取到 `~/clawd/lib/` 或對應 skill
2. **設計文檔** → 提取到 `~/clawd/docs/designs/`
3. **Prompt/模板** → 提取到 `~/clawd/prompts/`
4. **素材資產** → 提取到對應專案或 `~/clawd/assets/`
5. **經驗教訓** → 寫入 `MEMORY.md`
6. **產出**：`萃取清單`

### Phase 3: 整合
1. **有價值的功能** → 合併到活躍專案
2. **獨立工具** → 變成 skill
3. **想法種子** → 寫入 `IDEAS.md` 待孵化
4. **產出**：`整合報告`

### Phase 4: 歸檔
只有完成以上步驟後：
1. 確認沒有遺漏價值
2. 更新 `EMPIRE_STATUS.md`
3. 移動到 `~/Documents/archive/YYYY-MM/`
4. Git commit 記錄歸檔原因

## 消化優先級

### 🔴 高價值優先（先消化）
- HumanOS 系列（❤️💪🛡️🦵🧠）— 杜甫的人生哲學
- persona_cruz_ai — 35個 AI 反思日記
- builder-governance — 薪資制度設計
- field-rhythm-kit — 語場節奏設計
- ziwei-astrology-system — 80%+ 完成的紫微 API

### 🟡 工具類（快速消化）
- OpenManus, SlackAI, LINEBOT 等 — 看有沒有可重用組件
- threads-* 系列 — 合併後保留

### 🟢 確定無價值（直接歸檔）
- __pycache__, temp, tmp — 臨時文件
- 超過 2 年沒動的純文件

## 消化節奏

每次 heartbeat 消化 **1-2 個專案**，不求快，求深。

預計消化完全帝國：~2-3 週

## 產出文件

### 專案摘要卡（每個專案一張）
```yaml
name: 專案名
path: ~/Documents/xxx
created: YYYY-MM-DD
last_modified: YYYY-MM-DD
purpose: 一句話說明用途
status: 完成/未完成/放棄
value_extracted:
  - code: [檔案列表]
  - docs: [文檔列表]
  - prompts: [模板列表]
  - lessons: [經驗列表]
integrated_to: [目標專案]
archived: true/false
archive_date: YYYY-MM-DD
```

### 帝國知識圖譜
消化完成後，產出專案關係圖：
- 哪些專案共享代碼
- 哪些想法演化成哪些專案
- 技術棧重疊度
