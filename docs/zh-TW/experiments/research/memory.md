---
summary: 「研究筆記：Clawd 工作區的離線記憶系統（以 Markdown 作為單一事實來源 + 衍生索引）」」
read_when:
  - 設計超越每日 Markdown 紀錄的工作區記憶（~/.openclaw/workspace）
  - 決策：獨立 CLI vs 深度 OpenClaw 整合
  - 新增離線回憶 + 反思（保留 / 回憶 / 反思）
title: 「工作區記憶研究」
x-i18n:
  source_path: experiments/research/memory.md
  source_hash: 1753c8ee6284999f
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:53:34Z
---

# 工作區記憶 v2（離線）：研究筆記

目標：Clawd 風格的工作區（`agents.defaults.workspace`，預設 `~/.openclaw/workspace`），其中「記憶」以每日一個 Markdown 檔案（`memory/YYYY-MM-DD.md`）儲存，並搭配少量穩定檔案（例如 `memory.md`、`SOUL.md`）。

本文提出一種 **離線優先（offline-first）** 的記憶架構：保留 Markdown 作為可檢閱的權威事實來源，同時透過衍生索引加入 **結構化回憶**（搜尋、實體摘要、信心更新）。

## 為什麼要改變？

目前的設定（每日一個檔案）非常適合：

- 「只追加（append-only）」的日誌記錄
- 人工編輯
- 以 git 為後盾的耐久性 + 可稽核性
- 低摩擦的捕捉流程（「直接寫下來」）

但在以下方面較弱：

- 高回憶率的檢索（「我們對 X 的結論是什麼？」「上次嘗試 Y 是什麼時候？」）
- 以實體為中心的回答（「告訴我 Alice / The Castle / warelay」），而不必重讀大量檔案
- 意見 / 偏好的穩定性（以及其變化時的證據）
- 時間限制（「在 2025 年 11 月期間哪些內容為真？」）與衝突解決

## 設計目標

- **離線**：不需網路即可運作；可在筆電 / Castle 上執行；不依賴雲端。
- **可解釋**：取回的項目應可追溯（檔案 + 位置），並可與推論分離。
- **低儀式感**：每日記錄維持 Markdown，不需要繁重的結構化工作。
- **可漸進**：v1 僅用 FTS 即具價值；語意 / 向量與圖結構屬於可選升級。
- **代理程式友善**：讓「在權杖預算內進行回憶」變得容易（回傳小型事實束）。

## 北極星模型（Hindsight × Letta）

要融合的兩個要素：

1. **Letta / MemGPT 風格的控制迴圈**

- 保持一個小型「核心」永遠在上下文中（角色設定 + 重要使用者事實）
- 其他內容皆在上下文之外，透過工具取回
- 記憶寫入是明確的工具呼叫（append / replace / insert），持久化後於下一回合重新注入

2. **Hindsight 風格的記憶基底**

- 區分「觀察到的」、「相信的」、「已摘要的」
- 支援保留 / 回憶 / 反思
- 帶有信心的意見，能隨證據演進
- 具備實體感知的檢索 + 時間查詢（即使沒有完整知識圖譜）

## 提議的架構（Markdown 作為事實來源 + 衍生索引）

### 權威儲存（git 友善）

保留 `~/.openclaw/workspace` 作為人類可讀的權威記憶。

建議的工作區配置：

```
~/.openclaw/workspace/
  memory.md                    # small: durable facts + preferences (core-ish)
  memory/
    YYYY-MM-DD.md              # daily log (append; narrative)
  bank/                        # “typed” memory pages (stable, reviewable)
    world.md                   # objective facts about the world
    experience.md              # what the agent did (first-person)
    opinions.md                # subjective prefs/judgments + confidence + evidence pointers
    entities/
      Peter.md
      The-Castle.md
      warelay.md
      ...
```

說明：

- **每日記錄就是每日記錄**。不需要轉成 JSON。
- `bank/` 檔案是 **精選** 的，由反思工作產生，仍可手動編輯。
- `memory.md` 維持「小而核心」：你希望 Clawd 每個工作階段都能看到的內容。

### 衍生儲存（機器回憶）

在工作區下新增一個衍生索引（不一定納入 git 追蹤）：

```
~/.openclaw/workspace/.memory/index.sqlite
```

其後端包含：

- SQLite 綱要：事實 + 實體連結 + 意見中繼資料
- SQLite **FTS5** 用於詞彙式回憶（快速、輕量、離線）
- 可選的嵌入向量資料表，用於語意回憶（仍為離線）

此索引永遠 **可由 Markdown 重新建置**。

## 保留 / 回憶 / 反思（作業迴圈）

### 保留：將每日記錄正規化為「事實」

Hindsight 在此最重要的洞見：儲存 **敘事式、可自足的事實**，而不是零碎片段。

對 `memory/YYYY-MM-DD.md` 的實務規則：

- 在一天結束時（或期間），新增一個 `## Retain` 區段，包含 2–5 個項目，且必須：
  - 具敘事性（保留跨回合上下文）
  - 可自足（日後單獨閱讀也合理）
  - 以類型 + 實體標註

範例：

