---
summary: "Gateway（ゲートウェイ）に接続する `openclaw tui`（ターミナル UI）の CLI リファレンスです"
read_when:
  - Gateway（ゲートウェイ）向けのターミナル UI（リモート対応）が必要な場合
  - スクリプトから url/token/session を渡したい場合
title: "tui"
x-i18n:
  source_path: cli/tui.md
  source_hash: f0a97d92e08746a9
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T04:59:20Z
---

# `openclaw tui`

Gateway（ゲートウェイ）に接続されたターミナル UI を開きます。

関連:

- TUI ガイド: [TUI](/tui)

## 例

```bash
openclaw tui
openclaw tui --url ws://127.0.0.1:18789 --token <token>
openclaw tui --session main --deliver
```
