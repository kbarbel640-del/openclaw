---
summary: "ウェイクおよび分離されたエージェント実行のための Webhook イングレス"
read_when:
  - Webhook エンドポイントを追加または変更する場合
  - 外部システムを OpenClaw に接続する場合
title: "Webhook"
x-i18n:
  source_path: automation/webhook.md
  source_hash: f26b88864567be82
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T04:42:10Z
---

# Webhook

Gateway（ゲートウェイ）は、外部トリガーのための小さな HTTP Webhook エンドポイントを公開できます。

## 有効化

```json5
{
  hooks: {
    enabled: true,
    token: "shared-secret",
    path: "/hooks",
  },
}
```

注記:

- `hooks.token` は、`hooks.enabled=true` の場合に必須です。
- `hooks.path` のデフォルトは `/hooks` です。

## 認証

すべてのリクエストにはフックトークンを含める必要があります。ヘッダーを推奨します:

- `Authorization: Bearer <token>`（推奨）
- `x-openclaw-token: <token>`
- `?token=<token>`（非推奨。警告をログに出力し、将来のメジャーリリースで削除されます）

## エンドポイント

### `POST /hooks/wake`

ペイロード:

```json
{ "text": "System line", "mode": "now" }
```

- `text` **必須**（string）: イベントの説明（例: 「New email received」）。
- `mode` 任意（`now` | `next-heartbeat`）: 即時ハートビートをトリガーするか（デフォルト `now`）、次の定期チェックまで待つか。

効果:

- **メイン** セッション向けにシステムイベントをキューに追加します
- `mode=now` の場合、即時ハートビートをトリガーします

### `POST /hooks/agent`

ペイロード:

```json
{
  "message": "Run this",
  "name": "Email",
  "sessionKey": "hook:email:msg-123",
  "wakeMode": "now",
  "deliver": true,
  "channel": "last",
  "to": "+15551234567",
  "model": "openai/gpt-5.2-mini",
  "thinking": "low",
  "timeoutSeconds": 120
}
```

- `message` **必須**（string）: エージェントが処理するためのプロンプトまたはメッセージ。
- `name` 任意（string）: フックの人間可読な名前（例: 「GitHub」）。セッション要約で接頭辞として使用されます。
- `sessionKey` 任意（string）: エージェントのセッションを識別するためのキー。デフォルトはランダムな `hook:<uuid>` です。一貫したキーを使用すると、フックコンテキスト内でのマルチターン会話が可能になります。
- `wakeMode` 任意（`now` | `next-heartbeat`）: 即時ハートビートをトリガーするか（デフォルト `now`）、次の定期チェックまで待つか。
- `deliver` 任意（boolean）: `true` の場合、エージェントの応答はメッセージングチャンネルに送信されます。デフォルトは `true` です。ハートビートの確認応答のみである応答は自動的にスキップされます。
- `channel` 任意（string）: 配信先のメッセージングチャンネル。次のいずれか: `last`、`whatsapp`、`telegram`、`discord`、`slack`、`mattermost`（plugin）、`signal`、`imessage`、`msteams`。デフォルトは `last` です。
- `to` 任意（string）: チャンネルの受信者識別子（例: WhatsApp/Signal の電話番号、Telegram の chat ID、Discord/Slack/Mattermost（plugin）の channel ID、MS Teams の conversation ID）。デフォルトはメインセッションの最後の受信者です。
- `model` 任意（string）: モデルの上書き（例: `anthropic/claude-3-5-sonnet` またはエイリアス）。制限されている場合は、許可されたモデルリストに含まれている必要があります。
- `thinking` 任意（string）: 思考レベルの上書き（例: `low`、`medium`、`high`）。
- `timeoutSeconds` 任意（number）: エージェント実行の最大継続時間（秒）。

効果:

- **分離された** エージェントターンを実行します（独自のセッションキー）
- 常に **メイン** セッションに要約を投稿します
- `wakeMode=now` の場合、即時ハートビートをトリガーします

### `POST /hooks/<name>`（マッピング）

カスタムフック名は `hooks.mappings`（設定を参照）により解決されます。マッピングにより、任意のペイロードを `wake` または `agent` のアクションに変換でき、任意でテンプレートやコード変換を適用できます。

マッピングオプション（要約）:

- `hooks.presets: ["gmail"]` は、組み込みの Gmail マッピングを有効化します。
- `hooks.mappings` では、設定で `match`、`action`、およびテンプレートを定義できます。
- `hooks.transformsDir` + `transform.module` は、カスタムロジックのために JS/TS モジュールを読み込みます。
- `match.source` を使用して、汎用インジェストエンドポイント（ペイロード駆動ルーティング）を維持します。
- TS 変換には TS ローダー（例: `bun` または `tsx`）または実行時の事前コンパイル済み `.js` が必要です。
- マッピングに `deliver: true` + `channel`/`to` を設定して、返信をチャットサーフェスへルーティングします
  （`channel` のデフォルトは `last` で、WhatsApp へフォールバックします）。
- `allowUnsafeExternalContent: true` は、そのフックの外部コンテンツ安全ラッパーを無効化します
  （危険です。信頼できる内部ソースにのみ使用してください）。
- `openclaw webhooks gmail setup` は、`openclaw webhooks gmail run` のために `hooks.gmail` 設定を書き込みます。
  Gmail の監視フローの全体については、[Gmail Pub/Sub](/automation/gmail-pubsub) を参照してください。

## レスポンス

- `/hooks/wake` には `200`
- `/hooks/agent` には `202`（非同期実行を開始）
- 認証失敗時は `401`
- 無効なペイロード時は `400`
- 過大なペイロード時は `413`

## 例

```bash
curl -X POST http://127.0.0.1:18789/hooks/wake \
  -H 'Authorization: Bearer SECRET' \
  -H 'Content-Type: application/json' \
  -d '{"text":"New email received","mode":"now"}'
```

```bash
curl -X POST http://127.0.0.1:18789/hooks/agent \
  -H 'x-openclaw-token: SECRET' \
  -H 'Content-Type: application/json' \
  -d '{"message":"Summarize inbox","name":"Email","wakeMode":"next-heartbeat"}'
```

### 別のモデルを使用する

エージェントペイロード（またはマッピング）に `model` を追加して、その実行のモデルを上書きします:

```bash
curl -X POST http://127.0.0.1:18789/hooks/agent \
  -H 'x-openclaw-token: SECRET' \
  -H 'Content-Type: application/json' \
  -d '{"message":"Summarize inbox","name":"Email","model":"openai/gpt-5.2-mini"}'
```

`agents.defaults.models` を強制している場合は、上書きモデルがそこに含まれていることを確認してください。

```bash
curl -X POST http://127.0.0.1:18789/hooks/gmail \
  -H 'Authorization: Bearer SECRET' \
  -H 'Content-Type: application/json' \
  -d '{"source":"gmail","messages":[{"from":"Ada","subject":"Hello","snippet":"Hi"}]}'
```

## セキュリティ

- フックエンドポイントは loopback、tailnet、または信頼できるリバースプロキシの背後に置いてください。
- 専用のフックトークンを使用し、gateway の認証トークンを再利用しないでください。
- Webhook ログに機密性の高い生のペイロードを含めないでください。
- フックペイロードは信頼できないものとして扱われ、デフォルトで安全境界によりラップされます。
  特定のフックでこれを無効化する必要がある場合は、そのフックのマッピングで `allowUnsafeExternalContent: true`
  を設定してください（危険です）。
