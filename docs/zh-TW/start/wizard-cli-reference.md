---
summary: "CLI 入門引導流程、驗證／模型設定、輸出與內部機制的完整參考"
read_when:
  - 你需要 openclaw onboard 的詳細行為
  - 你正在除錯入門引導結果或整合入門引導用戶端
title: "CLI 入門引導參考"
sidebarTitle: "CLI reference"
x-i18n:
  source_path: start/wizard-cli-reference.md
  source_hash: 0ef6f01c3e29187b
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:07Z
---

# CLI 入門引導參考

本頁是 `openclaw onboard` 的完整參考。
簡短指南請見 [入門引導精靈（CLI）](/start/wizard)。

## 精靈會做什麼

本機模式（預設）會引導你完成：

- 模型與驗證設定（OpenAI Code 訂閱 OAuth、Anthropic API key 或設定權杖，另含 MiniMax、GLM、Moonshot 與 AI Gateway 選項）
- 工作區位置與啟動檔案
- Gateway 閘道器設定（連接埠、繫結、驗證、 tailscale）
- 頻道與提供者（Telegram、WhatsApp、Discord、Google Chat、Mattermost 外掛、Signal）
- 常駐程式安裝（LaunchAgent 或 systemd 使用者單元）
- 健康檢查
- Skills 設定

遠端模式會設定此機器連線到其他位置的 Gateway 閘道器。
它不會在遠端主機上安裝或修改任何內容。

## 本機流程細節

