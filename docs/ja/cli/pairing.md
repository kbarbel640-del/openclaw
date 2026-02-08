---
summary: "`openclaw pairing` の CLI リファレンス（ペアリングリクエストの承認/一覧表示）"
read_when:
  - ペアリングモードのダイレクトメッセージを使用しており、送信者を承認する必要がある場合
title: "ペアリング"
x-i18n:
  source_path: cli/pairing.md
  source_hash: e0bc9707294463c9
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:00:19Z
---

# `openclaw pairing`

（ペアリングに対応しているチャンネル向けに）ダイレクトメッセージのペアリングリクエストを承認または確認します。

関連:

- ペアリングフロー: [ペアリング](/start/pairing)

## コマンド

```bash
openclaw pairing list whatsapp
openclaw pairing approve whatsapp <code> --notify
```
