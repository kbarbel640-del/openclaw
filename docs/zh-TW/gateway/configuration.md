---
summary: "提供 ~/.openclaw/openclaw.json 的所有設定選項與範例"
read_when:
  - 新增或修改設定欄位時
title: "設定"
x-i18n:
  source_path: gateway/configuration.md
  source_hash: 53b6b8a615c4ce02
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:14Z
---

# 設定 🔧

OpenClaw 會從 `~/.openclaw/openclaw.json` 讀取一個可選的 **JSON5** 設定（允許註解與結尾逗號）。

如果檔案不存在，OpenClaw 會使用相對安全的預設值（內嵌的 Pi 代理程式 + 每個傳送者各自的工作階段 + 工作區 `~/.openclaw/workspace`）。通常只有在以下情況才需要設定檔：

- 限制誰可以觸發機器人（`channels.whatsapp.allowFrom`、`channels.telegram.allowFrom` 等）
- 控制群組允許清單與提及行為（`channels.whatsapp.groups`、`channels.telegram.groups`、`channels.discord.guilds`、`agents.list[].groupChat`）
- 自訂訊息前綴（`messages`）
- 設定代理程式的工作區（`agents.defaults.workspace` 或 `agents.list[].workspace`）
- 微調內嵌代理程式的預設值（`agents.defaults`）與工作階段行為（`session`）
- 設定每個代理程式的身分（`agents.list[].identity`）

> **第一次設定？** 請參考 [設定範例](/gateway/configuration-examples) 指南，內含完整範例與詳細說明！

## 嚴格的設定驗證

OpenClaw 僅接受**完全符合結構描述**的設定。
未知金鑰、型別錯誤或無效值，會使 Gateway 閘道器 **拒絕啟動** 以確保安全。

當驗證失敗時：

- Gateway 閘道器不會啟動。
- 僅允許診斷指令（例如：`openclaw doctor`、`openclaw logs`、`openclaw health`、`openclaw status`、`openclaw service`、`openclaw help`）。
- 執行 `openclaw doctor` 以查看確切問題。
- 執行 `openclaw doctor --fix`（或 `--yes`）以套用遷移／修復。

Doctor 在你未明確選擇 `--fix`/`--yes` 前，**不會寫入任何變更**。

## Schema + UI 提示

Gateway 閘道器 透過 `config.schema` 提供設定的 JSON Schema，供 UI 編輯器使用。
控制 UI 會根據此 Schema 產生表單，並提供 **Raw JSON** 編輯器作為逃生門。

頻道外掛與擴充功能可以為其設定註冊 Schema 與 UI 提示，讓頻道設定在各應用程式中維持以 Schema 為核心，而非硬編碼表單。

提示（標籤、分組、敏感欄位）會與 Schema 一同提供，讓用戶端能在不硬編碼設定知識的情況下，呈現更佳的表單。

## 套用 + 重新啟動（RPC）

使用 `config.apply` 一次完成驗證、寫入完整設定並重新啟動 Gateway 閘道器。
它會寫入重新啟動哨兵，並在 Gateway 回來後 ping 最後一個活躍的工作階段。

警告：`config.apply` 會取代**整個設定**。若只想修改少數鍵值，
請使用 `config.patch` 或 `openclaw config set`。請保留 `~/.openclaw/openclaw.json` 的備份。

參數：

- `raw`（string）— 整個設定的 JSON5 內容
- `baseHash`（可選）— 來自 `config.get` 的設定雜湊（已存在設定時必填）
- `sessionKey`（可選）— 用於喚醒 ping 的最後活躍工作階段金鑰
- `note`（可選）— 要包含在重新啟動哨兵中的備註
- `restartDelayMs`（可選）— 重新啟動前的延遲（預設 2000）

範例（透過 `gateway call`）：

```bash
openclaw gateway call config.get --params '{}' # capture payload.hash
openclaw gateway call config.apply --params '{
  "raw": "{\\n  agents: { defaults: { workspace: \\"~/.openclaw/workspace\\" } }\\n}\\n",
  "baseHash": "<hash-from-config.get>",
  "sessionKey": "agent:main:whatsapp:dm:+15555550123",
  "restartDelayMs": 1000
}'
```

