---
summary: "OpenClaw が接続できるメッセージングプラットフォーム"
read_when:
  - OpenClaw 用のチャットチャンネルを選びたい場合
  - サポートされているメッセージングプラットフォームの概要を素早く把握する必要がある場合
title: "チャットチャンネル"
x-i18n:
  source_path: channels/index.md
  source_hash: 5269db02b77b1dc3
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T04:45:31Z
---

# チャットチャンネル

OpenClaw は、すでにお使いのどのチャットアプリでもあなたと会話できます。各チャンネルは Gateway（ゲートウェイ）経由で接続します。
テキストはどこでもサポートされていますが、メディアとリアクションはチャンネルによって異なります。

## サポートされているチャンネル

- [WhatsApp](/channels/whatsapp) — 最も人気があります。Baileys を使用し、QR ペアリングが必要です。
- [Telegram](/channels/telegram) — grammY 経由の Bot API。グループをサポートします。
- [Discord](/channels/discord) — Discord Bot API + Gateway（ゲートウェイ）。サーバー、チャンネル、ダイレクトメッセージをサポートします。
- [Slack](/channels/slack) — Bolt SDK。ワークスペースアプリです。
- [Feishu](/channels/feishu) — WebSocket 経由の Feishu/Lark ボット（プラグイン、別途インストール）。
- [Google Chat](/channels/googlechat) — HTTP webhook 経由の Google Chat API アプリです。
- [Mattermost](/channels/mattermost) — Bot API + WebSocket。チャンネル、グループ、ダイレクトメッセージ（プラグイン、別途インストール）。
- [Signal](/channels/signal) — signal-cli。プライバシー重視です。
- [BlueBubbles](/channels/bluebubbles) — **iMessage に推奨**。機能をフルサポートする BlueBubbles macOS サーバー REST API を使用します（編集、送信取り消し、エフェクト、リアクション、グループ管理 — 編集は現在 macOS 26 Tahoe で不具合があります）。
- [iMessage (legacy)](/channels/imessage) — imsg CLI 経由のレガシー macOS 統合（非推奨。新規セットアップでは BlueBubbles を使用してください）。
- [Microsoft Teams](/channels/msteams) — Bot Framework。エンタープライズ対応（プラグイン、別途インストール）。
- [LINE](/channels/line) — LINE Messaging API ボット（プラグイン、別途インストール）。
- [Nextcloud Talk](/channels/nextcloud-talk) — Nextcloud Talk によるセルフホストチャット（プラグイン、別途インストール）。
- [Matrix](/channels/matrix) — Matrix プロトコル（プラグイン、別途インストール）。
- [Nostr](/channels/nostr) — NIP-04 による分散型ダイレクトメッセージ（プラグイン、別途インストール）。
- [Tlon](/channels/tlon) — Urbit ベースのメッセンジャー（プラグイン、別途インストール）。
- [Twitch](/channels/twitch) — IRC 接続による Twitch チャット（プラグイン、別途インストール）。
- [Zalo](/channels/zalo) — Zalo Bot API。ベトナムで人気のメッセンジャー（プラグイン、別途インストール）。
- [Zalo Personal](/channels/zalouser) — QR ログインによる Zalo 個人アカウント（プラグイン、別途インストール）。
- [WebChat](/web/webchat) — WebSocket 上の Gateway（ゲートウェイ）WebChat UI。

## 注記

- チャンネルは同時に実行できます。複数を設定すると、OpenClaw がチャットごとにルーティングします。
- 最も素早くセットアップできるのは通常 **Telegram** です（シンプルなボットトークン）。WhatsApp は QR ペアリングが必要で、より多くの状態をディスクに保存します。
- グループの挙動はチャンネルによって異なります。[Groups](/concepts/groups) を参照してください。
- 安全のため、ダイレクトメッセージのペアリングと許可リストが適用されます。[Security](/gateway/security) を参照してください。
- Telegram の内部仕様: [grammY notes](/channels/grammy)。
- トラブルシューティング: [Channel troubleshooting](/channels/troubleshooting)。
- モデルプロバイダーは別途ドキュメント化されています。[Model Providers](/providers/models) を参照してください。
