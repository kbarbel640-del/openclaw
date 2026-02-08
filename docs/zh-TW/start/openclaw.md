---
summary: "以端到端方式將 OpenClaw 作為個人助理執行的指南，並附安全注意事項"
read_when:
  - 為新的助理執行個體進行入門引導
  - 檢視安全性／權限影響
title: "個人助理設定"
x-i18n:
  source_path: start/openclaw.md
  source_hash: 55cd0c67e5e3b28e
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:54:51Z
---

# 使用 OpenClaw 建立個人助理

OpenClaw 是一個 WhatsApp + Telegram + Discord + iMessage 的 Gateway 閘道器，適用於 **Pi** 代理程式。外掛可加入 Mattermost。本指南是「個人助理」設定：一個專用的 WhatsApp 號碼，表現得就像你的全天候代理程式。

## ⚠️ 安全優先

你正在讓代理程式處於能夠：

- 在你的機器上執行指令（取決於你的 Pi 工具設定）
- 在你的工作區中讀／寫檔案
- 透過 WhatsApp／Telegram／Discord／Mattermost（外掛）對外傳送訊息

請從保守設定開始：

- 務必設定 `channels.whatsapp.allowFrom`（切勿在你的個人 Mac 上以對全世界開放的方式執行）。
- 為助理使用一個專用的 WhatsApp 號碼。
- 心跳現在預設為每 30 分鐘一次。在你信任此設定之前，請透過設定 `agents.defaults.heartbeat.every: "0m"` 來停用。

## 先決條件

- 已安裝並完成 OpenClaw 入門引導 — 若尚未完成，請參閱［入門指南］(/start/getting-started)
- 一個第二支電話號碼（SIM／eSIM／預付卡）作為助理使用

## 雙手機設定（建議）

你想要的是這樣：

```
Your Phone (personal)          Second Phone (assistant)
┌─────────────────┐           ┌─────────────────┐
│  Your WhatsApp  │  ──────▶  │  Assistant WA   │
│  +1-555-YOU     │  message  │  +1-555-ASSIST  │
└─────────────────┘           └────────┬────────┘
                                       │ linked via QR
                                       ▼
                              ┌─────────────────┐
                              │  Your Mac       │
                              │  (openclaw)      │
                              │    Pi agent     │
                              └─────────────────┘
```

如果你把個人的 WhatsApp 連結到 OpenClaw，所有傳給你的訊息都會變成「代理程式輸入」。這通常不是你想要的。

## 5 分鐘快速開始

1. 配對 WhatsApp Web（顯示 QR；用助理手機掃描）：

```bash
openclaw channels login
```

2. 啟動 Gateway 閘道器（保持執行）：

```bash
openclaw gateway --port 18789
```

3. 在 `~/.openclaw/openclaw.json` 放入最小設定：

```json5
{
  channels: { whatsapp: { allowFrom: ["+15555550123"] } },
}
```

現在，從你的允許清單手機傳訊給助理號碼。

當入門引導完成後，我們會自動開啟儀表板並列印一個乾淨（未含權杖）的連結。若提示需要驗證，請將 `gateway.auth.token` 中的權杖貼到 Control UI 設定中。稍後要重新開啟：`openclaw dashboard`。

## 給代理程式一個工作區（AGENTS）

OpenClaw 會從其工作區目錄讀取操作指示與「記憶」。

預設情況下，OpenClaw 使用 `~/.openclaw/workspace` 作為代理程式工作區，並會在設定／首次代理程式執行時自動建立（以及起始的 `AGENTS.md`、`SOUL.md`、`TOOLS.md`、`IDENTITY.md`、`USER.md`）。`BOOTSTRAP.md` 只會在工作區是全新時建立（刪除後不應再出現）。

提示：把這個資料夾當作 OpenClaw 的「記憶」，並將其設為 git 儲存庫（理想情況下為私有），以便備份你的 `AGENTS.md` + 記憶檔案。若已安裝 git，全新的工作區會自動初始化。

```bash
openclaw setup
```

完整的工作區配置與備份指南：[Agent workspace](/concepts/agent-workspace)
記憶流程：[Memory](/concepts/memory)

選用：使用 `agents.defaults.workspace` 選擇不同的工作區（支援 `~`）。

```json5
{
  agent: {
    workspace: "~/.openclaw/workspace",
  },
}
```

如果你已從儲存庫發佈自己的工作區檔案，可以完全停用啟動時的檔案建立：

