---
summary: 「CLI 入門引導精靈的完整參考：每個步驟、旗標與設定欄位」
read_when:
  - 查找特定的精靈步驟或旗標
  - 以非互動模式自動化入門引導
  - 除錯精靈行為
title: 「入門引導精靈參考」
sidebarTitle: "Wizard Reference"
x-i18n:
  source_path: reference/wizard.md
  source_hash: 1dd46ad12c53668c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:54:57Z
---

# 入門引導精靈參考

這是 `openclaw onboard` CLI 精靈的完整參考。
如需高層概覽，請參閱 [Onboarding Wizard](/start/wizard)。

## 流程細節（本機模式）

<Steps>
  <Step title="既有設定偵測">
    - 若存在 `~/.openclaw/openclaw.json`，可選擇 **保留 / 修改 / 重設**。
    - 重新執行精靈**不會**清除任何內容，除非你明確選擇 **重設**
      （或傳入 `--reset`）。
    - 若設定無效或包含舊版金鑰，精靈會停止並要求你先執行
      `openclaw doctor` 再繼續。
    - 重設會使用 `trash`（絕不使用 `rm`），並提供範圍選項：
      - 僅設定
      - 設定 + 憑證 + 工作階段
      - 完整重設（也會移除工作空間）
  </Step>
  <Step title="模型 / 驗證">
    - **Anthropic API 金鑰（建議）**：若存在 `ANTHROPIC_API_KEY` 則使用，否則提示輸入金鑰，並儲存供 daemon 使用。
    - **Anthropic OAuth（Claude Code CLI）**：在 macOS 上，精靈會檢查鑰匙圈項目「Claude Code-credentials」（請選擇「Always Allow」，避免 launchd 啟動時被阻擋）；在 Linux/Windows 上，若存在則重用 `~/.claude/.credentials.json`。
    - **Anthropic token（貼上 setup-token）**：在任何機器上執行 `claude setup-token`，再貼上 token（可命名；留空＝預設）。
    - **OpenAI Code（Codex）訂閱（Codex CLI）**：若存在 `~/.codex/auth.json`，精靈可重用。
    - **OpenAI Code（Codex）訂閱（OAuth）**：瀏覽器流程；貼上 `code#state`。
      - 當模型未設定或為 `openai/*` 時，會將 `agents.defaults.model` 設為 `openai-codex/gpt-5.2`。
    - **OpenAI API 金鑰**：若存在 `OPENAI_API_KEY` 則使用，否則提示輸入金鑰，並將其儲存至 `~/.openclaw/.env` 以供 launchd 讀取。
    - **OpenCode Zen（多模型代理）**：提示輸入 `OPENCODE_API_KEY`（或 `OPENCODE_ZEN_API_KEY`，於 https://opencode.ai/auth 取得）。
    - **API 金鑰**：為你儲存金鑰。
    - **Vercel AI Gateway（多模型代理）**：提示輸入 `AI_GATEWAY_API_KEY`。
    - 更多詳情：[Vercel AI Gateway](/providers/vercel-ai-gateway)
    - **Cloudflare AI Gateway**：提示輸入 Account ID、Gateway ID 與 `CLOUDFLARE_AI_GATEWAY_API_KEY`。
    - 更多詳情：[Cloudflare AI Gateway](/providers/cloudflare-ai-gateway)
    - **MiniMax M2.1**：自動寫入設定。
    - 更多詳情：[MiniMax](/providers/minimax)
    - **Synthetic（相容 Anthropic）**：提示輸入 `SYNTHETIC_API_KEY`。
    - 更多詳情：[Synthetic](/providers/synthetic)
    - **Moonshot（Kimi K2）**：自動寫入設定。
    - **Kimi Coding**：自動寫入設定。
    - 更多詳情：[Moonshot AI（Kimi + Kimi Coding）](/providers/moonshot)
    - **略過**：尚未設定任何驗證。
    - 從偵測到的選項中選擇預設模型（或手動輸入提供者 / 模型）。
    - 精靈會執行模型檢查，若設定的模型未知或缺少驗證會提出警告。
    - OAuth 憑證位於 `~/.openclaw/credentials/oauth.json`；驗證設定檔位於 `~/.openclaw/agents/<agentId>/agent/auth-profiles.json`（API 金鑰 + OAuth）。
    - 更多詳情：[/concepts/oauth](/concepts/oauth)
    <Note>
    無頭 / 伺服器提示：請在有瀏覽器的機器上完成 OAuth，然後將
    `~/.openclaw/credentials/oauth.json`（或 `$OPENCLAW_STATE_DIR/credentials/oauth.json`）複製到
    Gateway 主機。
    </Note>
  </Step>
  <Step title="工作空間">
    - 預設為 `~/.openclaw/workspace`（可設定）。
    - 會建立代理程式啟動儀式所需的工作空間檔案。
    - 完整的工作空間配置 + 備份指南：[Agent workspace](/concepts/agent-workspace)
  </Step>
  <Step title="Gateway">
    - 連接埠、綁定位址、驗證模式、Tailscale 曝露。
    - 驗證建議：即使是 loopback 也保留 **Token**，讓本機 WS 用戶端必須驗證。
    - 僅在你完全信任所有本機程序時才停用驗證。
    - 非 loopback 的綁定仍然需要驗證。
  </Step>
  <Step title="頻道">
    - [WhatsApp](/channels/whatsapp)：可選的 QR 登入。
    - [Telegram](/channels/telegram)：Bot token。
    - [Discord](/channels/discord)：Bot token。
    - [Google Chat](/channels/googlechat)：服務帳戶 JSON + webhook audience。
    - [Mattermost](/channels/mattermost)（外掛）：Bot token + 基礎 URL。
    - [Signal](/channels/signal)：可選的 `signal-cli` 安裝 + 帳戶設定。
    - [BlueBubbles](/channels/bluebubbles)：**iMessage 建議使用**；伺服器 URL + 密碼 + webhook。
    - [iMessage](/channels/imessage)：舊版 `imsg` CLI 路徑 + 資料庫存取。
    - 私訊安全性：預設為配對。第一則私訊會傳送代碼；透過 `openclaw pairing approve <channel> <code>` 核准，或使用允許清單。
  </Step>
  <Step title="Daemon 安裝">
    - macOS：LaunchAgent
      - 需要已登入的使用者工作階段；若為無頭環境，請使用自訂的 LaunchDaemon（未隨附）。
    - Linux（以及透過 WSL2 的 Windows）：systemd 使用者單元
      - 精靈會嘗試透過 `loginctl enable-linger <user>` 啟用 lingering，讓 Gateway 在登出後仍保持運作。
      - 可能會提示需要 sudo（寫入 `/var/lib/systemd/linger`）；會先嘗試不使用 sudo。
    - **執行階段選擇：** Node（建議；WhatsApp / Telegram 需要）。不建議使用 Bun。
  </Step>
  <Step title="健康檢查">
    - 啟動 Gateway（如有需要）並執行 `openclaw health`。
    - 提示：`openclaw status --deep` 會將 Gateway 健康探測加入狀態輸出（需要可連線的 Gateway）。
  </Step>
  <Step title="Skills（建議）">
    - 讀取可用的 Skills 並檢查需求。
    - 讓你選擇 Node 套件管理器：**npm / pnpm**（不建議 bun）。
    - 安裝選用相依套件（部分在 macOS 上使用 Homebrew）。
  </Step>
  <Step title="完成">
    - 摘要 + 後續步驟，包含 iOS / Android / macOS 應用程式以啟用額外功能。
  </Step>
