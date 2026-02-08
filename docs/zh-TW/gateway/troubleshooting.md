---
summary: "常見 OpenClaw 故障的快速疑難排解指南"
read_when:
  - 在調查執行階段問題或故障時
title: "疑難排解"
x-i18n:
  source_path: gateway/troubleshooting.md
  source_hash: a07bb06f0b5ef568
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:54:29Z
---

# 疑難排解 🔧

當 OpenClaw 表現異常時，以下是修復方式。

如果你只想要快速的初步檢查流程，請先從 FAQ 的「[最初的 60 秒](/help/faq#first-60-seconds-if-somethings-broken)」開始。本頁將更深入說明執行階段故障與診斷方式。

提供者專屬捷徑：[/channels/troubleshooting](/channels/troubleshooting)

## 狀態與診斷

快速初步檢查指令（依序）：

| Command                            | 它告訴你什麼                                                                       | 何時使用它                           |
| ---------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------ |
| `openclaw status`                  | 本機摘要：OS + 更新、Gateway 可達性/模式、服務、代理程式/工作階段、提供者設定狀態  | 第一次檢查，快速總覽                 |
| `openclaw status --all`            | 完整本機診斷（唯讀、可貼上、相對安全），包含日誌尾端                               | 需要分享除錯報告時                   |
| `openclaw status --deep`           | 執行 Gateway 健康檢查（含提供者探測；需要 Gateway 可達）                           | 當「已設定」不代表「可運作」時       |
| `openclaw gateway probe`           | Gateway 探索 + 可達性（本機 + 遠端目標）                                           | 懷疑探測到錯誤的 Gateway 時          |
| `openclaw channels status --probe` | 向執行中的 Gateway 查詢頻道狀態（並可選擇進行探測）                                | Gateway 可達但頻道行為異常時         |
| `openclaw gateway status`          | 監督程式狀態（launchd/systemd/schtasks）、執行中 PID/結束狀態、最後的 Gateway 錯誤 | 服務「看起來已載入」但實際沒有執行時 |
| `openclaw logs --follow`           | 即時日誌（執行階段問題的最佳訊號）                                                 | 需要實際失敗原因時                   |

**分享輸出：** 優先使用 `openclaw status --all`（會遮蔽權杖）。如果貼上 `openclaw status`，請先考慮設定 `OPENCLAW_SHOW_SECRETS=0`（權杖預覽）。

另請參閱：[健康檢查](/gateway/health) 與 [日誌](/logging)。

## 常見問題

### 找不到提供者「anthropic」的 API 金鑰

這表示 **代理程式的驗證儲存庫是空的**，或缺少 Anthropic 憑證。
驗證是 **以代理程式為單位**，因此新代理程式不會繼承主要代理程式的金鑰。

修復方式：

- 重新執行入門引導，並為該代理程式選擇 **Anthropic**。
- 或在 **Gateway 主機** 上貼上 setup-token：
  ```bash
  openclaw models auth setup-token --provider anthropic
  ```
- 或將主要代理程式目錄中的 `auth-profiles.json` 複製到新代理程式目錄。

驗證：

```bash
openclaw models status
```

### OAuth 權杖重新整理失敗（Anthropic Claude 訂閱）

這表示已儲存的 Anthropic OAuth 權杖已過期，且重新整理失敗。
如果你使用的是 Claude 訂閱（沒有 API 金鑰），最可靠的修復方式是
改用 **Claude Code setup-token**，並在 **Gateway 主機** 上貼上。

**建議作法（setup-token）：**

```bash
# Run on the gateway host (paste the setup-token)
openclaw models auth setup-token --provider anthropic
openclaw models status
```

如果你在其他地方產生了權杖：

```bash
openclaw models auth paste-token --provider anthropic
openclaw models status
```

更多細節：[Anthropic](/providers/anthropic) 與 [OAuth](/concepts/oauth)。

### 控制 UI 在 HTTP 下失敗（「需要裝置身分識別」/「連線失敗」）

如果你透過純 HTTP 開啟儀表板（例如 `http://<lan-ip>:18789/` 或
`http://<tailscale-ip>:18789/`），瀏覽器會在 **非安全內容** 下執行，
並封鎖 WebCrypto，因此無法產生裝置身分識別。

**修復方式：**

- 透過 [Tailscale Serve](/gateway/tailscale) 使用 HTTPS（建議）。
- 或在 Gateway 主機本機開啟：`http://127.0.0.1:18789/`。
- 如果必須使用 HTTP，請啟用 `gateway.controlUi.allowInsecureAuth: true`，並
  使用 Gateway 權杖（僅權杖；無裝置身分識別/配對）。請參閱
  [Control UI](/web/control-ui#insecure-http)。

### CI Secrets Scan 失敗

這表示 `detect-secrets` 找到了尚未納入基準的新候選項目。
請依照 [Secret scanning](/gateway/security#secret-scanning-detect-secrets) 操作。

### 服務已安裝但沒有任何東西在執行

如果 Gateway 服務已安裝，但程序立即結束，服務可能看起來「已載入」，但實際上沒有執行。

**檢查：**

```bash
openclaw gateway status
openclaw doctor
```

Doctor/服務會顯示執行階段狀態（PID/最後結束）與日誌提示。

**日誌：**

- 建議：`openclaw logs --follow`
- 檔案日誌（永遠可用）：`/tmp/openclaw/openclaw-YYYY-MM-DD.log`（或你設定的 `logging.file`）
- macOS LaunchAgent（若已安裝）：`$OPENCLAW_STATE_DIR/logs/gateway.log` 與 `gateway.err.log`
- Linux systemd（若已安裝）：`journalctl --user -u openclaw-gateway[-<profile>].service -n 200 --no-pager`
- Windows：`schtasks /Query /TN "OpenClaw Gateway (<profile>)" /V /FO LIST`

**啟用更多日誌：**

- 提高檔案日誌詳細度（持久化 JSONL）：
  ```json
  { "logging": { "level": "debug" } }
  ```
- 提高主控台詳細度（僅 TTY 輸出）：
  ```json
  { "logging": { "consoleLevel": "debug", "consoleStyle": "pretty" } }
  ```
- 快速提示：`--verbose` 只影響 **主控台** 輸出。檔案日誌仍由 `logging.level` 控制。

完整的格式、設定與存取方式請見 [/logging](/logging)。

### 「Gateway start blocked: set gateway.mode=local」

這表示設定檔存在，但 `gateway.mode` 未設定（或不是 `local`），
因此 Gateway 拒絕啟動。

**修復方式（建議）：**

- 執行精靈，將 Gateway 執行模式設為 **Local**：
  ```bash
  openclaw configure
  ```
- 或直接設定：
  ```bash
  openclaw config set gateway.mode local
  ```

**如果你其實是要執行遠端 Gateway：**

- 設定遠端 URL，並保留 `gateway.mode=remote`：
  ```bash
  openclaw config set gateway.mode remote
  openclaw config set gateway.remote.url "wss://gateway.example.com"
  ```

**僅限臨時/開發：** 傳入 `--allow-unconfigured`，在沒有
`gateway.mode=local` 的情況下啟動 Gateway。

**還沒有設定檔？** 執行 `openclaw setup` 建立初始設定，然後重新啟動
Gateway。

### 服務環境（PATH + runtime）

Gateway 服務以 **最小化 PATH** 執行，以避免 shell/管理器雜訊：

- macOS：`/opt/homebrew/bin`、`/usr/local/bin`、`/usr/bin`、`/bin`
- Linux：`/usr/local/bin`、`/usr/bin`、`/bin`

這刻意排除了版本管理器（nvm/fnm/volta/asdf）與套件管理器（pnpm/npm），
因為服務不會載入你的 shell 初始化。像 `DISPLAY` 這類的執行階段變數
應該放在 `~/.openclaw/.env`（由 Gateway 在早期載入）。
Exec 在 `host=gateway` 上會將你的登入 shell 的 `PATH` 合併到執行環境，
因此缺少工具通常表示你的 shell 初始化未匯出它們（或設定
`tools.exec.pathPrepend`）。請參閱 [/tools/exec](/tools/exec)。

WhatsApp + Telegram 頻道需要 **Node**；不支援 Bun。如果你的
服務是以 Bun 或版本管理的 Node 路徑安裝，請執行 `openclaw doctor`
以遷移到系統 Node 安裝。

### 沙箱中 Skill 缺少 API 金鑰

**症狀：** Skill 在主機上可用，但在沙箱中因缺少 API 金鑰而失敗。

**原因：** 沙箱隔離的 exec 在 Docker 中執行，且 **不會** 繼承主機的 `process.env`。

**修復方式：**

- 設定 `agents.defaults.sandbox.docker.env`（或每代理程式的 `agents.list[].sandbox.docker.env`）
- 或將金鑰烘焙進你的自訂沙箱映像
- 然後執行 `openclaw sandbox recreate --agent <id>`（或 `--all`）

### 服務在執行中，但連接埠沒有監聽

如果服務回報 **running**，但 Gateway 連接埠上沒有任何監聽，
很可能是 Gateway 拒絕繫結。

**此處「running」的意思**

- `Runtime: running` 表示你的監督程式（launchd/systemd/schtasks）認為程序仍存活。
- `RPC probe` 表示 CLI 實際能連線到 Gateway WebSocket 並呼叫 `status`。
- 請一律以 `Probe target:` + `Config (service):` 作為「我們實際嘗試了什麼」的依據。

**檢查：**

- 對於 `openclaw gateway` 與服務，`gateway.mode` 必須是 `local`。
- 如果你設定了 `gateway.mode=remote`，**CLI 預設** 會使用遠端 URL。服務仍可能在本機執行，但你的 CLI 可能在探測錯誤的位置。請使用 `openclaw gateway status` 查看服務解析後的連接埠 + 探測目標（或傳入 `--url`）。
- 當服務看似在執行但連接埠關閉時，`openclaw gateway status` 與 `openclaw doctor` 會顯示日誌中的 **最後一個 Gateway 錯誤**。
- 非 loopback 的繫結（`lan`/`tailnet`/`custom`，或在 loopback 不可用時的 `auto`）需要驗證：
  `gateway.auth.token`（或 `OPENCLAW_GATEWAY_TOKEN`）。
- `gateway.remote.token` 僅用於遠端 CLI 呼叫；它 **不會** 啟用本機驗證。
- `gateway.token` 會被忽略；請使用 `gateway.auth.token`。

**如果 `openclaw gateway status` 顯示設定不一致**

- `Config (cli): ...` 與 `Config (service): ...` 通常應該相同。
- 若不相同，幾乎可以確定你正在編輯一個設定，而服務卻在使用另一個。
- 修復方式：從你希望服務使用的同一個 `--profile` / `OPENCLAW_STATE_DIR`，重新執行 `openclaw gateway install --force`。

**如果 `openclaw gateway status` 回報服務設定問題**

- 監督程式設定（launchd/systemd/schtasks）缺少目前的預設值。
- 修復方式：執行 `openclaw doctor` 以更新（或使用 `openclaw gateway install --force` 進行完整重寫）。

**如果 `Last gateway error:` 提到「沒有驗證而拒絕繫結 …」**

- 你將 `gateway.bind` 設為非 loopback 模式（`lan`/`tailnet`/`custom`，或在 loopback 不可用時的 `auto`），但未設定驗證。
- 修復方式：設定 `gateway.auth.mode` + `gateway.auth.token`（或匯出 `OPENCLAW_GATEWAY_TOKEN`），然後重新啟動服務。

**如果 `openclaw gateway status` 顯示 `bind=tailnet`，但找不到 tailnet 介面**

- Gateway 嘗試繫結到 Tailscale IP（100.64.0.0/10），但在主機上未偵測到。
- 修復方式：在該機器上啟動 Tailscale（或將 `gateway.bind` 改為 `loopback`/`lan`）。

**如果 `Probe note:` 表示探測使用 loopback**

- 這對於 `bind=lan` 是預期行為：Gateway 監聽在 `0.0.0.0`（所有介面），而 loopback 仍應能在本機連線。
- 對於遠端用戶端，請使用實際的 LAN IP（而非 `0.0.0.0`）加上連接埠，並確保已設定驗證。

### 位址已被使用（連接埠 18789）

這表示已經有其他程式在監聽 Gateway 連接埠。

**檢查：**

```bash
openclaw gateway status
```

它會顯示監聽者與可能原因（Gateway 已在執行、SSH 通道）。
如有需要，停止該服務或選擇不同的連接埠。

### 偵測到額外的工作區資料夾

如果你從較舊的安裝升級，磁碟上可能仍有 `~/openclaw`。
多個工作區目錄可能造成驗證或狀態漂移的混淆，因為一次只會有一個工作區是啟用的。

**修復方式：** 保留單一啟用的工作區，其餘封存或移除。請參閱
[Agent workspace](/concepts/agent-workspace#extra-workspace-folders)。

### 主聊天在沙箱工作區中執行

症狀：即使你預期使用主機工作區，`pwd` 或檔案工具卻顯示 `~/.openclaw/sandboxes/...`。

**原因：** `agents.defaults.sandbox.mode: "non-main"` 依據 `session.mainKey`（預設 `"main"`）。
群組/頻道工作階段使用自己的金鑰，因此被視為非主要，並使用沙箱工作區。

**修復選項：**

- 如果你希望代理程式使用主機工作區：設定 `agents.list[].sandbox.mode: "off"`。
- 如果你希望在沙箱中存取主機工作區：為該代理程式設定 `workspaceAccess: "rw"`。

### 「Agent was aborted」

代理程式在回覆途中被中斷。

**原因：**

- 使用者送出了 `stop`、`abort`、`esc`、`wait` 或 `exit`
- 逾時
- 程序當機

**修復方式：** 只要再送一則訊息即可，工作階段會繼續。

### 「Agent failed before reply: Unknown model: anthropic/claude-haiku-3-5」

OpenClaw 會刻意拒絕 **較舊/不安全的模型**（尤其是更容易受到提示注入影響的模型）。
如果你看到此錯誤，表示該模型名稱已不再支援。

**修復方式：**

- 為該提供者選擇 **最新** 的模型，並更新你的設定或模型別名。
- 若不確定有哪些可用模型，請執行 `openclaw models list` 或
  `openclaw models scan`，並選擇受支援的模型。
- 檢查 Gateway 日誌以取得詳細失敗原因。

另請參閱：[Models CLI](/cli/models) 與 [Model providers](/concepts/model-providers)。

### 訊息未被觸發

**檢查 1：** 發送者是否在允許清單中？

```bash
openclaw status
```

在輸出中尋找 `AllowFrom: ...`。

**檢查 2：** 對於群組聊天，是否需要提及？

```bash
# The message must match mentionPatterns or explicit mentions; defaults live in channel groups/guilds.
# Multi-agent: `agents.list[].groupChat.mentionPatterns` overrides global patterns.
grep -n "agents\\|groupChat\\|mentionPatterns\\|channels\\.whatsapp\\.groups\\|channels\\.telegram\\.groups\\|channels\\.imessage\\.groups\\|channels\\.discord\\.guilds" \
  "${OPENCLAW_CONFIG_PATH:-$HOME/.openclaw/openclaw.json}"
```

**檢查 3：** 檢查日誌

```bash
openclaw logs --follow
# or if you want quick filters:
tail -f "$(ls -t /tmp/openclaw/openclaw-*.log | head -1)" | grep "blocked\\|skip\\|unauthorized"
```

### 配對碼未送達

如果 `dmPolicy` 為 `pairing`，未知的發送者應該會收到配對碼，且在獲得核准前其訊息會被忽略。

**檢查 1：** 是否已經有待處理的請求？

```bash
openclaw pairing list <channel>
```

待處理的私訊配對請求預設 **每個頻道最多 3 個**。如果清單已滿，在有請求被核准或過期之前，新請求不會產生配對碼。

**檢查 2：** 請求是否已建立但未送出回覆？

```bash
openclaw logs --follow | grep "pairing request"
```

**檢查 3：** 確認該頻道的 `dmPolicy` 不是 `open`/`allowlist`。

### 圖片 + 提及無法運作

已知問題：當你只傳送「提及 + 圖片」（沒有其他文字）時，WhatsApp 有時不會包含提及的中繼資料。

**因應方式：** 在提及時加入一些文字：

- ❌ `@openclaw` + 圖片
- ✅ `@openclaw check this` + 圖片

### 工作階段未恢復

**檢查 1：** 工作階段檔案是否存在？

```bash
ls -la ~/.openclaw/agents/<agentId>/sessions/
```

**檢查 2：** 重設視窗是否太短？

```json
{
  "session": {
    "reset": {
      "mode": "daily",
      "atHour": 4,
      "idleMinutes": 10080 // 7 days
    }
  }
}
```

**檢查 3：** 是否有人送出了 `/new`、`/reset`，或重設觸發詞？

### Agent 逾時

預設逾時為 30 分鐘。對於長時間任務：

```json
{
  "reply": {
    "timeoutSeconds": 3600 // 1 hour
  }
}
```

或使用 `process` 工具將長指令放到背景執行。

### WhatsApp 已中斷連線

```bash
# Check local status (creds, sessions, queued events)
openclaw status
# Probe the running gateway + channels (WA connect + Telegram + Discord APIs)
openclaw status --deep

# View recent connection events
openclaw logs --limit 200 | grep "connection\\|disconnect\\|logout"
```

**修復方式：** Gateway 執行後通常會自動重新連線。若仍卡住，請重新啟動 Gateway 程序（依你的監督方式），或以詳細輸出手動執行：

```bash
openclaw gateway --verbose
```

如果你已登出／解除連結：

```bash
openclaw channels logout
trash "${OPENCLAW_STATE_DIR:-$HOME/.openclaw}/credentials" # if logout can't cleanly remove everything
openclaw channels login --verbose       # re-scan QR
```

### 媒體傳送失敗

**檢查 1：** 檔案路徑是否有效？

```bash
ls -la /path/to/your/image.jpg
```

**檢查 2：** 是否太大？

- 圖片：最大 6MB
- 音訊/影片：最大 16MB
- 文件：最大 100MB

**檢查 3：** 檢查媒體日誌

```bash
grep "media\\|fetch\\|download" "$(ls -t /tmp/openclaw/openclaw-*.log | head -1)" | tail -20
```

### 記憶體使用量過高

OpenClaw 會將對話歷史保留在記憶體中。

**修復方式：** 定期重新啟動，或設定工作階段限制：

```json
{
  "session": {
    "historyLimit": 100 // Max messages to keep
  }
}
```

## 常見疑難排解

### 「Gateway 無法啟動 — 設定無效」

當設定包含未知鍵、格式錯誤的值或無效型別時，OpenClaw 現在會拒絕啟動。
這是出於安全考量的刻意設計。

使用 Doctor 修復：

```bash
openclaw doctor
openclaw doctor --fix
```

注意事項：

- `openclaw doctor` 會回報每一個無效項目。
- `openclaw doctor --fix` 會套用遷移/修復並重寫設定。
- 即使設定無效，像 `openclaw logs`、`openclaw health`、`openclaw status`、`openclaw gateway status` 與 `openclaw gateway probe` 等診斷指令仍可執行。

### 「All models failed」— 我該先檢查什麼？

- **憑證**：確認正在嘗試的提供者已有憑證（驗證設定檔 + 環境變數）。
- **模型路由**：確認 `agents.defaults.model.primary` 與後備模型是你可存取的模型。
- **Gateway 日誌**：查看 `/tmp/openclaw/…` 以取得確切的提供者錯誤。
- **模型狀態**：使用 `/model status`（聊天）或 `openclaw models status`（CLI）。

### 我使用個人的 WhatsApp 號碼 — 為什麼自我聊天怪怪的？

啟用自我聊天模式，並將你自己的號碼加入允許清單：

```json5
{
  channels: {
    whatsapp: {
      selfChatMode: true,
      dmPolicy: "allowlist",
      allowFrom: ["+15555550123"],
    },
  },
}
```

請參閱 [WhatsApp setup](/channels/whatsapp)。

### WhatsApp 把我登出了。我該如何重新驗證？

再次執行登入指令並掃描 QR code：

```bash
openclaw channels login
```

### 在 `main` 上發生建置錯誤 — 標準的修復流程是什麼？

1. `git pull origin main && pnpm install`
2. `openclaw doctor`
3. 檢查 GitHub issues 或 Discord
4. 臨時因應：切換到較舊的 commit

### npm install 失敗（allow-build-scripts / 缺少 tar 或 yargs）。現在怎麼辦？

如果你是從原始碼執行，請使用儲存庫的套件管理器：**pnpm**（建議）。
此儲存庫宣告了 `packageManager: "pnpm@…"`。

典型的復原方式：

```bash
git status   # ensure you’re in the repo root
pnpm install
pnpm build
openclaw doctor
openclaw gateway restart
```

原因：pnpm 是此儲存庫所設定的套件管理器。

### 如何在 git 安裝與 npm 安裝之間切換？

使用 **網站安裝器**，並以旗標選擇安裝方式。它會就地升級，並重寫 Gateway 服務以指向新的安裝。

切換 **到 git 安裝**：

```bash
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --install-method git --no-onboard
```

切換 **到 npm 全域**：

```bash
curl -fsSL https://openclaw.ai/install.sh | bash
```

注意事項：

- git 流程只會在儲存庫乾淨時 rebase。請先提交或 stash 變更。
- 切換後，請執行：
  ```bash
  openclaw doctor
  openclaw gateway restart
  ```

### Telegram 區塊串流沒有在工具呼叫之間分割文字。為什麼？

區塊串流只會傳送 **已完成的文字區塊**。你只看到單一訊息的常見原因：

- `agents.defaults.blockStreamingDefault` 仍為 `"off"`。
- `channels.telegram.blockStreaming` 設為 `false`。
- `channels.telegram.streamMode` 為 `partial` 或 `block`，且 **草稿串流已啟用**
  （私聊 + 主題）。在此情況下，草稿串流會停用區塊串流。
- 你的 `minChars` / 合併設定過高，導致區塊被合併。
- 模型只輸出一個大型文字區塊（回覆途中沒有 flush 點）。

修復檢查清單：

1. 將區塊串流設定放在 `agents.defaults` 之下，而不是根層。
2. 若要真正的多訊息區塊回覆，請設定 `channels.telegram.streamMode: "off"`。
3. 除錯時使用較小的 chunk/合併門檻。

請參閱 [Streaming](/concepts/streaming)。

### 即使設定了 `requireMention: false`，Discord 在我的伺服器中仍未回覆。為什麼？

`requireMention` 只控制在頻道通過允許清單 **之後** 的提及閘控。
預設 `channels.discord.groupPolicy` 為 **allowlist**，因此必須明確啟用 guild。
如果你設定了 `channels.discord.guilds.<guildId>.channels`，則只允許列出的頻道；省略它則允許該 guild 中的所有頻道。

修復檢查清單：

1. 設定 `channels.discord.groupPolicy: "open"` **或** 新增一個 guild 允許清單項目（並可選擇加入頻道允許清單）。
2. 在 `channels.discord.guilds.<guildId>.channels` 中使用 **數字頻道 ID**。
3. 將 `requireMention: false` 放在 `channels.discord.guilds` **之下**（全域或每頻道）。
   最上層的 `channels.discord.requireMention` 不是受支援的鍵。
4. 確保機器人具備 **Message Content Intent** 與頻道權限。
5. 執行 `openclaw channels status --probe` 以取得稽核提示。

文件：[Discord](/channels/discord)、[Channels troubleshooting](/channels/troubleshooting)。

### Cloud Code Assist API 錯誤：invalid tool schema（400）。接下來怎麼辦？

這幾乎總是 **工具結構相容性** 問題。Cloud Code Assist
端點只接受 JSON Schema 的嚴格子集合。OpenClaw 會在目前的 `main` 中清理/正規化工具結構，
但此修復尚未包含在上一個正式版本（截至 2026 年 1 月 13 日）。

修復檢查清單：

1. **更新 OpenClaw**：
   - 若可從原始碼執行，請拉取 `main` 並重新啟動 Gateway。
   - 否則，等待包含結構清理器的下一個版本。
2. 避免使用不支援的關鍵字，如 `anyOf/oneOf/allOf`、`patternProperties`、
   `additionalProperties`、`minLength`、`maxLength`、`format` 等。
3. 若你定義自訂工具，請保持頂層結構為 `type: "object"`，並使用
   `properties` 與簡單的列舉。

請參閱 [Tools](/tools) 與 [TypeBox schemas](/concepts/typebox)。

## macOS 專屬問題

### 授予權限時 App 當機（語音/麥克風）

如果你在隱私提示中點擊「Allow」時，App 消失或顯示「Abort trap 6」：

**修復 1：重設 TCC 快取**

```bash
tccutil reset All bot.molt.mac.debug
```

**修復 2：強制新的 Bundle ID**
如果重設無效，請在 [`scripts/package-mac-app.sh`](https://github.com/openclaw/openclaw/blob/main/scripts/package-mac-app.sh) 中變更 `BUNDLE_ID`（例如加入 `.test` 後綴）並重新建置。這會迫使 macOS 將其視為新 App。

### Gateway 卡在「Starting...」

App 會連線到本機連接埠 `18789` 上的 Gateway。如果一直卡住：

**修復 1：停止監督程式（建議）**
如果 Gateway 由 launchd 監督，直接殺掉 PID 只會讓它重生。請先停止監督程式：

```bash
openclaw gateway status
openclaw gateway stop
# Or: launchctl bootout gui/$UID/bot.molt.gateway (replace with bot.molt.<profile>; legacy com.openclaw.* still works)
```

**修復 2：連接埠被佔用（找出監聽者）**

```bash
lsof -nP -iTCP:18789 -sTCP:LISTEN
```

如果是未受監督的程序，請先嘗試優雅停止，再升級處理：

```bash
kill -TERM <PID>
sleep 1
kill -9 <PID> # last resort
```

**修復 3：檢查 CLI 安裝**
確認全域 `openclaw` CLI 已安裝，且版本與 App 相符：

```bash
openclaw --version
npm install -g openclaw@<version>
```

## 除錯模式

取得詳細日誌：

```bash
# Turn on trace logging in config:
#   ${OPENCLAW_CONFIG_PATH:-$HOME/.openclaw/openclaw.json} -> { logging: { level: "trace" } }
#
# Then run verbose commands to mirror debug output to stdout:
openclaw gateway --verbose
openclaw channels login --verbose
```

## 日誌位置

| 日誌                         | 位置                                                                                                                                                                                                                                                                                                                        |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gateway 檔案日誌（結構化）   | `/tmp/openclaw/openclaw-YYYY-MM-DD.log`（或 `logging.file`）                                                                                                                                                                                                                                                                |
| Gateway 服務日誌（監督程式） | macOS：`$OPENCLAW_STATE_DIR/logs/gateway.log` + `gateway.err.log`（預設：`~/.openclaw/logs/...`；使用設定檔時為 `~/.openclaw-<profile>/logs/...`）<br />Linux：`journalctl --user -u openclaw-gateway[-<profile>].service -n 200 --no-pager`<br />Windows：`schtasks /Query /TN "OpenClaw Gateway (<profile>)" /V /FO LIST` |
| 工作階段檔案                 | `$OPENCLAW_STATE_DIR/agents/<agentId>/sessions/`                                                                                                                                                                                                                                                                            |
| 媒體快取                     | `$OPENCLAW_STATE_DIR/media/`                                                                                                                                                                                                                                                                                                |
| 憑證                         | `$OPENCLAW_STATE_DIR/credentials/`                                                                                                                                                                                                                                                                                          |

## 健康檢查

```bash
# Supervisor + probe target + config paths
openclaw gateway status
# Include system-level scans (legacy/extra services, port listeners)
openclaw gateway status --deep

# Is the gateway reachable?
openclaw health --json
# If it fails, rerun with connection details:
openclaw health --verbose

# Is something listening on the default port?
lsof -nP -iTCP:18789 -sTCP:LISTEN

# Recent activity (RPC log tail)
openclaw logs --follow
# Fallback if RPC is down
tail -20 /tmp/openclaw/openclaw-*.log
```

## 全部重設

核彈選項：

```bash
openclaw gateway stop
# If you installed a service and want a clean install:
# openclaw gateway uninstall

trash "${OPENCLAW_STATE_DIR:-$HOME/.openclaw}"
openclaw channels login         # re-pair WhatsApp
openclaw gateway restart           # or: openclaw gateway
```

⚠️ 這會遺失所有工作階段，並需要重新配對 WhatsApp。

## 取得協助

1. 先檢查日誌：`/tmp/openclaw/`（預設：`openclaw-YYYY-MM-DD.log`，或你設定的 `logging.file`）
2. 搜尋 GitHub 上的既有 issues
3. 開立新 issue，並附上：
   - OpenClaw 版本
   - 相關日誌片段
   - 重現步驟
   - 你的設定（請遮蔽機密！）

---

_「你有試過把它關掉再打開嗎？」_ — 每一位 IT 人員

🦞🔧

### 瀏覽器無法啟動（Linux）

如果你看到 `"Failed to start Chrome CDP on port 18800"`：

**最可能原因：** Ubuntu 上以 Snap 封裝的 Chromium。

**快速修復：** 改安裝 Google Chrome：

```bash
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo dpkg -i google-chrome-stable_current_amd64.deb
```

然後在設定中指定：

```json
{
  "browser": {
    "executablePath": "/usr/bin/google-chrome-stable"
  }
}
```

**完整指南：** 請參閱 [browser-linux-troubleshooting](/tools/browser-linux-troubleshooting)
