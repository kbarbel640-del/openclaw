---
summary: 「測試工具組：unit／e2e／live 測試套件、Docker 執行器，以及各測試涵蓋內容」
read_when:
  - 在本機或 CI 中執行測試時
  - 為模型／提供者錯誤新增回歸測試時
  - 除錯 Gateway 閘道器 + 代理程式 行為時
title: 「測試」
x-i18n:
  source_path: testing.md
  source_hash: 7a23ced0e6e3be5e
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:29Z
---

# 測試

OpenClaw 有三個 Vitest 測試套件（unit／integration、e2e、live）以及一小組 Docker 執行器。

本文件是「我們如何測試」的指南：

- 各套件涵蓋的內容（以及刻意「不」涵蓋的內容）
- 常見工作流程（本機、pre-push、除錯）該執行哪些指令
- Live 測試如何探索憑證並選擇模型／提供者
- 如何為真實世界的模型／提供者問題新增回歸測試

## 快速開始

大多數情況：

- 完整關卡（推送前預期）：`pnpm build && pnpm check && pnpm test`

當你修改測試或需要更高信心時：

- 覆蓋率關卡：`pnpm test:coverage`
- E2E 套件：`pnpm test:e2e`

當除錯真實提供者／模型（需要真實憑證）時：

- Live 套件（模型 + Gateway 閘道器 工具／映像探測）：`pnpm test:live`

提示：當你只需要一個失敗案例時，請優先使用下文描述的 allowlist 環境變數來縮小 live 測試範圍。

## 測試套件（在哪裡執行、涵蓋什麼）

將這些套件視為「寫實度逐步提高」（同時不穩定性／成本也提高）：

### Unit／integration（預設）

- 指令：`pnpm test`
- 設定：`vitest.config.ts`
- 檔案：`src/**/*.test.ts`
- 範圍：
  - 純 unit 測試
  - 行程內 integration 測試（gateway 驗證、路由、工具、解析、設定）
  - 已知錯誤的確定性回歸測試
- 期望：
  - 在 CI 中執行
  - 不需要真實金鑰
  - 應該快速且穩定

### E2E（gateway 煙霧測試）

- 指令：`pnpm test:e2e`
- 設定：`vitest.e2e.config.ts`
- 檔案：`src/**/*.e2e.test.ts`
- 範圍：
  - 多實例 gateway 端到端行為
  - WebSocket／HTTP 介面、節點配對，以及較重的網路行為
- 期望：
  - 在 CI 中執行（當管線啟用時）
  - 不需要真實金鑰
  - 比 unit 測試有更多可動元件（可能較慢）

### Live（真實提供者 + 真實模型）

- 指令：`pnpm test:live`
- 設定：`vitest.live.config.ts`
- 檔案：`src/**/*.live.test.ts`
- 預設：由 `pnpm test:live` **啟用**（設定 `OPENCLAW_LIVE_TEST=1`）
- 範圍：
  - 「這個提供者／模型今天是否真的能用真實憑證正常運作？」
  - 捕捉提供者格式變更、工具呼叫怪癖、驗證問題與速率限制行為
- 期望：
  - 設計上不具 CI 穩定性（真實網路、真實提供者政策、配額、故障）
  - 需要花錢／使用速率限制
  - 盡量執行縮小範圍的子集合，而非「全部」
  - Live 執行會載入 `~/.profile` 以取得缺失的 API 金鑰
  - Anthropic 金鑰輪替：設定 `OPENCLAW_LIVE_ANTHROPIC_KEYS="sk-...,sk-..."`（或 `OPENCLAW_LIVE_ANTHROPIC_KEY=sk-...`）或多個 `ANTHROPIC_API_KEY*` 變數；測試在遇到速率限制時會重試

## 我該執行哪個套件？

使用這個決策表：

- 編輯邏輯／測試：執行 `pnpm test`（若改動很多，再加上 `pnpm test:coverage`）
- 修改 gateway 網路／WS 協定／配對：加入 `pnpm test:e2e`
- 除錯「我的機器人掛了」／提供者特定失敗／工具呼叫：執行縮小範圍的 `pnpm test:live`