```
## Retain
- W @Peter: Currently in Marrakech (Nov 27–Dec 1, 2025) for Andy’s birthday.
- B @warelay: I fixed the Baileys WS crash by wrapping connection.update handlers in try/catch (see memory/2025-11-27.md).
- O(c=0.95) @Peter: Prefers concise replies (&lt;1500 chars) on WhatsApp; long content goes into files.
```

最小解析需求：

- 類型前綴：`W`（世界）、`B`（經驗 / 傳記）、`O`（意見）、`S`（觀察 / 摘要；通常自動產生）
- 實體：`@Peter`、`@warelay` 等（slug 對應至 `bank/entities/*.md`）
- 意見信心：`O(c=0.0..1.0)`（選用）

如果不希望作者費心思考：反思工作可以從其餘日誌中推斷這些項目；但明確的 `## Retain` 區段是最簡單的「品質槓桿」。

### 回憶：對衍生索引進行查詢

回憶應支援：

- **詞彙式**：「找出確切字詞 / 名稱 / 指令」（FTS5）
- **實體式**：「告訴我 X」（實體頁面 + 連結至實體的事實）
- **時間式**：「11 月 27 日前後發生了什麼」/「自上週以來」
- **意見式**：「Peter 偏好什麼？」（含信心 + 證據）

回傳格式應對代理程式友善，並引用來源：

- `kind`（`world|experience|opinion|observation`）
- `timestamp`（來源日期，或若存在則為擷取的時間範圍）
- `entities`（`["Peter","warelay"]`）
- `content`（敘事事實）
- `source`（`memory/2025-11-27.md#L12` 等）

### 反思：產生穩定頁面 + 更新信念

反思是一個排程工作（每日或心跳式 `ultrathink`），其職責包括：

- 根據近期事實更新 `bank/entities/*.md`（實體摘要）
- 依強化 / 矛盾更新 `bank/opinions.md` 的信心
- 視需要提議編輯 `memory.md`（「偏核心」的耐久事實）

意見演進（簡單、可解釋）：

- 每個意見包含：
  - 陳述
  - 信心 `c ∈ [0,1]`
  - last_updated
  - 證據連結（支持 + 反駁的事實 ID）
- 當新事實到來時：
  - 依實體重疊 + 相似度找出候選意見（先用 FTS，之後可加嵌入）
  - 以小幅度調整信心；大幅跳動需要強烈反駁 + 重複證據

## CLI 整合：獨立 vs 深度整合

建議：**深度整合至 OpenClaw**，但保留可分離的核心函式庫。

### 為何整合到 OpenClaw？

- OpenClaw 已知：
  - 工作區路徑（`agents.defaults.workspace`）
  - 工作階段模型 + 心跳
  - 日誌 + 疑難排解模式
- 你會希望代理程式本身呼叫工具：
  - `openclaw memory recall "…" --k 25 --since 30d`
  - `openclaw memory reflect --since 7d`

### 為何仍要拆分函式庫？

- 讓記憶邏輯可在無 Gateway / 執行階段下測試
- 可在其他情境重用（本地腳本、未來桌面應用程式等）

形態：
記憶工具的目標是一個小型 CLI + 函式庫層，但此處僅為探索性規劃。

## 「S-Collide」/ SuCo：何時使用（研究）

若「S-Collide」指的是 **SuCo（Subspace Collision）**：這是一種 ANN 檢索方法，透過在子空間中使用學習 / 結構化的碰撞，取得強勁的召回率 / 延遲權衡（論文：arXiv 2411.14754，2024）。

對 `~/.openclaw/workspace` 的務實看法：

- **不要一開始就用** SuCo。
- 先用 SQLite FTS +（選用）簡單嵌入；你會立刻獲得大多數 UX 改善。
- 僅在以下情況才考慮 SuCo / HNSW / ScaNN 類方案：
  - 語料很大（數萬 / 數十萬個區塊）
  - 暴力式嵌入搜尋變得太慢
  - 召回品質明顯受限於詞彙搜尋

離線友善的替代方案（複雜度遞增）：

- SQLite FTS5 + 中繼資料過濾（零 ML）
- 嵌入 + 暴力搜尋（在區塊數量低時效果出奇地好）
- HNSW 索引（常見、穩健；需要函式庫綁定）
- SuCo（研究等級；若有可嵌入的成熟實作，則具吸引力）

開放問題：

- 在你的機器（筆電 + 桌機）上，哪個是「**最佳**」的離線嵌入模型，適用於「個人助理記憶」？
  - 若你已使用 Ollama：用本地模型做嵌入；否則在工具鏈中隨附一個小型嵌入模型。

## 最小且實用的試點

若你想要一個最小、但仍具價值的版本：

- 新增 `bank/` 實體頁面，以及每日記錄中的 `## Retain` 區段。
- 使用 SQLite FTS 進行可引用的回憶（路徑 + 行號）。
- 僅在回憶品質或規模需要時才加入嵌入。

## 參考資料

- Letta / MemGPT 概念：「核心記憶區塊」+「封存記憶」+ 以工具驅動的自我編輯記憶。
- Hindsight 技術報告：「保留 / 回憶 / 反思」、四網路記憶、敘事事實擷取、意見信心演進。
- SuCo：arXiv 2411.14754（2024）：「Subspace Collision」近似最近鄰檢索。
