---
summary: "「openclaw logs」的 CLI 參考（透過 RPC 追蹤 Gateway 閘道器 日誌）"
read_when:
  - 你需要在不使用 SSH 的情況下，遠端追蹤 Gateway 閘道器 日誌
  - 你想要用於工具處理的 JSON 日誌行
title: "logs"
x-i18n:
  source_path: cli/logs.md
  source_hash: 911a57f0f3b78412
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:52:43Z
---

# `openclaw logs`

透過 RPC 追蹤 Gateway 閘道器 的檔案日誌（可在遠端模式運作）。

相關內容：

- 記錄概覽：[Logging](/logging)

## 範例

```bash
openclaw logs
openclaw logs --follow
openclaw logs --json
openclaw logs --limit 500
```