## Live：模型煙霧測試（profile keys）

Live 測試分成兩層，以便隔離失敗原因：

- 「直接模型」告訴我們提供者／模型是否能以該金鑰回應。
- 「Gateway 煙霧」告訴我們該模型的完整 gateway+agent 管線是否運作（工作階段、歷史、工具、沙箱政策等）。

### 第 1 層：直接模型完成（不經 gateway）

- 測試：`src/agents/models.profiles.live.test.ts`
- 目標：
  - 列舉探索到的模型
  - 使用 `getApiKeyForModel` 選擇你有憑證的模型
  - 每個模型執行一次小型完成（必要時加入目標回歸）
- 啟用方式：
  - `pnpm test:live`（或直接呼叫 Vitest 時使用 `OPENCLAW_LIVE_TEST=1`）
- 設定 `OPENCLAW_LIVE_MODELS=modern`（或現代別名 `all`）以實際執行此套件；否則會跳過以讓 `pnpm test:live` 專注於 gateway 煙霧測試
- 選擇模型：
  - `OPENCLAW_LIVE_MODELS=modern` 執行現代 allowlist（Opus／Sonnet／Haiku 4.5、GPT-5.x + Codex、Gemini 3、GLM 4.7、MiniMax M2.1、Grok 4）
  - `OPENCLAW_LIVE_MODELS=all` 是現代 allowlist 的別名
  - 或 `OPENCLAW_LIVE_MODELS="openai/gpt-5.2,anthropic/claude-opus-4-6,..."`（以逗號分隔的 allowlist）
- 選擇提供者：
  - `OPENCLAW_LIVE_PROVIDERS="google,google-antigravity,google-gemini-cli"`（以逗號分隔的 allowlist）
- 金鑰來源：
  - 預設：profile store 與 env 後備
  - 設定 `OPENCLAW_LIVE_REQUIRE_PROFILE_KEYS=1` 以強制僅使用 **profile store**
- 為何存在：
  - 將「提供者 API 壞了／金鑰無效」與「gateway agent 管線壞了」分離
  - 容納小而獨立的回歸（例如：OpenAI Responses／Codex Responses 的推理重播 + 工具呼叫流程）

### 第 2 層：Gateway + 開發代理程式 煙霧測試（「@openclaw」實際做的事）

- 測試：`src/gateway/gateway-models.profiles.live.test.ts`
- 目標：
  - 啟動行程內 gateway
  - 建立／修補一個 `agent:dev:*` 工作階段（每次執行可覆寫模型）
  - 迭代具金鑰的模型並斷言：
    - 有「有意義」的回應（無工具）
    - 真實的工具呼叫可運作（read 探測）
    - 選用的額外工具探測（exec+read 探測）
    - OpenAI 回歸路徑（僅工具呼叫 → 後續）仍可運作
- 探測細節（方便快速解釋失敗）：
  - `read` 探測：測試在工作區寫入一個 nonce 檔案，並要求代理程式 `read` 它並回傳 nonce。
  - `exec+read` 探測：測試要求代理程式 `exec` 寫入一個 nonce 到暫存檔，然後再 `read` 讀回。
  - 影像探測：測試附上一張產生的 PNG（貓 + 隨機代碼），並期望模型回傳 `cat <CODE>`。
  - 實作參考：`src/gateway/gateway-models.profiles.live.test.ts` 與 `src/gateway/live-image-probe.ts`。
- 啟用方式：
  - `pnpm test:live`（或直接呼叫 Vitest 時使用 `OPENCLAW_LIVE_TEST=1`）
- 選擇模型：
  - 預設：現代 allowlist（Opus／Sonnet／Haiku 4.5、GPT-5.x + Codex、Gemini 3、GLM 4.7、MiniMax M2.1、Grok 4）
  - `OPENCLAW_LIVE_GATEWAY_MODELS=all` 是現代 allowlist 的別名
  - 或設定 `OPENCLAW_LIVE_GATEWAY_MODELS="provider/model"`（或以逗號分隔）以縮小範圍
