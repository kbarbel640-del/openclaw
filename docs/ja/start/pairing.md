---
summary: "ペアリングの概要: 誰があなたにダイレクトメッセージできるか + どのノードが参加できるかを承認します"
read_when:
  - ダイレクトメッセージのアクセス制御を設定する場合
  - 新しい iOS/Android ノードをペアリングする場合
  - OpenClaw のセキュリティ態勢を見直す場合
title: "ペアリング"
x-i18n:
  source_path: start/pairing.md
  source_hash: 5a0539932f905536
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:10:55Z
---

# ペアリング

「ペアリング」とは、OpenClaw における明示的な **オーナー承認** ステップです。
これは次の 2 か所で使用されます:

1. **ダイレクトメッセージのペアリング**（ボットと会話できるユーザー）
2. **ノードのペアリング**（Gateway（ゲートウェイ）ネットワークに参加できるデバイス/ノード）

セキュリティの背景: [Security](/gateway/security)

## 1) ダイレクトメッセージのペアリング（受信チャットアクセス）

チャンネルがダイレクトメッセージポリシー `pairing` で設定されている場合、未確認の送信者には短いコードが付与され、あなたが承認するまでメッセージは **処理されません**。

デフォルトのダイレクトメッセージポリシーは次に記載されています: [Security](/gateway/security)

ペアリングコード:

- 8 文字、英大文字、紛らわしい文字なし（`0O1I`）。
- **1 時間後に失効**。ボットは新しいリクエストが作成されたときにのみペアリングメッセージを送信します（送信者ごとに概ね 1 時間に 1 回）。
- 保留中のダイレクトメッセージのペアリングリクエストは、デフォルトで **チャンネルあたり 3 件** に制限されます。追加のリクエストは、いずれかが失効するか承認されるまで無視されます。

### 送信者を承認する

```bash
openclaw pairing list telegram
openclaw pairing approve telegram <CODE>
```

対応チャンネル: `telegram`、`whatsapp`、`signal`、`imessage`、`discord`、`slack`。

### 状態の保存場所

`~/.openclaw/credentials/` の下に保存されます:

- 保留中のリクエスト: `<channel>-pairing.json`
- 承認済み許可リストのストア: `<channel>-allowFrom.json`

これらは機密として扱ってください（アシスタントへのアクセスを制御します）。

## 2) ノードデバイスのペアリング（iOS/Android/macOS/headless ノード）

ノードは `role: node` を持つ **デバイス** として Gateway（ゲートウェイ）に接続します。Gateway（ゲートウェイ）は承認が必要なデバイスペアリングリクエストを作成します。

### ノードデバイスを承認する

```bash
openclaw devices list
openclaw devices approve <requestId>
openclaw devices reject <requestId>
```

### 状態の保存場所

`~/.openclaw/devices/` の下に保存されます:

- `pending.json`（短命。保留中のリクエストは失効します）
- `paired.json`（ペアリング済みデバイス + トークン）

### 注記

- レガシーな `node.pair.*` API（CLI: `openclaw nodes pending/approve`）は、Gateway（ゲートウェイ）所有の別のペアリングストアです。WS ノードでは引き続きデバイスペアリングが必要です。

## 関連ドキュメント

- セキュリティモデル + プロンプトインジェクション: [Security](/gateway/security)
- 安全に更新する（doctor を実行）: [Updating](/install/updating)
- チャンネル設定:
  - Telegram: [Telegram](/channels/telegram)
  - WhatsApp: [WhatsApp](/channels/whatsapp)
  - Signal: [Signal](/channels/signal)
  - BlueBubbles（iMessage）: [BlueBubbles](/channels/bluebubbles)
  - iMessage（レガシー）: [iMessage](/channels/imessage)
  - Discord: [Discord](/channels/discord)
  - Slack: [Slack](/channels/slack)