</Steps>

<Note>
若未偵測到 GUI，精靈會改為輸出 Control UI 的 SSH 連接埠轉送指示，而不會開啟瀏覽器。
若 Control UI 資產缺失，精靈會嘗試建置；後備方案為 `pnpm ui:build`（自動安裝 UI 相依套件）。
</Note>

## 非互動模式

使用 `--non-interactive` 來自動化或以腳本方式完成入門引導：

```bash
openclaw onboard --non-interactive \
  --mode local \
  --auth-choice apiKey \
  --anthropic-api-key "$ANTHROPIC_API_KEY" \
  --gateway-port 18789 \
  --gateway-bind loopback \
  --install-daemon \
  --daemon-runtime node \
  --skip-skills
```

加入 `--json` 以取得機器可讀的摘要。

<Note>
`--json` **不**代表非互動模式。腳本請使用 `--non-interactive`（以及 `--workspace`）。
</Note>

<AccordionGroup>
  <Accordion title="Gemini 範例">
    ```bash
    openclaw onboard --non-interactive \
      --mode local \
      --auth-choice gemini-api-key \
      --gemini-api-key "$GEMINI_API_KEY" \
      --gateway-port 18789 \
      --gateway-bind loopback
    ```
  </Accordion>
  <Accordion title="Z.AI 範例">
    ```bash
    openclaw onboard --non-interactive \
      --mode local \
      --auth-choice zai-api-key \
      --zai-api-key "$ZAI_API_KEY" \
      --gateway-port 18789 \
      --gateway-bind loopback
    ```
  </Accordion>
  <Accordion title="Vercel AI Gateway 範例">
    ```bash
    openclaw onboard --non-interactive \
      --mode local \
      --auth-choice ai-gateway-api-key \
      --ai-gateway-api-key "$AI_GATEWAY_API_KEY" \
      --gateway-port 18789 \
      --gateway-bind loopback
    ```
  </Accordion>
  <Accordion title="Cloudflare AI Gateway 範例">
    ```bash
    openclaw onboard --non-interactive \
      --mode local \
      --auth-choice cloudflare-ai-gateway-api-key \
      --cloudflare-ai-gateway-account-id "your-account-id" \
      --cloudflare-ai-gateway-gateway-id "your-gateway-id" \
      --cloudflare-ai-gateway-api-key "$CLOUDFLARE_AI_GATEWAY_API_KEY" \
      --gateway-port 18789 \
      --gateway-bind loopback
    ```
  </Accordion>
  <Accordion title="Moonshot 範例">
    ```bash
    openclaw onboard --non-interactive \
      --mode local \
      --auth-choice moonshot-api-key \
      --moonshot-api-key "$MOONSHOT_API_KEY" \
      --gateway-port 18789 \
      --gateway-bind loopback
    ```
  </Accordion>
  <Accordion title="Synthetic 範例">
    ```bash
    openclaw onboard --non-interactive \
      --mode local \
      --auth-choice synthetic-api-key \
      --synthetic-api-key "$SYNTHETIC_API_KEY" \
      --gateway-port 18789 \
      --gateway-bind loopback
    ```
  </Accordion>
  <Accordion title="OpenCode Zen 範例">
    ```bash
    openclaw onboard --non-interactive \
      --mode local \
      --auth-choice opencode-zen \
      --opencode-zen-api-key "$OPENCODE_API_KEY" \
      --gateway-port 18789 \
      --gateway-bind loopback
    ```
  </Accordion>