- 選擇提供者（避免「OpenRouter 全部」）：
  - `OPENCLAW_LIVE_GATEWAY_PROVIDERS="google,google-antigravity,google-gemini-cli,openai,anthropic,zai,minimax"`（以逗號分隔的 allowlist）
- 工具 + 影像探測在此 live 測試中永遠開啟：
  - `read` 探測 + `exec+read` 探測（工具壓力）
  - 當模型宣告支援影像輸入時，會執行影像探測
  - 流程（高層）：
    - 測試產生一個含「CAT」+ 隨機代碼的小型 PNG（`src/gateway/live-image-probe.ts`）
    - 透過 `agent` `attachments: [{ mimeType: "image/png", content: "<base64>" }]` 傳送
    - Gateway 解析附件為 `images[]`（`src/gateway/server-methods/agent.ts` + `src/gateway/chat-attachments.ts`）
    - 內嵌代理程式將多模態使用者訊息轉送至模型
    - 斷言：回覆包含 `cat` + 代碼（OCR 容錯：允許些微錯誤）

提示：要查看你的機器可測試的項目（以及確切的 `provider/model` ID），請執行：

```bash
openclaw models list
openclaw models list --json
```

## Live：Anthropic setup-token 煙霧測試

- 測試：`src/agents/anthropic.setup-token.live.test.ts`
- 目標：驗證 Claude Code CLI 的 setup-token（或貼上的 setup-token profile）能完成 Anthropic 提示。
- 啟用：
  - `pnpm test:live`（或直接呼叫 Vitest 時使用 `OPENCLAW_LIVE_TEST=1`）
  - `OPENCLAW_LIVE_SETUP_TOKEN=1`
- Token 來源（擇一）：
  - Profile：`OPENCLAW_LIVE_SETUP_TOKEN_PROFILE=anthropic:setup-token-test`
  - 原始 token：`OPENCLAW_LIVE_SETUP_TOKEN_VALUE=sk-ant-oat01-...`
- 模型覆寫（選用）：
  - `OPENCLAW_LIVE_SETUP_TOKEN_MODEL=anthropic/claude-opus-4-6`

設定範例：

```bash
openclaw models auth paste-token --provider anthropic --profile-id anthropic:setup-token-test
OPENCLAW_LIVE_SETUP_TOKEN=1 OPENCLAW_LIVE_SETUP_TOKEN_PROFILE=anthropic:setup-token-test pnpm test:live src/agents/anthropic.setup-token.live.test.ts
```

## Live：CLI 後端 煙霧測試（Claude Code CLI 或其他本機 CLI）

- 測試：`src/gateway/gateway-cli-backend.live.test.ts`
- 目標：使用本機 CLI 後端驗證 Gateway 閘道器 + 代理程式 管線，而不影響你的預設設定。
- 啟用：
  - `pnpm test:live`（或直接呼叫 Vitest 時使用 `OPENCLAW_LIVE_TEST=1`）
  - `OPENCLAW_LIVE_CLI_BACKEND=1`
- 預設：
  - 模型：`claude-cli/claude-sonnet-4-5`
  - 指令：`claude`
  - 參數：`["-p","--output-format","json","--dangerously-skip-permissions"]`
- 覆寫（選用）：
  - `OPENCLAW_LIVE_CLI_BACKEND_MODEL="claude-cli/claude-opus-4-6"`
  - `OPENCLAW_LIVE_CLI_BACKEND_MODEL="codex-cli/gpt-5.3-codex"`
  - `OPENCLAW_LIVE_CLI_BACKEND_COMMAND="/full/path/to/claude"`
  - `OPENCLAW_LIVE_CLI_BACKEND_ARGS='["-p","--output-format","json","--permission-mode","bypassPermissions"]'`
  - `OPENCLAW_LIVE_CLI_BACKEND_CLEAR_ENV='["ANTHROPIC_API_KEY","ANTHROPIC_API_KEY_OLD"]'`
  - `OPENCLAW_LIVE_CLI_BACKEND_IMAGE_PROBE=1` 以傳送真實影像附件（路徑會注入提示中）。
  - `OPENCLAW_LIVE_CLI_BACKEND_IMAGE_ARG="--image"` 以將影像檔路徑作為 CLI 參數傳遞，而非提示注入。
  - `OPENCLAW_LIVE_CLI_BACKEND_IMAGE_MODE="repeat"`（或 `"list"`）以在設定 `IMAGE_ARG` 時控制影像參數的傳遞方式。
  - `OPENCLAW_LIVE_CLI_BACKEND_RESUME_PROBE=1` 以傳送第二輪並驗證續接流程。