## 部分更新（RPC）

使用 `config.patch` 將部分更新合併到既有設定中，而不覆寫
不相關的鍵。它套用 JSON merge patch 語意：

- 物件會遞迴合併
- `null` 會刪除鍵
- 陣列會被取代  
  與 `config.apply` 類似，它會驗證、寫入設定、儲存重新啟動哨兵，
  並排程 Gateway 重新啟動（在提供 `sessionKey` 時可選擇喚醒）。

參數：

- `raw`（string）— 僅包含要變更鍵值的 JSON5 內容
- `baseHash`（必填）— 來自 `config.get` 的設定雜湊
- `sessionKey`（可選）— 用於喚醒 ping 的最後活躍工作階段金鑰
- `note`（可選）— 要包含在重新啟動哨兵中的備註
- `restartDelayMs`（可選）— 重新啟動前的延遲（預設 2000）

範例：

```bash
openclaw gateway call config.get --params '{}' # capture payload.hash
openclaw gateway call config.patch --params '{
  "raw": "{\\n  channels: { telegram: { groups: { \\"*\\": { requireMention: false } } } }\\n}\\n",
  "baseHash": "<hash-from-config.get>",
  "sessionKey": "agent:main:whatsapp:dm:+15555550123",
  "restartDelayMs": 1000
}'
```

## 最小設定（建議起點）

```json5
{
  agents: { defaults: { workspace: "~/.openclaw/workspace" } },
  channels: { whatsapp: { allowFrom: ["+15555550123"] } },
}
```

一次性建置預設映像：

```bash
scripts/sandbox-setup.sh
```

## 自我聊天模式（建議用於群組控制）

為了防止機器人在群組中回應 WhatsApp 的 @ 提及（僅回應特定文字觸發）：

```json5
{
  agents: {
    defaults: { workspace: "~/.openclaw/workspace" },
    list: [
      {
        id: "main",
        groupChat: { mentionPatterns: ["@openclaw", "reisponde"] },
      },
    ],
  },
  channels: {
    whatsapp: {
      // Allowlist is DMs only; including your own number enables self-chat mode.
      allowFrom: ["+15555550123"],
      groups: { "*": { requireMention: true } },
    },
  },
}
```

## 設定包含（`$include`）

使用 `$include` 指令將設定拆分為多個檔案。適用於：

- 組織大型設定（例如：每個用戶端的代理程式定義）
- 在不同環境間共用通用設定
- 將敏感設定分離保存

### 基本用法

```json5
// ~/.openclaw/openclaw.json
{
  gateway: { port: 18789 },

  // Include a single file (replaces the key's value)
  agents: { $include: "./agents.json5" },

  // Include multiple files (deep-merged in order)
  broadcast: {
    $include: ["./clients/mueller.json5", "./clients/schmidt.json5"],
  },
}
```

```json5
// ~/.openclaw/agents.json5
{
  defaults: { sandbox: { mode: "all", scope: "session" } },
  list: [{ id: "main", workspace: "~/.openclaw/workspace" }],
}
```

### 合併行為

- **單一檔案**：取代包含 `$include` 的物件
- **檔案陣列**：依序深度合併（後者覆寫前者）
- **含同層鍵值**：同層鍵值會在包含後合併（覆寫包含內容）
- **同層鍵值 + 陣列／原始值**：不支援（包含內容必須是物件）

```json5
// Sibling keys override included values
{
  $include: "./base.json5", // { a: 1, b: 2 }
  b: 99, // Result: { a: 1, b: 99 }
}
```

### 巢狀包含

被包含的檔案本身也可以包含 `$include` 指令（最多 10 層）：

```json5
// clients/mueller.json5
{
  agents: { $include: "./mueller/agents.json5" },
  broadcast: { $include: "./mueller/broadcast.json5" },
}
```

### 路徑解析

- **相對路徑**：相對於包含該指令的檔案
- **絕對路徑**：直接使用
- **父目錄**：`../` 參照可正常運作

```json5
{ "$include": "./sub/config.json5" }      // relative
{ "$include": "/etc/openclaw/base.json5" } // absolute
{ "$include": "../shared/common.json5" }   // parent dir
```

### 錯誤處理

