---
summary: "`openclaw voicecall` の CLI リファレンス（voice-call プラグインのコマンドサーフェス）"
read_when:
  - voice-call プラグインを使用していて、CLI のエントリポイントが必要な場合
  - `voicecall call|continue|status|tail|expose` の簡単な例が欲しい場合
title: "voicecall"
x-i18n:
  source_path: cli/voicecall.md
  source_hash: d93aaee6f6f5c9ac
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:00:11Z
---

# `openclaw voicecall`

`voicecall` はプラグインが提供するコマンドです。voice-call プラグインがインストールされ、有効になっている場合にのみ表示されます。

主要ドキュメント:

- Voice-call プラグイン: [Voice Call](/plugins/voice-call)

## 共通コマンド

```bash
openclaw voicecall status --call-id <id>
openclaw voicecall call --to "+15555550123" --message "Hello" --mode notify
openclaw voicecall continue --call-id <id> --message "Any questions?"
openclaw voicecall end --call-id <id>
```

## Webhook の公開（Tailscale）

```bash
openclaw voicecall expose --mode serve
openclaw voicecall expose --mode funnel
openclaw voicecall unexpose
```

セキュリティ注記: webhook エンドポイントは信頼できるネットワークにのみ公開してください。可能であれば Funnel よりも Tailscale Serve を優先してください。