- `OPENCLAW_LIVE_CLI_BACKEND_DISABLE_MCP_CONFIG=0` 以保持 Claude Code CLI MCP 設定啟用（預設會用臨時空檔案停用 MCP 設定）。

範例：

```bash
OPENCLAW_LIVE_CLI_BACKEND=1 \
  OPENCLAW_LIVE_CLI_BACKEND_MODEL="claude-cli/claude-sonnet-4-5" \
  pnpm test:live src/gateway/gateway-cli-backend.live.test.ts
```

### 建議的 live 配方

縮小且明確的 allowlist 最快、最不易不穩定：

- 單一模型，直接（不經 gateway）：
  - `OPENCLAW_LIVE_MODELS="openai/gpt-5.2" pnpm test:live src/agents/models.profiles.live.test.ts`

- 單一模型，gateway 煙霧測試：
  - `OPENCLAW_LIVE_GATEWAY_MODELS="openai/gpt-5.2" pnpm test:live src/gateway/gateway-models.profiles.live.test.ts`

- 跨多個提供者的工具呼叫：
  - `OPENCLAW_LIVE_GATEWAY_MODELS="openai/gpt-5.2,anthropic/claude-opus-4-6,google/gemini-3-flash-preview,zai/glm-4.7,minimax/minimax-m2.1" pnpm test:live src/gateway/gateway-models.profiles.live.test.ts`

- Google 聚焦（Gemini API 金鑰 + Antigravity）：
  - Gemini（API 金鑰）：`OPENCLAW_LIVE_GATEWAY_MODELS="google/gemini-3-flash-preview" pnpm test:live src/gateway/gateway-models.profiles.live.test.ts`
  - Antigravity（OAuth）：`OPENCLAW_LIVE_GATEWAY_MODELS="google-antigravity/claude-opus-4-5-thinking,google-antigravity/gemini-3-pro-high" pnpm test:live src/gateway/gateway-models.profiles.live.test.ts`

備註：

- `google/...` 使用 Gemini API（API 金鑰）。
- `google-antigravity/...` 使用 Antigravity OAuth 橋接（Cloud Code Assist 風格的 agent 端點）。
- `google-gemini-cli/...` 使用你機器上的本機 Gemini CLI（獨立驗證 + 工具怪癖）。
- Gemini API vs Gemini CLI：
  - API：OpenClaw 透過 HTTP 呼叫 Google 託管的 Gemini API（API 金鑰／profile 驗證）；這是多數使用者所指的「Gemini」。
  - CLI：OpenClaw 以 shell 呼叫本機 `gemini` 二進位檔；它有自己的驗證，行為可能不同（串流／工具支援／版本偏差）。

## Live：模型矩陣（我們涵蓋的內容）

沒有固定的「CI 模型清單」（live 為 opt-in），但以下是建議在具備金鑰的開發機器上定期涵蓋的模型。

### 現代煙霧集合（工具呼叫 + 影像）

這是我們期望能持續運作的「常見模型」執行：

- OpenAI（非 Codex）：`openai/gpt-5.2`（選用：`openai/gpt-5.1`）
- OpenAI Codex：`openai-codex/gpt-5.3-codex`（選用：`openai-codex/gpt-5.3-codex-codex`）
- Anthropic：`anthropic/claude-opus-4-6`（或 `anthropic/claude-sonnet-4-5`）
- Google（Gemini API）：`google/gemini-3-pro-preview` 與 `google/gemini-3-flash-preview`（避免較舊的 Gemini 2.x）
- Google（Antigravity）：`google-antigravity/claude-opus-4-5-thinking` 與 `google-antigravity/gemini-3-flash`
- Z.AI（GLM）：`zai/glm-4.7`
- MiniMax：`minimax/minimax-m2.1`

