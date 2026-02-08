---
summary: "CLI リファレンス：`openclaw reset`（ローカルの状態/設定をリセット）"
read_when:
  - CLI をインストールしたままローカルの状態を消去したい場合
  - 削除される内容のドライランを行いたい場合
title: "reset"
x-i18n:
  source_path: cli/reset.md
  source_hash: 08afed5830f892e0
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T04:57:39Z
---

# `openclaw reset`

ローカルの設定/状態をリセットします（CLI はインストールされたままです）。

```bash
openclaw reset
openclaw reset --dry-run
openclaw reset --scope config+creds+sessions --yes --non-interactive
```