<Steps>
  <Step title="既有設定偵測">
    - 若 `~/.openclaw/openclaw.json` 存在，可選擇「保留」、「修改」或「重設」。
    - 重新執行精靈不會清除任何內容，除非你明確選擇「重設」（或傳入 `--reset`）。
    - 若設定無效或包含舊版金鑰，精靈會停止並要求你先執行 `openclaw doctor` 再繼續。
    - 重設會使用 `trash`，並提供範圍：
      - 僅設定
      - 設定 + 憑證 + 工作階段
      - 完整重設（也會移除工作區）
  </Step>
  <Step title="模型與驗證">
    - 完整選項矩陣請見 [驗證與模型選項](#auth-and-model-options)。
  </Step>
  <Step title="工作區">
    - 預設為 `~/.openclaw/workspace`（可設定）。
    - 會建立首次執行啟動儀式所需的工作區檔案。
    - 工作區配置： [代理程式工作區](/concepts/agent-workspace)。
  </Step>
  <Step title="Gateway 閘道器">
    - 提示輸入連接埠、繫結、驗證模式與 tailscale 曝露。
    - 建議：即使是 loopback 也保持權杖驗證啟用，讓本機 WS 用戶端必須驗證。
    - 僅在你完全信任所有本機行程時才停用驗證。
    - 非 loopback 的繫結仍然需要驗證。
  </Step>
  <Step title="頻道">
    - [WhatsApp](/channels/whatsapp)：選用 QR 登入
    - [Telegram](/channels/telegram)：機器人權杖
    - [Discord](/channels/discord)：機器人權杖
    - [Google Chat](/channels/googlechat)：服務帳戶 JSON + webhook 受眾
    - [Mattermost](/channels/mattermost) 外掛：機器人權杖 + 基底 URL
    - [Signal](/channels/signal)：選用安裝 `signal-cli` + 帳戶設定
    - [BlueBubbles](/channels/bluebubbles)：建議用於 iMessage；伺服器 URL + 密碼 + webhook
    - [iMessage](/channels/imessage)：舊版 `imsg` CLI 路徑 + DB 存取
    - 私訊安全：預設為配對。首次私訊會傳送代碼；請透過
      `openclaw pairing approve <channel> <code>` 核准或使用允許清單。
  </Step>
  <Step title="常駐程式安裝">
    - macOS：LaunchAgent
      - 需要已登入的使用者工作階段；無頭環境請使用自訂 LaunchDaemon（未隨附）。
    - Linux 與 Windows（透過 WSL2）：systemd 使用者單元
      - 精靈會嘗試 `loginctl enable-linger <user>`，讓 Gateway 閘道器在登出後仍保持運作。
      - 可能會要求 sudo（寫入 `/var/lib/systemd/linger`）；會先嘗試不使用 sudo。
    - 執行期選擇：Node（建議；WhatsApp 與 Telegram 必需）。不建議使用 Bun。
  </Step>
  <Step title="健康檢查">
    - 啟動 Gateway 閘道器（如需要）並執行 `openclaw health`。
    - `openclaw status --deep` 會將 Gateway 閘道器健康探針加入狀態輸出。
  </Step>
  <Step title="Skills">
    - 讀取可用 Skills 並檢查需求。
    - 讓你選擇 node 管理器：npm 或 pnpm（不建議 bun）。
    - 安裝選用相依套件（部分在 macOS 使用 Homebrew）。
  </Step>
  <Step title="完成">
    - 摘要與後續步驟，包含 iOS、Android 與 macOS 應用程式選項。
  </Step>
</Steps>

<Note>
若未偵測到 GUI，精靈會改為列印 Control UI 的 SSH 連接埠轉送指示，而不是開啟瀏覽器。
若 Control UI 資產遺失，精靈會嘗試建置；後備方案為 `pnpm ui:build`（自動安裝 UI 相依套件）。
</Note>

## 遠端模式細節

遠端模式會設定此機器連線到其他位置的 Gateway 閘道器。

<Info>
遠端模式不會在遠端主機上安裝或修改任何內容。
</Info>

你需要設定：

- 遠端 Gateway 閘道器 URL（`ws://...`）
- 若遠端 Gateway 閘道器需要驗證，請提供權杖（建議）

<Note>
- 若 Gateway 閘道器僅限 loopback，請使用 SSH 通道或 tailnet。
- 裝置探索提示：
  - macOS：Bonjour（`dns-sd`）
  - Linux：Avahi（`avahi-browse`）
</Note>

## 驗證與模型選項

<AccordionGroup>
  <Accordion title="Anthropic API key（建議）">
    若存在則使用 `ANTHROPIC_API_KEY`，否則提示輸入金鑰，並儲存以供常駐程式使用。
  </Accordion>
  <Accordion title="Anthropic OAuth（Claude Code CLI）">
    - macOS：檢查鑰匙圈項目「Claude Code-credentials」
    - Linux 與 Windows：若存在則重用 `~/.claude/.credentials.json`

    在 macOS 上，請選擇「Always Allow」，以免 launchd 啟動被阻擋。

  </Accordion>
  <Accordion title="Anthropic 權杖（貼上設定權杖）">
    在任一台機器上執行 `claude setup-token`，然後貼上權杖。
    你可以命名；留白則使用預設。
  </Accordion>
  <Accordion title="OpenAI Code 訂閱（重用 Codex CLI）">
    若存在 `~/.codex/auth.json`，精靈可重用它。
  </Accordion>
  <Accordion title="OpenAI Code 訂閱（OAuth）">
    瀏覽器流程；貼上 `code#state`。

    當模型未設定或為 `openai/*` 時，會將 `agents.defaults.model` 設為 `openai-codex/gpt-5.3-codex`。

  </Accordion>
  <Accordion title="OpenAI API key">
    若存在則使用 `OPENAI_API_KEY`，否則提示輸入金鑰，並將其儲存至
    `~/.openclaw/.env`，以便 launchd 讀取。

    當模型未設定、為 `openai/*`，或為 `openai-codex/*` 時，會將 `agents.defaults.model` 設為 `openai/gpt-5.1-codex`。

  </Accordion>
  <Accordion title="OpenCode Zen">
    提示輸入 `OPENCODE_API_KEY`（或 `OPENCODE_ZEN_API_KEY`）。
    設定 URL： [opencode.ai/auth](https://opencode.ai/auth)。
  </Accordion>
  <Accordion title="API key（通用）">
    會替你儲存金鑰。
  </Accordion>
  <Accordion title="Vercel AI Gateway">
    提示輸入 `AI_GATEWAY_API_KEY`。
    更多詳情： [Vercel AI Gateway](/providers/vercel-ai-gateway)。
  </Accordion>
  <Accordion title="Cloudflare AI Gateway">
    提示輸入帳戶 ID、Gateway ID 與 `CLOUDFLARE_AI_GATEWAY_API_KEY`。
    更多詳情： [Cloudflare AI Gateway](/providers/cloudflare-ai-gateway)。
  </Accordion>
  <Accordion title="MiniMax M2.1">
    會自動寫入設定。
    更多詳情： [MiniMax](/providers/minimax)。
  </Accordion>
  <Accordion title="Synthetic（相容 Anthropic）">
    提示輸入 `SYNTHETIC_API_KEY`。
    更多詳情： [Synthetic](/providers/synthetic)。
  </Accordion>
  <Accordion title="Moonshot 與 Kimi Coding">
    Moonshot（Kimi K2）與 Kimi Coding 的設定會自動寫入。
    更多詳情： [Moonshot AI（Kimi + Kimi Coding）](/providers/moonshot)。
  </Accordion>
  <Accordion title="略過">
    保持驗證未設定。
  </Accordion>
</AccordionGroup>

模型行為：

- 從偵測到的選項中挑選預設模型，或手動輸入提供者與模型。
- 精靈會執行模型檢查，若設定的模型未知或缺少驗證則提出警告。

憑證與設定檔路徑：

- OAuth 憑證：`~/.openclaw/credentials/oauth.json`
- 驗證設定檔（API key + OAuth）：`~/.openclaw/agents/<agentId>/agent/auth-profiles.json`

<Note>
無頭與伺服器提示：請在有瀏覽器的機器上完成 OAuth，然後將
`~/.openclaw/credentials/oauth.json`（或 `$OPENCLAW_STATE_DIR/credentials/oauth.json`）
複製到 Gateway 閘道器主機。
</Note>

## 輸出與內部機制

`~/.openclaw/openclaw.json` 中的常見欄位：

- `agents.defaults.workspace`
- `agents.defaults.model` / `models.providers`（若選擇 Minimax）
- `gateway.*`（模式、繫結、驗證、 tailscale）
- `channels.telegram.botToken`、`channels.discord.token`、`channels.signal.*`、`channels.imessage.*`
- 在提示中選擇加入時，會建立頻道允許清單（Slack、Discord、Matrix、Microsoft Teams）（名稱可解析為 ID 時會自動解析）
- `skills.install.nodeManager`
- `wizard.lastRunAt`
- `wizard.lastRunVersion`
- `wizard.lastRunCommit`
- `wizard.lastRunCommand`
- `wizard.lastRunMode`

`openclaw agents add` 會寫入 `agents.list[]` 與選用的 `bindings`。

WhatsApp 憑證位於 `~/.openclaw/credentials/whatsapp/<accountId>/` 之下。
工作階段儲存在 `~/.openclaw/agents/<agentId>/sessions/` 之下。

<Note>
部分頻道以外掛形式提供。在入門引導期間選擇後，精靈會在頻道設定前
提示安裝外掛（npm 或本機路徑）。
</Note>

Gateway 閘道器精靈 RPC：

- `wizard.start`
- `wizard.next`
- `wizard.cancel`
- `wizard.status`

用戶端（macOS 應用程式與 Control UI）可在不重新實作入門引導邏輯的情況下呈現步驟。

Signal 設定行為：

- 下載適當的發行資產
- 將其儲存在 `~/.openclaw/tools/signal-cli/<version>/`
- 在設定中寫入 `channels.signal.cliPath`
- JVM 組建需要 Java 21
- 可用時優先使用原生組建
- Windows 使用 WSL2，並在 WSL 內依循 Linux 的 signal-cli 流程

## 相關文件

- 入門引導總覽： [入門引導精靈（CLI）](/start/wizard)
- 自動化與腳本： [CLI 自動化](/start/wizard-cli-automation)
- 指令參考： [`openclaw onboard`](/cli/onboard)
