---
summary: "ペアリングの概要：誰がダイレクトメッセージを送れるか＋どのノードが参加できるかを承認"
read_when:
  - ダイレクトメッセージのアクセス制御を設定する場合
  - 新しい iOS/Android ノードをペアリングする場合
  - OpenClaw のセキュリティ体制を確認する場合
title: "ペアリング"
x-i18n:
  source_path: channels/pairing.md
  source_hash: cc6ce9c71db6d96d
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:14:45Z
---

# ペアリング

「ペアリング」は、OpenClaw における明示的な **オーナー承認** のステップです。
次の 2 つの場面で使用されます。

1. **ダイレクトメッセージのペアリング**（ボットと会話できる相手）
2. **ノードのペアリング**（ゲートウェイ ネットワークに参加できるデバイス／ノード）

セキュリティの文脈： [Security](/gateway/security)

## 1) ダイレクトメッセージのペアリング（受信チャットのアクセス）

チャンネルが DM ポリシー `pairing` で設定されている場合、未知の送信者には短いコードが発行され、あなたが承認するまでそのメッセージは **処理されません**。

デフォルトの DM ポリシーについては、次を参照してください： [Security](/gateway/security)

ペアリングコード：

- 8 文字、英大文字、紛らわしい文字は含まれません（`0O1I`）。
- **1 時間後に失効**します。ボットは新しいリクエストが作成されたときにのみペアリングメッセージを送信します（送信者ごとにおおよそ 1 時間に 1 回）。
- 保留中のダイレクトメッセージ ペアリング リクエストは、デフォルトで **チャンネルあたり 3 件** に制限されています。いずれかが失効または承認されるまで、追加のリクエストは無視されます。

### 送信者を承認する

```bash
openclaw pairing list telegram
openclaw pairing approve telegram <CODE>
```

対応チャンネル： `telegram`、`whatsapp`、`signal`、`imessage`、`discord`、`slack`。

### 状態の保存場所

`~/.openclaw/credentials/` 配下に保存されます。

- 保留中のリクエスト： `<channel>-pairing.json`
- 承認済みの許可リスト ストア： `<channel>-allowFrom.json`

これらは機密として扱ってください（アシスタントへのアクセスを制御します）。

## 2) ノード デバイスのペアリング（iOS/Android/macOS/ヘッドレス ノード）

ノードは `role: node` を用いた **デバイス** として Gateway（ゲートウェイ）に接続します。Gateway（ゲートウェイ）はデバイス ペアリング リクエストを作成し、承認が必要です。

### ノード デバイスを承認する

```bash
openclaw devices list
openclaw devices approve <requestId>
openclaw devices reject <requestId>
```

### ノード ペアリング状態の保存

`~/.openclaw/devices/` 配下に保存されます。

- `pending.json`（短期間有効；保留中のリクエストは失効します）
- `paired.json`（ペアリング済みデバイス＋トークン）

### 注記

- レガシーの `node.pair.*` API（CLI： `openclaw nodes pending/approve`）は、
  ゲートウェイ所有の別個のペアリング ストアです。WS ノードは引き続きデバイス ペアリングが必要です。

## 関連ドキュメント

- セキュリティ モデル＋プロンプト インジェクション： [Security](/gateway/security)
- 安全な更新（doctor の実行）： [Updating](/install/updating)
- チャンネル設定：
  - Telegram： [Telegram](/channels/telegram)
  - WhatsApp： [WhatsApp](/channels/whatsapp)
  - Signal： [Signal](/channels/signal)
  - BlueBubbles（iMessage）： [BlueBubbles](/channels/bluebubbles)
  - iMessage（レガシー）： [iMessage](/channels/imessage)
  - Discord： [Discord](/channels/discord)
  - Slack： [Slack](/channels/slack)
