---
summary: "頻道連線狀況的健康檢查步驟"
read_when:
  - 診斷 WhatsApp 頻道健康狀態
title: "健康檢查"
x-i18n:
  source_path: gateway/health.md
  source_hash: 74f242e98244c135
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:53:23Z
---

# 健康檢查（CLI）

在不靠猜測的情況下驗證頻道連線的簡短指南。

## 快速檢查

- `openclaw status` — 本機摘要：Gateway 閘道器 可達性／模式、更新提示、已連結頻道的驗證年齡、工作階段 + 近期活動。
- `openclaw status --all` — 完整的本機診斷（唯讀、彩色、可安全貼上以供除錯）。
- `openclaw status --deep` — 也會探測正在執行的 Gateway 閘道器（在支援時進行各頻道探測）。
- `openclaw health --json` — 向正在執行的 Gateway 閘道器 請求完整健康快照（僅 WS；不直接連線 Baileys socket）。
- 在 WhatsApp／WebChat 中以獨立訊息傳送 `/status`，即可取得狀態回覆而不啟用代理程式。
- 記錄：tail `/tmp/openclaw/openclaw-*.log`，並以 `web-heartbeat`、`web-reconnect`、`web-auto-reply`、`web-inbound` 進行篩選。

## 深度診斷

- 磁碟上的憑證：`ls -l ~/.openclaw/credentials/whatsapp/<accountId>/creds.json`（mtime 應為近期）。
- 工作階段儲存區：`ls -l ~/.openclaw/agents/<agentId>/sessions/sessions.json`（路徑可在設定中覆寫）。數量與近期收件者會透過 `status` 顯示。
- 重新連結流程：當記錄中出現狀態碼 409–515 或 `loggedOut` 時，使用 `openclaw channels logout && openclaw channels login --verbose`。（注意：在配對後，狀態 515 的 QR 登入流程會自動重啟一次。）

## 當發生失敗時

- `logged out` 或狀態 409–515 → 先用 `openclaw channels logout` 重新連結，接著執行 `openclaw channels login`。
- Gateway 閘道器 無法連線 → 啟動它：`openclaw gateway --port 18789`（若連接埠被佔用，使用 `--force`）。
- 沒有入站訊息 → 確認已連結的手機在線，且傳送者被允許（`channels.whatsapp.allowFrom`）；對於群組聊天，確保允許清單 + 提及規則相符（`channels.whatsapp.groups`、`agents.list[].groupChat.mentionPatterns`）。

## 專用「health」指令

`openclaw health --json` 會向正在執行的 Gateway 閘道器 請求其健康快照（CLI 不會直接連線頻道 socket）。在可用時，它會回報已連結的憑證／驗證年齡、各頻道探測摘要、工作階段儲存區摘要，以及探測耗時。若 Gateway 閘道器 無法連線或探測失敗／逾時，則以非零狀態碼結束。使用 `--timeout <ms>` 可覆寫預設的 10 秒。
