---
summary: 「Context：模型看到的內容、如何建構，以及如何檢視」
read_when:
  - 當你想了解 OpenClaw 中「context」的意義
  - 當你在除錯為何模型「知道」某些事（或忘記了）
  - 當你想降低 context 負擔（/context、/status、/compact）
title: 「Context」
x-i18n:
  source_path: concepts/context.md
  source_hash: b32867b9b93254fd
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:53:02Z
---

# Context

「Context」是 **OpenClaw 在一次執行中送給模型的一切內容**。它受限於模型的 **context window**（權杖上限）。

給新手的心智模型：

- **System prompt**（由 OpenClaw 建立）：規則、工具、Skills 清單、時間／執行階段，以及注入的工作區檔案。
- **對話歷史**：本工作階段中你的訊息 + 助手的訊息。
- **工具呼叫／結果 + 附件**：指令輸出、檔案讀取、影像／音訊等。

Context **不等同於**「memory」：memory 可以寫入磁碟並在之後重新載入；context 則是位於模型目前視窗中的內容。

## 快速開始（檢視 context）

- `/status` → 快速查看「我的視窗用了多少？」+ 工作階段設定。
- `/context list` → 注入了哪些內容 + 粗略大小（每個檔案 + 總計）。
- `/context detail` → 更深入的拆解：每個檔案、每個工具 schema 大小、每個 Skill 項目大小，以及 system prompt 大小。
- `/usage tokens` → 在一般回覆後附加每則回覆的使用量頁尾。
- `/compact` → 將較舊的歷史摘要成精簡項目，以釋放視窗空間。

另請參閱：[Slash commands](/tools/slash-commands)、[Token 使用與費用](/token-use)、[Compaction](/concepts/compaction)。

## 範例輸出

數值會依模型、提供者、工具政策，以及你的工作區內容而異。

### `/context list`

```
🧠 Context breakdown
Workspace: <workspaceDir>
Bootstrap max/file: 20,000 chars
Sandbox: mode=non-main sandboxed=false
System prompt (run): 38,412 chars (~9,603 tok) (Project Context 23,901 chars (~5,976 tok))

Injected workspace files:
- AGENTS.md: OK | raw 1,742 chars (~436 tok) | injected 1,742 chars (~436 tok)
- SOUL.md: OK | raw 912 chars (~228 tok) | injected 912 chars (~228 tok)
- TOOLS.md: TRUNCATED | raw 54,210 chars (~13,553 tok) | injected 20,962 chars (~5,241 tok)
- IDENTITY.md: OK | raw 211 chars (~53 tok) | injected 211 chars (~53 tok)
- USER.md: OK | raw 388 chars (~97 tok) | injected 388 chars (~97 tok)
- HEARTBEAT.md: MISSING | raw 0 | injected 0
- BOOTSTRAP.md: OK | raw 0 chars (~0 tok) | injected 0 chars (~0 tok)

Skills list (system prompt text): 2,184 chars (~546 tok) (12 skills)
Tools: read, edit, write, exec, process, browser, message, sessions_send, …
Tool list (system prompt text): 1,032 chars (~258 tok)
Tool schemas (JSON): 31,988 chars (~7,997 tok) (counts toward context; not shown as text)
Tools: (same as above)

Session tokens (cached): 14,250 total / ctx=32,000
```

### `/context detail`

```
🧠 Context breakdown (detailed)
…
Top skills (prompt entry size):
- frontend-design: 412 chars (~103 tok)
- oracle: 401 chars (~101 tok)
… (+10 more skills)

Top tools (schema size):
- browser: 9,812 chars (~2,453 tok)
- exec: 6,240 chars (~1,560 tok)
… (+N more tools)
```

## 什麼會計入 context window

模型收到的一切都會計入，包括：

- System prompt（所有區段）。
- 對話歷史。
- 工具呼叫 + 工具結果。
- 附件／逐字稿（影像／音訊／檔案）。
- Compaction 摘要與修剪產物。
- 提供者的「包裝」或隱藏標頭（不可見，但仍計入）。

## OpenClaw 如何建構 system prompt

System prompt **由 OpenClaw 擁有**，且每次執行都會重建。其包含：

- 工具清單 + 簡短說明。
- Skills 清單（僅中繼資料；見下文）。
- 工作區位置。
- 時間（UTC + 若已設定則轉換為使用者時間）。
- 執行階段中繼資料（主機／作業系統／模型／思考）。
- 位於 **Project Context** 之下、注入的工作區啟動檔案。

完整拆解：[System Prompt](/concepts/system-prompt)。

## 注入的工作區檔案（Project Context）

預設情況下，OpenClaw 會注入一組固定的工作區檔案（若存在）：

- `AGENTS.md`
- `SOUL.md`
- `TOOLS.md`
- `IDENTITY.md`
- `USER.md`
- `HEARTBEAT.md`
- `BOOTSTRAP.md`（僅首次執行）

大型檔案會依檔案以 `agents.defaults.bootstrapMaxChars` 進行截斷（預設 `20000` 個字元）。`/context` 會顯示 **原始 vs 注入** 的大小，以及是否發生截斷。

## Skills：注入的內容 vs 依需求載入

System prompt 會包含精簡的 **skills 清單**（名稱 + 說明 + 位置）。這份清單具有實際的負擔成本。

Skill 指令預設 **不會** 納入。模型預期僅在 **需要時** 才 `read` 該 skill 的 `SKILL.md`。

## Tools：有兩種成本

Tools 以兩種方式影響 context：

1. System prompt 中的 **工具清單文字**（你看到的「Tooling」）。
2. **工具 schemas**（JSON）。這些會送給模型以便其呼叫工具；即使你看不到純文字內容，也會計入 context。

`/context detail` 會拆解最大的工具 schemas，讓你看出主要佔比。

## 指令、指示與「內嵌捷徑」

Slash commands 由 Gateway 閘道器處理，行為分為幾種：

- **獨立指令**：僅包含 `/...` 的訊息會以指令執行。
- **指示（Directives）**：`/think`、`/verbose`、`/reasoning`、`/elevated`、`/model`、`/queue` 會在模型看到訊息前被移除。
  - 僅含指示的訊息會持續套用工作階段設定。
  - 一般訊息中的內嵌指示會作為單則訊息的提示。
- **內嵌捷徑**（僅允許名單中的傳送者）：一般訊息中的某些 `/...` 權杖可立即執行（例如：「hey /status」），並在模型看到剩餘文字前被移除。

詳情：[Slash commands](/tools/slash-commands)。

## 工作階段、compaction 與 pruning（哪些會保留）

跨訊息是否保留，取決於機制：

- **一般歷史** 會保留在工作階段逐字稿中，直到依政策進行 compaction／pruning。
- **Compaction** 會將摘要保留到逐字稿中，並保留近期訊息不變。
- **Pruning** 會從單次執行的 _記憶體內_ prompt 移除舊的工具結果，但不會重寫逐字稿。

文件：[Session](/concepts/session)、[Compaction](/concepts/compaction)、[Session pruning](/concepts/session-pruning)。

## `/context` 實際回報的是什麼

`/context` 在可用時，會優先使用最新的 **執行時建構** system prompt 報告：

- `System prompt (run)` = 從上一次具備嵌入（可呼叫工具）的執行中擷取，並持久化於工作階段儲存。
- `System prompt (estimate)` = 在沒有執行報告時即時計算（或透過不產生報告的 CLI 後端執行時）。

不論哪一種方式，都只回報大小與主要貢獻者；**不會** 傾印完整的 system prompt 或工具 schemas。