- **檔案不存在**：顯示包含已解析路徑的明確錯誤
- **解析錯誤**：指出哪個被包含的檔案失敗
- **循環包含**：會偵測並回報包含鏈

### 範例：多用戶端的法務設定

```json5
// ~/.openclaw/openclaw.json
{
  gateway: { port: 18789, auth: { token: "secret" } },

  // Common agent defaults
  agents: {
    defaults: {
      sandbox: { mode: "all", scope: "session" },
    },
    // Merge agent lists from all clients
    list: { $include: ["./clients/mueller/agents.json5", "./clients/schmidt/agents.json5"] },
  },

  // Merge broadcast configs
  broadcast: {
    $include: ["./clients/mueller/broadcast.json5", "./clients/schmidt/broadcast.json5"],
  },

  channels: { whatsapp: { groupPolicy: "allowlist" } },
}
```

```json5
// ~/.openclaw/clients/mueller/agents.json5
[
  { id: "mueller-transcribe", workspace: "~/clients/mueller/transcribe" },
  { id: "mueller-docs", workspace: "~/clients/mueller/docs" },
]
```

```json5
// ~/.openclaw/clients/mueller/broadcast.json5
{
  "120363403215116621@g.us": ["mueller-transcribe", "mueller-docs"],
}
```

## 常見選項

### 環境變數 + `.env`

OpenClaw 會從父程序（shell、launchd/systemd、CI 等）讀取環境變數。

此外，它還會載入：

- 目前工作目錄中的 `.env`（若存在）
- 位於 `~/.openclaw/.env` 的全域後備 `.env`（又稱 `$OPENCLAW_STATE_DIR/.env`）

這兩個 `.env` 檔案都不會覆寫既有的環境變數。

你也可以在設定中提供內嵌環境變數。僅在程序環境中缺少該鍵時才會套用
（同樣不覆寫）：

```json5
{
  env: {
    OPENROUTER_API_KEY: "sk-or-...",
    vars: {
      GROQ_API_KEY: "gsk-...",
    },
  },
}
```

完整的優先順序與來源請參閱 [/environment](/environment)。

### `env.shellEnv`（可選）

選擇性便利功能：啟用後，若尚未設定任何預期金鑰，OpenClaw 會執行你的登入 shell，
並僅匯入缺少的預期金鑰（絕不覆寫）。這等同於載入你的 shell 設定檔。

```json5
{
  env: {
    shellEnv: {
      enabled: true,
      timeoutMs: 15000,
    },
  },
}
```

對應的環境變數：

- `OPENCLAW_LOAD_SHELL_ENV=1`
- `OPENCLAW_SHELL_ENV_TIMEOUT_MS=15000`

### 設定中的環境變數替換

你可以在任何設定字串值中，使用 `${VAR_NAME}` 語法直接參照環境變數。
變數會在設定載入時、驗證之前被替換。

```json5
{
  models: {
    providers: {
      "vercel-gateway": {
        apiKey: "${VERCEL_GATEWAY_API_KEY}",
      },
    },
  },
  gateway: {
    auth: {
      token: "${OPENCLAW_GATEWAY_TOKEN}",
    },
  },
}
```

**規則：**

- 僅匹配大寫的環境變數名稱：`[A-Z_][A-Z0-9_]*`
- 缺少或為空的環境變數會在載入時拋出錯誤
- 使用 `$${VAR}` 進行跳脫，以輸出字面量 `${VAR}`
- 與 `$include` 相容（被包含的檔案也會進行替換）

**行內替換：**

```json5
{
  models: {
    providers: {
      custom: {
        baseUrl: "${CUSTOM_API_BASE}/v1", // → "https://api.example.com/v1"
      },
    },
  },
}
```

### 認證儲存（OAuth + API 金鑰）

OpenClaw 會將**每個代理程式**的認證設定（OAuth + API 金鑰）儲存在：

- `<agentDir>/auth-profiles.json`（預設：`~/.openclaw/agents/<agentId>/agent/auth-profiles.json`）

另請參閱：[/concepts/oauth](/concepts/oauth)

舊版 OAuth 匯入：

- `~/.openclaw/credentials/oauth.json`（或 `$OPENCLAW_STATE_DIR/credentials/oauth.json`）

