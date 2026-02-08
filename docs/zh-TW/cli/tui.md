---
summary: "連線至 Gateway 閘道器 的終端機 UI 的 CLI 參考文件（`openclaw tui`）"
read_when:
  - "你想要為 Gateway 閘道器 使用終端機 UI（適合遠端）"
  - "你想要從腳本傳遞 url／token／session"
title: "tui"
x-i18n:
  source_path: cli/tui.md
  source_hash: f0a97d92e08746a9
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:52:46Z
---

# `openclaw tui`

開啟連線至 Gateway 閘道器 的終端機 UI。

相關：

- TUI 指南：[TUI](/tui)

## 範例

```bash
openclaw tui
openclaw tui --url ws://127.0.0.1:18789 --token <token>
openclaw tui --session main --deliver
```