</AccordionGroup>

### 新增代理程式（非互動）

```bash
openclaw agents add work \
  --workspace ~/.openclaw/workspace-work \
  --model openai/gpt-5.2 \
  --bind whatsapp:biz \
  --non-interactive \
  --json
```

## Gateway 精靈 RPC

Gateway 透過 RPC 提供精靈流程（`wizard.start`、`wizard.next`、`wizard.cancel`、`wizard.status`）。
用戶端（macOS 應用程式、Control UI）可在不重新實作入門引導邏輯的情況下呈現步驟。

## Signal 設定（signal-cli）

精靈可從 GitHub releases 安裝 `signal-cli`：

- 下載對應的發佈資產。
- 儲存至 `~/.openclaw/tools/signal-cli/<version>/`。
- 將 `channels.signal.cliPath` 寫入你的設定。

注意事項：

- JVM 版本需要 **Java 21**。
- 可用時會使用原生版本。
- Windows 使用 WSL2；signal-cli 的安裝會在 WSL 內依循 Linux 流程。

## 精靈會寫入的內容

`~/.openclaw/openclaw.json` 中的典型欄位：

- `agents.defaults.workspace`
- `agents.defaults.model` / `models.providers`（若選擇 Minimax）
- `gateway.*`（模式、綁定、驗證、Tailscale）
- `channels.telegram.botToken`、`channels.discord.token`、`channels.signal.*`、`channels.imessage.*`
- 當你在提示中選擇加入時，會寫入頻道允許清單（Slack / Discord / Matrix / Microsoft Teams）（名稱可解析時會轉為 ID）。
- `skills.install.nodeManager`
- `wizard.lastRunAt`
- `wizard.lastRunVersion`
- `wizard.lastRunCommit`
- `wizard.lastRunCommand`
- `wizard.lastRunMode`

`openclaw agents add` 會寫入 `agents.list[]` 與選用的 `bindings`。

WhatsApp 憑證位於 `~/.openclaw/credentials/whatsapp/<accountId>/`。
工作階段儲存在 `~/.openclaw/agents/<agentId>/sessions/`。

部分頻道以外掛形式提供。當你在入門引導中選擇其中之一時，精靈
會在可設定前提示你安裝它（npm 或本機路徑）。

## 相關文件

- 精靈概覽：[Onboarding Wizard](/start/wizard)
- macOS 應用程式入門引導：[Onboarding](/start/onboarding)
- 設定參考：[Gateway configuration](/gateway/configuration)
- 提供者：[WhatsApp](/channels/whatsapp)、[Telegram](/channels/telegram)、[Discord](/channels/discord)、[Google Chat](/channels/googlechat)、[Signal](/channels/signal)、[BlueBubbles](/channels/bluebubbles)（iMessage）、[iMessage](/channels/imessage)（舊版）
- Skills：[Skills](/tools/skills)、[Skills 設定](/tools/skills-config)