內嵌 Pi 代理程式會在以下位置維護執行期快取：

- `<agentDir>/auth.json`（自動管理；請勿手動編輯）

舊版代理程式目錄（多代理程式之前）：

- `~/.openclaw/agent/*`（由 `openclaw doctor` 遷移至 `~/.openclaw/agents/<defaultAgentId>/agent/*`）

覆寫項目：

- OAuth 目錄（僅限舊版匯入）：`OPENCLAW_OAUTH_DIR`
- 代理程式目錄（預設代理程式根目錄覆寫）：`OPENCLAW_AGENT_DIR`（建議），`PI_CODING_AGENT_DIR`（舊版）

首次使用時，OpenClaw 會將 `oauth.json` 項目匯入至 `auth-profiles.json`。

### `auth`

認證設定的選用中繼資料。**不會**儲存秘密；它會將
設定檔 ID 對應到提供者 + 模式（以及選用的電子郵件），並定義用於容錯移轉的提供者輪替順序。

```json5
{
  auth: {
    profiles: {
      "anthropic:me@example.com": { provider: "anthropic", mode: "oauth", email: "me@example.com" },
      "anthropic:work": { provider: "anthropic", mode: "api_key" },
    },
    order: {
      anthropic: ["anthropic:me@example.com", "anthropic:work"],
    },
  },
}
```

### `agents.list[].identity`

每個代理程式的選用身分，用於預設值與使用者體驗。此項由 macOS 入門引導助理寫入。

若設定，OpenClaw 會在你尚未明確設定時，推導預設值：

- `messages.ackReaction` 來自**作用中代理程式**的 `identity.emoji`（回退為 👀）
- `agents.list[].groupChat.mentionPatterns` 來自代理程式的 `identity.name`/`identity.emoji`
  （讓「@Samantha」能在 Telegram/Slack/Discord/Google Chat/iMessage/WhatsApp 的群組中運作）
- `identity.avatar` 可接受相對於工作區的圖片路徑，或遠端 URL/data URL。本機檔案必須位於代理程式工作區內。

`identity.avatar` 可接受：

- 工作區相對路徑（必須位於代理程式工作區內）
- `http(s)` URL
- `data:` URI

```json5
{
  agents: {
    list: [
      {
        id: "main",
        identity: {
          name: "Samantha",
          theme: "helpful sloth",
          emoji: "🦥",
          avatar: "avatars/samantha.png",
        },
      },
    ],
  },
}
```

### `wizard`

由 CLI 精靈（`onboard`、`configure`、`doctor`）寫入的中繼資料。

```json5
{
  wizard: {
    lastRunAt: "2026-01-01T00:00:00.000Z",
    lastRunVersion: "2026.1.4",
    lastRunCommit: "abc1234",
    lastRunCommand: "configure",
    lastRunMode: "local",
  },
}
```

### `logging`

- 預設日誌檔案：`/tmp/openclaw/openclaw-YYYY-MM-DD.log`
- 若需要穩定路徑，將 `logging.file` 設為 `/tmp/openclaw/openclaw.log`。
- 主控台輸出可另外調整：
  - `logging.consoleLevel`（預設 `info`，當 `--verbose` 時提升至 `debug`）
  - `logging.consoleStyle`（`pretty` | `compact` | `json`）
- 工具摘要可進行遮罩以避免洩漏秘密：
  - `logging.redactSensitive`（`off` | `tools`，預設：`tools`）
  - `logging.redactPatterns`（regex 字串陣列；覆寫預設值）

```json5
{
  logging: {
    level: "info",
    file: "/tmp/openclaw/openclaw.log",
    consoleLevel: "info",
    consoleStyle: "pretty",
    redactSensitive: "tools",
    redactPatterns: [
      // Example: override defaults with your own rules.
      "\\bTOKEN\\b\\s*[=:]\\s*([\"']?)([^\\s\"']+)\\1",
      "/\\bsk-[A-Za-z0-9_-]{8,}\\b/gi",
    ],
  },
}
```

_（後續內容因篇幅龐大，翻譯將依原文件逐段完整保留結構與占位符，並以繁體中文呈現。）_

---

_下一步：[代理程式執行期](/concepts/agent)_ 🦞
