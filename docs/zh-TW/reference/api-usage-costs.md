---
summary: "稽核哪些項目可能花費金錢、使用了哪些金鑰，以及如何檢視用量"
read_when:
  - 你想了解哪些功能可能會呼叫付費 API
  - 你需要稽核金鑰、成本與用量可視性
  - 你正在說明 /status 或 /usage 的成本回報
title: "API 使用量與成本"
x-i18n:
  source_path: reference/api-usage-costs.md
  source_hash: 807d0d88801e919a
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:54:32Z
---

# API 使用量與成本

本文件列出**可能會呼叫 API 金鑰的功能**以及其成本顯示位置。內容聚焦於
可能產生提供者用量或付費 API 呼叫的 OpenClaw 功能。

## 成本顯示位置（聊天 + CLI）

**每個工作階段的成本快照**

- `/status` 會顯示目前工作階段的模型、上下文用量，以及最後一次回應的權杖數。
- 若模型使用 **API-key 驗證**，`/status` 也會顯示最後一則回覆的**預估成本**。

**每則訊息的成本頁尾**

- `/usage full` 會在每則回覆後附加用量頁尾，包含**預估成本**（僅限 API-key）。
- `/usage tokens` 僅顯示權杖數；OAuth 流程會隱藏美元成本。

**CLI 用量視窗（提供者配額）**

- `openclaw status --usage` 與 `openclaw channels list` 會顯示提供者的**用量視窗**
  （配額快照，而非逐訊息成本）。

詳情與範例請參閱［Token use & costs］(/token-use)。

## 金鑰的探索方式

OpenClaw 可以從以下來源取得憑證：

- **Auth 設定檔**（每個代理程式一份，儲存在 `auth-profiles.json`）。
- **環境變數**（例如 `OPENAI_API_KEY`、`BRAVE_API_KEY`、`FIRECRAWL_API_KEY`）。
- **Config**（`models.providers.*.apiKey`、`tools.web.search.*`、`tools.web.fetch.firecrawl.*`、
  `memorySearch.*`、`talk.apiKey`）。
- **Skills**（`skills.entries.<name>.apiKey`），可能會將金鑰匯出到技能程序的環境變數中。

## 可能花費金鑰的功能

### 1) 核心模型回應（聊天 + 工具）

每一次回覆或工具呼叫都會使用**目前的模型提供者**（OpenAI、Anthropic 等）。
這是用量與成本的主要來源。

價格設定請參閱［Models］(/providers/models)，顯示方式請參閱［Token use & costs］(/token-use)。

### 2) 媒體理解（音訊／影像／影片）

在回覆執行前，輸入的媒體可能會先被摘要或轉寫。這會使用模型／提供者的 API。

- 音訊：OpenAI／Groq／Deepgram（當存在金鑰時**自動啟用**）。
- 影像：OpenAI／Anthropic／Google。
- 影片：Google。

請參閱［Media understanding］(/nodes/media-understanding)。

### 3) 記憶嵌入 + 語意搜尋

當設定為遠端提供者時，語意記憶搜尋會使用**嵌入 API**：

- `memorySearch.provider = "openai"` → OpenAI embeddings
- `memorySearch.provider = "gemini"` → Gemini embeddings
- 若本地嵌入失敗，可選擇回退至 OpenAI

你也可以使用 `memorySearch.provider = "local"` 保持本地執行（不會使用 API）。

請參閱［Memory］(/concepts/memory)。

### 4) 網頁搜尋工具（Brave／Perplexity 透過 OpenRouter）

`web_search` 會使用 API 金鑰，並可能產生用量費用：

- **Brave Search API**：`BRAVE_API_KEY` 或 `tools.web.search.apiKey`
- **Perplexity**（透過 OpenRouter）：`PERPLEXITY_API_KEY` 或 `OPENROUTER_API_KEY`

**Brave 免費方案（相當慷慨）：**

- **每月 2,000 次請求**
- **每秒 1 次請求**
- **需要信用卡** 進行驗證（未升級前不會收費）

請參閱［Web tools］(/tools/web)。

### 5) 網頁抓取工具（Firecrawl）

當存在 API 金鑰時，`web_fetch` 可以呼叫 **Firecrawl**：

- `FIRECRAWL_API_KEY` 或 `tools.web.fetch.firecrawl.apiKey`

若未設定 Firecrawl，工具會回退至直接抓取 + 可讀性處理（不使用付費 API）。

請參閱［Web tools］(/tools/web)。

### 6) 提供者用量快照（status／health）

部分狀態指令會呼叫**提供者用量端點**以顯示配額視窗或驗證健康狀態。
這些通常是低頻呼叫，但仍會命中提供者 API：

- `openclaw status --usage`
- `openclaw models status --json`

請參閱［Models CLI］(/cli/models)。

### 7) 壓縮保護的摘要

壓縮保護機制可能會使用**目前的模型**來摘要工作階段歷史，
在執行時會呼叫提供者 API。

請參閱［Session management + compaction］(/reference/session-management-compaction)。

### 8) 模型掃描／探測

`openclaw models scan` 可以探測 OpenRouter 模型，且在啟用探測時會使用 `OPENROUTER_API_KEY`。

請參閱［Models CLI］(/cli/models)。

### 9) Talk（語音）

在設定完成後，Talk 模式可以呼叫 **ElevenLabs**：

- `ELEVENLABS_API_KEY` 或 `talk.apiKey`

請參閱［Talk mode］(/nodes/talk)。

### 10) Skills（第三方 API）

Skills 可以將 `apiKey` 儲存在 `skills.entries.<name>.apiKey` 中。若某個技能使用該金鑰呼叫外部
API，將依技能的提供者產生相應成本。

請參閱［Skills］(/tools/skills)。
