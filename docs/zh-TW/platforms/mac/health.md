---
summary: "macOS 應用程式如何回報 gateway/Baileys 的健康狀態"
read_when:
  - 偵錯 macOS 應用程式健康指示器
title: "健康檢查"
x-i18n:
  source_path: platforms/mac/health.md
  source_hash: 0560e96501ddf53a
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:54:05Z
---

# macOS 上的健康檢查

如何從功能表列應用程式查看已連結頻道是否健康。

## 功能表列

- 狀態圓點現在反映 Baileys 的健康狀態：
  - 綠色：已連結 + 最近已開啟 socket。
  - 橘色：連線中／重試中。
  - 紅色：已登出或探測失敗。
- 次要文字行顯示「linked · auth 12m」或顯示失敗原因。
- 「Run Health Check」功能表項目會觸發隨選探測。

## 設定

- 一般分頁新增「健康」卡片，顯示：已連結的驗證年齡、工作階段儲存路徑／數量、最後檢查時間、最後錯誤／狀態碼，以及「Run Health Check」／「Reveal Logs」按鈕。
- 使用快取的快照，讓 UI 即時載入，並在離線時優雅回退。
- **頻道分頁** 顯示 WhatsApp／Telegram 的頻道狀態與控制項（登入 QR、登出、探測、最後一次中斷連線／錯誤）。

## 探測的運作方式

- 應用程式每約 60 秒以及隨選時，透過 `ShellExecutor` 執行 `openclaw health --json`。探測會載入憑證並回報狀態，但不會傳送訊息。
- 分別快取最後一次良好的快照與最後一次錯誤以避免閃爍；顯示各自的時間戳記。

## 不確定時

- 你仍可使用 [Gateway health](/gateway/health) 中的 CLI 流程（`openclaw status`、`openclaw status --deep`、`openclaw health --json`），並 tail `/tmp/openclaw/openclaw-*.log` 以查看 `web-heartbeat`／`web-reconnect`。