```json5
{
  agent: {
    skipBootstrap: true,
  },
}
```

## 將其變成「助理」的設定

OpenClaw 預設即為良好的助理設定，但你通常會想調整：

- `SOUL.md` 中的人設／指示
- 思考預設（如需要）
- 心跳（在你信任之後）

範例：

```json5
{
  logging: { level: "info" },
  agent: {
    model: "anthropic/claude-opus-4-6",
    workspace: "~/.openclaw/workspace",
    thinkingDefault: "high",
    timeoutSeconds: 1800,
    // Start with 0; enable later.
    heartbeat: { every: "0m" },
  },
  channels: {
    whatsapp: {
      allowFrom: ["+15555550123"],
      groups: {
        "*": { requireMention: true },
      },
    },
  },
  routing: {
    groupChat: {
      mentionPatterns: ["@openclaw", "openclaw"],
    },
  },
  session: {
    scope: "per-sender",
    resetTriggers: ["/new", "/reset"],
    reset: {
      mode: "daily",
      atHour: 4,
      idleMinutes: 10080,
    },
  },
}
```

## 工作階段與記憶

- 工作階段檔案：`~/.openclaw/agents/<agentId>/sessions/{{SessionId}}.jsonl`
- 工作階段中繼資料（權杖用量、最後路由等）：`~/.openclaw/agents/<agentId>/sessions/sessions.json`（舊版：`~/.openclaw/sessions/sessions.json`）
- `/new` 或 `/reset` 會為該聊天啟動新的工作階段（可透過 `resetTriggers` 設定）。若單獨傳送，代理程式會以簡短的問候回覆以確認重置。
- `/compact [instructions]` 會壓縮工作階段內容並回報剩餘的內容預算。

## 心跳（主動模式）

預設情況下，OpenClaw 每 30 分鐘以以下提示執行一次心跳：
`Read HEARTBEAT.md if it exists (workspace context). Follow it strictly. Do not infer or repeat old tasks from prior chats. If nothing needs attention, reply HEARTBEAT_OK.`
設定 `agents.defaults.heartbeat.every: "0m"` 可停用。

- 若 `HEARTBEAT.md` 存在但實質上是空的（只有空白行與像 `# Heading` 這樣的 Markdown 標題），OpenClaw 會跳過心跳以節省 API 呼叫。
- 若檔案不存在，心跳仍會執行，並由模型決定要做什麼。
- 若代理程式回覆 `HEARTBEAT_OK`（可選擇性地加上短填充；見 `agents.defaults.heartbeat.ackMaxChars`），OpenClaw 會抑制該次心跳的對外傳送。
- 心跳會執行完整的代理程式回合 — 較短的間隔會消耗更多權杖。

```json5
{
  agent: {
    heartbeat: { every: "30m" },
  },
}
```

## 媒體進出

可透過樣板將傳入附件（圖片／音訊／文件）提供給你的指令：

- `{{MediaPath}}`（本機暫存檔路徑）
- `{{MediaUrl}}`（偽 URL）
- `{{Transcript}}`（若啟用音訊轉錄）

代理程式的傳出附件：在單獨一行加入 `MEDIA:<path-or-url>`（不可有空白）。範例：

```
Here’s the screenshot.
MEDIA:https://example.com/screenshot.png
```

OpenClaw 會擷取這些並與文字一同以媒體形式傳送。

## 營運檢查清單

```bash
openclaw status          # local status (creds, sessions, queued events)
openclaw status --all    # full diagnosis (read-only, pasteable)
openclaw status --deep   # adds gateway health probes (Telegram + Discord)
openclaw health --json   # gateway health snapshot (WS)
```

日誌位於 `/tmp/openclaw/`（預設：`openclaw-YYYY-MM-DD.log`）。

## 下一步

- WebChat：[WebChat](/web/webchat)
- Gateway 操作：[Gateway runbook](/gateway)
- Cron + 喚醒：[Cron jobs](/automation/cron-jobs)
- macOS 功能表列配套應用程式：[OpenClaw macOS app](/platforms/macos)
- iOS 節點應用程式：[iOS app](/platforms/ios)
- Android 節點應用程式：[Android app](/platforms/android)
- Windows 狀態：[Windows (WSL2)](/platforms/windows)
- Linux 狀態：[Linux app](/platforms/linux)
- 安全性：[Security](/gateway/security)
