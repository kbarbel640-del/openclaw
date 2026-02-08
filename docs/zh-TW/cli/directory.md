---
summary: "「openclaw directory」的 CLI 參考（self、peers、groups）"
read_when:
  - "你想查找某個頻道的聯絡人／群組／自身 ID"
  - "你正在開發頻道目錄配接器"
title: "directory"
x-i18n:
  source_path: cli/directory.md
  source_hash: 7c878d9013aeaa22
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:52:34Z
---

# `openclaw directory`

支援的頻道目錄查詢（聯絡人／peers、群組，以及「我」）。

## 常用旗標

- `--channel <name>`：頻道 ID／別名（當設定了多個頻道時為必填；僅設定一個時會自動選擇）
- `--account <id>`：帳戶 ID（預設：頻道預設）
- `--json`：輸出 JSON

## 注意事項

- `directory` 的目的在於協助你找到可貼入其他指令的 ID（特別是 `openclaw message send --target ...`）。
- 對於許多頻道，結果來自設定（允許清單／已設定的群組），而非即時的提供者目錄。
- 預設輸出為以定位字元分隔的 `id`（有時也包含 `name`）；用於腳本時請使用 `--json`。

## 將結果用於 `message send`

```bash
openclaw directory peers list --channel slack --query "U0"
openclaw message send --channel slack --target user:U012ABCDEF --message "hello"
```

## ID 格式（依頻道）

- WhatsApp：`+15551234567`（私訊），`1234567890-1234567890@g.us`（群組）
- Telegram：`@username` 或數字聊天 ID；群組為數字 ID
- Slack：`user:U…` 與 `channel:C…`
- Discord：`user:<id>` 與 `channel:<id>`
- Matrix（外掛）：`user:@user:server`、`room:!roomId:server` 或 `#alias:server`
- Microsoft Teams（外掛）：`user:<id>` 與 `conversation:<id>`
- Zalo（外掛）：使用者 ID（Bot API）
- Zalo Personal／`zalouser`（外掛）：來自 `zca` 的執行緒 ID（私訊／群組）（`me`、`friend list`、`group list`）

## 自身（「我」）

```bash
openclaw directory self --channel zalouser
```

## Peers（聯絡人／使用者）

```bash
openclaw directory peers list --channel zalouser
openclaw directory peers list --channel zalouser --query "name"
openclaw directory peers list --channel zalouser --limit 50
```

## 群組

```bash
openclaw directory groups list --channel zalouser
openclaw directory groups list --channel zalouser --query "work"
openclaw directory groups members --channel zalouser --group-id <id>
```