以工具 + 影像執行 gateway 煙霧測試：
`OPENCLAW_LIVE_GATEWAY_MODELS="openai/gpt-5.2,openai-codex/gpt-5.3-codex,anthropic/claude-opus-4-6,google/gemini-3-pro-preview,google/gemini-3-flash-preview,google-antigravity/claude-opus-4-5-thinking,google-antigravity/gemini-3-flash,zai/glm-4.7,minimax/minimax-m2.1" pnpm test:live src/gateway/gateway-models.profiles.live.test.ts`

### 基準：工具呼叫（Read + 選用 Exec）

每個提供者家族至少選一個：

- OpenAI：`openai/gpt-5.2`（或 `openai/gpt-5-mini`）
- Anthropic：`anthropic/claude-opus-4-6`（或 `anthropic/claude-sonnet-4-5`）
- Google：`google/gemini-3-flash-preview`（或 `google/gemini-3-pro-preview`）
- Z.AI（GLM）：`zai/glm-4.7`
- MiniMax：`minimax/minimax-m2.1`

選用的額外涵蓋（加分）：

- xAI：`xai/grok-4`（或最新可用）
- Mistral：`mistral/`…（挑選一個你已啟用、支援工具的模型）
- Cerebras：`cerebras/`…（若你有存取權）
- LM Studio：`lmstudio/`…（本機；工具呼叫取決於 API 模式）

### 視覺：影像傳送（附件 → 多模態訊息）

在 `OPENCLAW_LIVE_GATEWAY_MODELS` 中至少包含一個支援影像的模型（Claude／Gemini／OpenAI 具視覺能力的變體等）以驗證影像探測。

### 彙整器／替代閘道器

若你已啟用金鑰，也支援透過以下方式測試：

- OpenRouter：`openrouter/...`（數百個模型；使用 `openclaw models scan` 尋找支援工具+影像的候選）
- OpenCode Zen：`opencode/...`（透過 `OPENCODE_API_KEY`／`OPENCODE_ZEN_API_KEY` 驗證）

可加入 live 矩陣的更多提供者（若你有憑證／設定）：

- 內建：`openai`、`openai-codex`、`anthropic`、`google`、`google-vertex`、`google-antigravity`、`google-gemini-cli`、`zai`、`openrouter`、`opencode`、`xai`、`groq`、`cerebras`、`mistral`、`github-copilot`
- 透過 `models.providers`（自訂端點）：`minimax`（雲端／API），以及任何 OpenAI／Anthropic 相容的代理（LM Studio、vLLM、LiteLLM 等）

提示：不要嘗試在文件中硬編碼「所有模型」。權威清單是你機器上 `discoverModels(...)` 的回傳結果 + 可用的金鑰。

## 憑證（切勿提交）

Live 測試探索憑證的方式與 CLI 相同。實務影響：

- 若 CLI 可用，live 測試應能找到相同金鑰。
- 若 live 測試顯示「no creds」，請用你除錯 `openclaw models list`／模型選擇的方式來除錯。

- Profile store：`~/.openclaw/credentials/`（建議；測試中「profile keys」的意義）
- 設定：`~/.openclaw/openclaw.json`（或 `OPENCLAW_CONFIG_PATH`）

若你想依賴 env 金鑰（例如在你的 `~/.profile` 中已匯出），請在 `source ~/.profile` 之後執行本機測試，或使用下方的 Docker 執行器（可將 `~/.profile` 掛載到容器中）。

## Deepgram live（音訊轉寫）

- 測試：`src/media-understanding/providers/deepgram/audio.live.test.ts`
- 啟用：`DEEPGRAM_API_KEY=... DEEPGRAM_LIVE_TEST=1 pnpm test:live src/media-understanding/providers/deepgram/audio.live.test.ts`

