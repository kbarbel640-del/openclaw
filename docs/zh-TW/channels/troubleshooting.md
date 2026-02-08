---
summary: 「各頻道專屬的疑難排解捷徑（Discord／Telegram／WhatsApp）」
read_when:
  - 頻道已連線但訊息未流動
  - 調查頻道設定錯誤（intents、權限、隱私模式）
title: 「頻道疑難排解」
x-i18n:
  source_path: channels/troubleshooting.md
  source_hash: 6542ee86b3e50929
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:52:14Z
---

# 頻道疑難排解

從以下開始：

```bash
openclaw doctor
openclaw channels status --probe
```

`channels status --probe` 會在能夠偵測到常見的頻道設定錯誤時輸出警告，並包含一些即時檢查（憑證、部分權限／成員資格）。

## 頻道

- Discord：[/channels/discord#troubleshooting](/channels/discord#troubleshooting)
- Telegram：[/channels/telegram#troubleshooting](/channels/telegram#troubleshooting)
- WhatsApp：[/channels/whatsapp#troubleshooting-quick](/channels/whatsapp#troubleshooting-quick)

## Telegram 快速修復

- 日誌顯示 `HttpError: Network request for 'sendMessage' failed` 或 `sendChatAction` → 檢查 IPv6 DNS。若 `api.telegram.org` 優先解析為 IPv6，且主機缺乏 IPv6 對外連線能力，請強制使用 IPv4 或啟用 IPv6。請參閱 [/channels/telegram#troubleshooting](/channels/telegram#troubleshooting)。
- 日誌顯示 `setMyCommands failed` → 檢查對 `api.telegram.org` 的對外 HTTPS 與 DNS 連線可達性（在受限制的 VPS 或代理上很常見）。
