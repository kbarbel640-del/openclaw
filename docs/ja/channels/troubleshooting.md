---
summary: "チャンネル別のトラブルシューティング用ショートカット（Discord/Telegram/WhatsApp）"
read_when:
  - チャンネルは接続されるがメッセージが流れない場合
  - チャンネルの誤設定（インテント、権限、プライバシーモード）を調査している場合
title: "チャンネルトラブルシューティング"
x-i18n:
  source_path: channels/troubleshooting.md
  source_hash: 6542ee86b3e50929
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T04:49:36Z
---

# チャンネルトラブルシューティング

次から始めます:

```bash
openclaw doctor
openclaw channels status --probe
```

`channels status --probe` は、一般的なチャンネルの誤設定を検出できる場合に警告を出力し、小規模なライブチェック（認証情報、一部の権限/メンバーシップ）も含みます。

## チャンネル

- Discord: [/channels/discord#troubleshooting](/channels/discord#troubleshooting)
- Telegram: [/channels/telegram#troubleshooting](/channels/telegram#troubleshooting)
- WhatsApp: [/channels/whatsapp#troubleshooting-quick](/channels/whatsapp#troubleshooting-quick)

## Telegram のクイック修正

- ログに `HttpError: Network request for 'sendMessage' failed` または `sendChatAction` が表示される → IPv6 DNS を確認します。`api.telegram.org` が先に IPv6 に解決され、ホストに IPv6 エグレスがない場合は、IPv4 を強制するか IPv6 を有効化します。[/channels/telegram#troubleshooting](/channels/telegram#troubleshooting) を参照してください。
- ログに `setMyCommands failed` が表示される → `api.telegram.org` へのアウトバウンド HTTPS と DNS 到達性を確認します（ロックダウンされた VPS やプロキシで一般的です）。