## Docker 執行器（選用的「在 Linux 上可運作」檢查）

這些會在 repo 的 Docker 映像中執行 `pnpm test:live`，並掛載你的本機設定目錄與工作區（若已掛載，會載入 `~/.profile`）：

- 直接模型：`pnpm test:docker:live-models`（腳本：`scripts/test-live-models-docker.sh`）
- Gateway + 開發代理程式：`pnpm test:docker:live-gateway`（腳本：`scripts/test-live-gateway-models-docker.sh`）
- 入門引導精靈（TTY，完整鷹架）：`pnpm test:docker:onboard`（腳本：`scripts/e2e/onboard-docker.sh`）
- Gateway 網路（兩個容器，WS 驗證 + 健康檢查）：`pnpm test:docker:gateway-network`（腳本：`scripts/e2e/gateway-network-docker.sh`）
- 外掛（自訂擴充載入 + 登錄煙霧）：`pnpm test:docker:plugins`（腳本：`scripts/e2e/plugins-docker.sh`）

實用的環境變數：

- `OPENCLAW_CONFIG_DIR=...`（預設：`~/.openclaw`）掛載到 `/home/node/.openclaw`
- `OPENCLAW_WORKSPACE_DIR=...`（預設：`~/.openclaw/workspace`）掛載到 `/home/node/.openclaw/workspace`
- `OPENCLAW_PROFILE_FILE=...`（預設：`~/.profile`）掛載到 `/home/node/.profile` 並在執行測試前載入
- `OPENCLAW_LIVE_GATEWAY_MODELS=...`／`OPENCLAW_LIVE_MODELS=...` 以縮小執行範圍
- `OPENCLAW_LIVE_REQUIRE_PROFILE_KEYS=1` 以確保憑證來自 profile store（而非 env）

## 文件健全性

文件編輯後執行文件檢查：`pnpm docs:list`。

## 離線回歸（CI 安全）

這些是在沒有真實提供者的情況下的「真實管線」回歸：

- Gateway 工具呼叫（模擬 OpenAI，真實 gateway + agent 迴圈）：`src/gateway/gateway.tool-calling.mock-openai.test.ts`
- Gateway 精靈（WS `wizard.start`/`wizard.next`，寫入設定 + 強制驗證）：`src/gateway/gateway.wizard.e2e.test.ts`

## 代理程式可靠性評估（Skills）

我們已經有一些 CI 安全、行為類似「代理程式可靠性評估」的測試：

- 透過真實 gateway + agent 迴圈的模擬工具呼叫（`src/gateway/gateway.tool-calling.mock-openai.test.ts`）。
- 驗證工作階段接線與設定效果的端到端精靈流程（`src/gateway/gateway.wizard.e2e.test.ts`）。

Skills 仍缺少的部分（見 [Skills](/tools/skills)）：

- **決策：** 當提示中列出 skills 時，代理程式是否選擇正確的 skill（或避免不相關的）？
- **合規：** 代理程式是否在使用前閱讀 `SKILL.md` 並遵循必要步驟／參數？
- **工作流程合約：** 多輪情境，斷言工具順序、工作階段歷史延續與沙箱邊界。

未來的評估應先保持確定性：

- 使用模擬提供者的情境執行器，斷言工具呼叫 + 順序、skill 檔案讀取與工作階段接線。
- 一小組以 skill 為中心的情境（使用 vs 避免、閘控、提示注入）。
- 只有在 CI 安全套件到位後，才加入選用的 live 評估（opt-in、以 env 控制）。

## 新增回歸（指引）

當你修復在 live 中發現的提供者／模型問題時：

- 盡可能新增 CI 安全的回歸（模擬／存根提供者，或擷取精確的請求形狀轉換）
- 若本質上只能 live（速率限制、驗證政策），請保持 live 測試狹窄並以 env 變數 opt-in
- 優先鎖定能捕捉錯誤的最小層級：
  - 提供者請求轉換／重播錯誤 → 直接模型測試
  - gateway 工作階段／歷史／工具管線錯誤 → gateway live 煙霧或 CI 安全的 gateway 模擬測試
